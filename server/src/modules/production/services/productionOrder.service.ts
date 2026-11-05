import { Types } from 'mongoose';
import { ProductionOrder, IProductionOrder, ProductionOrderStatus, ProductionPriority } from '../models/productionOrder.model';
import { BOM } from '../models/bom.model';
import { Item } from '../../../models/item.model';
import { documentNumberService } from '../../../services/documentNumber.service';
import { productionPlanningService } from './productionPlanning.service';
import { productionMaterialService } from './productionMaterial.service';
import { auditRepository } from '../../../repositories/audit.repository';
import { AuditAction, AuditEntity } from '../../../config/constants';
import { BadRequestError, NotFoundError } from '../../../core/errors';

export interface CreateProductionOrderInput {
  productionItemId: string | Types.ObjectId;
  bomId: string | Types.ObjectId;
  plannedQuantity: number;
  warehouseId: string | Types.ObjectId;
  productionLocation?: string;
  plannedStartDate?: string | Date;
  plannedEndDate?: string | Date;
  priority?: ProductionPriority;
  notes?: string;
}

export interface UpdateProductionOrderInput extends Partial<CreateProductionOrderInput> {}

export class ProductionOrderService {
  async getProductionOrders(
    tenantId: string | Types.ObjectId,
    query: {
      page?: number;
      limit?: number;
      status?: ProductionOrderStatus;
      warehouseId?: string;
      priority?: ProductionPriority;
      search?: string;
    } = {}
  ): Promise<{ data: IProductionOrder[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: any = { tenantId: new Types.ObjectId(tenantId) };
    if (query.status) filter.status = query.status;
    if (query.warehouseId) filter.warehouseId = new Types.ObjectId(query.warehouseId);
    if (query.priority) filter.priority = query.priority;
    if (query.search) {
      filter.$or = [
        { productionOrderNumber: { $regex: query.search.trim(), $options: 'i' } },
        { batchNumber: { $regex: query.search.trim(), $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      ProductionOrder.find(filter)
        .populate('productionItemId', 'sku name itemCode standardCost baseUomId')
        .populate('uomId', 'code name')
        .populate('warehouseId', 'name code')
        .populate('bomId', 'bomNumber name version')
        .populate('materials.itemId', 'sku name itemCode standardCost')
        .populate('materials.uomId', 'code name')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      ProductionOrder.countDocuments(filter).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getProductionOrderById(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IProductionOrder> {
    const po = await ProductionOrder.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    })
      .populate('productionItemId', 'sku name itemCode standardCost baseUomId')
      .populate('uomId', 'code name')
      .populate('warehouseId', 'name code')
      .populate('bomId', 'bomNumber name version components')
      .populate('materials.itemId', 'sku name itemCode standardCost')
      .populate('materials.uomId', 'code name')
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('releasedBy', 'name email')
      .populate('startedBy', 'name email')
      .populate('completedBy', 'name email')
      .exec();

    if (!po) throw new NotFoundError('Production Order not found');
    return po;
  }

  async createProductionOrder(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    input: CreateProductionOrderInput
  ): Promise<IProductionOrder> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);
    const itmId = new Types.ObjectId(input.productionItemId);
    const bId = new Types.ObjectId(input.bomId);
    const whId = new Types.ObjectId(input.warehouseId);

    // 1. Verify Item & BOM
    const [item, bom] = await Promise.all([
      Item.findOne({ _id: itmId, tenantId: tId }).exec(),
      BOM.findOne({ _id: bId, tenantId: tId }).exec(),
    ]);

    if (!item) throw new NotFoundError('Manufactured item not found');
    if (!bom) throw new NotFoundError('Bill of Materials not found');

    if (bom.status === 'ARCHIVED') {
      throw new BadRequestError(`Cannot use BOM in 'ARCHIVED' status for production order`);
    }
    if (bom.status === 'DRAFT' || bom.status === 'UNDER_REVIEW') {
      bom.status = 'ACTIVE';
      bom.effectiveFrom = bom.effectiveFrom || new Date();
      await bom.save();
    }

    // 2. Calculate initial material requirements using Planning Service
    const plan = await productionPlanningService.calculateMaterialRequirements(
      tId,
      bId,
      input.plannedQuantity,
      whId
    );

    const productionOrderNumber = await documentNumberService.getNextNumber(tId, 'PRODUCTION_ORDER');

    const po = await ProductionOrder.create({
      tenantId: tId,
      productionOrderNumber,
      productionItemId: itmId,
      bomId: bId,
      bomVersion: bom.version,
      plannedQuantity: input.plannedQuantity,
      uomId: item.baseUomId,
      warehouseId: whId,
      productionLocation: input.productionLocation || 'Assembly Line 1',
      plannedStartDate: input.plannedStartDate ? new Date(input.plannedStartDate) : new Date(),
      plannedEndDate: input.plannedEndDate ? new Date(input.plannedEndDate) : undefined,
      priority: input.priority || 'MEDIUM',
      status: 'PLANNED',
      plannedMaterialCost: plan.totalEstimatedMaterialCost,
      actualMaterialCost: 0,
      yieldQuantity: 0,
      scrapQuantity: 0,
      rejectedQuantity: 0,
      notes: input.notes?.trim(),
      materials: plan.components.map((c) => ({
        itemId: c.itemId,
        plannedQuantity: c.grossRequiredQuantity,
        reservedQuantity: 0,
        issuedQuantity: 0,
        actualConsumedQuantity: 0,
        returnedQuantity: 0,
        scrapQuantity: 0,
        uomId: c.uomId,
        unitCost: c.unitCost,
        operationCode: c.operationCode,
      })),
      createdBy: uId,
    });

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.CREATE,
      entity: AuditEntity.PRODUCTION,
      entityId: po._id.toString(),
      details: `Created Production Order ${po.productionOrderNumber} for ${po.plannedQuantity} ${item.name}`,
    });

    return this.getProductionOrderById(tId, po._id);
  }

  async updateProductionOrder(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    input: UpdateProductionOrderInput
  ): Promise<IProductionOrder> {
    const tId = new Types.ObjectId(tenantId);
    const po = await this.getProductionOrderById(tId, id);

    if (po.status !== 'DRAFT' && po.status !== 'PLANNED') {
      throw new BadRequestError(`Cannot edit Production Order in '${po.status}' status`);
    }

    if (input.plannedQuantity && input.plannedQuantity !== po.plannedQuantity) {
      po.plannedQuantity = input.plannedQuantity;
      // Recalculate material requirements
      const plan = await productionPlanningService.calculateMaterialRequirements(
        tId,
        po.bomId._id || po.bomId,
        input.plannedQuantity,
        po.warehouseId._id || po.warehouseId
      );
      po.plannedMaterialCost = plan.totalEstimatedMaterialCost;
      po.materials = plan.components.map((c) => ({
        itemId: c.itemId,
        plannedQuantity: c.grossRequiredQuantity,
        reservedQuantity: 0,
        issuedQuantity: 0,
        actualConsumedQuantity: 0,
        returnedQuantity: 0,
        scrapQuantity: 0,
        uomId: c.uomId,
        unitCost: c.unitCost,
        operationCode: c.operationCode,
      })) as any;
    }

    if (input.priority) po.priority = input.priority;
    if (input.productionLocation) po.productionLocation = input.productionLocation;
    if (input.plannedStartDate) po.plannedStartDate = new Date(input.plannedStartDate);
    if (input.plannedEndDate) po.plannedEndDate = new Date(input.plannedEndDate);
    if (input.notes !== undefined) po.notes = input.notes?.trim();

    po.updatedBy = new Types.ObjectId(userId);
    await po.save();

    return this.getProductionOrderById(tId, po._id);
  }

  async submitProductionOrder(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IProductionOrder> {
    const po = await this.getProductionOrderById(tenantId, id);
    if (po.status !== 'DRAFT' && po.status !== 'PLANNED') {
      throw new BadRequestError(`Cannot submit order in '${po.status}' status`);
    }
    po.status = 'APPROVED'; // Direct submit & approve workflow
    po.approvedBy = new Types.ObjectId(userId);
    po.approvedAt = new Date();
    po.updatedBy = new Types.ObjectId(userId);
    await po.save();

    await auditRepository.create({
      tenantId: new Types.ObjectId(tenantId),
      userId: new Types.ObjectId(userId),
      action: AuditAction.APPROVE,
      entity: AuditEntity.PRODUCTION,
      entityId: po._id.toString(),
      details: `Approved Production Order ${po.productionOrderNumber}`,
    });

    return this.getProductionOrderById(tenantId, po._id);
  }

  async approveProductionOrder(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IProductionOrder> {
    const po = await this.getProductionOrderById(tenantId, id);
    if (po.status !== 'PLANNED') {
      throw new BadRequestError(`Cannot approve order in '${po.status}' status`);
    }
    po.status = 'APPROVED';
    po.approvedBy = new Types.ObjectId(userId);
    po.approvedAt = new Date();
    po.updatedBy = new Types.ObjectId(userId);
    await po.save();

    return this.getProductionOrderById(tenantId, po._id);
  }

  async releaseProductionOrder(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IProductionOrder> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);
    const po = await this.getProductionOrderById(tId, id);

    if (po.status !== 'APPROVED' && po.status !== 'PLANNED') {
      throw new BadRequestError(`Cannot release order in '${po.status}' status. Order must be approved.`);
    }

    // Atomically reserve raw materials in Centralized Inventory
    await productionMaterialService.reserveMaterialsForOrder(tId, uId, po);

    po.status = 'RELEASED';
    po.releasedBy = uId;
    po.releasedAt = new Date();
    po.updatedBy = uId;
    await po.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.STATUS_CHANGE,
      entity: AuditEntity.PRODUCTION,
      entityId: po._id.toString(),
      details: `Released Production Order ${po.productionOrderNumber} and reserved required materials`,
    });

    return this.getProductionOrderById(tId, po._id);
  }

