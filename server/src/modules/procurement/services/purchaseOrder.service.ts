import { Types } from 'mongoose';
import { PurchaseOrder, IPurchaseOrder, POStatus } from '../models/purchaseOrder.model';
import { SupplierQuote } from '../models/supplierQuote.model';
import { RFQ } from '../models/rfq.model';
import { Supplier } from '../../../models/supplier.model';
import { Warehouse } from '../../../models/warehouse.model';
import { Item } from '../../../models/item.model';
import { UOM } from '../../../models/uom.model';
import { PaymentTerm } from '../../../models/paymentTerm.model';
import { procurementApprovalService } from './procurementApproval.service';
import { documentNumberService } from '../../../services/documentNumber.service';
import { auditRepository } from '../../../repositories/audit.repository';
import { AuditAction, AuditEntity } from '../../../config/constants';
import { Tenant } from '../../../models/tenant.model';
import { emailService } from '../../../services/email.service';
import { smsService } from '../../../services/sms.service';
import { logger } from '../../../core/logger';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../../core/errors';

export class PurchaseOrderService {
  async getPurchaseOrders(
    tenantId: string | Types.ObjectId,
    query: {
      status?: POStatus;
      supplierId?: string;
      warehouseId?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ data: IPurchaseOrder[]; total: number; page: number; limit: number }> {
    const tId = new Types.ObjectId(tenantId);
    const filter: any = { tenantId: tId };

    if (query.status) filter.status = query.status;
    if (query.supplierId && Types.ObjectId.isValid(query.supplierId)) {
      filter.supplierId = new Types.ObjectId(query.supplierId);
    }
    if (query.warehouseId && Types.ObjectId.isValid(query.warehouseId)) {
      filter.warehouseId = new Types.ObjectId(query.warehouseId);
    }
    if (query.search) {
      filter.$or = [
        { poNumber: { $regex: query.search.trim(), $options: 'i' } },
        { notes: { $regex: query.search.trim(), $options: 'i' } },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      PurchaseOrder.find(filter)
        .populate('supplierId', 'name supplierCode email phone')
        .populate('warehouseId', 'name code')
        .populate('paymentTermsId', 'name code days')
        .populate('items.itemId', 'name sku itemCode standardCost qcRequired batchManaged expiryManaged')
        .populate('items.uomId', 'name symbol code')
        .populate('approvedBy', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      PurchaseOrder.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async getPOById(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IPurchaseOrder> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Invalid Purchase Order identifier');

    const po = await PurchaseOrder.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    })
      .populate('supplierId', 'name supplierCode email phone address taxNumber paymentTerms currency')
      .populate('warehouseId', 'name code address')
      .populate('paymentTermsId', 'name code days')
      .populate('sourceQuoteId', 'quoteNumber total quoteDate')
      .populate('sourceRFQId', 'rfqNumber issueDate')
      .populate('sourcePRIds', 'prNumber purpose')
      .populate('items.itemId', 'name sku itemCode standardCost qcRequired batchManaged expiryManaged')
      .populate('items.uomId', 'name symbol code')
      .populate('approvedBy', 'name email')
      .populate('rejectedBy', 'name email')
      .populate('createdBy', 'name email')
      .exec();

    if (!po) throw new NotFoundError('Purchase Order not found');
    return po;
  }

  async createPO(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    data: any
  ): Promise<IPurchaseOrder> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    // Validate supplier
    const supplier = await Supplier.findOne({ _id: new Types.ObjectId(data.supplierId), tenantId: tId });
    if (!supplier) throw new NotFoundError('Supplier not found in organization');
    if (supplier.status === 'BLOCKED') throw new BadRequestError(`Supplier '${supplier.name}' is blocked`);

    // Validate warehouse
    const wh = await Warehouse.findOne({ _id: new Types.ObjectId(data.warehouseId), tenantId: tId });
    if (!wh) throw new NotFoundError('Destination warehouse not found in organization');

    // Link lineage from sourceQuoteId if provided
    let sourceRFQId: Types.ObjectId | undefined;
    let sourcePRIds: Types.ObjectId[] = [];

    if (data.sourceQuoteId && Types.ObjectId.isValid(data.sourceQuoteId)) {
      const quote = await SupplierQuote.findOne({
        _id: new Types.ObjectId(data.sourceQuoteId),
        tenantId: tId,
      });
      if (quote) {
        sourceRFQId = quote.rfqId;
        const rfq = await RFQ.findOne({ _id: quote.rfqId, tenantId: tId });
        if (rfq && rfq.sourcePRIds && rfq.sourcePRIds.length > 0) {
          sourcePRIds = rfq.sourcePRIds;
        }
      }
    } else if (data.sourcePRIds && Array.isArray(data.sourcePRIds)) {
      sourcePRIds = data.sourcePRIds
        .filter((id: string) => Types.ObjectId.isValid(id))
        .map((id: string) => new Types.ObjectId(id));
    }

    // Validate items and calculate lines
    let calculatedSubtotal = 0;
    const validatedItems = [];

    for (const itemInput of data.items) {
      const item = await Item.findOne({ _id: new Types.ObjectId(itemInput.itemId), tenantId: tId });
      if (!item) throw new NotFoundError(`Item '${itemInput.itemId}' not found in organization`);
      if (item.status !== 'ACTIVE') throw new BadRequestError(`Item '${item.name}' is inactive`);

      const uom = await UOM.findOne({ _id: new Types.ObjectId(itemInput.uomId), tenantId: tId });
      if (!uom) throw new NotFoundError(`UOM '${itemInput.uomId}' not found in organization`);

      const lineTotal =
        Math.round(
          (itemInput.quantity * itemInput.unitPrice - (itemInput.discount || 0) + (itemInput.tax || 0)) * 100
        ) / 100;
      calculatedSubtotal += lineTotal;

      validatedItems.push({
        itemId: item._id,
        description: itemInput.description || item.name,
        quantity: itemInput.quantity,
        uomId: uom._id,
        unitPrice: itemInput.unitPrice,
        discount: itemInput.discount || 0,
        tax: itemInput.tax || 0,
        lineTotal,
        expectedDeliveryDate: itemInput.expectedDeliveryDate
          ? new Date(itemInput.expectedDeliveryDate)
          : undefined,
        receivedQuantity: 0,
        pendingQuantity: itemInput.quantity,
        remarks: itemInput.remarks,
      });
    }

    const overallDiscount = data.discount || 0;
    const overallTax = data.tax || 0;
    const total = Math.round((calculatedSubtotal - overallDiscount + overallTax) * 100) / 100;

    const poNumber = await documentNumberService.getNextNumber(tId, 'PURCHASE_ORDER');

    const po = await PurchaseOrder.create({
      tenantId: tId,
      poNumber,
      supplierId: supplier._id,
      sourceQuoteId: data.sourceQuoteId ? new Types.ObjectId(data.sourceQuoteId) : undefined,
      sourceRFQId,
      sourcePRIds,
      orderDate: new Date(),
      expectedDeliveryDate: new Date(data.expectedDeliveryDate),
      warehouseId: wh._id,
      paymentTermsId: data.paymentTermsId ? new Types.ObjectId(data.paymentTermsId) : undefined,
      currency: data.currency || supplier.currency || 'USD',
      shippingTerms: data.shippingTerms,
      subtotal: calculatedSubtotal,
      discount: overallDiscount,
      tax: overallTax,
      total,
      notes: data.notes,
      attachments: data.attachments || [],
      status: 'DRAFT',
      items: validatedItems,
      revisions: [],
      createdBy: uId,
    });

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.CREATE,
      entity: AuditEntity.PURCHASE,
      entityId: po._id.toString(),
      details: `Generated Purchase Order ${poNumber} for supplier '${supplier.name}' totaling $${total.toLocaleString()}`,
    });

    return this.getPOById(tId, po._id);
  }

