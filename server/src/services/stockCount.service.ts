import { Types } from 'mongoose';
import { StockCount, IStockCount } from '../models/stockCount.model';
import { InventoryBalance } from '../models/inventoryBalance.model';
import { Item } from '../models/item.model';
import { inventoryService } from './inventory.service';
import { documentNumberService } from './documentNumber.service';
import { auditRepository } from '../repositories/audit.repository';
import { AuditAction, AuditEntity } from '../config/constants';
import { BadRequestError, NotFoundError, ForbiddenError } from '../core/errors';
import { resolveWarehouseScope } from '../core/warehouseScope';

export class StockCountService {
  async getCounts(
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
        throw new ForbiddenError('You do not have access to view counts for this warehouse');
      }
      queryFilter.warehouseId = new Types.ObjectId(filter.warehouseId);
    } else if (resolvedScope.isRestricted && resolvedScope.objectIds.length > 0) {
      queryFilter.warehouseId = { $in: resolvedScope.objectIds };
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      StockCount.find(queryFilter)
        .populate('warehouseId', 'name code')
        .populate('plannedBy', 'name email')
        .populate('approvedBy', 'name email')
        .populate('assignedUsers', 'name email')
        .populate('items.itemId', 'sku name standardCost')
        .populate('items.locationId', 'code name')
        .populate('items.reasonId', 'name code')
        .sort({ countDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      StockCount.countDocuments(queryFilter).exec(),
    ]);

    return { items, total, page, limit };
  }

  async getCountById(tenantId: string | Types.ObjectId, id: string | Types.ObjectId): Promise<IStockCount> {
    const count = await StockCount.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    })
      .populate('warehouseId', 'name code')
      .populate('plannedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('assignedUsers', 'name email')
      .populate('items.itemId', 'sku name standardCost category uom')
      .populate('items.locationId', 'code name')
      .populate('items.reasonId', 'name code')
      .exec();

    if (!count) throw new NotFoundError('Stock count record not found');
    return count;
  }

  async createCount(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    data: {
      warehouseId: string;
      countDate?: Date;
      assignedUsers?: string[];
      itemIds?: string[];
      remarks?: string;
    },
    warehouseScope: string[] = []
  ): Promise<IStockCount> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const resolvedScope = await resolveWarehouseScope(tId, warehouseScope);
    if (resolvedScope.isRestricted && !resolvedScope.isAuthorized(data.warehouseId)) {
      throw new ForbiddenError('You do not have permission to plan counts for this warehouse');
    }

    // Fetch system balances snapshot for this warehouse
    const balanceQuery: any = {
      tenantId: tId,
      warehouseId: new Types.ObjectId(data.warehouseId),
    };
    if (data.itemIds && data.itemIds.length > 0) {
      balanceQuery.itemId = { $in: data.itemIds.map((id) => new Types.ObjectId(id)) };
    }

    const balances = await InventoryBalance.find(balanceQuery).exec();

    const items = await Promise.all(
      balances.map(async (b) => {
        let unitCost = b.averageCost;
        if (!unitCost || unitCost === 0) {
          const itm = await Item.findById(b.itemId).select('standardCost sellingPrice').exec();
          unitCost = itm?.standardCost || itm?.sellingPrice || 0;
        }
        return {
          itemId: b.itemId,
          batchNumber: b.batchNumber || undefined,
          locationId: b.locationId || undefined,
          systemQuantity: b.quantity || 0,
          countedQuantity: b.quantity || 0, // defaults to system until entered
          variance: 0,
          varianceValue: 0,
          unitCost: unitCost || 0,
        };
      })
    );

    const countNumber = await documentNumberService.getNextNumber(tId, 'STOCK_COUNT');

    const createdCount = await StockCount.create({
      tenantId: tId,
      countNumber,
      warehouseId: new Types.ObjectId(data.warehouseId),
      countDate: data.countDate || new Date(),
      assignedUsers: data.assignedUsers?.map((u) => new Types.ObjectId(u)) || [uId],
      status: 'PLANNED',
      items,
      plannedBy: uId,
      remarks: data.remarks?.trim() || undefined,
    });

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.CREATE,
      entity: AuditEntity.INVENTORY,
      entityId: createdCount._id.toString(),
      details: `Planned physical cycle count audit ${countNumber} for warehouse ${data.warehouseId} (${items.length} items)`,
    });

    return createdCount;
  }

  async recordCounts(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    countedItems: Array<{
      _id?: string;
      itemId: string;
      batchNumber?: string;
      locationId?: string;
      countedQuantity: number;
      reasonId?: string;
      remarks?: string;
    }>,
    userId?: string | Types.ObjectId
  ): Promise<IStockCount> {
    const count = await this.getCountById(tenantId, id);

    if (count.status !== 'PLANNED' && count.status !== 'IN_PROGRESS' && count.status !== 'SUBMITTED') {
      throw new BadRequestError(`Cannot record counts for audit in status '${count.status}'`);
    }

    for (const cItem of countedItems) {
      const target = count.items.find((i: any) => {
        if (cItem._id && i._id && i._id.toString() === cItem._id) return true;
        const iItemIdStr = (i.itemId?._id || i.itemId)?.toString();
        const cItemIdStr = cItem.itemId?.toString();
        const iBatch = (i.batchNumber || '').trim();
        const cBatch = (cItem.batchNumber || '').trim();
        return iItemIdStr === cItemIdStr && iBatch === cBatch;
      });

      if (target) {
        target.countedQuantity = Number(cItem.countedQuantity) || 0;
        target.variance = target.countedQuantity - target.systemQuantity;
        const cost = target.unitCost || (target.itemId as any)?.standardCost || 0;
        target.varianceValue = Math.round(target.variance * cost * 100) / 100;
        if (cItem.reasonId && Types.ObjectId.isValid(cItem.reasonId)) {
          target.reasonId = new Types.ObjectId(cItem.reasonId) as any;
        }
        if (cItem.remarks) target.remarks = cItem.remarks.trim();
      }
    }

    count.status = 'SUBMITTED';
    await count.save();

    if (userId) {
      await auditRepository.create({
        tenantId: new Types.ObjectId(tenantId),
        userId: new Types.ObjectId(userId),
        action: AuditAction.UPDATE,
        entity: AuditEntity.INVENTORY,
        entityId: count._id.toString(),
        details: `Recorded physical stock counts for audit ${count.countNumber}`,
      });
    }

    return count;
  }

  async approveCount(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    warehouseScope: string[] = []
  ): Promise<IStockCount> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);
    const count = await this.getCountById(tId, id);

    if (count.status !== 'SUBMITTED') {
      throw new BadRequestError(`Cannot approve audit in status '${count.status}' (Must be SUBMITTED)`);
    }

    const whIdStr = (count.warehouseId as any)?._id?.toString() || count.warehouseId.toString();
    const resolvedScope = await resolveWarehouseScope(tId, warehouseScope);
    if (resolvedScope.isRestricted && !resolvedScope.isAuthorized(whIdStr)) {
      throw new ForbiddenError('You do not have permission to approve counts for this warehouse');
    }

    // Apply variance adjustments via Central Inventory Engine
    for (const itm of count.items) {
      const itmId = (itm.itemId as any)?._id || itm.itemId;
      const whId = (count.warehouseId as any)?._id || count.warehouseId;
      const locId = (itm.locationId as any)?._id || itm.locationId;

      if (itm.variance > 0) {
        // Surplus: receive stock
        await inventoryService.receiveStock(tId, uId, {
          itemId: itmId,
          warehouseId: whId,
          locationId: locId,
          batchNumber: itm.batchNumber,
          quantity: itm.variance,
          unitCost: itm.unitCost || 0,
          transactionType: 'STOCK_ADJUSTMENT',
          referenceType: 'STOCK_COUNT',
          referenceId: count._id.toString(),
          reason: `Physical Audit Surplus: ${count.countNumber}`,
        });
      } else if (itm.variance < 0) {
        // Deficit: issue stock
        await inventoryService.issueStock(tId, uId, {
          itemId: itmId,
          warehouseId: whId,
          locationId: locId,
          batchNumber: itm.batchNumber,
          quantity: Math.abs(itm.variance),
          transactionType: 'STOCK_ADJUSTMENT',
          referenceType: 'STOCK_COUNT',
          referenceId: count._id.toString(),
          reason: `Physical Audit Deficit: ${count.countNumber}`,
        });
      }
    }

    count.status = 'COMPLETED';
    count.approvedBy = uId;
    count.completedAt = new Date();
    await count.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.APPROVE,
      entity: AuditEntity.INVENTORY,
      entityId: count._id.toString(),
      details: `Approved physical stock audit ${count.countNumber} and reconciled ledger balances`,
    });

    return count;
  }
}

export const stockCountService = new StockCountService();