  async cancelProductionOrder(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    reason: string
  ): Promise<IProductionOrder> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);
    const po = await this.getProductionOrderById(tId, id);

    if (po.status === 'COMPLETED' || po.status === 'CLOSED' || po.status === 'CANCELLED') {
      throw new BadRequestError(`Cannot cancel order in '${po.status}' status`);
    }

    // Release any reserved materials back to inventory
    await productionMaterialService.releaseMaterialsForOrder(tId, uId, po);

    po.status = 'CANCELLED';
    po.cancelledBy = uId;
    po.cancelledAt = new Date();
    po.cancellationReason = reason.trim();
    po.updatedBy = uId;
    await po.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.STATUS_CHANGE,
      entity: AuditEntity.PRODUCTION,
      entityId: po._id.toString(),
      details: `Cancelled Production Order ${po.productionOrderNumber}. Reason: ${reason}`,
    });

    return this.getProductionOrderById(tId, po._id);
  }

  async closeProductionOrder(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IProductionOrder> {
    const po = await this.getProductionOrderById(tenantId, id);
    if (po.status !== 'COMPLETED') {
      throw new BadRequestError(`Cannot close order in '${po.status}' status. Order must be completed first.`);
    }
    po.status = 'CLOSED';
    po.updatedBy = new Types.ObjectId(userId);
    await po.save();
    return this.getProductionOrderById(tenantId, po._id);
  }
}

export const productionOrderService = new ProductionOrderService();
