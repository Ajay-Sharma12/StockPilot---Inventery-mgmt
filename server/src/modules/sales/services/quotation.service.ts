import { Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Quotation, IQuotation, IQuotationItem } from '../models/quotation.model';
import { Customer } from '../../../models/customer.model';
import { Item } from '../../../models/item.model';
import { Warehouse } from '../../../models/warehouse.model';
import { Tenant } from '../../../models/tenant.model';
import { emailService } from '../../../services/email.service';
import { logger } from '../../../core/logger';
import { salesOrderService } from './salesOrder.service';
import { documentNumberService } from '../../../services/documentNumber.service';
import { auditRepository } from '../../../repositories/audit.repository';
import { AuditAction, AuditEntity } from '../../../config/constants';
import { BadRequestError, NotFoundError } from '../../../core/errors';
import { env } from '../../../config/env.config';

export class QuotationService {
  async createQuotation(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    data: any
  ): Promise<IQuotation> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const customer = await Customer.findOne({ _id: data.customerId, tenantId: tId }).exec();
    if (!customer) throw new NotFoundError('Customer not found in this organization');

    const warehouse = await Warehouse.findOne({ _id: data.warehouseId, tenantId: tId }).exec();
    if (!warehouse) throw new NotFoundError('Fulfillment warehouse not found');

    let calculatedSubtotal = 0;
    let calculatedTax = 0;
    let calculatedDiscount = 0;

    const items: IQuotationItem[] = [];
    for (const line of data.items) {
      const item = await Item.findOne({ _id: line.itemId, tenantId: tId }).exec();
      if (!item) throw new NotFoundError(`Item ${line.itemId} not found`);

      const qty = Number(line.quantity);
      const unitPrice = Number(line.unitPrice);
      const discount = Number(line.discount || 0);
      const taxRate = Number(line.taxRate || 0);

      const lineSubtotal = Math.round(qty * unitPrice * 100) / 100;
      const lineTax = Math.round((lineSubtotal - discount) * (taxRate / 100) * 100) / 100;
      const lineTotal = Math.round((lineSubtotal - discount + lineTax) * 100) / 100;

      calculatedSubtotal += lineSubtotal;
      calculatedDiscount += discount;
      calculatedTax += lineTax;

      items.push({
        itemId: item._id,
        description: line.description || item.name,
        quantity: qty,
        uomId: new Types.ObjectId(line.uomId || item.baseUomId),
        unitPrice,
        discount,
        taxRate,
        taxAmount: lineTax,
        lineSubtotal,
        lineTotal,
        remarks: line.remarks,
      });
    }

    const shippingAmount = Number(data.shippingAmount || 0);
    const grandTotal = Math.round((calculatedSubtotal - calculatedDiscount + calculatedTax + shippingAmount) * 100) / 100;

    let quotationNumber: string;
    try {
      quotationNumber = await documentNumberService.getNextNumber(tId, 'SALES_QUOTATION');
    } catch {
      const count = await Quotation.countDocuments({ tenantId: tId }).exec();
      const year = new Date().getFullYear();
      quotationNumber = `QT-${year}-${String(count + 1).padStart(4, '0')}`;
    }

