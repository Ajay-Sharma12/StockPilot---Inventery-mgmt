import { Types } from 'mongoose';
import { InventoryBalance } from '../../../models/inventoryBalance.model';
import { InventoryTransaction } from '../../../models/inventoryTransaction.model';
import { Item } from '../../../models/item.model';
import { Wastage } from '../../../models/wastage.model';

export class InventoryReportService {
  async getStockSummary(
    tenantId: Types.ObjectId,
    filters: { warehouseId?: Types.ObjectId; categoryId?: Types.ObjectId; itemType?: string }
  ): Promise<{ data: any[]; summary: Record<string, any> }> {
    const query: any = { tenantId };
    if (filters.warehouseId) query.warehouseId = filters.warehouseId;

    const balances = await InventoryBalance.find(query)
      .populate('itemId', 'sku name itemCode standardCost reorderLevel itemType')
      .populate('warehouseId', 'name code')
      .exec();

    let totalPhysicalStock = 0;
    let totalReservedStock = 0;
    let totalAvailableStock = 0;
    let totalValuation = 0;

    const data = balances.map((b) => {
      const itm: any = b.itemId || {};
      const wh: any = b.warehouseId || {};

      totalPhysicalStock += b.quantity;
      totalReservedStock += b.reservedQuantity;
      totalAvailableStock += b.availableQuantity;
      totalValuation += b.totalValue || 0;

      return {
        id: b._id,
        sku: itm.sku || 'N/A',
        itemName: itm.name || 'Unknown',
        itemType: itm.itemType || 'RAW_MATERIAL',
        warehouse: wh.name || 'Default',
        batchNumber: b.batchNumber || 'N/A',
        physicalQuantity: b.quantity,
        reservedQuantity: b.reservedQuantity,
        availableQuantity: b.availableQuantity,
        reorderLevel: itm.reorderLevel || 0,
        lowStockStatus: b.availableQuantity <= (itm.reorderLevel || 0) ? 'LOW_STOCK' : 'HEALTHY',
        averageCost: b.averageCost,
        totalValuation: Math.round((b.totalValue || 0) * 100) / 100,
      };
    });

    return {
      data,
      summary: {
        totalItemsTracked: data.length,
        totalPhysicalStock,
        totalReservedStock,
        totalAvailableStock,
        totalValuation: Math.round(totalValuation * 100) / 100,
      },
    };
  }

  async getStockLedger(
    tenantId: Types.ObjectId,
    filters: { warehouseId?: Types.ObjectId; itemId?: Types.ObjectId; startDate?: Date; endDate?: Date }
  ): Promise<{ data: any[]; summary: Record<string, any> }> {
    const query: any = { tenantId };
    if (filters.warehouseId) query.warehouseId = filters.warehouseId;
    if (filters.itemId) query.itemId = filters.itemId;
    if (filters.startDate || filters.endDate) {
      query.transactionDate = {};
      if (filters.startDate) query.transactionDate.$gte = filters.startDate;
      if (filters.endDate) query.transactionDate.$lte = filters.endDate;
    }

    const txns = await InventoryTransaction.find(query)
      .populate('itemId', 'sku name itemCode')
      .populate('warehouseId', 'name code')
      .sort({ transactionDate: -1 })
      .limit(500)
      .exec();

    let totalIn = 0;
    let totalOut = 0;

    const data = txns.map((t) => {
      const itm: any = t.itemId || {};
      const wh: any = t.warehouseId || {};

      totalIn += t.quantityIn;
      totalOut += t.quantityOut;

      return {
        id: t._id,
        transactionNumber: t.transactionNumber,
        date: t.transactionDate,
        type: t.transactionType,
        referenceType: t.referenceType,
        referenceId: t.referenceId,
        sku: itm.sku,
        itemName: itm.name,
        warehouse: wh.name,
        quantityIn: t.quantityIn,
        quantityOut: t.quantityOut,
        balanceAfter: t.balanceAfter,
        unitCost: t.unitCost,
        totalValue: t.totalValue,
      };
    });

    return {
      data,
      summary: {
        totalTransactions: data.length,
        totalQuantityIn: totalIn,
        totalQuantityOut: totalOut,
      },
    };
  }

  async getWastageReport(
    tenantId: Types.ObjectId,
    filters: { warehouseId?: Types.ObjectId; startDate?: Date; endDate?: Date }
  ): Promise<{ data: any[]; summary: Record<string, any> }> {
    const query: any = { tenantId };
    if (filters.warehouseId) query.warehouseId = filters.warehouseId;
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = filters.startDate;
      if (filters.endDate) query.createdAt.$lte = filters.endDate;
    }

    const wastages = await Wastage.find(query)
      .populate('itemId', 'sku name itemCode')
      .populate('warehouseId', 'name code')
      .populate('reasonId', 'name')
      .sort({ createdAt: -1 })
      .exec();

    let totalScrappedQty = 0;
    let totalFinancialLoss = 0;

    const data = wastages.map((w: any) => {
      totalScrappedQty += w.quantity || 0;
      totalFinancialLoss += w.totalCost || 0;

      return {
        id: w._id,
        wastageNumber: w.wastageNumber,
        date: w.createdAt,
        sku: w.itemId?.sku,
        itemName: w.itemId?.name,
        warehouse: w.warehouseId?.name,
        reason: w.reasonId?.name || w.reason,
        quantity: w.quantity,
        unitCost: w.unitCost,
        totalLoss: w.totalCost,
      };
    });

    return {
      data,
      summary: {
        totalRecords: data.length,
        totalScrappedQty,
        totalFinancialLoss: Math.round(totalFinancialLoss * 100) / 100,
      },
    };
  }
}

export const inventoryReportService = new InventoryReportService();
