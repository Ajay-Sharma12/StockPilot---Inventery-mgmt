import { Types } from 'mongoose';
import { SupplierQuote, ISupplierQuote, SupplierQuoteStatus } from '../models/supplierQuote.model';
import { RFQ } from '../models/rfq.model';
import { Supplier } from '../../../models/supplier.model';
import { Item } from '../../../models/item.model';
import { UOM } from '../../../models/uom.model';
import { PaymentTerm } from '../../../models/paymentTerm.model';
import { documentNumberService } from '../../../services/documentNumber.service';
import { auditRepository } from '../../../repositories/audit.repository';
import { AuditAction, AuditEntity } from '../../../config/constants';
import { Tenant } from '../../../models/tenant.model';
import { emailService } from '../../../services/email.service';
import { smsService } from '../../../services/sms.service';
import { logger } from '../../../core/logger';
import { BadRequestError, NotFoundError } from '../../../core/errors';

export class SupplierQuoteService {
  async getQuotes(
    tenantId: string | Types.ObjectId,
    query: {
      rfqId?: string;
      supplierId?: string;
      status?: SupplierQuoteStatus;
      search?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ data: ISupplierQuote[]; total: number; page: number; limit: number }> {
    const tId = new Types.ObjectId(tenantId);
    const filter: any = { tenantId: tId };

    if (query.rfqId && Types.ObjectId.isValid(query.rfqId)) {
      filter.rfqId = new Types.ObjectId(query.rfqId);
    }
    if (query.supplierId && Types.ObjectId.isValid(query.supplierId)) {
      filter.supplierId = new Types.ObjectId(query.supplierId);
    }
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.quoteNumber = { $regex: query.search.trim(), $options: 'i' };
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      SupplierQuote.find(filter)
        .populate('supplierId', 'name supplierCode email phone')
        .populate('rfqId', 'rfqNumber issueDate responseDeadline')
        .populate('paymentTermsId', 'name code days')
        .populate('items.itemId', 'name sku itemCode standardCost')
        .populate('items.uomId', 'name symbol code')
        .populate('finalizedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      SupplierQuote.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async getQuoteById(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<ISupplierQuote> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Invalid quote identifier');

    const quote = await SupplierQuote.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    })
      .populate('supplierId', 'name supplierCode email phone address taxNumber paymentTerms currency')
      .populate('rfqId', 'rfqNumber issueDate responseDeadline notes')
      .populate('paymentTermsId', 'name code days')
      .populate('items.itemId', 'name sku itemCode standardCost')
      .populate('items.uomId', 'name symbol code')
      .populate('finalizedBy', 'name email')
      .exec();

