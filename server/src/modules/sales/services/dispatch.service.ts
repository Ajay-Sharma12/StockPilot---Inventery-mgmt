import { Types } from 'mongoose';
import { Dispatch, IDispatch } from '../models/dispatch.model';
import { Package } from '../models/package.model';
import { SalesOrder } from '../models/salesOrder.model';
import { inventoryService } from '../../../services/inventory.service';
import { documentNumberService } from '../../../services/documentNumber.service';
import { auditRepository } from '../../../repositories/audit.repository';
import { AuditAction, AuditEntity } from '../../../config/constants';
import { BadRequestError, NotFoundError } from '../../../core/errors';

export class DispatchService {
  async createDispatch(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    data: any
  ): Promise<IDispatch> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const so = await SalesOrder.findOne({ _id: data.salesOrderId, tenantId: tId }).exec();
    if (!so) throw new NotFoundError('Sales Order not found');

    const packages = await Package.find({
      _id: { $in: data.packageIds.map((id: string) => new Types.ObjectId(id)) },
      tenantId: tId,
      salesOrderId: so._id,
    }).exec();

    if (packages.length !== data.packageIds.length) {
      throw new BadRequestError('One or more selected packages do not exist or do not belong to this Sales Order');
    }

    const unreadyPackages = packages.filter((p) => p.status !== 'PACKED');
    if (unreadyPackages.length > 0) {
      throw new BadRequestError('All packages included in a dispatch must be in PACKED status');
    }

    const dispatchNumber = await documentNumberService.getNextNumber(tId, 'DISPATCH');

