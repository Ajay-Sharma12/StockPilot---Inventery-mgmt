import { Types } from 'mongoose';
import { ProductionOrder, IProductionOrder } from '../models/productionOrder.model';
import { inventoryService } from '../../../services/inventory.service';
import { auditRepository } from '../../../repositories/audit.repository';
import { AuditAction, AuditEntity } from '../../../config/constants';
import { BadRequestError, NotFoundError } from '../../../core/errors';

export interface ConsumeMaterialInput {
  itemId: string | Types.ObjectId;
  quantity: number;
  batchNumber?: string;
  warehouseId?: string | Types.ObjectId;
  scrapQuantity?: number;
  remarks?: string;
}

export interface ReturnMaterialInput {
  itemId: string | Types.ObjectId;
  quantity: number;
  batchNumber?: string;
  warehouseId?: string | Types.ObjectId;
  remarks?: string;
}

export class ProductionMaterialService {
  async reserveMaterialsForOrder(
    tenantId: Types.ObjectId,
    userId: Types.ObjectId,
    order: IProductionOrder
  ): Promise<void> {
    const warehouseId = order.warehouseId._id || order.warehouseId;

    for (const mat of order.materials) {
      const qtyToReserve = Math.max(0, mat.plannedQuantity - mat.reservedQuantity);
      if (qtyToReserve > 0) {
        await inventoryService.reserveStock(tenantId, userId, {
          itemId: mat.itemId,
          warehouseId,
          quantity: qtyToReserve,
          referenceType: 'PRODUCTION_ORDER',
          referenceId: order.productionOrderNumber,
          reason: `Raw material allocation for order ${order.productionOrderNumber}`,
        });
        mat.reservedQuantity += qtyToReserve;
      }
    }
    await order.save();
  }

  async releaseMaterialsForOrder(
    tenantId: Types.ObjectId,
    userId: Types.ObjectId,
    order: IProductionOrder
  ): Promise<void> {
    const warehouseId = order.warehouseId._id || order.warehouseId;

    for (const mat of order.materials) {
      if (mat.reservedQuantity > 0) {
        await inventoryService.releaseStock(tenantId, userId, {
          itemId: mat.itemId,
          warehouseId,
          quantity: mat.reservedQuantity,
          referenceType: 'PRODUCTION_ORDER',
          referenceId: order.productionOrderNumber,
          reason: `Release unused reservation for cancelled/closed order ${order.productionOrderNumber}`,
        });
        mat.reservedQuantity = 0;
      }
    }
    await order.save();
  }

  async consumeMaterial(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    productionOrderId: string | Types.ObjectId,
    input: ConsumeMaterialInput
  ): Promise<IProductionOrder> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);
    const itmId = new Types.ObjectId(input.itemId);

    const order = await ProductionOrder.findOne({ _id: new Types.ObjectId(productionOrderId), tenantId: tId }).exec();
    if (!order) throw new NotFoundError('Production Order not found');

    if (order.status !== 'RELEASED' && order.status !== 'IN_PROGRESS') {
      throw new BadRequestError(`Cannot consume material in '${order.status}' status. Order must be released or in-progress.`);
    }

    const mat = order.materials.find((m) => (m.itemId?._id || m.itemId)?.toString() === itmId.toString());
    if (!mat) {
      throw new BadRequestError('Specified item is not part of this production order BOM');
    }

    // Anti-over-consumption tolerance guard (max 20% over planned without manager override)
    const plannedWithTolerance = mat.plannedQuantity * 1.2;
    if (mat.actualConsumedQuantity + input.quantity > plannedWithTolerance) {
      throw new BadRequestError(
        `Over-consumption exceeds 20% tolerance: Planned ${mat.plannedQuantity}, Attempted ${
          mat.actualConsumedQuantity + input.quantity
        }`
      );
    }

    const warehouseId = input.warehouseId
      ? new Types.ObjectId(input.warehouseId)
      : (order.warehouseId as Types.ObjectId);

    // Call Centralized Inventory Service to issue stock
    const isFromReserved = mat.reservedQuantity >= input.quantity;
    await inventoryService.issueStock(tId, uId, {
      itemId: itmId,
      warehouseId,
      quantity: input.quantity,
      batchNumber: input.batchNumber,
      transactionType: 'PRODUCTION_CONSUMPTION',
      referenceType: 'PRODUCTION_ORDER',
      referenceId: order.productionOrderNumber,
      fromReserved: isFromReserved,
      reason: `Material consumed in production run ${order.productionOrderNumber}`,
    });

    // Update material tracking
    mat.issuedQuantity += input.quantity;
    mat.actualConsumedQuantity += input.quantity;
    if (isFromReserved) {
      mat.reservedQuantity = Math.max(0, mat.reservedQuantity - input.quantity);
    }
    if (input.scrapQuantity) {
      mat.scrapQuantity += input.scrapQuantity;
    }

    const materialCostIncrement = Math.round(input.quantity * mat.unitCost * 100) / 100;
    order.actualMaterialCost = Math.round((order.actualMaterialCost + materialCostIncrement) * 100) / 100;
    order.updatedBy = uId;

    await order.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.PRODUCTION,
      entityId: order._id.toString(),
      details: `Consumed ${input.quantity} units of material ${mat.itemId} for ${order.productionOrderNumber}`,
    });

    return order;
  }

  async returnMaterial(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    productionOrderId: string | Types.ObjectId,
    input: ReturnMaterialInput
  ): Promise<IProductionOrder> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);
    const itmId = new Types.ObjectId(input.itemId);

    const order = await ProductionOrder.findOne({ _id: new Types.ObjectId(productionOrderId), tenantId: tId }).exec();
    if (!order) throw new NotFoundError('Production Order not found');

    const mat = order.materials.find((m) => (m.itemId?._id || m.itemId)?.toString() === itmId.toString());
    if (!mat) {
      throw new BadRequestError('Specified item is not part of this production order BOM');
    }

    if (input.quantity > mat.actualConsumedQuantity) {
      throw new BadRequestError(
        `Cannot return ${input.quantity} units. Only ${mat.actualConsumedQuantity} units were consumed.`
      );
    }

    const warehouseId = input.warehouseId
      ? new Types.ObjectId(input.warehouseId)
      : (order.warehouseId as Types.ObjectId);

    // Call Centralized Inventory Service to return unused material
    await inventoryService.receiveStock(tId, uId, {
      itemId: itmId,
      warehouseId,
      quantity: input.quantity,
      batchNumber: input.batchNumber,
      transactionType: 'PRODUCTION_RECEIPT',
      referenceType: 'PRODUCTION_ORDER',
      referenceId: order.productionOrderNumber,
      reason: `Unused material returned from production run ${order.productionOrderNumber}`,
    });

    mat.returnedQuantity += input.quantity;
    mat.actualConsumedQuantity = Math.max(0, mat.actualConsumedQuantity - input.quantity);

    const materialCostReduction = Math.round(input.quantity * mat.unitCost * 100) / 100;
    order.actualMaterialCost = Math.max(0, Math.round((order.actualMaterialCost - materialCostReduction) * 100) / 100);
    order.updatedBy = uId;

    await order.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.PRODUCTION,
      entityId: order._id.toString(),
      details: `Returned ${input.quantity} units of material ${mat.itemId} from ${order.productionOrderNumber}`,
    });

    return order;
  }
}

export const productionMaterialService = new ProductionMaterialService();