  async updatePO(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    data: any
  ): Promise<IPurchaseOrder> {
    const po = await this.getPOById(tenantId, id);
    const uId = new Types.ObjectId(userId);

    // If PO is already received, commercial fields cannot be mutated
    if (po.status === 'PARTIALLY_RECEIVED' || po.status === 'FULLY_RECEIVED' || po.status === 'CLOSED') {
      throw new BadRequestError(`Cannot modify PO in '${po.status}' state`);
    }

    // Controlled PO revisions if PO was already APPROVED or SENT
    if (po.status === 'APPROVED' || po.status === 'SENT') {
      const revisionNumber = (po.revisions?.length || 0) + 1;
      const previousValues = {
        subtotal: po.subtotal,
        discount: po.discount,
        tax: po.tax,
        total: po.total,
        expectedDeliveryDate: po.expectedDeliveryDate,
        itemsCount: po.items.length,
      };

      po.revisions.push({
        revisionNumber,
        previousValues,
        changedFields: Object.keys(data),
        reason: data.revisionReason || 'Operational order modification',
        changedBy: uId,
        changedAt: new Date(),
      });
    }

    if (data.expectedDeliveryDate) po.expectedDeliveryDate = new Date(data.expectedDeliveryDate);
    if (data.notes !== undefined) po.notes = data.notes;
    if (data.shippingTerms !== undefined) po.shippingTerms = data.shippingTerms;

    po.updatedBy = uId;
    await po.save();

    await auditRepository.create({
      tenantId: new Types.ObjectId(tenantId),
      userId: uId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.PURCHASE,
      entityId: po._id.toString(),
      details: `Updated Purchase Order ${po.poNumber}`,
    });

    return this.getPOById(tenantId, po._id);
  }