    if (!quote) throw new NotFoundError('Supplier Quote not found');
    return quote;
  }

  async createQuote(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    data: any
  ): Promise<ISupplierQuote> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    // Validate RFQ
    const rfq = await RFQ.findOne({ _id: new Types.ObjectId(data.rfqId), tenantId: tId });
    if (!rfq) throw new NotFoundError('Referenced RFQ not found in organization');

    // Validate Supplier
    const supplier = await Supplier.findOne({ _id: new Types.ObjectId(data.supplierId), tenantId: tId });
    if (!supplier) throw new NotFoundError('Supplier not found in organization');
    if (supplier.status === 'BLOCKED') throw new BadRequestError('Supplier is blocked');

    // Validate payment terms if provided
    let paymentTermsId: Types.ObjectId | undefined;
    if (data.paymentTermsId && Types.ObjectId.isValid(data.paymentTermsId)) {
      const pt = await PaymentTerm.findOne({ _id: new Types.ObjectId(data.paymentTermsId), tenantId: tId });
      if (pt) paymentTermsId = pt._id;
    }

    // Validate items and calculate line totals
    let calculatedSubtotal = 0;
    const validatedItems = [];

    for (const itemInput of data.items) {
      const item = await Item.findOne({ _id: new Types.ObjectId(itemInput.itemId), tenantId: tId });
      if (!item) throw new NotFoundError(`Item '${itemInput.itemId}' not found in organization`);

      const uom = await UOM.findOne({ _id: new Types.ObjectId(itemInput.uomId), tenantId: tId });
      if (!uom) throw new NotFoundError(`UOM '${itemInput.uomId}' not found in organization`);

      const lineTotal =
        Math.round(
          (itemInput.quantity * itemInput.unitPrice - (itemInput.discount || 0) + (itemInput.tax || 0)) * 100
        ) / 100;
      calculatedSubtotal += lineTotal;

      validatedItems.push({
        itemId: item._id,
        rfqLineId: itemInput.rfqLineId ? new Types.ObjectId(itemInput.rfqLineId) : undefined,
        quantity: itemInput.quantity,
        uomId: uom._id,
        unitPrice: itemInput.unitPrice,
        discount: itemInput.discount || 0,
        tax: itemInput.tax || 0,
        deliveryDays: itemInput.deliveryDays || 0,
        lineTotal,
        remarks: itemInput.remarks,
      });
    }

    const overallDiscount = data.discount || 0;
    const overallTax = data.tax || 0;
    const total = Math.round((calculatedSubtotal - overallDiscount + overallTax) * 100) / 100;

    const quoteNumber = await documentNumberService.getNextNumber(tId, 'SUPPLIER_QUOTE');

    const quote = await SupplierQuote.create({
      tenantId: tId,
      quoteNumber,
      rfqId: rfq._id,
      supplierId: supplier._id,
      quoteDate: new Date(),
      validityDate: new Date(data.validityDate),
      deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
      paymentTermsId,
      currency: data.currency || supplier.currency || 'USD',
      shippingTerms: data.shippingTerms,
      discount: overallDiscount,
      tax: overallTax,
      subtotal: calculatedSubtotal,
      total,
      items: validatedItems,
      attachments: data.attachments || [],
      notes: data.notes,
      status: 'RECEIVED',
      submittedAt: new Date(),
      createdBy: uId,
    });

    // Update supplier status on RFQ
    const supplierEntry = rfq.suppliers.find(
      (s) => s.supplierId.toString() === supplier._id.toString()
    );
    if (supplierEntry) {
      supplierEntry.status = 'QUOTED';
      const allQuoted = rfq.suppliers.every((s) => s.status === 'QUOTED' || s.status === 'DECLINED');
      rfq.status = allQuoted ? 'FULLY_RESPONDED' : 'PARTIALLY_RESPONDED';
      await rfq.save();
    }

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.CREATE,
      entity: AuditEntity.PURCHASE,
      entityId: quote._id.toString(),
      details: `Received quotation ${quoteNumber} from supplier '${supplier.name}' for RFQ ${rfq.rfqNumber} ($${total.toLocaleString()})`,
    });

    return this.getQuoteById(tId, quote._id);
  }

  async finalizeQuote(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    selectionReason: string
  ): Promise<ISupplierQuote> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const quote = await this.getQuoteById(tId, id);

    if (quote.status === 'SELECTED') {
      throw new BadRequestError('This quotation has already been selected as winning bid');
    }
    if (quote.status === 'REJECTED' || quote.status === 'EXPIRED' || quote.status === 'CANCELLED') {
      throw new BadRequestError(`Cannot finalize quotation in '${quote.status}' status`);
    }

    // 1. Mark this quote as SELECTED
    quote.status = 'SELECTED';
    quote.finalizedAt = new Date();
    quote.finalizedBy = uId;
    quote.selectionReason = selectionReason;
    quote.updatedBy = uId;
    await quote.save();

    // 2. Mark other quotations for the same RFQ as REJECTED (audit preservation)
    await SupplierQuote.updateMany(
      {
        tenantId: tId,
        rfqId: quote.rfqId,
        _id: { $ne: quote._id },
        status: { $in: ['RECEIVED', 'UNDER_REVIEW'] },
      },
      {
        $set: {
          status: 'REJECTED',
          selectionReason: `Another quotation (${quote.quoteNumber}) was selected`,
          updatedBy: uId,
        },
      }
    );

    // 3. Dispatch Winner Notifications (Email + Phone SMS)
    try {
      const [supplierDoc, rfqDoc, tenantDoc] = await Promise.all([
        Supplier.findById(quote.supplierId),
        RFQ.findById(quote.rfqId),
        Tenant.findById(tId).select('name'),
      ]);

      const supplierName = supplierDoc?.name || 'Valued Supplier';
      const supplierEmail = supplierDoc?.email || supplierDoc?.contactEmail;
      const supplierPhone = supplierDoc?.phone;
      const rfqNumber = rfqDoc?.rfqNumber || 'RFQ';
      const tenantName = tenantDoc?.name || 'StockPilot Operations';

      if (supplierEmail) {
        emailService.sendQuoteAwardEmail({
          to: supplierEmail,
          supplierName,
          quoteNumber: quote.quoteNumber,
          rfqNumber,
          totalAmount: quote.total,
          tenantName,
        }).catch((err) => logger.error(`Failed to send quote award email to ${supplierEmail}:`, err));
      }

      if (supplierPhone) {
        smsService.sendQuoteAwardSMS(
          supplierPhone,
          supplierName,
          quote.quoteNumber,
          rfqNumber,
          tenantName
        ).catch((err) => logger.error(`Failed to send quote award SMS to ${supplierPhone}:`, err));
      }
    } catch (notifyErr) {
      logger.error('Error during quote award notification trigger:', notifyErr);
    }

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.APPROVE,
      entity: AuditEntity.PURCHASE,
      entityId: quote._id.toString(),
      details: `Finalized and awarded quotation ${quote.quoteNumber}. Justification: ${selectionReason}`,
      previousState: { status: 'RECEIVED' },
      newState: { status: 'SELECTED', selectionReason },
    });

    return this.getQuoteById(tId, quote._id);
  }

  async rejectQuote(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    reason?: string
  ): Promise<ISupplierQuote> {
    const quote = await this.getQuoteById(tenantId, id);
    quote.status = 'REJECTED';
    quote.selectionReason = reason;
    quote.updatedBy = new Types.ObjectId(userId);
    await quote.save();

    await auditRepository.create({
      tenantId: new Types.ObjectId(tenantId),
      userId: new Types.ObjectId(userId),
      action: AuditAction.REJECT,
      entity: AuditEntity.PURCHASE,
      entityId: quote._id.toString(),
      details: `Rejected quotation ${quote.quoteNumber}. Reason: ${reason || 'Not specified'}`,
    });

    return this.getQuoteById(tenantId, quote._id);
  }
}

export const supplierQuoteService = new SupplierQuoteService();
