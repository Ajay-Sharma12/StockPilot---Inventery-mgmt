import { Types } from 'mongoose';
import { GoodsReceiptNote, IGoodsReceiptNote, GRNStatus } from '../models/grn.model';
import { PurchaseOrder } from '../models/purchaseOrder.model';
import { Supplier } from '../../../models/supplier.model';
import { Tenant } from '../../../models/tenant.model';
import { Item } from '../../../models/item.model';
import { Warehouse } from '../../../models/warehouse.model';
import { UOM } from '../../../models/uom.model';
import { PurchaseQCInspection } from '../models/purchaseQc.model';
import { inventoryService } from '../../../services/inventory.service';
import { emailService } from '../../../services/email.service';
import { smsService } from '../../../services/sms.service';
import { documentNumberService } from '../../../services/documentNumber.service';
import { auditRepository } from '../../../repositories/audit.repository';
import { AuditAction, AuditEntity } from '../../../config/constants';
import { logger } from '../../../core/logger';
import { BadRequestError, NotFoundError } from '../../../core/errors';

export class GRNService {
  async getGRNs(
    tenantId: string | Types.ObjectId,
    query: {
      status?: GRNStatus;
      purchaseOrderId?: string;
      warehouseId?: string;
      supplierId?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ data: IGoodsReceiptNote[]; total: number; page: number; limit: number }> {
    const tId = new Types.ObjectId(tenantId);
    const filter: any = { tenantId: tId };

    if (query.status) filter.status = query.status;
    if (query.purchaseOrderId && Types.ObjectId.isValid(query.purchaseOrderId)) {
      filter.purchaseOrderId = new Types.ObjectId(query.purchaseOrderId);
    }
    if (query.warehouseId && Types.ObjectId.isValid(query.warehouseId)) {
      filter.warehouseId = new Types.ObjectId(query.warehouseId);
    }
    if (query.supplierId && Types.ObjectId.isValid(query.supplierId)) {
      filter.supplierId = new Types.ObjectId(query.supplierId);
    }
    if (query.search) {
      filter.grnNumber = { $regex: query.search.trim(), $options: 'i' };
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      GoodsReceiptNote.find(filter)
        .populate('supplierId', 'name supplierCode')
        .populate('warehouseId', 'name code')
        .populate('purchaseOrderId', 'poNumber status total orderDate')
        .populate('receivedBy', 'name email')
        .populate('items.itemId', 'name sku itemCode qcRequired batchManaged expiryManaged')
        .populate('items.uomId', 'name symbol code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      GoodsReceiptNote.countDocuments(filter),
    ]);

    for (const grn of data) {
      await this.autoHealGRN(grn, tId);
    }

    return { data, total, page, limit };
  }

  private async autoHealGRN(grn: IGoodsReceiptNote, tId: Types.ObjectId): Promise<void> {
    if (grn.status === 'QC_PENDING') {
      const qcs = await PurchaseQCInspection.find({ grnId: grn._id, tenantId: tId });
      if (qcs.length > 0 && qcs.every((q) => q.status === 'DISPOSITIONED')) {
        for (const qc of qcs) {
          const qcItemIdStr = ((qc.itemId as any)?._id || qc.itemId)?.toString();
          const qcLineIdStr = ((qc.grnLineId as any)?._id || qc.grnLineId)?.toString();
          const line = grn.items.find(
            (l) => (l._id && l._id.toString() === qcLineIdStr) || (l.itemId && l.itemId.toString() === qcItemIdStr)
          );
          if (line) {
            line.acceptedQuantity = qc.acceptedQuantity;
            line.rejectedQuantity = qc.rejectedQuantity;
            line.heldQuantity = qc.heldQuantity;
          }
        }
        const allAccepted = grn.items.every((l) => (l.acceptedQuantity || 0) >= (l.receivedQuantity || 0));
        const allRejected = grn.items.every((l) => (l.rejectedQuantity || 0) >= (l.receivedQuantity || 0));
        const hasAccepted = grn.items.some((l) => (l.acceptedQuantity || 0) > 0);

        grn.status = allAccepted ? 'ACCEPTED' : allRejected ? 'REJECTED' : hasAccepted ? 'PARTIALLY_ACCEPTED' : 'PARTIALLY_ACCEPTED';
        try {
          await grn.save();
        } catch {
          // Non-critical auto-heal save
        }
      }
    }
  }

  async getGRNById(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IGoodsReceiptNote> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Invalid GRN identifier');

    const tId = new Types.ObjectId(tenantId);
    const grn = await GoodsReceiptNote.findOne({
      _id: new Types.ObjectId(id),
      tenantId: tId,
    })
      .populate('supplierId', 'name supplierCode email phone address')
      .populate('warehouseId', 'name code address')
      .populate('purchaseOrderId', 'poNumber status total orderDate expectedDeliveryDate')
      .populate('receivedBy', 'name email')
      .populate('items.itemId', 'name sku itemCode standardCost qcRequired batchManaged expiryManaged')
      .populate('items.uomId', 'name symbol code')
      .exec();

    if (!grn) throw new NotFoundError('Goods Receipt Note not found');
    await this.autoHealGRN(grn, tId);
    return grn;
  }

  async createGRN(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    data: any
  ): Promise<IGoodsReceiptNote> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    // 1. Fetch and validate Purchase Order
    const po = await PurchaseOrder.findOne({
      _id: new Types.ObjectId(data.purchaseOrderId),
      tenantId: tId,
    });
    if (!po) throw new NotFoundError('Purchase Order not found in organization');
    if (po.status !== 'APPROVED' && po.status !== 'SENT' && po.status !== 'PARTIALLY_RECEIVED') {
      throw new BadRequestError(`Cannot receive goods for PO in '${po.status}' status (must be APPROVED or SENT)`);
    }

    // 2. Validate receiving warehouse
    const wh = await Warehouse.findOne({
      _id: new Types.ObjectId(data.warehouseId),
      tenantId: tId,
    });
    if (!wh) throw new NotFoundError('Warehouse not found');

    const grnNumber = await documentNumberService.getNextNumber(tId, 'GRN');
    const validatedItems = [];
    let hasAnyQCRequired = false;

    // 3. Validate line quantities and check over-receipt
    for (const itemInput of data.items) {
      const poLine = po.items.find((l) => l._id?.toString() === itemInput.poLineId);
      if (!poLine) {
        throw new NotFoundError(`PO line item '${itemInput.poLineId}' not found on order ${po.poNumber}`);
      }

      const remainingPending = poLine.quantity - poLine.receivedQuantity;
      if (itemInput.receivedQuantity > remainingPending) {
        throw new BadRequestError(
          `Over-receipt prevented: Line '${poLine.description}' has only ${remainingPending} pending units, but attempted receipt is ${itemInput.receivedQuantity}`
        );
      }

      const item = await Item.findOne({ _id: new Types.ObjectId(itemInput.itemId), tenantId: tId });
      if (!item) throw new NotFoundError(`Item '${itemInput.itemId}' not found`);

      // Batch & Expiry validations
      if (item.batchManaged && !itemInput.batchNumber?.trim()) {
        throw new BadRequestError(`Item '${item.name}' requires batch number identification upon receipt`);
      }
      if (item.expiryManaged && !itemInput.expiryDate) {
        throw new BadRequestError(`Item '${item.name}' requires expiration date upon receipt`);
      }
      if (itemInput.manufacturingDate && itemInput.expiryDate) {
        if (new Date(itemInput.expiryDate) <= new Date(itemInput.manufacturingDate)) {
          throw new BadRequestError('Expiration date must be after manufacturing date');
        }
      }

      const uom = await UOM.findOne({ _id: new Types.ObjectId(itemInput.uomId), tenantId: tId });
      if (!uom) throw new NotFoundError('UOM not found');

      const isQCRequired = item.qcRequired || Boolean(itemInput.qcRequired);
      if (isQCRequired) hasAnyQCRequired = true;

      validatedItems.push({
        itemId: item._id,
        poLineId: poLine._id!,
        orderedQuantity: poLine.quantity,
        receivedQuantity: itemInput.receivedQuantity,
        acceptedQuantity: isQCRequired ? 0 : itemInput.receivedQuantity,
        rejectedQuantity: 0,
        heldQuantity: 0,
        pendingQuantity: poLine.quantity - (poLine.receivedQuantity + itemInput.receivedQuantity),
        uomId: uom._id,
        batchNumber: itemInput.batchNumber?.trim(),
        manufacturingDate: itemInput.manufacturingDate ? new Date(itemInput.manufacturingDate) : undefined,
        expiryDate: itemInput.expiryDate ? new Date(itemInput.expiryDate) : undefined,
        qcRequired: isQCRequired,
        remarks: itemInput.remarks,
      });

      // Update PO line received & pending counters
      poLine.receivedQuantity += itemInput.receivedQuantity;
      poLine.pendingQuantity = poLine.quantity - poLine.receivedQuantity;
    }

    // 4. Update overall PO status based on progress
    const allLinesCompleted = po.items.every((line) => line.receivedQuantity >= line.quantity);
    po.status = allLinesCompleted ? 'FULLY_RECEIVED' : 'PARTIALLY_RECEIVED';
    await po.save();

    // 5. Create GRN record with logistics details
    const initialGRNStatus: GRNStatus = hasAnyQCRequired ? 'QC_PENDING' : 'COMPLETED';

    const grn = await GoodsReceiptNote.create({
      tenantId: tId,
      grnNumber,
      purchaseOrderId: po._id,
      supplierId: po.supplierId,
      warehouseId: wh._id,
      receiptDate: data.receiptDate ? new Date(data.receiptDate) : new Date(),
      receivedBy: uId,
      status: initialGRNStatus,
      deliveryChallanNumber: data.deliveryChallanNumber?.trim(),
      deliveryChallanDate: data.deliveryChallanDate ? new Date(data.deliveryChallanDate) : undefined,
      transporterName: data.transporterName?.trim(),
      vehicleNumber: data.vehicleNumber?.trim(),
      lrNumber: data.lrNumber?.trim(),
      packageCount: data.packageCount ? Number(data.packageCount) : undefined,
      remarks: data.remarks,
      attachments: data.attachments || [],
      items: validatedItems,
      createdBy: uId,
    });

    // 6. Branch: If item does NOT require QC -> Directly receive into central InventoryService
    for (let idx = 0; idx < validatedItems.length; idx++) {
      const line = validatedItems[idx];
      const poLine = po.items.find((l) => l._id?.toString() === line.poLineId.toString());
      const effectiveUnitCost = poLine ? poLine.unitPrice : 0;

      if (!line.qcRequired) {
        // Stock directly enters available inventory via Phase 2 InventoryService
        await inventoryService.receiveStock(tId, uId, {
          itemId: line.itemId,
          warehouseId: wh._id,
          locationId: (line as any).locationId,
          batchNumber: line.batchNumber,
          quantity: line.receivedQuantity,
          unitCost: effectiveUnitCost,
          transactionType: 'PURCHASE_RECEIPT',
          referenceType: 'GRN',
          referenceId: grn._id.toString(),
          reason: `GRN inbound receipt for PO ${po.poNumber}`,
          metadata: {
            grnNumber,
            poNumber: po.poNumber,
            supplierId: po.supplierId.toString(),
            deliveryChallanNumber: grn.deliveryChallanNumber,
          },
        });
      } else {
        // Automatically spawn a Purchase QC Inspection worksheet
        const qcNumber = await documentNumberService.getNextNumber(tId, 'PURCHASE_QC');
        const grnLineRefId = (grn.items[idx] as any)._id || new Types.ObjectId();

        await PurchaseQCInspection.create({
          tenantId: tId,
          qcNumber,
          grnId: grn._id,
          grnLineId: grnLineRefId,
          itemId: line.itemId,
          batchNumber: line.batchNumber,
          inspectedQuantity: line.receivedQuantity,
          acceptedQuantity: 0,
          rejectedQuantity: 0,
          heldQuantity: 0,
          inspectorId: uId,
          overallResult: 'HOLD',
          status: 'PENDING',
          remarks: `Inbound inspection queued from GRN ${grnNumber}`,
          createdBy: uId,
        });
      }
    }

    // 7. Automated Supplier Inbound Receipt Notification (Email + SMS)
    if (data.notifySupplier !== false) {
      try {
        const [supplierDoc, tenantDoc] = await Promise.all([
          Supplier.findById(po.supplierId).exec(),
          Tenant.findById(tId).select('name').exec(),
        ]);

        const supplierName = supplierDoc?.name || 'Valued Partner';
        const supplierEmail = data.recipientEmail?.trim() || supplierDoc?.email || supplierDoc?.contactEmail;
        const supplierPhone = data.recipientPhone?.trim() || supplierDoc?.phone;
        const tenantName = tenantDoc?.name || 'StockPilot Operations';

        const receiptDateFormatted = new Date(grn.receiptDate).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });

        // Summary items for email
        const itemsSummary = await Promise.all(
          validatedItems.map(async (l) => {
            const itemDoc = await Item.findById(l.itemId).select('name code').exec();
            const uomDoc = await UOM.findById(l.uomId).select('symbol name').exec();
            return {
              name: itemDoc?.name || 'Material Item',
              receivedQuantity: l.receivedQuantity,
              uom: uomDoc?.symbol || uomDoc?.name || 'pcs',
              qcRequired: l.qcRequired,
              batchNumber: l.batchNumber,
            };
          })
        );

        // Send Email & SMS in parallel with await
        const emailPromise = supplierEmail
          ? emailService
              .sendGRNAcknowledgmentEmail({
                to: supplierEmail,
                supplierName,
                grnNumber: grn.grnNumber,
                poNumber: po.poNumber,
                warehouseName: wh.name,
                receiptDate: receiptDateFormatted,
                items: itemsSummary,
                tenantName,
                deliveryChallanNumber: grn.deliveryChallanNumber,
                vehicleNumber: grn.vehicleNumber,
                remarks: grn.remarks,
              })
              .then((sent) => Boolean(sent))
              .catch((err) => {
                logger.error(`Failed to send GRN email to ${supplierEmail}:`, err);
                return false;
              })
          : Promise.resolve(false);

        const smsPromise = supplierPhone
          ? smsService
              .sendGRNAcknowledgmentSMS(
                supplierPhone,
                supplierName,
                grn.grnNumber,
                po.poNumber,
                wh.name,
                validatedItems.length,
                tenantName
              )
              .then((res) => Boolean(res.success))
              .catch((err) => {
                logger.error(`Failed to send GRN SMS to ${supplierPhone}:`, err);
                return false;
              })
          : Promise.resolve(false);

        const [emailSent, smsSent] = await Promise.all([emailPromise, smsPromise]);

        if (emailSent || smsSent) {
          await GoodsReceiptNote.findByIdAndUpdate(grn._id, {
            $set: {
              ...(emailSent && { supplierNotifiedEmail: true }),
              ...(smsSent && { supplierNotifiedSMS: true }),
              notifiedAt: new Date(),
            },
          }).exec();
        }
      } catch (notifyErr) {
        logger.warn('Error during supplier GRN receipt notification dispatch:', notifyErr);
      }
    }

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.CREATE,
      entity: AuditEntity.PURCHASE,
      entityId: grn._id.toString(),
      details: `Created GRN ${grnNumber} against PO ${po.poNumber} (Challan: ${grn.deliveryChallanNumber || 'N/A'}, Vehicle: ${grn.vehicleNumber || 'N/A'}). Total lines: ${validatedItems.length}. QC Required: ${hasAnyQCRequired}`,
    });

    return this.getGRNById(tId, grn._id);
  }

  async cancelGRN(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    reason: string
  ): Promise<IGoodsReceiptNote> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const grn = await GoodsReceiptNote.findOne({ _id: new Types.ObjectId(id), tenantId: tId });
    if (!grn) throw new NotFoundError('Goods Receipt Note not found');
    if (grn.status === 'CANCELLED') {
      throw new BadRequestError('This GRN is already cancelled');
    }

    const po = await PurchaseOrder.findOne({ _id: grn.purchaseOrderId, tenantId: tId });
    if (!po) throw new NotFoundError('Associated Purchase Order not found');

    // Rollback stock for direct receipt lines (non-QC items that were added to inventory)
    for (const line of grn.items) {
      if (!line.qcRequired && line.receivedQuantity > 0) {
        try {
          await inventoryService.issueStock(tId, uId, {
            itemId: line.itemId,
            warehouseId: grn.warehouseId,
            batchNumber: line.batchNumber,
            quantity: line.receivedQuantity,
            transactionType: 'PURCHASE_RETURN' as any,
            referenceType: 'GRN_VOID',
            referenceId: grn._id.toString(),
            reason: `GRN Cancellation / Reversal: ${reason || 'Voided GRN'}`,
          });
        } catch (stockErr) {
          logger.warn(`Could not reverse inventory for line ${line.itemId} on GRN cancellation:`, stockErr);
        }
      }

      // Revert PO line received counters
      const poLine = po.items.find((l) => l._id?.toString() === line.poLineId.toString());
      if (poLine) {
        poLine.receivedQuantity = Math.max(0, poLine.receivedQuantity - line.receivedQuantity);
        poLine.pendingQuantity = poLine.quantity - poLine.receivedQuantity;
      }
    }

    // Recalculate PO overall status
    const hasAnyReceived = po.items.some((l) => l.receivedQuantity > 0);
    po.status = hasAnyReceived ? 'PARTIALLY_RECEIVED' : 'APPROVED';
    await po.save();

    // Mark GRN as CANCELLED
    grn.status = 'CANCELLED';
    grn.cancellationReason = reason || 'Cancelled by authorized user';
    grn.updatedBy = uId;
    await grn.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.STATUS_CHANGE,
      entity: AuditEntity.PURCHASE,
      entityId: grn._id.toString(),
      details: `Cancelled GRN ${grn.grnNumber} against PO ${po.poNumber}. Reason: ${reason}`,
      previousState: { status: grn.status },
      newState: { status: 'CANCELLED', cancellationReason: reason },
    });

    return this.getGRNById(tId, grn._id);
  }

  async resendNotification(
    tenantId: string | Types.ObjectId,
    grnId: string | Types.ObjectId,
    overrides?: { email?: string; phone?: string }
  ): Promise<IGoodsReceiptNote> {
    const tId = new Types.ObjectId(tenantId);
    const grn = await GoodsReceiptNote.findOne({ _id: new Types.ObjectId(grnId), tenantId: tId });
    if (!grn) throw new NotFoundError('Goods Receipt Note not found');

    const [po, wh, tenantDoc] = await Promise.all([
      PurchaseOrder.findOne({ _id: grn.purchaseOrderId, tenantId: tId }),
      Warehouse.findOne({ _id: grn.warehouseId, tenantId: tId }),
      Tenant.findById(tId).select('name').exec(),
    ]);

    if (!po) throw new NotFoundError('Associated Purchase Order not found');

    const supplierDoc = await Supplier.findById(po.supplierId).exec();
    const supplierName = supplierDoc?.name || 'Valued Partner';
    const supplierEmail = overrides?.email?.trim() || supplierDoc?.email || supplierDoc?.contactEmail;
    const supplierPhone = overrides?.phone?.trim() || supplierDoc?.phone;
    const tenantName = tenantDoc?.name || 'StockPilot Operations';

    const receiptDateFormatted = new Date(grn.receiptDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const itemsSummary = await Promise.all(
      grn.items.map(async (l) => {
        const itemDoc = await Item.findById(l.itemId).select('name code').exec();
        const uomDoc = await UOM.findById(l.uomId).select('symbol name').exec();
        return {
          name: itemDoc?.name || 'Material Item',
          receivedQuantity: l.receivedQuantity,
          uom: uomDoc?.symbol || uomDoc?.name || 'pcs',
          qcRequired: l.qcRequired,
          batchNumber: l.batchNumber,
        };
      })
    );

    let emailSent = false;
    if (supplierEmail) {
      emailSent = await emailService
        .sendGRNAcknowledgmentEmail({
          to: supplierEmail,
          supplierName,
          grnNumber: grn.grnNumber,
          poNumber: po.poNumber,
          warehouseName: wh?.name || 'Main Warehouse',
          receiptDate: receiptDateFormatted,
          items: itemsSummary,
          tenantName,
          deliveryChallanNumber: grn.deliveryChallanNumber,
          vehicleNumber: grn.vehicleNumber,
          remarks: grn.remarks,
        })
        .catch(() => false);
    }

    let smsSent = false;
    if (supplierPhone) {
      const res = await smsService
        .sendGRNAcknowledgmentSMS(
          supplierPhone,
          supplierName,
          grn.grnNumber,
          po.poNumber,
          wh?.name || 'Main Warehouse',
          grn.items.length,
          tenantName
        )
        .catch(() => ({ success: false }));
      smsSent = Boolean(res?.success);
    }

    if (emailSent || smsSent) {
      await GoodsReceiptNote.findByIdAndUpdate(grn._id, {
        $set: {
          ...(emailSent && { supplierNotifiedEmail: true }),
          ...(smsSent && { supplierNotifiedSMS: true }),
          notifiedAt: new Date(),
        },
      }).exec();
    }

    return this.getGRNById(tId, grn._id);
  }

  async sendToQC(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    grnId: string
  ): Promise<IGoodsReceiptNote> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const grn = await GoodsReceiptNote.findOne({ _id: new Types.ObjectId(grnId), tenantId: tId });
    if (!grn) throw new NotFoundError('GRN not found');
    if (grn.status === 'CANCELLED') throw new BadRequestError('Cannot send cancelled GRN to QC');

    let createdCount = 0;
    for (let idx = 0; idx < grn.items.length; idx++) {
      const line = grn.items[idx];
      const grnLineRefId = (line as any)._id || new Types.ObjectId();

      // Check if an inspection worksheet already exists for this GRN line
      const existingQC = await PurchaseQCInspection.findOne({
        tenantId: tId,
        grnId: grn._id,
        itemId: line.itemId,
      });

      if (!existingQC) {
        // If this line was previously direct stock without QC, reverse the available stock into quarantine
        if (!line.qcRequired && line.receivedQuantity > 0) {
          try {
            await inventoryService.issueStock(tId, uId, {
              itemId: line.itemId,
              warehouseId: grn.warehouseId,
              batchNumber: line.batchNumber,
              quantity: line.receivedQuantity,
              transactionType: 'PURCHASE_RETURN' as any,
              referenceType: 'GRN',
              referenceId: grn._id.toString(),
              reason: `Stock quarantined for retroactively requested QC inspection on GRN ${grn.grnNumber}`,
            });
          } catch (stockErr) {
            logger.warn(`Could not reverse inventory for line ${line.itemId} when sending to QC:`, stockErr);
          }
        }

        line.qcRequired = true;
        line.acceptedQuantity = 0;
        const qcNumber = await documentNumberService.getNextNumber(tId, 'PURCHASE_QC');

        await PurchaseQCInspection.create({
          tenantId: tId,
          qcNumber,
          grnId: grn._id,
          grnLineId: grnLineRefId,
          itemId: line.itemId,
          batchNumber: line.batchNumber,
          inspectedQuantity: line.receivedQuantity,
          acceptedQuantity: 0,
          rejectedQuantity: 0,
          heldQuantity: 0,
          inspectorId: uId,
          overallResult: 'HOLD',
          status: 'PENDING',
          remarks: `Inbound inspection queued from GRN ${grn.grnNumber}`,
          createdBy: uId,
        });
        createdCount++;
      } else {
        line.qcRequired = true;
      }
    }

    grn.status = 'QC_PENDING';
    await grn.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.PURCHASE,
      entityId: grn._id.toString(),
      details: `Dispatched GRN ${grn.grnNumber} to Quality Inspection queue (${createdCount} line(s) queued)`,
    });

    return this.getGRNById(tId, grn._id);
  }
}

export const grnService = new GRNService();
