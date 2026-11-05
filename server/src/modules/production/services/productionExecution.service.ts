import { Types } from 'mongoose';
import { ProductionOrder, IProductionOrder } from '../models/productionOrder.model';
import { ProductionBatch } from '../models/productionBatch.model';
import { ProductionQC } from '../models/productionQc.model';
import { Item } from '../../../models/item.model';
import { documentNumberService } from '../../../services/documentNumber.service';
import { auditRepository } from '../../../repositories/audit.repository';
import { AuditAction, AuditEntity } from '../../../config/constants';
import { BadRequestError, NotFoundError } from '../../../core/errors';

export interface RecordOutputInput {
  producedQuantity: number;
  scrapQuantity?: number;
  batchNumber?: string;
  expiryDate?: string | Date;
  notes?: string;
}

export class ProductionExecutionService {
  async startProduction(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    productionOrderId: string | Types.ObjectId
  ): Promise<IProductionOrder> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const order = await ProductionOrder.findOne({ _id: new Types.ObjectId(productionOrderId), tenantId: tId }).exec();
    if (!order) throw new NotFoundError('Production Order not found');

    if (order.status !== 'RELEASED' && order.status !== 'PAUSED') {
      throw new BadRequestError(`Cannot start production in '${order.status}' status. Order must be released or paused.`);
    }

    order.status = 'IN_PROGRESS';
    if (!order.actualStartDate) {
      order.actualStartDate = new Date();
      order.startedBy = uId;
      order.startedAt = new Date();
    }
    order.updatedBy = uId;
    await order.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.STATUS_CHANGE,
      entity: AuditEntity.PRODUCTION,
      entityId: order._id.toString(),
      details: `Started manufacturing run for order ${order.productionOrderNumber}`,
    });

    return order;
  }

  async pauseProduction(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    productionOrderId: string | Types.ObjectId,
    reason?: string
  ): Promise<IProductionOrder> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const order = await ProductionOrder.findOne({ _id: new Types.ObjectId(productionOrderId), tenantId: tId }).exec();
    if (!order) throw new NotFoundError('Production Order not found');

    if (order.status !== 'IN_PROGRESS') {
      throw new BadRequestError(`Cannot pause production in '${order.status}' status. Order must be in-progress.`);
    }

    order.status = 'PAUSED';
    order.notes = reason ? `${order.notes || ''}\n[Paused]: ${reason}`.trim() : order.notes;
    order.updatedBy = uId;
    await order.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.STATUS_CHANGE,
      entity: AuditEntity.PRODUCTION,
      entityId: order._id.toString(),
      details: `Paused manufacturing run for order ${order.productionOrderNumber}`,
    });

    return order;
  }

  async resumeProduction(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    productionOrderId: string | Types.ObjectId
  ): Promise<IProductionOrder> {
    return this.startProduction(tenantId, userId, productionOrderId);
  }

  async recordOutput(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    productionOrderId: string | Types.ObjectId,
    input: RecordOutputInput
  ): Promise<{ order: IProductionOrder; batch?: any; qcInspection: any }> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const order = await ProductionOrder.findOne({ _id: new Types.ObjectId(productionOrderId), tenantId: tId }).exec();
    if (!order) throw new NotFoundError('Production Order not found');

    if (order.status === 'RELEASED') {
      order.status = 'IN_PROGRESS';
      order.actualStartDate = order.actualStartDate || new Date();
      order.startedBy = order.startedBy || uId;
      order.startedAt = order.startedAt || new Date();
    } else if (order.status !== 'IN_PROGRESS') {
      throw new BadRequestError(`Cannot record output in '${order.status}' status. Order must be released or in-progress.`);
    }

    const item = await Item.findOne({ _id: order.productionItemId, tenantId: tId }).exec();
    if (!item) throw new NotFoundError('Manufactured item not found');

    // 1. Create or bind Production Batch
    let batchNumber = input.batchNumber?.trim();
    if (!batchNumber) {
      batchNumber = await documentNumberService.getNextNumber(tId, 'PRODUCTION_BATCH');
    }

    let batch = await ProductionBatch.findOne({ tenantId: tId, batchNumber }).exec();
    if (!batch) {
      batch = await ProductionBatch.create({
        tenantId: tId,
        batchNumber,
        productionOrderId: order._id,
        itemId: item._id,
        manufacturingDate: new Date(),
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
        quantity: input.producedQuantity,
        uomId: item.baseUomId,
        status: 'QUARANTINED', // Quarantined pending QC disposition
        notes: input.notes?.trim(),
        createdBy: uId,
      });
    } else {
      batch.quantity += input.producedQuantity;
      await batch.save();
    }

    // 2. Automatically spawn Production QC inspection
    const qcNumber = await documentNumberService.getNextNumber(tId, 'PRODUCTION_QC');
    const qcInspection = await ProductionQC.create({
      tenantId: tId,
      qcNumber,
      productionOrderId: order._id,
      itemId: item._id,
      batchId: batch._id,
      batchNumber: batch.batchNumber,
      inspectedQuantity: input.producedQuantity,
      acceptedQuantity: 0,
      rejectedQuantity: 0,
      heldQuantity: input.producedQuantity,
      reworkQuantity: 0,
      inspectorId: uId,
      results: [
        { parameter: 'Visual Surface Finish', status: 'PASS' },
        { parameter: 'Dimensional Tolerance', status: 'PASS' },
        { parameter: 'Operational Test Run', status: 'PASS' },
      ],
      overallResult: 'HOLD',
      status: 'PENDING',
      createdBy: uId,
    });

    // 3. Update order yield and status
    order.yieldQuantity += input.producedQuantity;
    if (input.scrapQuantity) {
      order.scrapQuantity += input.scrapQuantity;
    }
    order.batchNumber = batchNumber;

    if (order.yieldQuantity >= order.plannedQuantity) {
      order.status = 'COMPLETED';
      order.actualEndDate = new Date();
      order.completedBy = uId;
      order.completedAt = new Date();
    }

    order.updatedBy = uId;
    await order.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.PRODUCTION,
      entityId: order._id.toString(),
      details: `Recorded output ${input.producedQuantity} units for ${order.productionOrderNumber}. Batch ${batchNumber} queued for QC.`,
    });

    return { order, batch, qcInspection };
  }
}

export const productionExecutionService = new ProductionExecutionService();
