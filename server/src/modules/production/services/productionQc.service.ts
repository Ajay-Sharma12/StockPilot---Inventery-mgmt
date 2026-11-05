import { Types } from 'mongoose';
import {
  ProductionQC,
  IProductionQCInspection,
  ProductionQCStatus,
  ProductionQCOverallResult,
  ProductionQCDisposition,
  IProductionQCResultItem,
} from '../models/productionQc.model';
import { ProductionOrder } from '../models/productionOrder.model';
import { ProductionBatch } from '../models/productionBatch.model';
import { ProductionOutput } from '../models/productionOutput.model';
import { inventoryService } from '../../../services/inventory.service';
import { auditRepository } from '../../../repositories/audit.repository';
import { AuditAction, AuditEntity } from '../../../config/constants';
import { BadRequestError, NotFoundError } from '../../../core/errors';

export interface InspectProductionQCInput {
  results: IProductionQCResultItem[];
  overallResult: ProductionQCOverallResult;
  remarks?: string;
}

export interface DispositionProductionQCInput {
  disposition: ProductionQCDisposition;
  acceptedQuantity: number;
  rejectedQuantity?: number;
  heldQuantity?: number;
  reworkQuantity?: number;
  dispositionNotes: string;
}

export class ProductionQCService {
  async getQCInspections(
    tenantId: string | Types.ObjectId,
    query: {
      page?: number;
      limit?: number;
      status?: ProductionQCStatus;
      overallResult?: ProductionQCOverallResult;
      productionOrderId?: string;
      search?: string;
    } = {}
  ): Promise<{ data: IProductionQCInspection[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: any = { tenantId: new Types.ObjectId(tenantId) };
    if (query.status) filter.status = query.status;
    if (query.overallResult) filter.overallResult = query.overallResult;
    if (query.productionOrderId) filter.productionOrderId = new Types.ObjectId(query.productionOrderId);
    if (query.search) {
      filter.$or = [
        { qcNumber: { $regex: query.search.trim(), $options: 'i' } },
        { batchNumber: { $regex: query.search.trim(), $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      ProductionQC.find(filter)
        .populate('itemId', 'sku name itemCode standardCost baseUomId description category')
        .populate({
          path: 'productionOrderId',
          select: 'productionOrderNumber status warehouseId plannedQuantity yieldQuantity bomId',
          populate: [
            { path: 'warehouseId', select: 'name code' },
            { path: 'bomId', select: 'bomNumber name version' },
          ],
        })
        .populate('batchId', 'batchNumber manufacturingDate expiryDate status quantity notes')
        .populate('inspectorId', 'name email')
        .populate('createdBy', 'name email')
        .populate('dispositionedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      ProductionQC.countDocuments(filter).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getQCInspectionById(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IProductionQCInspection> {
    const qc = await ProductionQC.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    })
      .populate('itemId', 'sku name itemCode standardCost baseUomId description category')
      .populate({
        path: 'productionOrderId',
        select: 'productionOrderNumber status warehouseId plannedQuantity yieldQuantity bomId',
        populate: [
          { path: 'warehouseId', select: 'name code' },
          { path: 'bomId', select: 'bomNumber name version' },
        ],
      })
      .populate('batchId', 'batchNumber manufacturingDate expiryDate status quantity notes')
      .populate('inspectorId', 'name email')
      .populate('createdBy', 'name email')
      .populate('dispositionedBy', 'name email')
      .exec();

    if (!qc) throw new NotFoundError('Production QC inspection not found');
    return qc;
  }

  async inspectProductionQC(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    input: InspectProductionQCInput
  ): Promise<IProductionQCInspection> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);
    const qc = await this.getQCInspectionById(tId, id);

    if (qc.status === 'DISPOSITIONED') {
      throw new BadRequestError('Cannot re-inspect an already dispositioned QC record');
    }

    qc.results = input.results;
    qc.overallResult = input.overallResult;
    qc.status = 'INSPECTED';
    qc.inspectorId = uId;
    if (input.remarks) qc.remarks = input.remarks.trim();
    qc.updatedBy = uId;

    await qc.save();

    // Sync linked ProductionOutput documents
    await ProductionOutput.updateMany(
      { tenantId: tId, qcInspectionId: qc._id },
      { $set: { qcStatus: 'INSPECTED', updatedBy: uId } }
    ).exec();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.QC,
      entityId: qc._id.toString(),
      details: `Completed QC inspection ${qc.qcNumber} with result: ${qc.overallResult}`,
    });

    return qc;
  }

