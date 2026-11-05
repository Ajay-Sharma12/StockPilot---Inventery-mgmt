import { Types } from 'mongoose';
import { InventoryBalance, IInventoryBalance } from '../models/inventoryBalance.model';
import {
  InventoryTransaction,
  IInventoryTransaction,
  InventoryTransactionType,
} from '../models/inventoryTransaction.model';
import { Item } from '../models/item.model';
import { Warehouse, Zone, Rack, Bin } from '../models/warehouse.model';
import { logger } from '../core/logger';
import { documentNumberService } from './documentNumber.service';
import { inventoryCostingService } from './inventoryCosting.service';
import { auditRepository } from '../repositories/audit.repository';
import { AuditAction, AuditEntity } from '../config/constants';
import { BadRequestError, NotFoundError, ForbiddenError } from '../core/errors';
import { resolveWarehouseScope } from '../core/warehouseScope';

export interface ReceiveStockInput {
  itemId: string | Types.ObjectId;
  warehouseId: string | Types.ObjectId;
  locationId?: string | Types.ObjectId;
  batchNumber?: string;
  serialNumber?: string;
  quantity: number;
  unitCost?: number;
  transactionType?: InventoryTransactionType;
  referenceType?: string;
  referenceId?: string;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface ReserveStockInput {
  itemId: string | Types.ObjectId;
  warehouseId: string | Types.ObjectId;
  locationId?: string | Types.ObjectId;
  batchNumber?: string;
  quantity: number;
  referenceType?: string;
  referenceId?: string;
  reason?: string;
}

export interface ReleaseStockInput {
  itemId: string | Types.ObjectId;
  warehouseId: string | Types.ObjectId;
  locationId?: string | Types.ObjectId;
  batchNumber?: string;
  quantity: number;
  referenceType?: string;
  referenceId?: string;
  reason?: string;
}

export interface IssueStockInput {
  itemId: string | Types.ObjectId;
  warehouseId: string | Types.ObjectId;
  locationId?: string | Types.ObjectId;
  batchNumber?: string;
  serialNumber?: string;
  quantity: number;
  transactionType?: InventoryTransactionType;
  referenceType?: string;
  referenceId?: string;
  reason?: string;
  fromReserved?: boolean;
  metadata?: Record<string, any>;
}

export class InventoryService {
  async receiveStock(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    input: ReceiveStockInput
  ): Promise<{ balance: IInventoryBalance; transaction: IInventoryTransaction }> {
    if (input.quantity <= 0) {
      throw new BadRequestError('Received quantity must be greater than zero');
    }

    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);
    const itmId = new Types.ObjectId(input.itemId);
    const whId = new Types.ObjectId(input.warehouseId);
    let locId = input.locationId ? new Types.ObjectId(input.locationId) : undefined;
    const batchNo = input.batchNumber?.trim() || '';

    // 1. Verify item and warehouse belong to tenant
    const [item, warehouse] = await Promise.all([
      Item.findOne({ _id: itmId, tenantId: tId }).exec(),
      Warehouse.findOne({ _id: whId, tenantId: tId }).exec(),
    ]);

    if (!item) throw new NotFoundError('Item not found in this organization');
    if (!warehouse) throw new NotFoundError('Warehouse not found in this organization');

    if (locId) {
      const bin = await Bin.findOne({ _id: locId, warehouseId: whId, tenantId: tId }).exec();
      if (!bin) throw new BadRequestError('Specified bin location does not belong to this warehouse');
    } else {
      // Auto-assign to warehouse's designated physical bin
      locId = await this.resolveDefaultBinForWarehouse(tId, whId);
    }

    const effectiveUnitCost = input.unitCost !== undefined ? input.unitCost : item.standardCost || 0;

    // 2. Fetch existing balance or initialize
    const balanceFilter: any = {
      tenantId: tId,
      itemId: itmId,
      warehouseId: whId,
      locationId: locId || null,
      batchNumber: batchNo,
    };

    let balance = await InventoryBalance.findOne(balanceFilter).exec();
    const currentQty = balance ? balance.quantity : 0;
    const currentAvgCost = balance ? balance.averageCost : effectiveUnitCost;

    // 3. Compute new Weighted Average Cost
    const costing = inventoryCostingService.calculateWeightedAverageCost(
      currentQty,
      currentAvgCost,
      input.quantity,
      effectiveUnitCost
    );

