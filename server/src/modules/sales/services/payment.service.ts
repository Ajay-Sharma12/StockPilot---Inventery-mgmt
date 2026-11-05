import { Types } from 'mongoose';
import { Payment, IPayment } from '../models/payment.model';
import { Invoice } from '../models/invoice.model';
import { Customer } from '../../../models/customer.model';
import { documentNumberService } from '../../../services/documentNumber.service';
import { auditRepository } from '../../../repositories/audit.repository';
import { AuditAction, AuditEntity } from '../../../config/constants';
import { BadRequestError, NotFoundError } from '../../../core/errors';

export class PaymentService {
  async recordPayment(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    data: any
  ): Promise<IPayment> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const invoice = await Invoice.findOne({ _id: data.invoiceId, tenantId: tId }).exec();
    if (!invoice) throw new NotFoundError('Invoice not found');

    if (!['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status)) {
      throw new BadRequestError(`Cannot record payment against invoice in '${invoice.status}' status`);
    }

    const payAmount = Number(data.amount);
    if (payAmount <= 0) {
      throw new BadRequestError('Payment amount must be greater than zero');
    }

    if (payAmount > invoice.outstandingAmount) {
      throw new BadRequestError(
        `Payment amount ($${payAmount.toLocaleString()}) exceeds the remaining outstanding balance ($${invoice.outstandingAmount.toLocaleString()}) on Invoice ${invoice.invoiceNumber}`
      );
    }

    const newPaidAmount = Math.round((invoice.paidAmount + payAmount) * 100) / 100;
    const newOutstanding = Math.round((invoice.outstandingAmount - payAmount) * 100) / 100;

    invoice.paidAmount = newPaidAmount;
    invoice.outstandingAmount = newOutstanding;
    invoice.status = newOutstanding <= 0 ? 'PAID' : 'PARTIALLY_PAID';
    invoice.updatedBy = uId;
    await invoice.save();

    const paymentNumber = await documentNumberService.getNextNumber(tId, 'PAYMENT');

    const payment = await Payment.create({
      tenantId: tId,
      paymentNumber,
      invoiceId: invoice._id,
      customerId: invoice.customerId,
      paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
      amount: payAmount,
      paymentMethod: data.paymentMethod || 'BANK_TRANSFER',
      paymentReference: data.paymentReference,
      currency: data.currency || invoice.currency || 'USD',
      notes: data.notes,
      receivedBy: uId,
      status: 'RECORDED',
      createdBy: uId,
      updatedBy: uId,
    });

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.CREATE,
      entity: AuditEntity.SALES,
      entityId: payment._id.toString(),
      details: `Recorded Payment ${paymentNumber} of $${payAmount.toLocaleString()} against Invoice ${invoice.invoiceNumber} (Remaining Outstanding: $${newOutstanding.toLocaleString()})`,
    });

    return payment;
  }

  async getPayments(
    tenantId: string | Types.ObjectId,
    query: any = {}
  ): Promise<{ data: IPayment[]; total: number; page: number; limit: number }> {
    const tId = new Types.ObjectId(tenantId);
    const filter: any = { tenantId: tId };

    if (query.invoiceId) filter.invoiceId = new Types.ObjectId(query.invoiceId);
    if (query.customerId) filter.customerId = new Types.ObjectId(query.customerId);
    if (query.paymentMethod) filter.paymentMethod = query.paymentMethod;
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { paymentNumber: { $regex: query.search.trim(), $options: 'i' } },
        { paymentReference: { $regex: query.search.trim(), $options: 'i' } },
      ];
    }

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Payment.find(filter)
        .populate('invoiceId', 'invoiceNumber grandTotal outstandingAmount status')
        .populate('customerId', 'name customerCode')
        .populate('receivedBy', 'name firstName lastName email')
        .sort({ paymentDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Payment.countDocuments(filter).exec(),
    ]);

    return { data, total, page, limit };
  }

  async getPaymentById(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IPayment> {
    const tId = new Types.ObjectId(tenantId);
    const payment = await Payment.findOne({ _id: id, tenantId: tId })
      .populate('invoiceId')
      .populate('customerId')
      .populate('receivedBy', 'name firstName lastName email')
      .exec();

    if (!payment) throw new NotFoundError('Payment record not found');
    return payment;
  }

  async reversePayment(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    reason: string
  ): Promise<IPayment> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const payment = await Payment.findOne({ _id: id, tenantId: tId }).exec();
    if (!payment) throw new NotFoundError('Payment record not found');

    if (payment.status === 'REVERSED') {
      throw new BadRequestError('Payment is already reversed');
    }

    const invoice = await Invoice.findOne({ _id: payment.invoiceId, tenantId: tId }).exec();
    if (!invoice) throw new NotFoundError('Linked Invoice not found');

    invoice.paidAmount = Math.max(0, invoice.paidAmount - payment.amount);
    invoice.outstandingAmount = invoice.outstandingAmount + payment.amount;
    invoice.status = invoice.paidAmount > 0 ? 'PARTIALLY_PAID' : 'ISSUED';
    await invoice.save();

    payment.status = 'REVERSED';
    payment.reversedBy = uId;
    payment.reversedAt = new Date();
    payment.reversalReason = reason;
    payment.updatedBy = uId;
    await payment.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.SALES,
      entityId: payment._id.toString(),
      details: `Reversed Payment ${payment.paymentNumber} of $${payment.amount.toLocaleString()}. Reason: ${reason}`,
    });

    return payment;
  }

  async getReceivablesSummary(tenantId: string | Types.ObjectId): Promise<any> {
    const tId = new Types.ObjectId(tenantId);
    const now = new Date();

    const invoices = await Invoice.find({
      tenantId: tId,
      status: { $in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
    })
      .populate('customerId', 'name customerCode')
      .exec();

    let totalOutstanding = 0;
    let totalOverdue = 0;

    const customerMap = new Map<string, { customerId: string; customerName: string; outstanding: number; overdue: number }>();

    for (const inv of invoices) {
      const cust = inv.customerId as any;
      const custId = cust ? cust._id.toString() : 'UNKNOWN';
      const custName = cust ? cust.name : 'Unknown Customer';

      totalOutstanding += inv.outstandingAmount;
      const isOverdue = new Date(inv.dueDate) < now;
      if (isOverdue) totalOverdue += inv.outstandingAmount;

      const current = customerMap.get(custId) || {
        customerId: custId,
        customerName: custName,
        outstanding: 0,
        overdue: 0,
      };

      current.outstanding += inv.outstandingAmount;
      if (isOverdue) current.overdue += inv.outstandingAmount;
      customerMap.set(custId, current);
    }

    return {
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      totalOverdue: Math.round(totalOverdue * 100) / 100,
      customers: Array.from(customerMap.values()),
    };
  }
}

export const paymentService = new PaymentService();
