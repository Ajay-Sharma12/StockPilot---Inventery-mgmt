import { Types } from 'mongoose';
import { ProductionOrder } from '../../production/models/productionOrder.model';
import { ProductionOutput } from '../../production/models/productionOutput.model';
import { ProductionBatch } from '../../production/models/productionBatch.model';
import { ProductionQC } from '../../production/models/productionQc.model';

export class ProductionReportService {
  async getProductionOrdersReport(
    tenantId: Types.ObjectId,
    filters: { warehouseId?: Types.ObjectId; status?: string; startDate?: Date; endDate?: Date }
  ): Promise<{ data: any[]; summary: Record<string, any> }> {
    const query: any = { tenantId };
    if (filters.warehouseId) query.warehouseId = filters.warehouseId;
    if (filters.status) query.status = filters.status;
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = filters.startDate;
      if (filters.endDate) query.createdAt.$lte = filters.endDate;
    }

    const orders = await ProductionOrder.find(query)
      .populate('productionItemId', 'sku name itemCode standardCost')
      .populate('warehouseId', 'name code')
      .sort({ createdAt: -1 })
      .exec();

    let totalPlanned = 0;
    let totalProduced = 0;
    let totalScrap = 0;

    const data = orders.map((o: any) => {
      totalPlanned += o.plannedQuantity || 0;
      totalProduced += o.yieldQuantity || 0;
      totalScrap += o.scrapQuantity || 0;

      const yieldPercentage =
        o.plannedQuantity > 0 ? Math.round((o.yieldQuantity / o.plannedQuantity) * 1000) / 10 : 0;

      return {
        id: o._id,
        productionOrderNumber: o.productionOrderNumber,
        sku: o.productionItemId?.sku,
        itemName: o.productionItemId?.name,
        warehouse: o.warehouseId?.name,
        plannedQuantity: o.plannedQuantity,
        yieldQuantity: o.yieldQuantity,
        scrapQuantity: o.scrapQuantity,
        yieldRate: `${yieldPercentage}%`,
        status: o.status,
        batchNumber: o.batchNumber || 'N/A',
        plannedCost: o.plannedMaterialCost,
        actualCost: o.actualMaterialCost,
        createdAt: o.createdAt,
      };
    });