    const newQuantity = currentQty + input.quantity;
    const newReserved = balance ? balance.reservedQuantity : 0;
    const newAvailable = newQuantity - newReserved;

    // 4. Atomically update or insert balance
    balance = await InventoryBalance.findOneAndUpdate(
      balanceFilter,
      {
        $set: {
          quantity: newQuantity,
          availableQuantity: newAvailable,
          averageCost: costing.averageCost,
          totalValue: costing.totalValue,
          updatedAt: new Date(),
        },
      },
      { new: true, upsert: true }
    ).exec();

    // 5. Generate unique transaction number & record in immutable ledger
    const transactionNumber = await documentNumberService.getNextNumber(tId, 'INVENTORY_TXN');

    const transaction = await InventoryTransaction.create({
      tenantId: tId,
      transactionNumber,
      itemId: itmId,
      batchNumber: batchNo,
      serialNumber: input.serialNumber,
      warehouseId: whId,
      locationId: locId,
      transactionType: input.transactionType || 'GENERIC_RECEIPT',
      referenceType: input.referenceType || 'MANUAL',
      referenceId: input.referenceId,
      quantityIn: input.quantity,
      quantityOut: 0,
      balanceBefore: currentQty,
      balanceAfter: newQuantity,
      unitCost: effectiveUnitCost,
      totalValue: Math.round(input.quantity * effectiveUnitCost * 100) / 100,
      userId: uId,
      transactionDate: new Date(),
      reason: input.reason || 'Stock receipt',
      metadata: input.metadata,
    });