  async submitPO(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IPurchaseOrder> {
    const po = await this.getPOById(tenantId, id);
    if (po.status !== 'DRAFT') {
      throw new BadRequestError(`Only DRAFT orders can be submitted (Current: ${po.status})`);
    }

    po.status = 'SUBMITTED';
    po.updatedBy = new Types.ObjectId(userId);
    await po.save();

    await auditRepository.create({
      tenantId: new Types.ObjectId(tenantId),
      userId: new Types.ObjectId(userId),
      action: AuditAction.STATUS_CHANGE,
      entity: AuditEntity.PURCHASE,
      entityId: po._id.toString(),
      details: `Submitted Purchase Order ${po.poNumber} for managerial approval ($${po.total.toLocaleString()})`,
      previousState: { status: 'DRAFT' },
      newState: { status: 'SUBMITTED' },
    });

    return this.getPOById(tenantId, po._id);
  }

  async approvePO(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IPurchaseOrder> {
    const po = await this.getPOById(tenantId, id);
    if (po.status !== 'SUBMITTED') {
      throw new BadRequestError(`Only SUBMITTED orders can be approved (Current: ${po.status})`);
    }

    // Evaluate ABAC financial approval threshold
    const approvalCheck = await procurementApprovalService.canUserApprovePO(userId.toString(), po.total);
    if (!approvalCheck.allowed) {
      throw new ForbiddenError(approvalCheck.reason || 'Approval limit exceeded');
    }

    po.status = 'APPROVED';
    po.approvedAt = new Date();
    po.approvedBy = new Types.ObjectId(userId);
    po.updatedBy = new Types.ObjectId(userId);
    await po.save();

    await auditRepository.create({
      tenantId: new Types.ObjectId(tenantId),
      userId: new Types.ObjectId(userId),
      action: AuditAction.APPROVE,
      entity: AuditEntity.PURCHASE,
      entityId: po._id.toString(),
      details: `Approved Purchase Order ${po.poNumber} for $${po.total.toLocaleString()}`,
      previousState: { status: 'SUBMITTED' },
      newState: { status: 'APPROVED' },
    });

    return this.getPOById(tenantId, po._id);
  }

  async rejectPO(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    reason: string
  ): Promise<IPurchaseOrder> {
    const po = await this.getPOById(tenantId, id);
    if (po.status !== 'SUBMITTED') {
      throw new BadRequestError(`Only SUBMITTED orders can be rejected (Current: ${po.status})`);
    }

    po.status = 'REJECTED';
    po.rejectedAt = new Date();
    po.rejectedBy = new Types.ObjectId(userId);
    po.rejectionReason = reason;
    po.updatedBy = new Types.ObjectId(userId);
    await po.save();

    await auditRepository.create({
      tenantId: new Types.ObjectId(tenantId),
      userId: new Types.ObjectId(userId),
      action: AuditAction.REJECT,
      entity: AuditEntity.PURCHASE,
      entityId: po._id.toString(),
      details: `Rejected Purchase Order ${po.poNumber}. Reason: ${reason}`,
      previousState: { status: 'SUBMITTED' },
      newState: { status: 'REJECTED', reason },
    });

    return this.getPOById(tenantId, po._id);
  }

  async sendPO(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    options?: { recipientEmail?: string; recipientPhone?: string; updateSupplier?: boolean }
  ): Promise<IPurchaseOrder> {
    const po = await this.getPOById(tenantId, id);
    if (po.status !== 'APPROVED' && po.status !== 'SENT') {
      throw new BadRequestError(`Only APPROVED or SENT orders can be dispatched to vendor (Current: ${po.status})`);
    }

    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    // Retrieve organization tenant name
    const tenant = await Tenant.findById(tId).select('name');
    const tenantName = tenant?.name || 'StockPilot Enterprise';

    const supplierData: any = po.supplierId;
    const supplierName = supplierData?.name || 'Valued Partner';
    const supplierEmail = options?.recipientEmail?.trim() || supplierData?.email || supplierData?.contactEmail;
    const supplierPhone = options?.recipientPhone?.trim() || supplierData?.phone;

    // If custom phone or email provided and updateSupplier enabled, save to supplier master
    if (supplierData?._id && options?.updateSupplier) {
      const updateFields: any = {};
      if (options.recipientPhone?.trim()) updateFields.phone = options.recipientPhone.trim();
      if (options.recipientEmail?.trim()) updateFields.email = options.recipientEmail.trim();
      if (Object.keys(updateFields).length > 0) {
        await Supplier.findByIdAndUpdate(supplierData._id, updateFields);
      }
    }

    const warehouseData: any = po.warehouseId;
    const warehouseName = warehouseData?.name || 'Central Facility';
    const warehouseAddress = typeof warehouseData?.address === 'object'
      ? [warehouseData.address.street, warehouseData.address.city, warehouseData.address.state, warehouseData.address.postalCode]
          .filter(Boolean)
          .join(', ')
      : (warehouseData?.address || '');

    const deliveryDateFormatted = po.items[0]?.expectedDeliveryDate
      ? new Date(po.items[0].expectedDeliveryDate).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : 'As agreed in quotation';

    const orderDateFormatted = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const itemsSummary = (po.items || []).map((it: any) => ({
      name: it.itemId?.name || it.description || 'Purchased Item',
      quantity: it.quantity,
      uom: it.uomId?.symbol || it.uomId?.code || 'pcs',
      unitPrice: it.unitPrice,
      lineTotal: it.lineTotal,
    }));

    // Trigger Multi-Channel Notifications (Email + Phone SMS: "Please Supply Goods")
    let emailSuccess = false;
    let smsSuccess = false;

    if (supplierEmail) {
      try {
        emailSuccess = await emailService.sendPurchaseOrderDispatchEmail({
          to: supplierEmail,
          supplierName,
          poNumber: po.poNumber,
          orderDate: orderDateFormatted,
          deliveryDate: deliveryDateFormatted,
          warehouseName,
          warehouseAddress,
          totalAmount: po.total,
          items: itemsSummary,
          tenantName,
          remarks: po.notes || po.shippingTerms,
        });
      } catch (err) {
        logger.error(`Failed to send PO dispatch email to ${supplierEmail}:`, err);
      }
    }

    if (supplierPhone) {
      try {
        const smsResult = await smsService.sendPOSupplyOrderSMS(
          supplierPhone,
          supplierName,
          po.poNumber,
          po.total,
          deliveryDateFormatted,
          warehouseName,
          tenantName
        );
        smsSuccess = smsResult.success;
      } catch (err) {
        logger.error(`Failed to send PO supply SMS to ${supplierPhone}:`, err);
      }
    }

    po.status = 'SENT';
    po.sentAt = new Date();
    po.notifiedAt = new Date();
    po.emailSent = emailSuccess;
    po.smsSent = smsSuccess;
    po.updatedBy = uId;
    await po.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.STATUS_CHANGE,
      entity: AuditEntity.PURCHASE,
      entityId: po._id.toString(),
      details: `Dispatched Purchase Order ${po.poNumber} to supplier '${supplierName}' (Email: ${emailSuccess ? 'Sent to ' + supplierEmail : 'Skipped/Missing'}, SMS: ${smsSuccess ? 'Sent to ' + supplierPhone : 'Skipped/Missing'})`,
      previousState: { status: 'APPROVED' },
      newState: { status: 'SENT' },
    });

    return this.getPOById(tenantId, po._id);
  }