    const quotation = await Quotation.create({
      tenantId: tId,
      quotationNumber,
      customerId: customer._id,
      warehouseId: warehouse._id,
      quotationDate: new Date(),
      validUntil: new Date(data.validUntil),
      currency: data.currency || customer.currency || 'USD',
      subtotal: Math.round(calculatedSubtotal * 100) / 100,
      discountAmount: Math.round(calculatedDiscount * 100) / 100,
      taxAmount: Math.round(calculatedTax * 100) / 100,
      shippingAmount,
      grandTotal,
      items,
      termsAndConditions: data.termsAndConditions,
      notes: data.notes,
      status: 'DRAFT',
      createdBy: uId,
      updatedBy: uId,
    });

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.CREATE,
      entity: AuditEntity.SALES,
      entityId: quotation._id.toString(),
      details: `Generated Sales Quotation ${quotationNumber} for customer ${customer.name}`,
    });

    return quotation;
  }

  async getQuotations(
    tenantId: string | Types.ObjectId,
    filter: any = {},
    page: number = 1,
    limit: number = 50
  ): Promise<{ data: IQuotation[]; total: number; page: number; limit: number }> {
    const tId = new Types.ObjectId(tenantId);
    const query: any = { tenantId: tId };

    if (filter.status) query.status = filter.status;
    if (filter.customerId) query.customerId = new Types.ObjectId(filter.customerId);
    if (filter.search) {
      const q = filter.search.trim();
      query.$or = [
        { quotationNumber: { $regex: q, $options: 'i' } },
        { notes: { $regex: q, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Quotation.find(query)
        .populate('customerId', 'name legalName email phone customerCode')
        .populate('warehouseId', 'code name')
        .populate('createdBy', 'name email')
        .populate('convertedSalesOrderId', 'soNumber status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Quotation.countDocuments(query).exec(),
    ]);

    return { data, total, page, limit };
  }

  async getQuotationById(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IQuotation> {
    const tId = new Types.ObjectId(tenantId);
    const quotation = await Quotation.findOne({ _id: id, tenantId: tId })
      .populate('customerId')
      .populate('warehouseId')
      .populate('items.itemId')
      .populate('items.uomId')
      .populate('createdBy', 'name email')
      .populate('convertedSalesOrderId', 'soNumber status grandTotal')
      .exec();

    if (!quotation) throw new NotFoundError('Sales Quotation not found');
    return quotation;
  }

  async sendQuotation(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    customBaseUrl?: string
  ): Promise<IQuotation> {
    const tId = new Types.ObjectId(tenantId);
    const quotation = await Quotation.findOne({ _id: id, tenantId: tId })
      .populate('customerId')
      .populate('warehouseId')
      .populate('items.itemId')
      .populate('items.uomId')
      .populate('createdBy', 'name email')
      .exec();

    if (!quotation) throw new NotFoundError('Sales Quotation not found');

    if (quotation.status !== 'DRAFT' && quotation.status !== 'SENT') {
      throw new BadRequestError(`Cannot send quotation in '${quotation.status}' status`);
    }

    const tenant = await Tenant.findById(tId).select('name');
    const tenantName = tenant?.name || 'StockPilot Enterprise';

    const customerData: any = quotation.customerId;
    const customerEmail = customerData?.email;
    const customerName = customerData?.name || customerData?.contactPerson || 'Valued Customer';

    if (!customerEmail) {
      throw new BadRequestError('Customer email not found. Please ensure the customer has a valid email address.');
    }

    const quotationDateFormatted = quotation.quotationDate
      ? new Date(quotation.quotationDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const validUntilFormatted = quotation.validUntil
      ? new Date(quotation.validUntil).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : '30 days from date of issue';

    const itemsSummary = (quotation.items || []).map((it: any) => ({
      name: it.itemId?.name || it.description || 'Quoted Item',
      quantity: it.quantity,
      uom: it.uomId?.symbol || it.uomId?.code || 'pcs',
      unitPrice: it.unitPrice,
      discount: it.discount,
      taxRate: it.taxRate,
      lineTotal: it.lineTotal,
    }));

    const salesRepData: any = quotation.createdBy;
    const salesRepName = salesRepData?.name;

    if (!quotation.publicToken) {
      quotation.publicToken = uuidv4();
    }

    const rawBaseUrl =
      process.env.PUBLIC_APP_URL ||
      env.PUBLIC_APP_URL ||
      customBaseUrl ||
      env.CLIENT_URL ||
      process.env.CLIENT_URL ||
      'http://localhost:5173';
    const publicBaseUrl = rawBaseUrl.replace(/\/+$/, '');
    const reviewUrl = `${publicBaseUrl}/portal/quotation/${quotation._id}?token=${quotation.publicToken}`;

    // Send proposal email directly to customer inbox
    try {
      await emailService.sendSalesQuotationEmail({
        to: customerEmail,
        customerName,
        quotationNumber: quotation.quotationNumber,
        quotationDate: quotationDateFormatted,
        validUntil: validUntilFormatted,
        currency: quotation.currency || 'USD',
        subtotal: quotation.subtotal,
        discountAmount: quotation.discountAmount,
        taxAmount: quotation.taxAmount,
        shippingAmount: quotation.shippingAmount,
        grandTotal: quotation.grandTotal,
        items: itemsSummary,
        termsAndConditions: quotation.termsAndConditions,
        notes: quotation.notes,
        tenantName,
        salesRepName,
        reviewUrl,
      });
      logger.info(`✅ Sales Quotation proposal ${quotation.quotationNumber} emailed to ${customerEmail}`);
    } catch (emailErr: any) {
      logger.error(`❌ Failed to send quotation email to ${customerEmail}:`, emailErr);
    }

    quotation.status = 'SENT';
    quotation.sentAt = new Date();
    quotation.updatedBy = new Types.ObjectId(userId);
    await quotation.save();

    await auditRepository.create({
      tenantId: tId,
      userId: new Types.ObjectId(userId),
      action: AuditAction.UPDATE,
      entity: AuditEntity.SALES,
      entityId: quotation._id.toString(),
      details: `Dispatched Sales Quotation ${quotation.quotationNumber} to customer ${customerEmail}`,
    });

    return (await this.getQuotationById(tId, quotation._id)) as IQuotation;
  }

  async acceptQuotation(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IQuotation> {
    const tId = new Types.ObjectId(tenantId);
    const quotation = await Quotation.findOne({ _id: id, tenantId: tId }).exec();
    if (!quotation) throw new NotFoundError('Sales Quotation not found');

    if (quotation.status === 'CONVERTED' || quotation.status === 'REJECTED') {
      throw new BadRequestError(`Cannot accept quotation in '${quotation.status}' status`);
    }

    quotation.status = 'ACCEPTED';
    quotation.acceptedAt = new Date();
    quotation.updatedBy = new Types.ObjectId(userId);
    await quotation.save();

    return (await this.getQuotationById(tId, quotation._id)) as IQuotation;
  }

  async rejectQuotation(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    reason: string
  ): Promise<IQuotation> {
    const tId = new Types.ObjectId(tenantId);
    const quotation = await Quotation.findOne({ _id: id, tenantId: tId }).exec();
    if (!quotation) throw new NotFoundError('Sales Quotation not found');

    if (quotation.status === 'CONVERTED') {
      throw new BadRequestError('Cannot reject already converted quotation');
    }

    quotation.status = 'REJECTED';
    quotation.rejectedAt = new Date();
    quotation.rejectionReason = reason;
    quotation.updatedBy = new Types.ObjectId(userId);
    await quotation.save();

    return (await this.getQuotationById(tId, quotation._id)) as IQuotation;
  }

  async convertToSalesOrder(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<{ quotation: IQuotation; salesOrder: any }> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const quotation = await Quotation.findOne({ _id: id, tenantId: tId })
      .populate('customerId')
      .exec();

    if (!quotation) throw new NotFoundError('Sales Quotation not found');
    if (quotation.status === 'CONVERTED') {
      throw new BadRequestError('This quotation has already been converted to a Sales Order');
    }

    const customer = quotation.customerId as any;

    // Transform quotation lines into Sales Order lines
    const soData = {
      customerId: customer._id.toString(),
      warehouseId: quotation.warehouseId.toString(),
      currency: quotation.currency,
      shippingAmount: quotation.shippingAmount,
      notes: `Converted from Quotation ${quotation.quotationNumber}. ${quotation.notes || ''}`.trim(),
      requestedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      deliveryAddress: customer.shippingAddress || customer.billingAddress || {
        street: 'Main Facility',
        city: 'City Center',
        country: 'USA',
      },
      billingAddress: customer.billingAddress || customer.shippingAddress || {
        street: 'Main Facility',
        city: 'City Center',
        country: 'USA',
      },
      items: quotation.items.map((i) => ({
        itemId: i.itemId.toString(),
        description: i.description,
        orderedQuantity: i.quantity,
        uomId: i.uomId.toString(),
        unitPrice: i.unitPrice,
        discount: i.discount,
        taxRate: i.taxRate,
        remarks: i.remarks,
      })),
    };

    // Create formal Sales Order
    const salesOrder = await salesOrderService.createSalesOrder(tId, uId, soData);

    // Update Quotation state
    quotation.status = 'CONVERTED';
    quotation.convertedSalesOrderId = salesOrder._id;
    quotation.updatedBy = uId;
    await quotation.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.CREATE,
      entity: AuditEntity.SALES,
      entityId: salesOrder._id.toString(),
      details: `Converted Quotation ${quotation.quotationNumber} into Sales Order ${salesOrder.soNumber}`,
    });

    return { quotation: await this.getQuotationById(tId, quotation._id), salesOrder };
  }

  async getPublicQuotation(id: string, token?: string): Promise<any> {
    const quotation = await Quotation.findById(id)
      .populate('customerId', 'name email phone billingAddress shippingAddress')
      .populate('warehouseId', 'name address')
      .populate('items.itemId', 'name sku description')
      .populate('items.uomId', 'code name symbol')
      .populate('tenantId', 'name')
      .exec();

    if (!quotation) throw new NotFoundError('Sales Quotation not found');

    if (quotation.publicToken && token && quotation.publicToken !== token) {
      throw new BadRequestError('Invalid or expired proposal authorization link');
    }

    return quotation;
  }

  async publicAcceptQuotation(id: string, token?: string, feedback?: string): Promise<any> {
    const quotation = await Quotation.findById(id).exec();
    if (!quotation) throw new NotFoundError('Sales Quotation not found');

    if (quotation.publicToken && token && quotation.publicToken !== token) {
      throw new BadRequestError('Invalid or expired proposal authorization link');
    }

    if (quotation.status === 'CONVERTED' || quotation.status === 'REJECTED') {
      throw new BadRequestError(`Cannot accept quotation in '${quotation.status}' status`);
    }

    quotation.status = 'ACCEPTED';
    quotation.acceptedAt = new Date();
    quotation.clientAcceptedAt = new Date();
    if (feedback) {
      quotation.clientFeedback = feedback.trim();
    }
    await quotation.save();

    await auditRepository.create({
      tenantId: quotation.tenantId,
      userId: quotation.createdBy,
      action: AuditAction.UPDATE,
      entity: AuditEntity.SALES,
      entityId: quotation._id.toString(),
      details: `Customer approved Sales Quotation ${quotation.quotationNumber} online. Client Feedback: ${feedback || 'Approved via customer portal'}`,
    });

    return this.getPublicQuotation(id, token);
  }

  async publicRejectQuotation(id: string, token?: string, reason?: string): Promise<any> {
    const quotation = await Quotation.findById(id).exec();
    if (!quotation) throw new NotFoundError('Sales Quotation not found');

    if (quotation.publicToken && token && quotation.publicToken !== token) {
      throw new BadRequestError('Invalid or expired proposal authorization link');
    }

    if (quotation.status === 'CONVERTED') {
      throw new BadRequestError('Cannot decline already converted quotation');
    }

    quotation.status = 'REJECTED';
    quotation.rejectedAt = new Date();
    quotation.clientRejectedAt = new Date();
    quotation.rejectionReason = reason?.trim() || 'Declined by customer online';
    await quotation.save();

    await auditRepository.create({
      tenantId: quotation.tenantId,
      userId: quotation.createdBy,
      action: AuditAction.UPDATE,
      entity: AuditEntity.SALES,
      entityId: quotation._id.toString(),
      details: `Customer declined Sales Quotation ${quotation.quotationNumber} online. Reason: ${reason || 'N/A'}`,
    });

    return this.getPublicQuotation(id, token);
  }
}

export const quotationService = new QuotationService();