    return {
      data,
      summary: {
        totalOrders: data.length,
        totalPlannedQuantity: totalPlanned,
        totalProducedQuantity: totalProduced,
        totalScrapQuantity: totalScrap,
        overallYieldRate:
          totalPlanned > 0 ? `${Math.round((totalProduced / totalPlanned) * 1000) / 10}%` : '100%',
      },
    };
  }

  async getMaterialVarianceReport(
    tenantId: Types.ObjectId,
    filters: { warehouseId?: Types.ObjectId; startDate?: Date; endDate?: Date }
  ): Promise<{ data: any[]; summary: Record<string, any> }> {
    const query: any = { tenantId, status: { $in: ['IN_PROGRESS', 'COMPLETED', 'CLOSED'] } };
    if (filters.warehouseId) query.warehouseId = filters.warehouseId;
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = filters.startDate;
      if (filters.endDate) query.createdAt.$lte = filters.endDate;
    }

    const orders = await ProductionOrder.find(query)
      .populate('productionItemId', 'sku name')
      .populate('materials.itemId', 'sku name standardCost')
      .exec();

    const data: any[] = [];
    let totalPlannedCost = 0;
    let totalActualCost = 0;

    for (const order of orders) {
      for (const mat of order.materials) {
        const item: any = mat.itemId || {};
        const pCost = Math.round(mat.plannedQuantity * mat.unitCost * 100) / 100;
        const aCost = Math.round(mat.actualConsumedQuantity * mat.unitCost * 100) / 100;
        const qtyVariance = Math.round((mat.actualConsumedQuantity - mat.plannedQuantity) * 100) / 100;
        const costVariance = Math.round((aCost - pCost) * 100) / 100;

        totalPlannedCost += pCost;
        totalActualCost += aCost;

        data.push({
          productionOrderNumber: order.productionOrderNumber,
          finishedItem: (order.productionItemId as any)?.name,
          materialSku: item.sku || 'N/A',
          materialName: item.name || 'Component',
          plannedQuantity: mat.plannedQuantity,
          actualConsumedQuantity: mat.actualConsumedQuantity,
          quantityVariance: qtyVariance,
          unitCost: mat.unitCost,
          plannedCost: pCost,
          actualCost: aCost,
          costVariance,
          varianceStatus: costVariance > 0 ? 'OVER_CONSUMED' : costVariance < 0 ? 'FAVORABLE' : 'ON_TARGET',
        });
      }
    }

    return {
      data,
      summary: {
        totalMaterialLines: data.length,
        totalPlannedCost: Math.round(totalPlannedCost * 100) / 100,
        totalActualCost: Math.round(totalActualCost * 100) / 100,
        netVariance: Math.round((totalActualCost - totalPlannedCost) * 100) / 100,
      },
    };
  }

  async getProductionOutputReport(
    tenantId: Types.ObjectId,
    filters: { warehouseId?: Types.ObjectId; startDate?: Date; endDate?: Date; status?: string }
  ): Promise<{ data: any[]; summary: Record<string, any> }> {
    const query: any = { tenantId };
    if (filters.warehouseId) query.warehouseId = filters.warehouseId;
    if (filters.status && filters.status !== 'ALL') query.qcStatus = filters.status;
    if (filters.startDate || filters.endDate) {
      query.productionDate = {};
      if (filters.startDate) query.productionDate.$gte = filters.startDate;
      if (filters.endDate) query.productionDate.$lte = filters.endDate;
    }

    const outputs = await ProductionOutput.find(query)
      .populate('itemId', 'sku name itemCode')
      .populate('warehouseId', 'name code')
      .sort({ productionDate: -1 })
      .exec();

    let totalPlanned = 0;
    let totalProduced = 0;
    let totalAccepted = 0;
    let totalRejected = 0;
    let totalScrap = 0;

    const data = outputs.map((out: any) => {
      totalPlanned += out.plannedQuantity || 0;
      totalProduced += out.producedQuantity || 0;
      totalAccepted += out.acceptedQuantity || 0;
      totalRejected += out.rejectedQuantity || 0;
      totalScrap += out.scrapQuantity || 0;

      const yieldRate =
        out.plannedQuantity > 0
          ? Math.round((out.acceptedQuantity / out.plannedQuantity) * 1000) / 10
          : out.producedQuantity > 0
          ? Math.round((out.acceptedQuantity / out.producedQuantity) * 1000) / 10
          : 0;

      return {
        id: out._id,
        outputNumber: out.outputNumber,
        productionOrderNumber: out.productionOrderNumber,
        productName: out.itemId?.name || 'Item',
        productSku: out.itemId?.sku || 'N/A',
        warehouse: out.warehouseId?.name || 'Default',
        batchNumber: out.batchNumber || 'N/A',
        plannedQuantity: out.plannedQuantity,
        producedQuantity: out.producedQuantity,
        acceptedQuantity: out.acceptedQuantity,
        rejectedQuantity: out.rejectedQuantity,
        scrapQuantity: out.scrapQuantity,
        yieldRate: `${yieldRate}%`,
        qcStatus: out.qcStatus,
        productionDate: out.productionDate,
      };
    });

    return {
      data,
      summary: {
        totalOutputs: data.length,
        totalPlannedQuantity: totalPlanned,
        totalProducedQuantity: totalProduced,
        totalAcceptedQuantity: totalAccepted,
        totalRejectedQuantity: totalRejected,
        totalScrapQuantity: totalScrap,
        overallYieldRate:
          totalPlanned > 0
            ? `${Math.round((totalAccepted / totalPlanned) * 1000) / 10}%`
            : `${totalProduced > 0 ? Math.round((totalAccepted / totalProduced) * 1000) / 10 : 100}%`,
      },
    };
  }

  async getYieldReport(
    tenantId: Types.ObjectId,
    filters: { warehouseId?: Types.ObjectId; startDate?: Date; endDate?: Date }
  ): Promise<{ data: any[]; summary: Record<string, any> }> {
    return this.getProductionOutputReport(tenantId, filters);
  }

  async getWastageReport(
    tenantId: Types.ObjectId,
    filters: { warehouseId?: Types.ObjectId; startDate?: Date; endDate?: Date }
  ): Promise<{ data: any[]; summary: Record<string, any> }> {
    const query: any = { tenantId };
    if (filters.warehouseId) query.warehouseId = filters.warehouseId;
    if (filters.startDate || filters.endDate) {
      query.productionDate = {};
      if (filters.startDate) query.productionDate.$gte = filters.startDate;
      if (filters.endDate) query.productionDate.$lte = filters.endDate;
    }

    const outputs = await ProductionOutput.find({
      ...query,
      $or: [{ scrapQuantity: { $gt: 0 } }, { wastageQuantity: { $gt: 0 } }],
    })
      .populate('itemId', 'sku name')
      .populate('warehouseId', 'name')
      .sort({ productionDate: -1 })
      .exec();

    let totalScrapUnits = 0;

    const data = outputs.map((out: any) => {
      const scrap = (out.scrapQuantity || 0) + (out.wastageQuantity || 0);
      totalScrapUnits += scrap;

      return {
        id: out._id,
        productionOrderNumber: out.productionOrderNumber,
        productName: out.itemId?.name || 'Item',
        scrapQuantity: out.scrapQuantity || 0,
        scrapReason: out.scrapReason || 'Production Tooling Loss',
        wastageQuantity: out.wastageQuantity || 0,
        wastageReason: out.wastageReason || 'Cutting/Trimming Loss',
        totalScrapUnits: scrap,
        warehouse: out.warehouseId?.name,
        productionDate: out.productionDate,
      };
    });

    return {
      data,
      summary: {
        totalRecords: data.length,
        totalScrapUnits,
      },
    };
  }

  async getBatchHistoryReport(
    tenantId: Types.ObjectId,
    filters: { warehouseId?: Types.ObjectId; startDate?: Date; endDate?: Date; status?: string }
  ): Promise<{ data: any[]; summary: Record<string, any> }> {
    const query: any = { tenantId };
    if (filters.status && filters.status !== 'ALL') query.status = filters.status;
    if (filters.startDate || filters.endDate) {
      query.manufacturingDate = {};
      if (filters.startDate) query.manufacturingDate.$gte = filters.startDate;
      if (filters.endDate) query.manufacturingDate.$lte = filters.endDate;
    }

    const batches = await ProductionBatch.find(query)
      .populate('itemId', 'sku name itemCode')
      .populate('productionOrderId', 'productionOrderNumber status')
      .populate('createdBy', 'name email')
      .sort({ manufacturingDate: -1 })
      .exec();

    let totalBatchQty = 0;

    const data = batches.map((b: any) => {
      totalBatchQty += b.quantity || 0;
      return {
        id: b._id,
        batchNumber: b.batchNumber,
        productionOrderNumber: b.productionOrderId?.productionOrderNumber || 'N/A',
        productName: b.itemId?.name || 'Item',
        productSku: b.itemId?.sku || 'N/A',
        quantity: b.quantity,
        manufacturingDate: b.manufacturingDate,
        expiryDate: b.expiryDate || 'N/A',
        status: b.status,
        createdBy: b.createdBy?.name || 'Operator',
      };
    });

    return {
      data,
      summary: {
        totalBatches: data.length,
        totalBatchUnits: totalBatchQty,
      },
    };
  }
}

export const productionReportService = new ProductionReportService();