    const dispatch = await Dispatch.create({
      tenantId: tId,
      dispatchNumber,
      salesOrderId: so._id,
      customerId: so.customerId,
      warehouseId: so.warehouseId,
      packageIds: packages.map((p) => p._id),
      carrier: data.carrier,
      vehicleNumber: data.vehicleNumber,
      driverName: data.driverName,
      driverContact: data.driverContact,
      trackingNumber: data.trackingNumber,
      shippingAddress: data.shippingAddress || so.deliveryAddress,
      dispatchDate: data.dispatchDate ? new Date(data.dispatchDate) : new Date(),
      status: 'READY',
      inventoryIssued: false,
      inventoryTransactionIds: [],
      remarks: data.remarks,
      createdBy: uId,
      updatedBy: uId,
    });

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.CREATE,
      entity: AuditEntity.SALES,
      entityId: dispatch._id.toString(),
      details: `Created Dispatch ${dispatchNumber} for Sales Order ${so.soNumber} with ${packages.length} container(s)`,
    });

    return dispatch;
  }

  async dispatchOrder(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    dispatchId: string | Types.ObjectId
  ): Promise<IDispatch> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const dispatch = await Dispatch.findOne({ _id: dispatchId, tenantId: tId }).exec();
    if (!dispatch) throw new NotFoundError('Dispatch not found');

    if (dispatch.status === 'DISPATCHED' || dispatch.inventoryIssued) {
      throw new BadRequestError('Inventory has already been issued for this dispatch shipment');
    }
    if (dispatch.status === 'CANCELLED') {
      throw new BadRequestError('Cannot dispatch a cancelled shipment record');
    }

    const so = await SalesOrder.findOne({ _id: dispatch.salesOrderId, tenantId: tId }).exec();
    if (!so) throw new NotFoundError('Associated Sales Order not found');

    const packages = await Package.find({
      _id: { $in: dispatch.packageIds },
      tenantId: tId,
    }).exec();

    // 1. Aggregate items across all packages in this dispatch
    const itemQuantitiesToIssue: Map<string, { quantity: number; batchNumber?: string; uomId?: string }> = new Map();

    for (const pkg of packages) {
      for (const item of pkg.items) {
        const key = `${item.itemId.toString()}__${item.batchNumber || ''}`;
        const existing = itemQuantitiesToIssue.get(key);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          itemQuantitiesToIssue.set(key, {
            quantity: item.quantity,
            batchNumber: item.batchNumber,
            uomId: item.uomId?.toString(),
          });
        }
      }
    }

    // 2. Validate over-dispatch: dispatched cannot exceed ordered
    for (const [key, val] of itemQuantitiesToIssue.entries()) {
      const [itemIdStr] = key.split('__');
      const soLine = so.items.find((i) => i.itemId.toString() === itemIdStr);
      if (!soLine) {
        throw new BadRequestError(`Item ${itemIdStr} does not belong to Sales Order ${so.soNumber}`);
      }
      const remainingDispatchable = soLine.orderedQuantity - (soLine.dispatchedQuantity || 0);
      if (val.quantity > remainingDispatchable) {
        throw new BadRequestError(
          `Cannot dispatch ${val.quantity} units of '${soLine.description}'. Maximum remaining dispatchable is ${remainingDispatchable} units.`
        );
      }
    }

    // 3. Issue stock through the Centralized Inventory Engine (InventoryService.issueStock)
    const transactionIds: Types.ObjectId[] = [];
    for (const [key, val] of itemQuantitiesToIssue.entries()) {
      const [itemIdStr] = key.split('__');
      const soLine = so.items.find((i) => i.itemId.toString() === itemIdStr)!;
      const whId = soLine.warehouseId || so.warehouseId;

      const { transaction } = await inventoryService.issueStock(tId, uId, {
        itemId: new Types.ObjectId(itemIdStr),
        warehouseId: whId,
        quantity: val.quantity,
        batchNumber: val.batchNumber,
        fromReserved: true, // Deducts from reserved allocations
        transactionType: 'SALE',
        referenceType: 'SALES_ORDER',
        referenceId: so.soNumber,
        reason: `Sales Order dispatch: ${so.soNumber} [Dispatch: ${dispatch.dispatchNumber}]`,
      });

      transactionIds.push(transaction._id);

      // Update SO line tracking
      soLine.dispatchedQuantity = (soLine.dispatchedQuantity || 0) + val.quantity;
      soLine.pendingQuantity = Math.max(0, soLine.orderedQuantity - soLine.dispatchedQuantity);
    }

    // 4. Update Sales Order status (PARTIALLY_FULFILLED vs FULFILLED)
    const allFulfilled = so.items.every((i) => (i.dispatchedQuantity || 0) >= i.orderedQuantity);
    so.status = allFulfilled ? 'FULFILLED' : 'PARTIALLY_FULFILLED';
    so.updatedBy = uId;
    await so.save();

    // 5. Update Dispatch status
    dispatch.status = 'DISPATCHED';
    dispatch.inventoryIssued = true;
    dispatch.inventoryTransactionIds = transactionIds;
    dispatch.dispatchedBy = uId;
    dispatch.dispatchedAt = new Date();
    dispatch.updatedBy = uId;
    await dispatch.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.STATUS_CHANGE,
      entity: AuditEntity.SALES,
      entityId: dispatch._id.toString(),
      details: `Dispatched shipment ${dispatch.dispatchNumber} for SO ${so.soNumber}. Status updated to ${so.status}`,
    });

    return dispatch;
  }

  async getDispatches(
    tenantId: string | Types.ObjectId,
    query: any = {}
  ): Promise<{ data: IDispatch[]; total: number; page: number; limit: number }> {
    const tId = new Types.ObjectId(tenantId);
    const filter: any = { tenantId: tId };

    if (query.salesOrderId) filter.salesOrderId = new Types.ObjectId(query.salesOrderId);
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { dispatchNumber: { $regex: query.search.trim(), $options: 'i' } },
        { trackingNumber: { $regex: query.search.trim(), $options: 'i' } },
        { carrier: { $regex: query.search.trim(), $options: 'i' } },
      ];
    }

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Dispatch.find(filter)
        .populate('salesOrderId', 'soNumber status grandTotal orderDate items')
        .populate('customerId', 'name customerCode')
        .populate('warehouseId', 'name code')
        .populate('packageIds', 'packageNumber totalWeight items status')
        .populate('dispatchedBy', 'name firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Dispatch.countDocuments(filter).exec(),
    ]);

    return { data, total, page, limit };
  }

  async getDispatchById(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IDispatch> {
    const tId = new Types.ObjectId(tenantId);
    const dispatch = await Dispatch.findOne({ _id: id, tenantId: tId })
      .populate('salesOrderId')
      .populate('customerId')
      .populate('warehouseId')
      .populate('packageIds')
      .populate('inventoryTransactionIds')
      .populate('dispatchedBy', 'name firstName lastName email')
      .exec();

    if (!dispatch) throw new NotFoundError('Dispatch not found');
    return dispatch;
  }

  async cancelDispatch(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    reason?: string
  ): Promise<IDispatch> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const dispatch = await Dispatch.findOne({ _id: id, tenantId: tId }).exec();
    if (!dispatch) throw new NotFoundError('Dispatch not found');

    if (dispatch.status === 'DISPATCHED' || dispatch.inventoryIssued) {
      throw new BadRequestError('Cannot cancel a dispatch after stock has been physically issued from warehouse');
    }

    dispatch.status = 'CANCELLED';
    dispatch.updatedBy = uId;
    await dispatch.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.SALES,
      entityId: dispatch._id.toString(),
      details: `Cancelled Dispatch ${dispatch.dispatchNumber}`,
    });

    return dispatch;
  }
}

export const dispatchService = new DispatchService();