    // 6. Record Audit Log
    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.CREATE,
      entity: AuditEntity.INVENTORY,
      entityId: transaction._id.toString(),
      details: `Received ${input.quantity} units of SKU '${item.sku}' into ${warehouse.name} [Txn: ${transactionNumber}]`,
    });

    return { balance, transaction };
  }

  async issueStock(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    input: IssueStockInput
  ): Promise<{ balance: IInventoryBalance; transaction: IInventoryTransaction }> {
    if (input.quantity <= 0) {
      throw new BadRequestError('Issued quantity must be greater than zero');
    }

    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);
    const itmIdRaw = (input.itemId as any)?._id || input.itemId;
    const itmId = new Types.ObjectId(itmIdRaw);
    const whIdRaw = (input.warehouseId as any)?._id || input.warehouseId;
    const whId = new Types.ObjectId(whIdRaw);
    const locIdRaw = (input.locationId as any)?._id || input.locationId;
    const locId = locIdRaw && Types.ObjectId.isValid(locIdRaw.toString()) ? new Types.ObjectId(locIdRaw) : undefined;
    const batchNo = input.batchNumber?.trim() || '';

    // 1. Verify item and warehouse
    const [item, warehouse] = await Promise.all([
      Item.findOne({ _id: itmId, tenantId: tId }).exec(),
      Warehouse.findOne({ _id: whId, tenantId: tId }).exec(),
    ]);

    if (!item) throw new NotFoundError('Item not found');
    if (!warehouse) throw new NotFoundError('Warehouse not found');

    const balanceFilter: any = {
      tenantId: tId,
      itemId: itmId,
      warehouseId: whId,
    };
    if (locId) balanceFilter.locationId = locId;
    if (batchNo) balanceFilter.batchNumber = batchNo;

    // 2. Atomic decrement with concurrency check
    let balance: IInventoryBalance | null = null;
    let newQuantity = 0;
    let newAvailable = 0;
    let newReserved = 0;

    if (input.fromReserved) {
      balance = await InventoryBalance.findOne({
        ...balanceFilter,
        quantity: { $gte: input.quantity },
      }).sort({ createdAt: 1 }).exec();

      // Graceful fallback: If batch or location was specified on the package/form, but balance was stored without
      // that specific batch/bin (or with the warehouse's active lot), find a balance in this warehouse with sufficient stock
      if (!balance && (locId || batchNo)) {
        balance = await InventoryBalance.findOne({
          tenantId: tId,
          itemId: itmId,
          warehouseId: whId,
          quantity: { $gte: input.quantity },
        }).sort({ reservedQuantity: -1, quantity: -1 }).exec();
      }

      if (!balance) {
        const anyBalance = await InventoryBalance.findOne({
          tenantId: tId,
          itemId: itmId,
          warehouseId: whId,
        }).sort({ quantity: -1 }).exec();

        throw new BadRequestError(
          `Insufficient stock to issue for item '${item.sku}' in ${warehouse.name}. Requested: ${input.quantity}${
            anyBalance ? ` (Available in warehouse: ${anyBalance.quantity}, Reserved: ${anyBalance.reservedQuantity || 0})` : ''
          }`
        );
      }

      newQuantity = balance.quantity - input.quantity;
      newReserved = Math.max(0, (balance.reservedQuantity || 0) - input.quantity);
      newAvailable = newQuantity - newReserved;
    } else {
      balance = await InventoryBalance.findOne({
        ...balanceFilter,
        availableQuantity: { $gte: input.quantity },
      }).sort({ createdAt: 1 }).exec();

      // Graceful fallback: If batch or location was specified on the form, but balance was stored without
      // that specific batch/bin in this warehouse, find any balance with sufficient stock for this item
      if (!balance && (locId || batchNo)) {
        balance = await InventoryBalance.findOne({
          tenantId: tId,
          itemId: itmId,
          warehouseId: whId,
          availableQuantity: { $gte: input.quantity },
        }).sort({ availableQuantity: -1 }).exec();
      }

      if (!balance) {
        const anyBalance = await InventoryBalance.findOne({
          tenantId: tId,
          itemId: itmId,
          warehouseId: whId,
        }).sort({ availableQuantity: -1 }).exec();
        throw new BadRequestError(
          `Insufficient stock for item '${item.sku}' in ${warehouse.name}. Available: ${anyBalance ? anyBalance.availableQuantity : 0}, Requested: ${input.quantity}`
        );
      }

      newQuantity = balance.quantity - input.quantity;
      newReserved = balance.reservedQuantity || 0;
      newAvailable = balance.availableQuantity - input.quantity;
    }

    const newTotalValue = Math.round(newQuantity * balance.averageCost * 100) / 100;

    balance.quantity = newQuantity;
    balance.reservedQuantity = newReserved;
    balance.availableQuantity = newAvailable;
    balance.totalValue = newTotalValue;
    balance.updatedAt = new Date();
    await balance.save();

    // 3. Record in immutable ledger
    const transactionNumber = await documentNumberService.getNextNumber(tId, 'INVENTORY_TXN');

    const transaction = await InventoryTransaction.create({
      tenantId: tId,
      transactionNumber,
      itemId: itmId,
      batchNumber: balance.batchNumber || batchNo,
      serialNumber: input.serialNumber,
      warehouseId: whId,
      locationId: balance.locationId || locId,
      transactionType: input.transactionType || 'GENERIC_ISSUE',
      referenceType: input.referenceType || 'MANUAL',
      referenceId: input.referenceId,
      quantityIn: 0,
      quantityOut: input.quantity,
      balanceBefore: balance.quantity + input.quantity, // balance was already decremented above
      balanceAfter: newQuantity,
      unitCost: balance.averageCost,
      totalValue: Math.round(input.quantity * balance.averageCost * 100) / 100,
      userId: uId,
      transactionDate: new Date(),
      reason: input.reason || 'Stock issuance',
      metadata: input.metadata,
    });

    // 4. Audit Log
    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.INVENTORY,
      entityId: transaction._id.toString(),
      details: `Issued ${input.quantity} units of SKU '${item.sku}' from ${warehouse.name} [Txn: ${transactionNumber}]`,
    });

    return { balance, transaction };
  }

  async reserveStock(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    input: ReserveStockInput
  ): Promise<IInventoryBalance> {
    if (input.quantity <= 0) {
      throw new BadRequestError('Reserved quantity must be greater than zero');
    }

    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);
    const itmId = new Types.ObjectId(input.itemId);
    const whId = new Types.ObjectId(input.warehouseId);
    const locId = input.locationId ? new Types.ObjectId(input.locationId) : undefined;
    const batchNo = input.batchNumber?.trim() || '';

    const [item, warehouse] = await Promise.all([
      Item.findOne({ _id: itmId, tenantId: tId }).exec(),
      Warehouse.findOne({ _id: whId, tenantId: tId }).exec(),
    ]);

    if (!item) throw new NotFoundError('Item not found');
    if (!warehouse) throw new NotFoundError('Warehouse not found');

    const balanceFilter: any = {
      tenantId: tId,
      itemId: itmId,
      warehouseId: whId,
    };
    if (locId) balanceFilter.locationId = locId;
    if (batchNo) balanceFilter.batchNumber = batchNo;

    const balance = await InventoryBalance.findOne({
      ...balanceFilter,
      availableQuantity: { $gte: input.quantity },
    }).exec();

    if (!balance) {
      const anyBalance = await InventoryBalance.findOne(balanceFilter).exec();
      throw new BadRequestError(
        `Insufficient available stock to allocate/reserve for item '${item.sku}' in ${warehouse.name}. Available: ${anyBalance ? anyBalance.availableQuantity : 0}, Requested: ${input.quantity}`
      );
    }

    balance.availableQuantity -= input.quantity;
    balance.reservedQuantity = (balance.reservedQuantity || 0) + input.quantity;
    balance.updatedAt = new Date();
    await balance.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.INVENTORY,
      entityId: balance._id.toString(),
      details: `Reserved ${input.quantity} units of '${item.sku}' in ${warehouse.name} for ${input.referenceType || 'SO'} [Ref: ${input.referenceId || 'N/A'}]`,
    });

    return balance;
  }

  async releaseStock(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    input: ReleaseStockInput
  ): Promise<IInventoryBalance> {
    if (input.quantity <= 0) {
      throw new BadRequestError('Released quantity must be greater than zero');
    }

    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);
    const itmId = new Types.ObjectId(input.itemId);
    const whId = new Types.ObjectId(input.warehouseId);
    const locId = input.locationId ? new Types.ObjectId(input.locationId) : undefined;
    const batchNo = input.batchNumber?.trim() || '';

    const [item, warehouse] = await Promise.all([
      Item.findOne({ _id: itmId, tenantId: tId }).exec(),
      Warehouse.findOne({ _id: whId, tenantId: tId }).exec(),
    ]);

    if (!item) throw new NotFoundError('Item not found');
    if (!warehouse) throw new NotFoundError('Warehouse not found');

    const balanceFilter: any = {
      tenantId: tId,
      itemId: itmId,
      warehouseId: whId,
    };
    if (locId) balanceFilter.locationId = locId;
    if (batchNo) balanceFilter.batchNumber = batchNo;

    const balance = await InventoryBalance.findOne(balanceFilter).exec();
    if (!balance) {
      throw new NotFoundError(`No inventory balance found to release for item '${item.sku}' in ${warehouse.name}`);
    }

    const releaseAmount = Math.min(balance.reservedQuantity || 0, input.quantity);
    balance.reservedQuantity = Math.max(0, (balance.reservedQuantity || 0) - releaseAmount);
    balance.availableQuantity += releaseAmount;
    balance.updatedAt = new Date();
    await balance.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.INVENTORY,
      entityId: balance._id.toString(),
      details: `Released ${releaseAmount} reserved units of '${item.sku}' in ${warehouse.name} for ${input.referenceType || 'SO'} [Ref: ${input.referenceId || 'N/A'}]`,
    });

    return balance;
  }

  async getBalances(
    tenantId: string | Types.ObjectId,
    filter: any = {},
    warehouseScope: string[] = [],
    page = 1,
    limit = 20
  ): Promise<{ items: any[]; total: number; page: number; limit: number }> {
    const queryFilter: any = { tenantId: new Types.ObjectId(tenantId) };

    if (filter.itemId) queryFilter.itemId = new Types.ObjectId(filter.itemId);
    const resolvedScope = await resolveWarehouseScope(tenantId, warehouseScope);

    if (filter.warehouseId) {
      if (resolvedScope.isRestricted && !resolvedScope.isAuthorized(filter.warehouseId)) {
        throw new ForbiddenError('You do not have access to view stock for this warehouse');
      }
      queryFilter.warehouseId = new Types.ObjectId(filter.warehouseId);
    } else if (resolvedScope.isRestricted && resolvedScope.objectIds.length > 0) {
      queryFilter.warehouseId = { $in: resolvedScope.objectIds };
    }

    if (filter.lowStockOnly) {
      // Handled in pipeline or items threshold join
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      InventoryBalance.find(queryFilter)
        .populate('itemId')
        .populate('warehouseId')
        .populate('locationId')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      InventoryBalance.countDocuments(queryFilter).exec(),
    ]);

    let formatted = items.map((b) => {
      const itm = b.itemId as any;
      const wh = b.warehouseId as any;
      const loc = b.locationId as any;

      let stockStatus = 'NORMAL';
      if (itm) {
        if (b.availableQuantity <= 0) stockStatus = 'OUT_OF_STOCK';
        else if (b.availableQuantity <= (itm.minimumStock || 0)) stockStatus = 'CRITICAL';
        else if (b.availableQuantity <= (itm.reorderLevel || 0)) stockStatus = 'LOW';
      }

      let locationData = loc
        ? { id: loc._id, code: loc.code, name: loc.name }
        : wh
        ? { id: 'default', code: `${wh.code}-BIN1`, name: `${wh.name || wh.code} Primary Bin` }
        : null;

      return {
        id: b._id,
        item: itm
          ? {
              id: itm._id,
              sku: itm.sku,
              itemCode: itm.itemCode,
              name: itm.name,
              itemType: itm.itemType,
              reorderLevel: itm.reorderLevel,
              minimumStock: itm.minimumStock,
            }
          : null,
        warehouse: wh ? { id: wh._id, code: wh.code, name: wh.name } : null,
        location: locationData,
        batchNumber: b.batchNumber,
        quantity: b.quantity,
        reservedQuantity: b.reservedQuantity,
        availableQuantity: b.availableQuantity,
        averageCost: b.averageCost,
        totalValue: b.totalValue,
        stockStatus,
        updatedAt: b.updatedAt,
      };
    });

    if (filter.lowStockOnly) {
      formatted = formatted.filter(
        (b) => b.stockStatus === 'CRITICAL' || b.stockStatus === 'LOW' || b.stockStatus === 'OUT_OF_STOCK'
      );
    }

    return { items: formatted, total: filter.lowStockOnly ? formatted.length : total, page, limit };
  }

  async getLedger(
    tenantId: string | Types.ObjectId,
    filter: any = {},
    warehouseScope: string[] = [],
    page = 1,
    limit = 25
  ): Promise<{ items: any[]; total: number; page: number; limit: number }> {
    const queryFilter: any = { tenantId: new Types.ObjectId(tenantId) };

    if (filter.itemId) queryFilter.itemId = new Types.ObjectId(filter.itemId);
    if (filter.referenceId) queryFilter.referenceId = filter.referenceId;
    if (filter.userId) queryFilter.userId = new Types.ObjectId(filter.userId);

    // Support transaction type matching (including grouped variants like issue/return/adjustment)
    if (filter.transactionType) {
      if (filter.transactionType === 'STOCK_ISSUE' || filter.transactionType === 'GENERIC_ISSUE') {
        queryFilter.transactionType = { $in: ['STOCK_ISSUE', 'GENERIC_ISSUE'] };
      } else if (filter.transactionType === 'RETURN_OUT' || filter.transactionType === 'PURCHASE_RETURN') {
        queryFilter.transactionType = { $in: ['RETURN_OUT', 'PURCHASE_RETURN'] };
      } else if (filter.transactionType === 'CYCLE_COUNT_ADJUSTMENT') {
        queryFilter.transactionType = 'STOCK_ADJUSTMENT';
      } else {
        queryFilter.transactionType = filter.transactionType;
      }
    }

    const resolvedScope = await resolveWarehouseScope(tenantId, warehouseScope);

    if (filter.warehouseId) {
      if (resolvedScope.isRestricted && !resolvedScope.isAuthorized(filter.warehouseId)) {
        throw new ForbiddenError('You do not have access to view transactions for this warehouse');
      }
      queryFilter.warehouseId = new Types.ObjectId(filter.warehouseId);
    } else if (resolvedScope.isRestricted && resolvedScope.objectIds.length > 0) {
      queryFilter.warehouseId = { $in: resolvedScope.objectIds };
    }

    if (filter.startDate || filter.endDate) {
      queryFilter.transactionDate = {};
      if (filter.startDate) {
        const start = new Date(filter.startDate);
        if (!isNaN(start.getTime())) {
          queryFilter.transactionDate.$gte = start;
        }
      }
      if (filter.endDate) {
        const end = new Date(filter.endDate);
        if (!isNaN(end.getTime())) {
          if (typeof filter.endDate === 'string' && filter.endDate.length <= 10) {
            end.setUTCHours(23, 59, 59, 999);
          }
          queryFilter.transactionDate.$lte = end;
        }
      }
    }

    // Backend full-text search across transaction numbers, references, batches, items, and warehouses
    if (filter.search && typeof filter.search === 'string' && filter.search.trim()) {
      const q = filter.search.trim();
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');

      const [matchingItems, matchingWarehouses] = await Promise.all([
        Item.find({
          tenantId: queryFilter.tenantId,
          $or: [{ sku: regex }, { name: regex }, { itemCode: regex }],
        }).select('_id').exec(),
        Warehouse.find({
          tenantId: queryFilter.tenantId,
          $or: [{ code: regex }, { name: regex }],
        }).select('_id').exec(),
      ]);

      const itemIds = matchingItems.map((it) => it._id);
      const warehouseIds = matchingWarehouses.map((wh) => wh._id);

      const orConditions: any[] = [
        { transactionNumber: regex },
        { referenceId: regex },
        { referenceType: regex },
        { batchNumber: regex },
        { serialNumber: regex },
        { reason: regex },
        { transactionType: regex },
      ];

      if (itemIds.length > 0) {
        orConditions.push({ itemId: { $in: itemIds } });
      }
      if (warehouseIds.length > 0) {
        orConditions.push({ warehouseId: { $in: warehouseIds } });
      }

      queryFilter.$or = orConditions;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      InventoryTransaction.find(queryFilter)
        .populate('itemId')
        .populate('warehouseId')
        .populate('locationId')
        .populate('userId', 'name email')
        .sort({ transactionDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      InventoryTransaction.countDocuments(queryFilter).exec(),
    ]);

    const formatted = items.map((t) => {
      const itm = t.itemId as any;
      const wh = t.warehouseId as any;
      const loc = t.locationId as any;
      const u = t.userId as any;

      return {
        id: t._id,
        transactionNumber: t.transactionNumber,
        item: itm ? { id: itm._id, sku: itm.sku, name: itm.name, itemCode: itm.itemCode } : null,
        warehouse: wh ? { id: wh._id, code: wh.code, name: wh.name } : null,
        location: loc ? { id: loc._id, code: loc.code } : null,
        batchNumber: t.batchNumber,
        serialNumber: t.serialNumber,
        transactionType: t.transactionType,
        referenceType: t.referenceType,
        referenceId: t.referenceId,
        quantityIn: t.quantityIn,
        quantityOut: t.quantityOut,
        balanceBefore: t.balanceBefore ?? null,
        balanceAfter: t.balanceAfter,
        unitCost: t.unitCost,
        totalValue: t.totalValue,
        user: u ? { id: u._id, name: u.name, email: u.email } : null,
        transactionDate: t.transactionDate,
        reason: t.reason,
        metadata: t.metadata,
      };
    });

    return { items: formatted, total, page, limit };
  }

  async getTransactionById(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<any> {
    const tId = new Types.ObjectId(tenantId);
    const txn = await InventoryTransaction.findOne({
      _id: new Types.ObjectId(id),
      tenantId: tId,
    })
      .populate('itemId')
      .populate('warehouseId')
      .populate('locationId')
      .populate('userId', 'name email')
      .exec();

    if (!txn) throw new NotFoundError('Transaction not found');

    const itm = txn.itemId as any;
    const wh = txn.warehouseId as any;
    const loc = txn.locationId as any;
    const u = txn.userId as any;

    return {
      id: txn._id,
      transactionNumber: txn.transactionNumber,
      item: itm ? { id: itm._id, sku: itm.sku, name: itm.name, itemCode: itm.itemCode } : null,
      warehouse: wh ? { id: wh._id, code: wh.code, name: wh.name } : null,
      location: loc ? { id: loc._id, code: loc.code, name: loc.name } : null,
      batchNumber: txn.batchNumber,
      serialNumber: txn.serialNumber,
      transactionType: txn.transactionType,
      referenceType: txn.referenceType,
      referenceId: txn.referenceId,
      quantityIn: txn.quantityIn,
      quantityOut: txn.quantityOut,
      balanceBefore: txn.balanceBefore ?? null,
      balanceAfter: txn.balanceAfter,
      unitCost: txn.unitCost,
      totalValue: txn.totalValue,
      user: u ? { id: u._id, name: u.name, email: u.email } : null,
      transactionDate: txn.transactionDate,
      reason: txn.reason,
      metadata: txn.metadata,
      createdAt: txn.createdAt,
    };
  }

  async getItemTransactions(
    tenantId: string | Types.ObjectId,
    itemId: string | Types.ObjectId,
    filter: any = {},
    page = 1,
    limit = 25
  ): Promise<{ items: any[]; total: number; page: number; limit: number; currentStock: number }> {
    const tId = new Types.ObjectId(tenantId);
    const itmId = new Types.ObjectId(itemId);

    const queryFilter: any = { tenantId: tId, itemId: itmId };
    if (filter.warehouseId) queryFilter.warehouseId = new Types.ObjectId(filter.warehouseId);
    if (filter.transactionType) queryFilter.transactionType = filter.transactionType;
    if (filter.startDate || filter.endDate) {
      queryFilter.transactionDate = {};
      if (filter.startDate) queryFilter.transactionDate.$gte = new Date(filter.startDate);
      if (filter.endDate) queryFilter.transactionDate.$lte = new Date(filter.endDate);
    }

    const skip = (page - 1) * limit;

    const [items, total, balanceAgg] = await Promise.all([
      InventoryTransaction.find(queryFilter)
        .populate('warehouseId', 'code name')
        .populate('locationId', 'code name')
        .populate('userId', 'name email')
        .sort({ transactionDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      InventoryTransaction.countDocuments(queryFilter).exec(),
      InventoryBalance.aggregate([
        { $match: { tenantId: tId, itemId: itmId } },
        { $group: { _id: null, total: { $sum: '$quantity' } } },
      ]),
    ]);

    const currentStock = balanceAgg.length > 0 ? balanceAgg[0].total : 0;

    const formatted = items.map((t) => {
      const wh = t.warehouseId as any;
      const loc = t.locationId as any;
      const u = t.userId as any;
      return {
        id: t._id,
        transactionNumber: t.transactionNumber,
        warehouse: wh ? { id: wh._id, code: wh.code, name: wh.name } : null,
        location: loc ? { id: loc._id, code: loc.code } : null,
        batchNumber: t.batchNumber,
        transactionType: t.transactionType,
        referenceType: t.referenceType,
        referenceId: t.referenceId,
        quantityIn: t.quantityIn,
        quantityOut: t.quantityOut,
        balanceBefore: t.balanceBefore ?? null,
        balanceAfter: t.balanceAfter,
        unitCost: t.unitCost,
        totalValue: t.totalValue,
        user: u ? { name: u.name, email: u.email } : null,
        transactionDate: t.transactionDate,
        reason: t.reason,
      };
    });

    return { items: formatted, total, page, limit, currentStock };
  }

  async getOverviewStats(
    tenantId: string | Types.ObjectId,
    warehouseScope: string[] = []
  ): Promise<any> {
    const tId = new Types.ObjectId(tenantId);
    const balanceFilter: any = { tenantId: tId };

    const resolvedScope = await resolveWarehouseScope(tId, warehouseScope);

    if (resolvedScope.isRestricted) {
      balanceFilter.warehouseId = { $in: resolvedScope.objectIds };
    }

    const [totalSkus, balances, totalTransactions] = await Promise.all([
      Item.countDocuments({ tenantId: tId, status: 'ACTIVE' }),
      InventoryBalance.find(balanceFilter).populate('itemId').exec(),
      InventoryTransaction.countDocuments({ tenantId: tId }),
    ]);

    let totalStockUnits = 0;
    let totalValuation = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const b of balances) {
      totalStockUnits += (b.quantity || 0);
      totalValuation += (b.totalValue || 0);

      const itm = b.itemId as any;
      if (itm) {
        const avail = b.availableQuantity !== undefined && b.availableQuantity !== null ? b.availableQuantity : (b.quantity || 0);
        const reorder = itm.reorderLevel !== undefined && itm.reorderLevel !== null ? itm.reorderLevel : 0;
        if (avail <= 0) outOfStockCount++;
        else if (avail <= reorder) lowStockCount++;
      }
    }

    return {
      totalSkus: totalSkus || 0,
      totalStockUnits: totalStockUnits || 0,
      totalValuation: isNaN(totalValuation) ? 0 : Math.round(totalValuation * 100) / 100,
      lowStockCount: lowStockCount || 0,
      outOfStockCount: outOfStockCount || 0,
      totalTransactions: totalTransactions || 0,
    };
  }

  /**
   * Resolves or auto-creates an active physical bin for a given warehouse.
   */
  async resolveDefaultBinForWarehouse(
    tenantId: Types.ObjectId,
    warehouseId: Types.ObjectId
  ): Promise<Types.ObjectId | undefined> {
    try {
      // 1. Look for any active bin in this warehouse
      const existingBin = await Bin.findOne({
        warehouseId,
        tenantId,
        status: { $ne: 'INACTIVE' },
      })
        .sort({ createdAt: 1 })
        .exec();

      if (existingBin) {
        return existingBin._id;
      }

      // 2. No bin found: ensure Zone, Rack, and default Bin exist
      let zone = await Zone.findOne({ warehouseId, tenantId, status: { $ne: 'INACTIVE' } }).exec();
      if (!zone) {
        zone = await Zone.create({
          tenantId,
          warehouseId,
          code: 'ZONE-A',
          name: 'General Storage Bay A',
          status: 'ACTIVE',
        });
      }

      let rack = await Rack.findOne({ zoneId: zone._id, tenantId, status: { $ne: 'INACTIVE' } }).exec();
      if (!rack) {
        rack = await Rack.create({
          tenantId,
          warehouseId,
          zoneId: zone._id,
          code: 'RACK-01',
          name: 'Heavy Storage Rack 01',
          status: 'ACTIVE',
        });
      }

      const defaultBin = await Bin.create({
        tenantId,
        warehouseId,
        zoneId: zone._id,
        rackId: rack._id,
        code: 'BIN-01',
        name: 'Primary Storage Bay 01',
        status: 'ACTIVE',
      });

      return defaultBin._id;
    } catch (err: any) {
      logger.warn(`Could not resolve or create default bin for warehouse ${warehouseId}: ${err.message}`);
      return undefined;
    }
  }

  /**
   * Auto-provisions storage bins for all warehouses and backfills legacy stock balances missing locations.
   */
  async ensureWarehouseBinsAndBackfill(): Promise<void> {
    try {
      const warehouses = await Warehouse.find({ status: { $ne: 'INACTIVE' } }).exec();
      logger.info(`[InventoryService] Verifying bins for ${warehouses.length} active warehouses...`);

      for (const wh of warehouses) {
        await this.resolveDefaultBinForWarehouse(wh.tenantId, wh._id);
      }

      // Find all inventory balances with null or missing locationId
      const unassignedBalances = await InventoryBalance.find({
        $or: [{ locationId: null }, { locationId: { $exists: false } }],
      }).exec();

      if (unassignedBalances.length > 0) {
        logger.info(
          `[InventoryService] Found ${unassignedBalances.length} stock balances without a bin location. Backfilling...`
        );

        for (const balance of unassignedBalances) {
          const targetBinId = await this.resolveDefaultBinForWarehouse(balance.tenantId, balance.warehouseId);
          if (!targetBinId) continue;

          // Check if a balance record already exists for the same item, warehouse, bin, and batch
          const existingTarget = await InventoryBalance.findOne({
            tenantId: balance.tenantId,
            itemId: balance.itemId,
            warehouseId: balance.warehouseId,
            locationId: targetBinId,
            batchNumber: balance.batchNumber || '',
            _id: { $ne: balance._id },
          }).exec();

          if (existingTarget) {
            existingTarget.quantity += balance.quantity;
            existingTarget.reservedQuantity += balance.reservedQuantity;
            existingTarget.availableQuantity += balance.availableQuantity;
            existingTarget.totalValue += balance.totalValue;
            if (existingTarget.quantity > 0) {
              existingTarget.averageCost = existingTarget.totalValue / existingTarget.quantity;
            }
            await existingTarget.save();
            await InventoryBalance.deleteOne({ _id: balance._id }).exec();
          } else {
            balance.locationId = targetBinId;
            await balance.save();
          }
        }
        logger.info(`[InventoryService] Successfully assigned physical storage bins to all stock balances.`);
      }

      // Also backfill transactions where locationId is null
      const unassignedTxns = await InventoryTransaction.find({
        $or: [{ locationId: null }, { locationId: { $exists: false } }],
      })
        .limit(500)
        .exec();

      for (const txn of unassignedTxns) {
        const binId = await this.resolveDefaultBinForWarehouse(txn.tenantId, txn.warehouseId);
        if (binId) {
          txn.locationId = binId;
          await txn.save();
        }
      }
    } catch (err: any) {
      logger.error(`[InventoryService] Error during bin backfill: ${err.message}`);
    }
  }
}

export const inventoryService = new InventoryService();
