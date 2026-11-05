import { Types } from 'mongoose';
import { RFQ, IRFQ, RFQStatus } from '../models/rfq.model';
import { PurchaseRequisition, PRStatus } from '../models/purchaseRequisition.model';
import { Supplier } from '../../../models/supplier.model';
import { Item } from '../../../models/item.model';
import { UOM } from '../../../models/uom.model';
import { documentNumberService } from '../../../services/documentNumber.service';
import { auditRepository } from '../../../repositories/audit.repository';
import { AuditAction, AuditEntity } from '../../../config/constants';
import { Tenant } from '../../../models/tenant.model';
import { emailService } from '../../../services/email.service';
import { smsService } from '../../../services/sms.service';
import { logger } from '../../../core/logger';
import { BadRequestError, NotFoundError } from '../../../core/errors';

export class RFQService {
  async getRFQs(
    tenantId: string | Types.ObjectId,
    query: {
      status?: RFQStatus;
      sourceType?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ data: IRFQ[]; total: number; page: number; limit: number }> {
    const tId = new Types.ObjectId(tenantId);
    const filter: any = { tenantId: tId };

    if (query.status) filter.status = query.status;
    if (query.sourceType) filter.sourceType = query.sourceType;
    if (query.search) {
      filter.$or = [
        { rfqNumber: { $regex: query.search.trim(), $options: 'i' } },
        { notes: { $regex: query.search.trim(), $options: 'i' } },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      RFQ.find(filter)
        .populate('suppliers.supplierId', 'name supplierCode email phone status')
        .populate('items.itemId', 'name sku itemCode standardCost')
        .populate('items.uomId', 'name symbol code')
        .populate('sourceId', 'prNumber purpose requiredDate')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      RFQ.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async getRFQById(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IRFQ> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Invalid RFQ identifier');

    const rfq = await RFQ.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    })
      .populate('suppliers.supplierId', 'name supplierCode email phone paymentTerms currency status')
      .populate('items.itemId', 'name sku itemCode standardCost')
      .populate('items.uomId', 'name symbol code')
      .populate('sourceId', 'prNumber purpose requiredDate')
      .populate('createdBy', 'name email')
      .exec();

    if (!rfq) throw new NotFoundError('RFQ not found');
    return rfq;
  }

  async createRFQ(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    data: any
  ): Promise<IRFQ> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    let sourcePRIds: Types.ObjectId[] = [];
    if (data.sourceType === 'PURCHASE_REQUISITION' && data.sourceId) {
      const pr = await PurchaseRequisition.findOne({
        _id: new Types.ObjectId(data.sourceId),
        tenantId: tId,
      });
      if (!pr) throw new NotFoundError('Source Purchase Requisition not found');
      const validPRStatuses: PRStatus[] = [
        'APPROVED',
        'PARTIALLY_APPROVED',
        'PURCHASE_REQUIRED',
        'PARTIALLY_AVAILABLE',
      ];
      if (!validPRStatuses.includes(pr.status)) {
        throw new BadRequestError(
          `Cannot generate RFQ from PR in '${pr.status}' status (must be APPROVED, PARTIALLY_APPROVED, PURCHASE_REQUIRED, or PARTIALLY_AVAILABLE)`
        );
      }
      sourcePRIds = [pr._id];
      pr.status = 'CONVERTED';
      await pr.save();
    } else if (data.sourcePRIds && Array.isArray(data.sourcePRIds)) {
      sourcePRIds = data.sourcePRIds
        .filter((id: string) => Types.ObjectId.isValid(id))
        .map((id: string) => new Types.ObjectId(id));
    }

    // Validate suppliers belong to tenant and are active
    const validatedSuppliers = [];
    for (const s of data.suppliers) {
      const supplier = await Supplier.findOne({
        _id: new Types.ObjectId(s.supplierId),
        tenantId: tId,
      });
      if (!supplier) throw new NotFoundError(`Supplier '${s.supplierId}' not found`);
      if (supplier.status === 'BLOCKED') {
        throw new BadRequestError(`Supplier '${supplier.name}' is blocked`);
      }
      validatedSuppliers.push({
        supplierId: supplier._id,
        contact: s.contact || supplier.contactPerson || supplier.email,
        issueDate: new Date(),
        responseDeadline: new Date(data.responseDeadline),
        status: 'INVITED' as const,
        remarks: s.remarks,
      });
    }

    // Validate items
    const validatedItems = [];
    for (const itemInput of data.items) {
      const item = await Item.findOne({
        _id: new Types.ObjectId(itemInput.itemId),
        tenantId: tId,
      });
      if (!item) throw new NotFoundError(`Item '${itemInput.itemId}' not found`);

      const uom = await UOM.findOne({
        _id: new Types.ObjectId(itemInput.uomId),
        tenantId: tId,
      });
      if (!uom) throw new NotFoundError(`UOM '${itemInput.uomId}' not found`);

      validatedItems.push({
        itemId: item._id,
        prLineId: itemInput.prLineId ? new Types.ObjectId(itemInput.prLineId) : undefined,
        description: itemInput.description || item.name,
        quantity: itemInput.quantity,
        uomId: uom._id,
        requestedDeliveryDate: itemInput.requestedDeliveryDate
          ? new Date(itemInput.requestedDeliveryDate)
          : undefined,
        specifications: itemInput.specifications,
        remarks: itemInput.remarks,
      });
    }

    const rfqNumber = await documentNumberService.getNextNumber(tId, 'RFQ');

    const rfq = await RFQ.create({
      tenantId: tId,
      rfqNumber,
      sourceType: data.sourceType || 'MANUAL',
      sourceId: data.sourceId ? new Types.ObjectId(data.sourceId) : undefined,
      sourcePRIds,
      issueDate: new Date(),
      responseDeadline: new Date(data.responseDeadline),
      requestedDeliveryDate: data.requestedDeliveryDate
        ? new Date(data.requestedDeliveryDate)
        : undefined,
      terms: data.terms,
      notes: data.notes,
      attachments: data.attachments || [],
      status: 'DRAFT',
      suppliers: validatedSuppliers,
      items: validatedItems,
      createdBy: uId,
    });

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.CREATE,
      entity: AuditEntity.PURCHASE,
      entityId: rfq._id.toString(),
      details: `Created RFQ ${rfqNumber} inviting ${validatedSuppliers.length} suppliers for ${validatedItems.length} items`,
    });