  async resendNotification(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    options?: { recipientEmail?: string; recipientPhone?: string; updateSupplier?: boolean }
  ): Promise<IPurchaseOrder> {
    const po = await this.getPOById(tenantId, id);
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const tenant = await Tenant.findById(tId).select('name');
    const tenantName = tenant?.name || 'StockPilot Enterprise';

    const supplierData: any = po.supplierId;
    const supplierName = supplierData?.name || 'Valued Partner';
    const supplierEmail = options?.recipientEmail?.trim() || supplierData?.email || supplierData?.contactEmail;
    const supplierPhone = options?.recipientPhone?.trim() || supplierData?.phone;

    // If custom phone or email provided and updateSupplier enabled, save to supplier master
    if (supplierData?._id && options?.updateSupplier) {
      const updateFields: any = {};
      if (options.recipientPhone?.trim()) updateFields.phone = options.recipientPhone.trim();
      if (options.recipientEmail?.trim()) updateFields.email = options.recipientEmail.trim();
      if (Object.keys(updateFields).length > 0) {
        await Supplier.findByIdAndUpdate(supplierData._id, updateFields);
      }
    }

    const warehouseData: any = po.warehouseId;
    const warehouseName = warehouseData?.name || 'Central Facility';
    const warehouseAddress = typeof warehouseData?.address === 'object'
      ? [warehouseData.address.street, warehouseData.address.city, warehouseData.address.state, warehouseData.address.postalCode]
          .filter(Boolean)
          .join(', ')
      : (warehouseData?.address || '');

    const deliveryDateFormatted = po.items[0]?.expectedDeliveryDate
      ? new Date(po.items[0].expectedDeliveryDate).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : 'As agreed in quotation';

    const orderDateFormatted = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const itemsSummary = (po.items || []).map((it: any) => ({
      name: it.itemId?.name || it.description || 'Purchased Item',
      quantity: it.quantity,
      uom: it.uomId?.symbol || it.uomId?.code || 'pcs',
      unitPrice: it.unitPrice,
      lineTotal: it.lineTotal,
    }));

    let emailSuccess = false;
    let smsSuccess = false;

    if (supplierEmail) {
      try {
        emailSuccess = await emailService.sendPurchaseOrderDispatchEmail({
          to: supplierEmail,
          supplierName,
          poNumber: po.poNumber,
          orderDate: orderDateFormatted,
          deliveryDate: deliveryDateFormatted,
          warehouseName,
          warehouseAddress,
          totalAmount: po.total,
          items: itemsSummary,
          tenantName,
          remarks: po.notes || po.shippingTerms,
        });
      } catch (err) {
        logger.error(`Failed to resend PO dispatch email to ${supplierEmail}:`, err);
      }
    }

    if (supplierPhone) {
      try {
        const smsResult = await smsService.sendPOSupplyOrderSMS(
          supplierPhone,
          supplierName,
          po.poNumber,
          po.total,
          deliveryDateFormatted,
          warehouseName,
          tenantName
        );
        smsSuccess = smsResult.success;
      } catch (err) {
        logger.error(`Failed to resend PO supply SMS to ${supplierPhone}:`, err);
      }
    }

    po.notifiedAt = new Date();
    if (emailSuccess) po.emailSent = true;
    if (smsSuccess) po.smsSent = true;
    po.updatedBy = uId;
    await po.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.PURCHASE,
      entityId: po._id.toString(),
      details: `Dispatched Purchase Order ${po.poNumber} notification to supplier '${supplierName}' (Email: ${emailSuccess ? 'Sent to ' + supplierEmail : 'Skipped/Missing'}, SMS: ${smsSuccess ? 'Sent to ' + supplierPhone : 'Skipped/Missing'})`,
    });

    return this.getPOById(tenantId, po._id);
  }

  async cancelPO(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    reason?: string
  ): Promise<IPurchaseOrder> {
    const po = await this.getPOById(tenantId, id);
    const hasReceipts = po.items.some((i) => i.receivedQuantity > 0);
    if (hasReceipts) {
      throw new BadRequestError('Cannot cancel Purchase Order with existing goods receipts');
    }

    po.status = 'CANCELLED';
    po.rejectionReason = reason;
    po.updatedBy = new Types.ObjectId(userId);
    await po.save();

    await auditRepository.create({
      tenantId: new Types.ObjectId(tenantId),
      userId: new Types.ObjectId(userId),
      action: AuditAction.STATUS_CHANGE,
      entity: AuditEntity.PURCHASE,
      entityId: po._id.toString(),
      details: `Cancelled Purchase Order ${po.poNumber}. Reason: ${reason || 'Not specified'}`,
      newState: { status: 'CANCELLED' },
    });

    return this.getPOById(tenantId, po._id);
  }

  async getIncomingPurchases(
    tenantId: string | Types.ObjectId,
    query: {
      timing?: 'ALL' | 'DUE_TODAY' | 'OVERDUE' | 'THIS_WEEK' | 'PARTIAL';
      warehouseId?: string;
      supplierId?: string;
      search?: string;
    } = {}
  ): Promise<{
    data: any[];
    metrics: {
      totalIncoming: number;
      dueTodayCount: number;
      overdueCount: number;
      upcomingWeekCount: number;
      partiallyReceivedCount: number;
      totalPendingUnits: number;
    };
  }> {
    const tId = new Types.ObjectId(tenantId);
    const filter: any = {
      tenantId: tId,
      status: { $in: ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'] },
    };

    if (query.warehouseId && Types.ObjectId.isValid(query.warehouseId)) {
      filter.warehouseId = new Types.ObjectId(query.warehouseId);
    }
    if (query.supplierId && Types.ObjectId.isValid(query.supplierId)) {
      filter.supplierId = new Types.ObjectId(query.supplierId);
    }

    const pos = await PurchaseOrder.find(filter)
      .populate('supplierId', 'name supplierCode email phone')
      .populate('warehouseId', 'name code address')
      .populate('items.itemId', 'name sku itemCode standardCost qcRequired')
      .populate('items.uomId', 'name symbol')
      .sort({ expectedDeliveryDate: 1, createdAt: -1 })
      .exec();

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const endOf7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    let dueTodayCount = 0;
    let overdueCount = 0;
    let upcomingWeekCount = 0;
    let partiallyReceivedCount = 0;
    let totalPendingUnits = 0;

    const mapped = pos.map((po) => {
      const items = po.items || [];
      const totalOrderedQty = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const totalReceivedQty = items.reduce((sum, item) => sum + (item.receivedQuantity || 0), 0);
      const pendingQty = Math.max(0, totalOrderedQty - totalReceivedQty);
      const progressPercent = totalOrderedQty > 0 ? Math.min(100, Math.round((totalReceivedQty / totalOrderedQty) * 100)) : 0;

      totalPendingUnits += pendingQty;
      if (po.status === 'PARTIALLY_RECEIVED') {
        partiallyReceivedCount++;
      }

      // Check delivery date timing
      const deliveryDate = po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate) : null;
      let timingCategory: 'DUE_TODAY' | 'OVERDUE' | 'THIS_WEEK' | 'FUTURE' | 'UNSCHEDULED' = 'UNSCHEDULED';

      if (deliveryDate) {
        if (deliveryDate < startOfToday) {
          timingCategory = 'OVERDUE';
          overdueCount++;
        } else if (deliveryDate <= endOfToday) {
          timingCategory = 'DUE_TODAY';
          dueTodayCount++;
        } else if (deliveryDate <= endOf7Days) {
          timingCategory = 'THIS_WEEK';
          upcomingWeekCount++;
        } else {
          timingCategory = 'FUTURE';
        }
      }

      return {
        _id: po._id,
        poNumber: po.poNumber,
        status: po.status,
        supplier: po.supplierId,
        warehouse: po.warehouseId,
        orderDate: po.createdAt,
        expectedDeliveryDate: po.expectedDeliveryDate,
        totalAmount: po.total,
        totalOrderedQty,
        totalReceivedQty,
        pendingQty,
        progressPercent,
        timingCategory,
        notes: po.notes,
        emailSent: po.emailSent,
        smsSent: po.smsSent,
        notifiedAt: po.notifiedAt,
        itemsCount: items.length,
        items: items.map((it) => ({
          _id: it._id,
          itemId: it.itemId,
          description: it.description,
          orderedQty: it.quantity,
          receivedQty: it.receivedQuantity,
          pendingQty: it.pendingQuantity,
          uom: it.uomId,
        })),
      };
    });

    let filtered = mapped;

    // Apply search filter
    if (query.search && query.search.trim()) {
      const s = query.search.trim().toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.poNumber?.toLowerCase().includes(s) ||
          (p.supplier as any)?.name?.toLowerCase().includes(s) ||
          (p.warehouse as any)?.name?.toLowerCase().includes(s)
      );
    }

    // Apply timing filter
    if (query.timing && query.timing !== 'ALL') {
      if (query.timing === 'PARTIAL') {
        filtered = filtered.filter((p) => p.status === 'PARTIALLY_RECEIVED');
      } else {
        filtered = filtered.filter((p) => p.timingCategory === query.timing);
      }
    }

    return {
      data: filtered,
      metrics: {
        totalIncoming: mapped.length,
        dueTodayCount,
        overdueCount,
        upcomingWeekCount,
        partiallyReceivedCount,
        totalPendingUnits,
      },
    };
  }

  async sendDeliveryFollowUp(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    poId: string | Types.ObjectId,
    payload?: { recipientEmail?: string; recipientPhone?: string; customNote?: string }
  ): Promise<{ success: boolean; message: string }> {
    const po = await this.getPOById(tenantId, poId);
    const supplierDoc = await Supplier.findById(po.supplierId).exec();
    const tenantDoc = await Tenant.findById(tenantId).select('name').exec();

    const supplierName = supplierDoc?.name || 'Valued Supplier';
    const supplierEmail = payload?.recipientEmail?.trim() || supplierDoc?.email || supplierDoc?.contactEmail;
    const supplierPhone = payload?.recipientPhone?.trim() || supplierDoc?.phone;
    const tenantName = tenantDoc?.name || 'StockPilot Operations';

    const deliveryDateFormatted = po.expectedDeliveryDate
      ? new Date(po.expectedDeliveryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'Immediate / Earliest possible';

    let emailSent = false;
    if (supplierEmail) {
      emailSent = (await emailService.sendEmail({
        to: supplierEmail,
        subject: `⚠️ Inbound Shipment Delivery Status Inquiry: PO #${po.poNumber} [${tenantName}]`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
            <h2 style="color: #4338ca; margin-top: 0;">🚚 Inbound Shipment Follow-up: PO #${po.poNumber}</h2>
            <p>Dear <strong>${supplierName}</strong>,</p>
            <p>This is a formal follow-up inquiry regarding the dispatch and delivery status of Purchase Order <strong>#${po.poNumber}</strong>, with scheduled delivery date of <strong>${deliveryDateFormatted}</strong>.</p>
            ${payload?.customNote ? `<div style="background: #f8fafc; border-left: 4px solid #6366f1; padding: 12px; margin: 16px 0; font-size: 14px;"><strong>Buyer Note:</strong> ${payload.customNote}</div>` : ''}
            <p>Please provide the latest dispatch status, Transporter Name, and Bilty / Tracking (LR) number to facilitate prompt unloading at our inbound dock facility.</p>
            <p style="color: #64748b; font-size: 12px; margin-top: 24px;">Sent by ${tenantName} Inbound Logistics & Procurement.</p>
          </div>
        `,
        text: `Inbound Shipment Follow-up: PO #${po.poNumber}. Dear ${supplierName}, please provide delivery status and tracking details for PO #${po.poNumber}.`,
      })).success;
    }

    let smsSent = false;
    if (supplierPhone) {
      const res = await smsService.sendSMS({
        to: supplierPhone,
        text: `[${tenantName}] Delivery Follow-up: Please share dispatch / LR details for PO #${po.poNumber}. Delivery expected: ${deliveryDateFormatted}.`,
      }).catch(() => ({ success: false }));
      smsSent = Boolean(res?.success);
    }

    await auditRepository.create({
      tenantId: new Types.ObjectId(tenantId),
      userId: new Types.ObjectId(userId),
      action: AuditAction.UPDATE,
      entity: AuditEntity.PURCHASE,
      entityId: po._id.toString(),
      details: `Sent delivery follow-up for PO ${po.poNumber} to supplier '${supplierName}' (Email: ${emailSent ? 'Sent' : 'Skipped'}, SMS: ${smsSent ? 'Sent' : 'Skipped'})`,
    });

    return {
      success: true,
      message: `Follow-up sent successfully to ${supplierName}! (Email: ${emailSent ? 'Delivered' : 'N/A'}, SMS: ${smsSent ? 'Delivered' : 'N/A'})`,
    };
  }
}

export const purchaseOrderService = new PurchaseOrderService();
