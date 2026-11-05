import { Types } from 'mongoose';
import { SalesOrder, ISalesOrder, ISalesOrderItem } from '../models/salesOrder.model';
import { Customer } from '../../../models/customer.model';
import { Item } from '../../../models/item.model';
import { Warehouse } from '../../../models/warehouse.model';
import { InventoryBalance } from '../../../models/inventoryBalance.model';
import { inventoryService } from '../../../services/inventory.service';
import { documentNumberService } from '../../../services/documentNumber.service';
import { salesOrderApprovalService } from './salesOrderApproval.service';
import { auditRepository } from '../../../repositories/audit.repository';
import { AuditAction, AuditEntity } from '../../../config/constants';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../../core/errors';

export interface ItemAvailabilityReport {
  itemId: string;
  sku: string;
  name: string;
  warehouseId: string;
  warehouseName: string;
  requestedQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  freeQuantity: number;
  alreadyAllocated: number;
  shortfall: number;
  status: 'SUFFICIENT' | 'SHORTFALL' | 'OUT_OF_STOCK';
}

export class SalesOrderService {
  async createSalesOrder(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    data: any
  ): Promise<ISalesOrder> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const customer = await Customer.findOne({ _id: data.customerId, tenantId: tId }).exec();
    if (!customer) throw new NotFoundError('Customer not found in this organization');

    const warehouse = await Warehouse.findOne({ _id: data.warehouseId, tenantId: tId }).exec();
    if (!warehouse) throw new NotFoundError('Warehouse not found in this organization');

    let calculatedSubtotal = 0;
    let calculatedTax = 0;
    let calculatedDiscount = 0;

    const items: ISalesOrderItem[] = [];
    for (const line of data.items) {
      const item = await Item.findOne({ _id: line.itemId, tenantId: tId }).exec();
      if (!item) throw new NotFoundError(`Item ${line.itemId} not found`);

      const qty = Number(line.orderedQuantity);
      const unitPrice = Number(line.unitPrice);
      const discount = Number(line.discount || 0);
      const taxRate = Number(line.taxRate || 0);

      const lineSubtotal = Math.round(qty * unitPrice * 100) / 100;
      const lineTax = Math.round((lineSubtotal - discount) * (taxRate / 100) * 100) / 100;
      const lineTotal = Math.round((lineSubtotal - discount + lineTax) * 100) / 100;

      calculatedSubtotal += lineSubtotal;
      calculatedTax += lineTax;
      calculatedDiscount += discount;

      items.push({
        itemId: item._id,
        description: line.description || item.name,
        orderedQuantity: qty,
        uomId: line.uomId ? new Types.ObjectId(line.uomId) : (item.salesUomId || item.baseUomId),
        unitPrice,
        discount,
        taxRate,
        taxAmount: lineTax,
        lineSubtotal,
        lineTotal,
        warehouseId: warehouse._id,
        allocatedQuantity: 0,
        packedQuantity: 0,
        dispatchedQuantity: 0,
        invoicedQuantity: 0,
        pendingQuantity: qty,
        remarks: line.remarks,
      });
    }

    const shippingAmount = Number(data.shippingAmount || 0);
    const grandTotal =
      Math.round((calculatedSubtotal - calculatedDiscount + calculatedTax + shippingAmount) * 100) / 100;

    const soNumber = await documentNumberService.getNextNumber(tId, 'SALES_ORDER');

