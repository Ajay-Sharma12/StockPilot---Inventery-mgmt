import { Types } from 'mongoose';
import { StockAdjustment, IStockAdjustment } from '../models/stockAdjustment.model';
import { InventoryBalance } from '../models/inventoryBalance.model';
import { inventoryService } from './inventory.service';
import { documentNumberService } from './documentNumber.service';
import { BadRequestError, NotFoundError, ForbiddenError } from '../core/errors';
import { resolveWarehouseScope } from '../core/warehouseScope';

export class StockAdjustmentService {
  async getAdjustments(
    tenantId: string | Types.ObjectId,
    filter: any = {},
    warehouseScope: string[] = [],
    page = 1,
    limit = 20
  ): Promise<{ items: any[]; total: number; page: number; limit: number }> {
    const tId = new Types.ObjectId(tenantId);
    const queryFilter: any = { tenantId: tId };

    if (filter.status) queryFilter.status = filter.status;

    const resolvedScope = await resolveWarehouseScope(tId, warehouseScope);

    if (filter.warehouseId) {
      if (resolvedScope.isRestricted && !resolvedScope.isAuthorized(filter.warehouseId)) {
        throw new ForbiddenError('You do not have access to view adjustments for this warehouse');
      }
      queryFilter.warehouseId = new Types.ObjectId(filter.warehouseId);
    } else if (resolvedScope.isRestricted && resolvedScope.objectIds.length > 0) {
      queryFilter.warehouseId = { $in: resolvedScope.objectIds };
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      StockAdjustment.find(queryFilter)
        .populate('warehouseId', 'name code')
        .populate('requestedBy', 'name email')
        .populate('approvedBy', 'name email')
        .populate('items.itemId', 'sku name')
        .populate('items.reasonId', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      StockAdjustment.countDocuments(queryFilter).exec(),
    ]);

    return { items, total, page, limit };
  }

  async getAdjustmentById(tenantId: string | Types.ObjectId, id: string | Types.ObjectId): Promise<IStockAdjustment> {
    const adj = await StockAdjustment.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    })
      .populate('warehouseId', 'name code')
      .populate('locationId', 'code name')
      .populate('requestedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('items.itemId', 'sku name standardCost')
      .populate('items.reasonId', 'name code')
      .exec();

    if (!adj) throw new NotFoundError('Stock adjustment record not found');
    return adj;
  }

  async createAdjustment(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    data: {
      warehouseId: string;
      locationId?: string;
      items: Array<{
        itemId: string;
        batchNumber?: string;
        adjustedQuantity: number;
        reasonId?: string;
        remarks?: string;
      }>;
      reason?: string;
      remarks?: string;
    },
    warehouseScope: string[] = []
  ): Promise<IStockAdjustment> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const resolvedScope = await resolveWarehouseScope(tId, warehouseScope);
    if (resolvedScope.isRestricted && !resolvedScope.isAuthorized(data.warehouseId)) {
      throw new ForbiddenError('You do not have permission to adjust stock in this warehouse');
    }

    if (!data.items || data.items.length === 0) {
      throw new BadRequestError('At least one item is required in the adjustment');
    }

    // Capture current snapshot of system balances & compute differences
    const processedItems = await Promise.all(
      data.items.map(async (item) => {
        const balance = await InventoryBalance.findOne({
          tenantId: tId,
          itemId: new Types.ObjectId(item.itemId),
          warehouseId: new Types.ObjectId(data.warehouseId),
          locationId: data.locationId ? new Types.ObjectId(data.locationId) : null,
          batchNumber: item.batchNumber || '',
        }).exec();

        const currentQuantity = balance ? balance.quantity : 0;
        const difference = item.adjustedQuantity - currentQuantity;
        const unitCost = balance ? balance.averageCost : 0;

        return {
          itemId: new Types.ObjectId(item.itemId),
          batchNumber: item.batchNumber,
          currentQuantity,
          adjustedQuantity: item.adjustedQuantity,
          difference,
          unitCost,
          reasonId: item.reasonId ? new Types.ObjectId(item.reasonId) : undefined,
          remarks: item.remarks,
        };
      })
    );

    const adjustmentNumber = await documentNumberService.getNextNumber(tId, 'STOCK_ADJUSTMENT');

    return StockAdjustment.create({
      tenantId: tId,
      adjustmentNumber,
      warehouseId: new Types.ObjectId(data.warehouseId),
      locationId: data.locationId ? new Types.ObjectId(data.locationId) : undefined,
      items: processedItems,
      status: 'DRAFT',
      requestedBy: uId,
      reason: data.reason,
      remarks: data.remarks,
    });
  }

  async approveAdjustment(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    warehouseScope: string[] = []
  ): Promise<IStockAdjustment> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);
    const adj = await this.getAdjustmentById(tId, id);

    if (adj.status !== 'DRAFT' && adj.status !== 'SUBMITTED') {
      throw new BadRequestError(`Cannot approve adjustment in status '${adj.status}'`);
    }

    const whIdStr = adj.warehouseId.toString();
    const resolvedScope = await resolveWarehouseScope(tId, warehouseScope);
    if (resolvedScope.isRestricted && !resolvedScope.isAuthorized(whIdStr)) {
      throw new ForbiddenError('You do not have permission to approve adjustments for this warehouse');
    }

    // Apply adjustments through Central Inventory Engine
    for (const itm of adj.items) {
      if (itm.difference > 0) {
        // Positive difference: receive stock into inventory
        await inventoryService.receiveStock(tId, uId, {
          itemId: itm.itemId._id || itm.itemId,
          warehouseId: adj.warehouseId._id || adj.warehouseId,
          locationId: adj.locationId,
          batchNumber: itm.batchNumber,
          quantity: itm.difference,
          unitCost: itm.unitCost,
          transactionType: 'STOCK_ADJUSTMENT',
          referenceType: 'STOCK_ADJUSTMENT',
          referenceId: adj._id.toString(),
          reason: `Adjustment ${adj.adjustmentNumber}: ${adj.reason || 'Positive variance'}`,
        });
      } else if (itm.difference < 0) {
        // Negative difference: issue stock out of inventory
        await inventoryService.issueStock(tId, uId, {
          itemId: itm.itemId._id || itm.itemId,
          warehouseId: adj.warehouseId._id || adj.warehouseId,
          locationId: adj.locationId,
          batchNumber: itm.batchNumber,
          quantity: Math.abs(itm.difference),
          transactionType: 'STOCK_ADJUSTMENT',
          referenceType: 'STOCK_ADJUSTMENT',
          referenceId: adj._id.toString(),
          reason: `Adjustment ${adj.adjustmentNumber}: ${adj.reason || 'Negative variance'}`,
        });
      }
    }

    adj.status = 'COMPLETED';
    adj.approvedBy = uId;
    await adj.save();

    return adj;
  }
}

export const stockAdjustmentService = new StockAdjustmentService();
