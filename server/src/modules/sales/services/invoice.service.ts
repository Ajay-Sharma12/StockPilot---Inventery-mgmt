import { Types } from 'mongoose';
import { Invoice, IInvoice, IInvoiceItem } from '../models/invoice.model';
import { SalesOrder } from '../models/salesOrder.model';
import { Customer } from '../../../models/customer.model';
import { documentNumberService } from '../../../services/documentNumber.service';
import { auditRepository } from '../../../repositories/audit.repository';
import { AuditAction, AuditEntity } from '../../../config/constants';
import { BadRequestError, NotFoundError } from '../../../core/errors';

export class InvoiceService {
  async createInvoice(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    data: any
  ): Promise<IInvoice> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const so = await SalesOrder.findOne({ _id: data.salesOrderId, tenantId: tId }).exec();
    if (!so) throw new NotFoundError('Sales Order not found');

    const customer = await Customer.findOne({ _id: so.customerId, tenantId: tId }).exec();
    if (!customer) throw new NotFoundError('Customer not found');

    let calculatedSubtotal = 0;
    let calculatedTax = 0;
    let calculatedDiscount = 0;

    const items: IInvoiceItem[] = [];
    for (const line of data.items) {
      const qty = Number(line.quantity);
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
        itemId: new Types.ObjectId(line.itemId),
        description: line.description,
        quantity: qty,
        uomId: new Types.ObjectId(line.uomId),
        unitPrice,
        discount,
        taxRate,
        taxAmount: lineTax,
        lineSubtotal,
        lineTotal,
        batchNumber: line.batchNumber,
        serialNumbers: line.serialNumbers || [],
      });
    }

    const shippingAmount = Number(data.shippingAmount || 0);
    const roundOff = Number(data.roundOff || 0);
    const grandTotal =
      Math.round(
        (calculatedSubtotal - calculatedDiscount + calculatedTax + shippingAmount + roundOff) * 100
      ) / 100;

    const invoiceNumber = await documentNumberService.getNextNumber(tId, 'INVOICE');

    const invoice = await Invoice.create({
      tenantId: tId,
      invoiceNumber,
      customerId: customer._id,
      salesOrderId: so._id,
      dispatchId: data.dispatchId ? new Types.ObjectId(data.dispatchId) : undefined,
      invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : new Date(),
      dueDate: new Date(data.dueDate),
      paymentTermId: data.paymentTermId ? new Types.ObjectId(data.paymentTermId) : so.paymentTermId,
      currency: so.currency || 'USD',
      items,
      subtotal: calculatedSubtotal,
      discountAmount: calculatedDiscount,
      taxAmount: calculatedTax,
      shippingAmount,
      roundOff,
      grandTotal,
      paidAmount: 0,
      outstandingAmount: grandTotal,
      status: 'ISSUED',
      notes: data.notes,
      issuedAt: new Date(),
      issuedBy: uId,
      createdBy: uId,
      updatedBy: uId,
    });

    // Update SO invoiced quantities
    for (const invLine of items) {
      const soLine = so.items.find((i) => i.itemId.toString() === invLine.itemId.toString());
      if (soLine) {
        soLine.invoicedQuantity = (soLine.invoicedQuantity || 0) + invLine.quantity;
      }
    }
    await so.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.CREATE,
      entity: AuditEntity.SALES,
      entityId: invoice._id.toString(),
      details: `Generated Invoice ${invoiceNumber} for Customer ${customer.name} [Amount: $${grandTotal.toLocaleString()}]`,
    });

    return invoice;
  }

  async getInvoices(
    tenantId: string | Types.ObjectId,
    query: any = {}
  ): Promise<{ data: IInvoice[]; total: number; page: number; limit: number }> {
    const tId = new Types.ObjectId(tenantId);
    const filter: any = { tenantId: tId };

    if (query.customerId) filter.customerId = new Types.ObjectId(query.customerId);
    if (query.salesOrderId) filter.salesOrderId = new Types.ObjectId(query.salesOrderId);
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.invoiceNumber = { $regex: query.search.trim(), $options: 'i' };
    }

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Invoice.find(filter)
        .populate('customerId', 'name customerCode email phone')
        .populate('salesOrderId', 'soNumber orderDate')
        .populate('dispatchId', 'dispatchNumber trackingNumber')
        .populate('items.itemId', 'name sku code')
        .populate('items.uomId', 'name symbol')
        .populate('issuedBy', 'name firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Invoice.countDocuments(filter).exec(),
    ]);

    return { data, total, page, limit };
  }

  async getInvoiceById(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IInvoice> {
    const tId = new Types.ObjectId(tenantId);
    const invoice = await Invoice.findOne({ _id: id, tenantId: tId })
      .populate('customerId')
      .populate('salesOrderId')
      .populate('dispatchId')
      .populate('paymentTermId')
      .populate('items.itemId')
      .populate('items.uomId')
      .populate('issuedBy', 'name firstName lastName email')
      .exec();

    if (!invoice) throw new NotFoundError('Invoice not found');
    return invoice;
  }

  async cancelInvoice(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    reason?: string
  ): Promise<IInvoice> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const invoice = await Invoice.findOne({ _id: id, tenantId: tId }).exec();
    if (!invoice) throw new NotFoundError('Invoice not found');

    if (invoice.paidAmount > 0) {
      throw new BadRequestError('Cannot cancel an invoice that already has collections/payments recorded against it');
    }

    invoice.status = 'CANCELLED';
    invoice.updatedBy = uId;
    await invoice.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.SALES,
      entityId: invoice._id.toString(),
      details: `Cancelled Invoice ${invoice.invoiceNumber}`,
    });

    return invoice;
  }
}

export const invoiceService = new InvoiceService();