    const so = await SalesOrder.create({
      tenantId: tId,
      soNumber,
      customerId: customer._id,
      warehouseId: warehouse._id,
      deliveryAddress: data.deliveryAddress || customer.shippingAddress,
      billingAddress: data.billingAddress || customer.billingAddress,
      paymentTermId: data.paymentTermId ? new Types.ObjectId(data.paymentTermId) : undefined,
      orderDate: data.orderDate ? new Date(data.orderDate) : new Date(),
      requestedDeliveryDate: data.requestedDeliveryDate
        ? new Date(data.requestedDeliveryDate)
        : undefined,
      currency: data.currency || customer.currency || 'USD',
      subtotal: calculatedSubtotal,
      discountAmount: calculatedDiscount,
      taxAmount: calculatedTax,
      shippingAmount,
      grandTotal,
      notes: data.notes,
      attachments: data.attachments || [],
      status: 'DRAFT',
      approvalStatus: 'PENDING',
      items,
      createdBy: uId,
      updatedBy: uId,
    });

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.CREATE,
      entity: AuditEntity.SALES,
      entityId: so._id.toString(),
      details: `Created draft Sales Order ${soNumber} for ${customer.name} [Grand Total: $${grandTotal.toLocaleString()}]`,
    });

    return so;
  }

  async getSalesOrders(
    tenantId: string | Types.ObjectId,
    query: any = {},
    userScope?: any
  ): Promise<{ data: ISalesOrder[]; total: number; page: number; limit: number }> {
    const tId = new Types.ObjectId(tenantId);
    const filter: any = { tenantId: tId };

    if (query.status) {
      filter.status = query.status;
    }
    if (query.customerId) {
      filter.customerId = new Types.ObjectId(query.customerId);
    }
    if (query.warehouseId) {
      filter.warehouseId = new Types.ObjectId(query.warehouseId);
    }

    if (userScope?.warehouses && userScope.warehouses.length > 0) {
      filter.warehouseId = { $in: userScope.warehouses.map((id: string) => new Types.ObjectId(id)) };
    }

    if (query.search) {
      const s = query.search.trim();
      filter.$or = [{ soNumber: { $regex: s, $options: 'i' } }, { notes: { $regex: s, $options: 'i' } }];
    }

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      SalesOrder.find(filter)
        .populate('customerId', 'name customerCode email phone creditLimit')
        .populate('warehouseId', 'name code')
        .populate('items.itemId', 'name sku itemCode purchasePrice standardCost')
        .populate('items.uomId', 'name symbol')
        .populate('createdBy', 'firstName lastName name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      SalesOrder.countDocuments(filter).exec(),
    ]);

    return { data, total, page, limit };
  }

  async getSalesOrderById(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    userScope?: any
  ): Promise<ISalesOrder> {
    const tId = new Types.ObjectId(tenantId);
    const so = await SalesOrder.findOne({ _id: id, tenantId: tId })
      .populate('customerId')
      .populate('warehouseId')
      .populate('paymentTermId')
      .populate('items.itemId')
      .populate('items.uomId')
      .populate('createdBy', 'name firstName lastName email')
      .populate('approvedBy', 'name firstName lastName email')
      .populate('confirmedBy', 'name firstName lastName email')
      .exec();

    if (!so) throw new NotFoundError('Sales Order not found');

    if (userScope?.warehouses && userScope.warehouses.length > 0) {
      const whIdStr = so.warehouseId._id ? so.warehouseId._id.toString() : so.warehouseId.toString();
      if (!userScope.warehouses.includes(whIdStr)) {
        throw new ForbiddenError('You do not have access to view orders for this facility');
      }
    }

    return so;
  }

  async updateSalesOrder(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    data: any
  ): Promise<ISalesOrder> {
    const tId = new Types.ObjectId(tenantId);
    const so = await SalesOrder.findOne({ _id: id, tenantId: tId }).exec();
    if (!so) throw new NotFoundError('Sales Order not found');

    if (so.status !== 'DRAFT') {
      throw new BadRequestError(`Cannot edit Sales Order in '${so.status}' status. Only DRAFT orders may be modified.`);
    }

    if (data.notes !== undefined) so.notes = data.notes;
    if (data.requestedDeliveryDate) so.requestedDeliveryDate = new Date(data.requestedDeliveryDate);
    if (data.deliveryAddress) so.deliveryAddress = data.deliveryAddress;
    if (data.billingAddress) so.billingAddress = data.billingAddress;
    so.updatedBy = new Types.ObjectId(userId);

    await so.save();
    return so;
  }

  async submitSalesOrder(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<ISalesOrder> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const so = await SalesOrder.findOne({ _id: id, tenantId: tId }).exec();
    if (!so) throw new NotFoundError('Sales Order not found');

    if (so.status !== 'DRAFT') {
      throw new BadRequestError(`Cannot submit Sales Order in '${so.status}' status`);
    }

    so.status = 'SUBMITTED';
    so.approvalStatus = 'PENDING';
    so.updatedBy = uId;
    await so.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.SALES,
      entityId: so._id.toString(),
      details: `Submitted Sales Order ${so.soNumber} for authorization sign-off`,
    });

    return so;
  }

  async approveSalesOrder(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<ISalesOrder> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const so = await SalesOrder.findOne({ _id: id, tenantId: tId }).exec();
    if (!so) throw new NotFoundError('Sales Order not found');

    if (so.status !== 'SUBMITTED') {
      throw new BadRequestError(`Cannot approve Sales Order in '${so.status}' status`);
    }

    const check = await salesOrderApprovalService.canUserApproveSO(uId.toString(), so.grandTotal);
    if (!check.allowed) {
      throw new ForbiddenError(check.reason || 'Insufficient approval authority for this order');
    }

    so.status = 'APPROVED';
    so.approvalStatus = 'APPROVED';
    so.approvedBy = uId;
    so.approvedAt = new Date();
    so.updatedBy = uId;
    await so.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.APPROVE,
      entity: AuditEntity.SALES,
      entityId: so._id.toString(),
      details: `Approved Sales Order ${so.soNumber} [Amount: $${so.grandTotal.toLocaleString()}]`,
    });

    return so;
  }

  async rejectSalesOrder(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    reason: string
  ): Promise<ISalesOrder> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const so = await SalesOrder.findOne({ _id: id, tenantId: tId }).exec();
    if (!so) throw new NotFoundError('Sales Order not found');

    if (so.status !== 'SUBMITTED') {
      throw new BadRequestError(`Cannot reject Sales Order in '${so.status}' status`);
    }

    so.status = 'REJECTED';
    so.approvalStatus = 'REJECTED';
    so.rejectedBy = uId;
    so.rejectedAt = new Date();
    so.rejectionReason = reason;
    so.updatedBy = uId;
    await so.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.REJECT,
      entity: AuditEntity.SALES,
      entityId: so._id.toString(),
      details: `Rejected Sales Order ${so.soNumber}. Reason: ${reason}`,
    });

    return so;
  }

  async checkAvailability(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<ItemAvailabilityReport[]> {
    const tId = new Types.ObjectId(tenantId);
    const so = await SalesOrder.findOne({ _id: id, tenantId: tId })
      .populate('items.itemId')
      .populate('warehouseId')
      .exec();

    if (!so) throw new NotFoundError('Sales Order not found');

    const reports: ItemAvailabilityReport[] = [];

    for (const itemLine of so.items) {
      const itm = itemLine.itemId as any;
      const wh = (itemLine.warehouseId || so.warehouseId) as any;

      const balances = await InventoryBalance.find({
        tenantId: tId,
        itemId: itm._id,
        warehouseId: wh._id || wh,
      }).exec();

      const totalAvail = balances.reduce((acc, b) => acc + (b.availableQuantity || 0), 0);
      const totalReserved = balances.reduce((acc, b) => acc + (b.reservedQuantity || 0), 0);
      const alreadyAllocated = itemLine.allocatedQuantity || 0;
      const shortfall = Math.max(0, itemLine.orderedQuantity - totalAvail);

      let status: 'SUFFICIENT' | 'SHORTFALL' | 'OUT_OF_STOCK' = 'SUFFICIENT';
      if (totalAvail <= 0) {
        status = 'OUT_OF_STOCK';
      } else if (shortfall > 0) {
        status = 'SHORTFALL';
      }

      reports.push({
        itemId: itm._id.toString(),
        sku: itm.sku || itm.code || 'N/A',
        name: itm.name || 'Unknown Item',
        warehouseId: (wh._id || wh).toString(),
        warehouseName: wh.name || 'Target Warehouse',
        requestedQuantity: itemLine.orderedQuantity,
        availableQuantity: totalAvail,
        reservedQuantity: totalReserved,
        freeQuantity: totalAvail,
        alreadyAllocated,
        shortfall,
        status,
      });
    }

    return reports;
  }

  async confirmSalesOrder(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<ISalesOrder> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const so = await SalesOrder.findOne({ _id: id, tenantId: tId }).exec();
    if (!so) throw new NotFoundError('Sales Order not found');

    if (so.status !== 'APPROVED') {
      throw new BadRequestError(`Cannot confirm Sales Order in '${so.status}' status. Order must be APPROVED first.`);
    }

    // 1. Validate availability for every item before executing reservation
    const availability = await this.checkAvailability(tId, id);
    const shortfalls = availability.filter((a) => a.shortfall > 0);
    if (shortfalls.length > 0) {
      const details = shortfalls
        .map((s) => `${s.name} (Requested: ${s.requestedQuantity}, Available: ${s.availableQuantity}, Shortfall: ${s.shortfall})`)
        .join(', ');
      throw new BadRequestError(`Cannot confirm Sales Order due to insufficient stock: ${details}`);
    }

    // 2. Reserve stock atomically across all line items
    for (const itemLine of so.items) {
      const whId = itemLine.warehouseId || so.warehouseId;
      await inventoryService.reserveStock(tId, uId, {
        itemId: itemLine.itemId,
        warehouseId: whId,
        quantity: itemLine.orderedQuantity,
        referenceType: 'SALES_ORDER',
        referenceId: so.soNumber,
        reason: `Sales Order confirmation: ${so.soNumber}`,
      });
      itemLine.allocatedQuantity = itemLine.orderedQuantity;
    }

    so.status = 'CONFIRMED';
    so.confirmedBy = uId;
    so.confirmedAt = new Date();
    so.updatedBy = uId;
    await so.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.SALES,
      entityId: so._id.toString(),
      details: `Confirmed Sales Order ${so.soNumber} and allocated stock for all ${so.items.length} line items`,
    });

    return so;
  }

  async cancelSalesOrder(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    reason: string
  ): Promise<ISalesOrder> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const so = await SalesOrder.findOne({ _id: id, tenantId: tId }).exec();
    if (!so) throw new NotFoundError('Sales Order not found');

    if (['FULFILLED', 'CANCELLED'].includes(so.status)) {
      throw new BadRequestError(`Cannot cancel Sales Order in '${so.status}' status`);
    }

    // If stock was confirmed/allocated, release reservations
    if (['CONFIRMED', 'PARTIALLY_FULFILLED'].includes(so.status)) {
      for (const line of so.items) {
        const remainingToRelease = Math.max(0, (line.allocatedQuantity || 0) - (line.dispatchedQuantity || 0));
        if (remainingToRelease > 0) {
          const whId = line.warehouseId || so.warehouseId;
          await inventoryService.releaseStock(tId, uId, {
            itemId: line.itemId,
            warehouseId: whId,
            quantity: remainingToRelease,
            referenceType: 'SALES_ORDER',
            referenceId: so.soNumber,
            reason: `Sales Order cancellation: ${so.soNumber}`,
          });
        }
      }
    }

    so.status = 'CANCELLED';
    so.cancelledBy = uId;
    so.cancelledAt = new Date();
    so.cancellationReason = reason;
    so.updatedBy = uId;
    await so.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.SALES,
      entityId: so._id.toString(),
      details: `Cancelled Sales Order ${so.soNumber}. Reason: ${reason}`,
    });

    return so;
  }

  /**
   * Generates a physical bin-optimized Pick-List for warehouse fulfillment.
   */
  async getPickList(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<any> {
    const tId = new Types.ObjectId(tenantId);
    const so = await SalesOrder.findOne({ _id: id, tenantId: tId })
      .populate('customerId', 'name customerCode')
      .populate('warehouseId', 'code name')
      .populate('items.itemId')
      .populate('items.uomId')
      .exec();

    if (!so) throw new NotFoundError('Sales Order not found');

    const groupedItems: any[] = [];
    let totalUnitsToPick = 0;

    for (const line of so.items) {
      const itm = line.itemId as any;
      const whId = line.warehouseId || so.warehouseId;
      const neededQty = line.orderedQuantity - (line.packedQuantity || 0);

      // Find stock balances in this warehouse with physical bin locations
      const balances = await InventoryBalance.find({
        tenantId: tId,
        itemId: itm?._id || itm,
        warehouseId: (whId as any)?._id || whId,
        quantity: { $gt: 0 },
      })
        .populate({
          path: 'locationId',
          populate: [
            { path: 'zoneId', select: 'code name' },
            { path: 'rackId', select: 'code name' },
          ],
        })
        .sort({ batchNumber: 1, updatedAt: 1 })
        .exec();

      let remainingToPick = Math.max(0, neededQty);
      const locationDetails: any[] = [];

      for (const bal of balances) {
        if (remainingToPick <= 0) break;

        const pickFromThisBal = Math.min(bal.quantity, remainingToPick);
        const loc = bal.locationId as any;

        locationDetails.push({
          balanceId: bal._id.toString(),
          warehouseId: bal.warehouseId?.toString() || '',
          locationId: loc?._id?.toString() || '',
          locationCode: loc?.code || 'MAIN-BIN',
          zone: loc?.zoneId?.name || loc?.zoneId?.code || 'Default Zone',
          aisle: loc?.aisle || 'A1',
          rack: loc?.rackId?.name || loc?.rackId?.code || 'Rack 1',
          shelf: loc?.shelf || 'Level 1',
          bin: loc?.name || loc?.code || 'Bin 1',
          lotNumber: bal.batchNumber || 'STANDARD',
          availableQuantity: bal.quantity,
          pickSuggestQty: pickFromThisBal,
        });

        remainingToPick -= pickFromThisBal;
        totalUnitsToPick += pickFromThisBal;
      }

      groupedItems.push({
        itemId: itm?._id?.toString() || itm?.toString() || '',
        itemSku: itm?.sku || 'SKU',
        itemName: itm?.name || line.description || 'Item',
        uom: (line.uomId as any)?.symbol || (line.uomId as any)?.code || (line.uomId as any)?.name || 'pcs',
        orderedQuantity: line.orderedQuantity,
        allocatedQuantity: line.allocatedQuantity || 0,
        packedQuantity: line.packedQuantity || 0,
        toPickQuantity: neededQty,
        locationDetails,
      });
    }

    return {
      salesOrderId: so._id.toString(),
      soNumber: so.soNumber,
      warehouseId: (so.warehouseId as any)?.name || (so.warehouseId as any)?._id || so.warehouseId,
      customer: so.customerId,
      salesOrder: {
        id: so._id,
        soNumber: so.soNumber,
        customerName: (so.customerId as any)?.name,
        customerCode: (so.customerId as any)?.customerCode,
        orderDate: so.orderDate,
        warehouseCode: (so.warehouseId as any)?.code,
        warehouseName: (so.warehouseId as any)?.name,
        status: so.status,
      },
      pickList: groupedItems,
      totalUnitsToPick,
      generatedAt: new Date(),
    };
  }
}

export const salesOrderService = new SalesOrderService();