    return this.getRFQById(tId, rfq._id);
  }

  async updateRFQ(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    data: any
  ): Promise<IRFQ> {
    const rfq = await this.getRFQById(tenantId, id);
    if (rfq.status !== 'DRAFT') {
      throw new BadRequestError(`Cannot modify RFQ in '${rfq.status}' status`);
    }

    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    if (data.responseDeadline) rfq.responseDeadline = new Date(data.responseDeadline);
    if (data.requestedDeliveryDate) {
      rfq.requestedDeliveryDate = new Date(data.requestedDeliveryDate);
    }
    if (data.terms !== undefined) rfq.terms = data.terms;
    if (data.notes !== undefined) rfq.notes = data.notes;
    if (data.attachments) rfq.attachments = data.attachments;

    rfq.updatedBy = uId;
    await rfq.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.PURCHASE,
      entityId: rfq._id.toString(),
      details: `Updated RFQ ${rfq.rfqNumber}`,
    });

    return this.getRFQById(tId, rfq._id);
  }

  async issueRFQ(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    overrides?: Array<{ supplierId: string; email?: string; phone?: string; updateSupplier?: boolean }>
  ): Promise<IRFQ> {
    const rfq = await this.getRFQById(tenantId, id);
    if (rfq.status !== 'DRAFT') {
      throw new BadRequestError(`Only DRAFT RFQs can be issued (Current: ${rfq.status})`);
    }

    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    // Retrieve organization tenant name
    const tenant = await Tenant.findById(tId).select('name');
    const tenantName = tenant?.name || 'StockPilot Operations';

    const deadlineFormatted = new Date(rfq.responseDeadline).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const itemsSummary = (rfq.items || []).map((it: any) => ({
      name: it.itemId?.name || it.description || 'Raw Material',
      quantity: it.quantity,
      uom: it.uomId?.symbol || it.uomId?.code || 'pcs',
      specifications: it.specifications,
    }));

    // Trigger multi-channel dispatch (Email + Phone SMS) to all invited suppliers
    const notificationPromises = rfq.suppliers.map(async (supplierEntry: any) => {
      const sObj = supplierEntry.supplierId;
      const sId = (sObj?._id || sObj)?.toString();
      const override = overrides?.find((o) => o.supplierId === sId);

      let supplierEmail = override?.email?.trim() || sObj?.email || sObj?.contactEmail;
      let supplierPhone = override?.phone?.trim() || sObj?.phone;
      const supplierName = sObj?.name || 'Valued Partner';

      // Persist contact details back to supplier master record if requested
      if (override?.updateSupplier && sId && Types.ObjectId.isValid(sId)) {
        try {
          const updatePayload: any = {};
          if (override.email?.trim()) updatePayload.email = override.email.trim();
          if (override.phone?.trim()) updatePayload.phone = override.phone.trim();
          if (Object.keys(updatePayload).length > 0) {
            await Supplier.findByIdAndUpdate(new Types.ObjectId(sId), { $set: updatePayload });
            logger.info(`✅ Updated master contact for supplier ${supplierName}: Email=${supplierEmail}, Phone=${supplierPhone}`);
          }
        } catch (err) {
          logger.warn(`Could not update supplier master record for ${sId}:`, err);
        }
      }

      supplierEntry.issueDate = new Date();
      supplierEntry.notifiedAt = new Date();

      // Dispatch Email
      if (supplierEmail) {
        try {
          const sent = await emailService.sendRFQInvitationEmail({
            to: supplierEmail,
            supplierName,
            rfqNumber: rfq.rfqNumber,
            deadline: deadlineFormatted,
            items: itemsSummary,
            tenantName,
            terms: rfq.terms,
          });
          supplierEntry.emailSent = sent;
        } catch (err) {
          logger.error(`Failed to send RFQ invite email to ${supplierEmail}:`, err);
          supplierEntry.emailSent = false;
        }
      }

      // Dispatch Phone SMS
      if (supplierPhone) {
        try {
          const smsResult = await smsService.sendRFQInvitationSMS(
            supplierPhone,
            supplierName,
            rfq.rfqNumber,
            deadlineFormatted,
            tenantName
          );
          supplierEntry.smsSent = smsResult.success;
        } catch (err) {
          logger.error(`Failed to send RFQ invite SMS to ${supplierPhone}:`, err);
          supplierEntry.smsSent = false;
        }
      }
    });

    await Promise.allSettled(notificationPromises);

    rfq.status = 'ISSUED';
    rfq.issueDate = new Date();
    rfq.updatedBy = uId;
    await rfq.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.STATUS_CHANGE,
      entity: AuditEntity.PURCHASE,
      entityId: rfq._id.toString(),
      details: `Issued RFQ ${rfq.rfqNumber} to ${rfq.suppliers.length} vendor(s) with automated Email & SMS notifications dispatched`,
      previousState: { status: 'DRAFT' },
      newState: { status: 'ISSUED' },
    });

    return this.getRFQById(tenantId, rfq._id);
  }

  async resendRFQInvite(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    supplierId: string | Types.ObjectId,
    data?: { email?: string; phone?: string; updateSupplier?: boolean }
  ): Promise<IRFQ> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);
    const sId = new Types.ObjectId(supplierId);

    const rfq = await RFQ.findOne({ _id: new Types.ObjectId(id), tenantId: tId });
    if (!rfq) throw new NotFoundError('RFQ not found');

    // Robust matching: supplierId param could be either Supplier._id or the subdocument _id
    let supplierEntry = rfq.suppliers.find((s: any) => {
      const sSuppId = (s.supplierId?._id || s.supplierId)?.toString();
      const sSubId = s._id?.toString();
      return sSuppId === sId.toString() || sSubId === sId.toString();
    });

    if (!supplierEntry) throw new NotFoundError('Supplier not found on this RFQ');

    const actualSupplierId = (supplierEntry.supplierId as any)?._id || supplierEntry.supplierId;
    let supplier = await Supplier.findOne({ _id: actualSupplierId, tenantId: tId });
    if (!supplier) {
      supplier = await Supplier.findById(actualSupplierId);
    }
    if (!supplier) throw new NotFoundError('Supplier record not found');

    let recipientEmail = (data?.email?.trim() || supplier.email || supplier.contactEmail || '').trim();
    let recipientPhone = (data?.phone?.trim() || supplier.phone || '').trim();

    if (data?.updateSupplier && (recipientEmail || recipientPhone)) {
      const updatePayload: any = {};
      if (recipientEmail) updatePayload.email = recipientEmail;
      if (recipientPhone) updatePayload.phone = recipientPhone;
      await Supplier.findByIdAndUpdate(supplier._id, { $set: updatePayload });
      logger.info(`Updated master profile for supplier ${supplier.name}`);
    }

    const tenant = await Tenant.findById(tId).select('name');
    const tenantName = tenant?.name || 'StockPilot Operations';

    const deadlineDate = supplierEntry.responseDeadline || rfq.responseDeadline || new Date();
    const deadlineFormatted = new Date(deadlineDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    // Populate items for description safely
    await rfq.populate('items.itemId', 'name sku itemCode standardCost');
    await rfq.populate('items.uomId', 'name symbol code');
    const itemsSummary = (rfq.items || []).map((it: any) => ({
      name: it.itemId?.name || it.description || 'Raw Material',
      quantity: it.quantity,
      uom: it.uomId?.symbol || it.uomId?.code || 'pcs',
      specifications: it.specifications,
    }));

    supplierEntry.notifiedAt = new Date();

    if (recipientEmail) {
      try {
        const sent = await emailService.sendRFQInvitationEmail({
          to: recipientEmail,
          supplierName: supplier.name,
          rfqNumber: rfq.rfqNumber,
          deadline: deadlineFormatted,
          items: itemsSummary,
          tenantName,
          terms: rfq.terms,
        });
        supplierEntry.emailSent = Boolean(sent);
      } catch (err: any) {
        logger.error(`Failed to resend RFQ invite email to ${recipientEmail}:`, err);
        supplierEntry.emailSent = false;
      }
    }

    if (recipientPhone) {
      try {
        const smsResult = await smsService.sendRFQInvitationSMS(
          recipientPhone,
          supplier.name,
          rfq.rfqNumber,
          deadlineFormatted,
          tenantName
        );
        supplierEntry.smsSent = smsResult.success;
      } catch (err) {
        logger.error(`Failed to resend RFQ invite SMS to ${recipientPhone}:`, err);
        supplierEntry.smsSent = false;
      }
    }

    await rfq.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.INVITE,
      entity: AuditEntity.PURCHASE,
      entityId: rfq._id.toString(),
      details: `Resent RFQ ${rfq.rfqNumber} invitation to supplier '${supplier.name}' (Email: ${recipientEmail || 'None'}, Phone: ${recipientPhone || 'None'})`,
    });

    return this.getRFQById(tId, rfq._id);
  }

  async closeRFQ(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IRFQ> {
    const rfq = await this.getRFQById(tenantId, id);
    rfq.status = 'CLOSED';
    rfq.updatedBy = new Types.ObjectId(userId);
    await rfq.save();

    await auditRepository.create({
      tenantId: new Types.ObjectId(tenantId),
      userId: new Types.ObjectId(userId),
      action: AuditAction.STATUS_CHANGE,
      entity: AuditEntity.PURCHASE,
      entityId: rfq._id.toString(),
      details: `Closed RFQ ${rfq.rfqNumber}`,
      newState: { status: 'CLOSED' },
    });

    return this.getRFQById(tenantId, rfq._id);
  }
}

export const rfqService = new RFQService();