  async dispositionProductionQC(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    input: DispositionProductionQCInput
  ): Promise<IProductionQCInspection> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);
    const qc = await this.getQCInspectionById(tId, id);

    if (qc.status === 'DISPOSITIONED') {
      throw new BadRequestError('QC inspection is already dispositioned');
    }

    const accepted = input.acceptedQuantity || 0;
    const rejected = input.rejectedQuantity || 0;
    const held = input.heldQuantity || 0;
    const rework = input.reworkQuantity || 0;

    const totalAllocated = accepted + rejected + held + rework;
    if (totalAllocated !== qc.inspectedQuantity) {
      throw new BadRequestError(
        `Disposition quantities sum (${totalAllocated}) must equal inspected quantity (${qc.inspectedQuantity})`
      );
    }

    const order = await ProductionOrder.findOne({ _id: qc.productionOrderId, tenantId: tId }).exec();
    if (!order) throw new NotFoundError('Associated Production Order not found');

    const warehouseId = order.warehouseId as Types.ObjectId;

    // CRITICAL QC INVENTORY RULE:
    // Only acceptedQuantity enters live inventory!
    if (accepted > 0) {
      const receiptResult = await inventoryService.receiveStock(tId, uId, {
        itemId: qc.itemId,
        warehouseId,
        quantity: accepted,
        batchNumber: qc.batchNumber,
        transactionType: 'PRODUCTION_RECEIPT',
        referenceType: 'PRODUCTION_QC',
        referenceId: qc.qcNumber,
        reason: `QC Accepted finished goods from production order ${order.productionOrderNumber}`,
      });

      qc.inventoryReceiptTransactionId = receiptResult.transaction._id;

      // Update ProductionBatch status to RELEASED if all/majority accepted
      if (qc.batchId) {
        await ProductionBatch.updateOne(
          { _id: qc.batchId, tenantId: tId },
          { $set: { status: 'RELEASED' } }
        ).exec();
      }
    } else {
      // If 0 accepted, batch remains REJECTED or QUARANTINED
      if (qc.batchId) {
        await ProductionBatch.updateOne(
          { _id: qc.batchId, tenantId: tId },
          { $set: { status: input.disposition === 'REJECT' ? 'REJECTED' : 'QUARANTINED' } }
        ).exec();
      }
    }

    // Update order rejected quantity
    if (rejected > 0) {
      order.rejectedQuantity += rejected;
      await order.save();
    }

    // Auto-align overallResult with final disposition outcome
    if (held === 0 && rejected === 0 && rework === 0) {
      qc.overallResult = 'PASS';
    } else if (accepted > 0 && held === 0) {
      qc.overallResult = 'CONDITIONAL';
    } else if (accepted === 0 && held === 0) {
      qc.overallResult = 'FAIL';
    } else if (held > 0) {
      qc.overallResult = 'HOLD';
    }

    qc.acceptedQuantity = accepted;
    qc.rejectedQuantity = rejected;
    qc.heldQuantity = held;
    qc.reworkQuantity = rework;
    qc.disposition = input.disposition;
    qc.dispositionNotes = input.dispositionNotes.trim();
    qc.dispositionedAt = new Date();
    qc.dispositionedBy = uId;
    qc.status = 'DISPOSITIONED';
    qc.updatedBy = uId;

    await qc.save();

    // Sync linked ProductionOutput documents with final QC outcome
    const outputQcStatus = (qc.overallResult === 'FAIL' || accepted === 0) ? 'FAILED' : 'PASSED';
    await ProductionOutput.updateMany(
      { tenantId: tId, qcInspectionId: qc._id },
      {
        $set: {
          qcStatus: outputQcStatus,
          acceptedQuantity: accepted,
          rejectedQuantity: rejected,
          updatedBy: uId,
        },
      }
    ).exec();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.APPROVE,
      entity: AuditEntity.QC,
      entityId: qc._id.toString(),
      details: `Dispositioned QC ${qc.qcNumber}: ${accepted} Accepted, ${rejected} Rejected, ${held} Held. Disposition: ${qc.disposition}`,
    });

    return this.getQCInspectionById(tId, qc._id);
  }

  async overrideVerdict(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    input: { overallResult: ProductionQCOverallResult; remarks?: string }
  ): Promise<IProductionQCInspection> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);
    const qc = await this.getQCInspectionById(tId, id);

    qc.overallResult = input.overallResult;
    if (input.remarks) {
      qc.dispositionNotes = qc.dispositionNotes
        ? `${qc.dispositionNotes} | Override: ${input.remarks.trim()}`
        : input.remarks.trim();
    }
    qc.updatedBy = uId;

    await qc.save();

    // Sync linked ProductionOutput documents with overridden verdict
    const outputQcStatus = input.overallResult === 'FAIL' ? 'FAILED' : 'PASSED';
    await ProductionOutput.updateMany(
      { tenantId: tId, qcInspectionId: qc._id },
      {
        $set: {
          qcStatus: outputQcStatus,
          updatedBy: uId,
        },
      }
    ).exec();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.QC,
      entityId: qc._id.toString(),
      details: `QC inspection ${qc.qcNumber} verdict updated to: ${qc.overallResult}`,
    });

    return this.getQCInspectionById(tId, qc._id);
  }
}

export const productionQcService = new ProductionQCService();
