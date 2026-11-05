import { Types } from 'mongoose';
import { ProductionOrder } from '../models/productionOrder.model';
import { NotFoundError } from '../../../core/errors';

export interface ProductionCostingSummary {
  productionOrderId: Types.ObjectId;
  productionOrderNumber: string;
  plannedQuantity: number;
  yieldQuantity: number;
  plannedMaterialCost: number;
  actualMaterialCost: number;
  materialVariance: number;
  materialVariancePercentage: number;
  plannedLaborCost: number;
  actualLaborCost: number;
  totalActualCost: number;
  actualCostPerUnit: number;
  materialDetails: Array<{
    itemId: Types.ObjectId;
    plannedQuantity: number;
    actualConsumedQuantity: number;
    unitCost: number;
    plannedCost: number;
    actualCost: number;
    variance: number;
  }>;
}

export class ProductionCostingService {
  async calculateOrderCosting(
    tenantId: string | Types.ObjectId,
    orderId: string | Types.ObjectId
  ): Promise<ProductionCostingSummary> {
    const tId = new Types.ObjectId(tenantId);
    const order = await ProductionOrder.findOne({ _id: new Types.ObjectId(orderId), tenantId: tId })
      .populate('productionItemId', 'sku name itemCode standardCost')
      .populate('materials.itemId', 'sku name itemCode standardCost')
      .exec();

    if (!order) throw new NotFoundError('Production Order not found');

    let totalPlannedMaterialCost = 0;
    let totalActualMaterialCost = 0;

    const materialDetails = order.materials.map((m) => {
      const plannedCost = Math.round(m.plannedQuantity * m.unitCost * 100) / 100;
      const actualCost = Math.round(m.actualConsumedQuantity * m.unitCost * 100) / 100;
      totalPlannedMaterialCost += plannedCost;
      totalActualMaterialCost += actualCost;

      return {
        itemId: m.itemId,
        plannedQuantity: m.plannedQuantity,
        actualConsumedQuantity: m.actualConsumedQuantity,
        unitCost: m.unitCost,
        plannedCost,
        actualCost,
        variance: Math.round((actualCost - plannedCost) * 100) / 100,
      };
    });

    const materialVariance = Math.round((totalActualMaterialCost - totalPlannedMaterialCost) * 100) / 100;
    const materialVariancePercentage =
      totalPlannedMaterialCost > 0
        ? Math.round((materialVariance / totalPlannedMaterialCost) * 10000) / 100
        : 0;

    const totalActualCost = Math.round((totalActualMaterialCost + (order.actualLaborCost || 0)) * 100) / 100;
    const actualCostPerUnit =
      order.yieldQuantity > 0
        ? Math.round((totalActualCost / order.yieldQuantity) * 100) / 100
        : order.plannedQuantity > 0
        ? Math.round((totalActualCost / order.plannedQuantity) * 100) / 100
        : 0;

    return {
      productionOrderId: order._id,
      productionOrderNumber: order.productionOrderNumber,
      plannedQuantity: order.plannedQuantity,
      yieldQuantity: order.yieldQuantity,
      plannedMaterialCost: Math.round(totalPlannedMaterialCost * 100) / 100,
      actualMaterialCost: Math.round(totalActualMaterialCost * 100) / 100,
      materialVariance,
      materialVariancePercentage,
      plannedLaborCost: order.plannedLaborCost || 0,
      actualLaborCost: order.actualLaborCost || 0,
      totalActualCost,
      actualCostPerUnit,
      materialDetails,
    };
  }
}

export const productionCostingService = new ProductionCostingService();
