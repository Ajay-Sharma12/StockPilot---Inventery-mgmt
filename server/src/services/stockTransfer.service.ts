import { Types } from 'mongoose';
import { StockTransfer, IStockTransfer } from '../models/stockTransfer.model';
import { inventoryService } from './inventory.service';
import { documentNumberService } from './documentNumber.service';
import { BadRequestError, NotFoundError, ForbiddenError } from '../core/errors';
import { InventoryBalance } from '../models/inventoryBalance.model';
import { resolveWarehouseScope } from '../core/warehouseScope';

export class StockTransferService {
  async getTransfers(
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

    if (resolvedScope.isRestricted && resolvedScope.objectIds.length > 0) {
      queryFilter.$or = [
        { fromWarehouseId: { $in: resolvedScope.objectIds } },
        { toWarehouseId: { $in: resolvedScope.objectIds } },
      ];
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      StockTransfer.find(queryFilter)
        .populate('fromWarehouseId', 'name code')
        .populate('toWarehouseId', 'name code')
        .populate('requestedBy', 'name email')
        .populate('items.itemId', 'sku name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      StockTransfer.countDocuments(queryFilter).exec(),
    ]);

    return { items, total, page, limit };
  }

  async getTransferById(tenantId: string | Types.ObjectId, id: string | Types.ObjectId): Promise<IStockTransfer> {
    const transfer = await StockTransfer.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    })
      .populate('fromWarehouseId', 'name code')
      .populate('toWarehouseId', 'name code')
      .populate('fromLocationId', 'code name')
      .populate('toLocationId', 'code name')
      .populate('items.itemId', 'sku name reorderLevel')
      .populate('requestedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('dispatchedBy', 'name email')
      .populate('receivedBy', 'name email')
      .exec();

    if (!transfer) throw new NotFoundError('Stock transfer order not found');
    return transfer;
  }

  async createTransfer(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    data: {
      fromWarehouseId: string;
      toWarehouseId: string;
      fromLocationId?: string;
      toLocationId?: string;
      items: Array<{
        itemId: string;
        batchNumber?: string;
        requestedQuantity: number;
      }>;
      remarks?: string;
    },
    warehouseScope: string[] = []
  ): Promise<IStockTransfer> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    if (data.fromWarehouseId === data.toWarehouseId) {
      throw new BadRequestError('Source and destination warehouses cannot be the same');
    }

    const resolvedScope = await resolveWarehouseScope(tId, warehouseScope);
    if (resolvedScope.isRestricted && !resolvedScope.isAuthorized(data.fromWarehouseId)) {
      throw new ForbiddenError('You do not have permission to initiate transfers from this warehouse');
    }

    if (!data.items || data.items.length === 0) {
      throw new BadRequestError('At least one item is required in the transfer order');
    }

    // Populate unit cost from source warehouse balance
    const itemsWithCost = await Promise.all(
      data.items.map(async (item) => {
        const balance = await InventoryBalance.findOne({
          tenantId: tId,
          itemId: new Types.ObjectId(item.itemId),
          warehouseId: new Types.ObjectId(data.fromWarehouseId),
        }).exec();

        return {
          itemId: new Types.ObjectId(item.itemId),
          batchNumber: item.batchNumber,
          requestedQuantity: item.requestedQuantity,
          dispatchedQuantity: 0,
          receivedQuantity: 0,
          unitCost: balance ? balance.averageCost : 0,
        };
      })
    );

    const transferNumber = await documentNumberService.getNextNumber(tId, 'STOCK_TRANSFER');

    return StockTransfer.create({
      tenantId: tId,
      transferNumber,
      fromWarehouseId: new Types.ObjectId(data.fromWarehouseId),
      fromLocationId: data.fromLocationId ? new Types.ObjectId(data.fromLocationId) : undefined,
      toWarehouseId: new Types.ObjectId(data.toWarehouseId),
      toLocationId: data.toLocationId ? new Types.ObjectId(data.toLocationId) : undefined,
      items: itemsWithCost,
      status: 'DRAFT',
      requestedBy: uId,
      remarks: data.remarks,
    });
  }

  async submitTransfer(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IStockTransfer> {
    const transfer = await this.getTransferById(tenantId, id);
    if (transfer.status !== 'DRAFT') {
      throw new BadRequestError(`Cannot submit transfer in '${transfer.status}' status`);
    }

    transfer.status = 'SUBMITTED';
    await transfer.save();
    return transfer;
  }

  async approveTransfer(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<IStockTransfer> {
    const transfer = await this.getTransferById(tenantId, id);
    if (transfer.status !== 'SUBMITTED' && transfer.status !== 'DRAFT') {
      throw new BadRequestError(`Cannot approve transfer in '${transfer.status}' status`);
    }

    transfer.status = 'APPROVED';
    transfer.approvedBy = new Types.ObjectId(userId);
    await transfer.save();
    return transfer;
  }

  async dispatchTransfer(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    warehouseScope: string[] = []
  ): Promise<IStockTransfer> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);
    const transfer = await this.getTransferById(tId, id);

    if (transfer.status !== 'APPROVED') {
      throw new BadRequestError(`Only approved transfers can be dispatched (current: ${transfer.status})`);
    }

    const resolvedScope = await resolveWarehouseScope(tId, warehouseScope);
    const fromWhId = transfer.fromWarehouseId._id ? transfer.fromWarehouseId._id.toString() : transfer.fromWarehouseId.toString();
    if (resolvedScope.isRestricted && !resolvedScope.isAuthorized(fromWhId)) {
      throw new ForbiddenError('You do not have permission to dispatch from source warehouse');
    }

    // Deduct stock from source warehouse via Central Inventory Engine
    for (const itm of transfer.items) {
      const issueResult = await inventoryService.issueStock(tId, uId, {
        itemId: itm.itemId._id || itm.itemId,
        warehouseId: transfer.fromWarehouseId._id || transfer.fromWarehouseId,
        locationId: transfer.fromLocationId,
        batchNumber: itm.batchNumber,
        quantity: itm.requestedQuantity,
        transactionType: 'TRANSFER_OUT',
        referenceType: 'STOCK_TRANSFER',
        referenceId: transfer._id.toString(),
        reason: `Dispatched Transfer ${transfer.transferNumber}`,
      });

      itm.dispatchedQuantity = itm.requestedQuantity;
      itm.unitCost = issueResult.transaction.unitCost;
    }

    transfer.status = 'DISPATCHED';
    transfer.dispatchedBy = uId;
    transfer.dispatchedDate = new Date();
    await transfer.save();

    return transfer;
  }

  async receiveTransfer(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    receivedQuantities?: Record<string, number>,
    warehouseScope: string[] = []
  ): Promise<IStockTransfer> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);
    const transfer = await this.getTransferById(tId, id);

    if (transfer.status !== 'DISPATCHED') {
      throw new BadRequestError(`Only dispatched transfers can be received (current: ${transfer.status})`);
    }

    const resolvedScope = await resolveWarehouseScope(tId, warehouseScope);
    const toWhId = transfer.toWarehouseId._id ? transfer.toWarehouseId._id.toString() : transfer.toWarehouseId.toString();
    if (resolvedScope.isRestricted && !resolvedScope.isAuthorized(toWhId)) {
      throw new ForbiddenError('You do not have permission to receive into destination warehouse');
    }

    // Add stock into destination warehouse via Central Inventory Engine
    for (const itm of transfer.items) {
      const itemIdStr = (itm.itemId._id || itm.itemId).toString();
      const qtyToReceive =
        receivedQuantities && receivedQuantities[itemIdStr] !== undefined
          ? receivedQuantities[itemIdStr]
          : itm.dispatchedQuantity;

      if (qtyToReceive > 0) {
        await inventoryService.receiveStock(tId, uId, {
          itemId: itm.itemId._id || itm.itemId,
          warehouseId: transfer.toWarehouseId._id || transfer.toWarehouseId,
          locationId: transfer.toLocationId,
          batchNumber: itm.batchNumber,
          quantity: qtyToReceive,
          unitCost: itm.unitCost,
          transactionType: 'TRANSFER_IN',
          referenceType: 'STOCK_TRANSFER',
          referenceId: transfer._id.toString(),
          reason: `Received Transfer ${transfer.transferNumber}`,
        });
      }

      itm.receivedQuantity = qtyToReceive;
    }

    transfer.status = 'COMPLETED';
    transfer.receivedBy = uId;
    transfer.receivedDate = new Date();
    await transfer.save();

    return transfer;
  }
}

export const stockTransferService = new StockTransferService();
