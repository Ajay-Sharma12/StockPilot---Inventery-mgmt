import { Types } from 'mongoose';
import {
  PurchaseRequisition,
  IPurchaseRequisition,
  PRStatus,
} from '../models/purchaseRequisition.model';
import { Item } from '../../../models/item.model';
import { Warehouse } from '../../../models/warehouse.model';
import { Department } from '../../../models/department.model';
import { UOM } from '../../../models/uom.model';
import { InventoryBalance } from '../../../models/inventoryBalance.model';
import { inventoryService } from '../../../services/inventory.service';
import { documentNumberService } from '../../../services/documentNumber.service';
import { auditRepository } from '../../../repositories/audit.repository';
import { AuditAction, AuditEntity } from '../../../config/constants';
import { BadRequestError, NotFoundError } from '../../../core/errors';

export interface ApprovePRPayload {
  approvalComment?: string;
  items?: {
    itemId: string;
    approvedQuantity: number;
  }[];
}

export interface IssuePRStockItemInput {
  itemId: string;
  quantity: number;
  locationId?: string;
  batchNumber?: string;
  remarks?: string;
}

export interface IssuePRStockPayload {
  itemsToIssue: IssuePRStockItemInput[];
  remarks?: string;
}

export class PurchaseRequisitionService {
  async getPurchaseRequisitions(
    tenantId: string | Types.ObjectId,
    query: {
      status?: PRStatus;
      priority?: string;
      warehouseId?: string;
      departmentId?: string;
      requesterId?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ data: IPurchaseRequisition[]; total: number; page: number; limit: number }> {
    const tId = new Types.ObjectId(tenantId);
    const filter: any = { tenantId: tId };

    if (query.status) {
      if (Array.isArray(query.status)) {
        filter.status = { $in: query.status };
      } else if (typeof query.status === 'string' && query.status.includes(',')) {
        filter.status = { $in: query.status.split(',').map((s: string) => s.trim()) };
      } else if (query.status === 'PENDING_APPROVAL' || query.status === 'SUBMITTED') {
        filter.status = { $in: ['PENDING_APPROVAL', 'SUBMITTED'] };
      } else {
        filter.status = query.status;
      }
    }

    if (query.priority) filter.priority = query.priority;

    if (query.warehouseId && Types.ObjectId.isValid(query.warehouseId)) {
      filter.warehouseId = new Types.ObjectId(query.warehouseId);
    }
    if (query.departmentId && Types.ObjectId.isValid(query.departmentId)) {
      filter.departmentId = new Types.ObjectId(query.departmentId);
    }
    if (query.requesterId && Types.ObjectId.isValid(query.requesterId)) {
      filter.requesterId = new Types.ObjectId(query.requesterId);
    }
    if (query.search) {
      filter.$or = [
        { prNumber: { $regex: query.search.trim(), $options: 'i' } },
        { purpose: { $regex: query.search.trim(), $options: 'i' } },
        { notes: { $regex: query.search.trim(), $options: 'i' } },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      PurchaseRequisition.find(filter)
        .populate('requesterId', 'name email department')
        .populate('warehouseId', 'name code address')
        .populate('departmentId', 'name code')
        .populate('items.itemId', 'name sku itemCode standardCost status')
        .populate('items.uomId', 'name symbol code')
        .populate('approvedBy', 'name email')
        .populate('rejectedBy', 'name email')
        .populate('cancelledBy', 'name email')
        .populate('stockIssueTransactionIds', 'transactionNumber transactionType quantityOut balanceBefore balanceAfter createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      PurchaseRequisition.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async getPRById(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IPurchaseRequisition> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Invalid PR identifier');

    const pr = await PurchaseRequisition.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    })
      .populate('requesterId', 'name email department')
      .populate('warehouseId', 'name code address')
      .populate('departmentId', 'name code')
      .populate('items.itemId', 'name sku itemCode standardCost status')
      .populate('items.uomId', 'name symbol code')
      .populate('approvedBy', 'name email')
      .populate('rejectedBy', 'name email')
      .populate('cancelledBy', 'name email')
      .populate('stockIssueTransactionIds', 'transactionNumber transactionType quantityOut balanceBefore balanceAfter createdAt reason')
      .exec();

    if (!pr) throw new NotFoundError('Purchase Requisition not found');
    return pr;
  }

  async createPR(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    data: any
  ): Promise<IPurchaseRequisition> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    // 1. Validate warehouse
    const wh = await Warehouse.findOne({ _id: new Types.ObjectId(data.warehouseId), tenantId: tId });
    if (!wh) throw new NotFoundError('Destination warehouse not found in organization');

    // 2. Validate department if provided
    if (data.departmentId) {
      const dept = await Department.findOne({
        _id: new Types.ObjectId(data.departmentId),
        tenantId: tId,
      });
      if (!dept) throw new NotFoundError('Department not found in organization');
    }

    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      throw new BadRequestError('At least one product item is required to create a requisition');
    }

    // 3. Prevent duplicate items in requisition
    const seenItemIds = new Set<string>();
    for (const itemInput of data.items) {
      const itId = itemInput.itemId?.toString();
      if (!itId) throw new BadRequestError('Invalid item in requisition');
      if (seenItemIds.has(itId)) {
        throw new BadRequestError('Duplicate item detected in requisition. Each item can only be added once.');
      }
      seenItemIds.add(itId);
    }

    // 4. Validate items & calculate line totals
    let computedEstimatedTotal = 0;
    const validatedItems = [];

    for (const itemInput of data.items) {
      const requestedQty = Number(itemInput.requestedQuantity);
      if (!requestedQty || requestedQty <= 0) {
        throw new BadRequestError('Quantity must be greater than 0');
      }

      const item = await Item.findOne({ _id: new Types.ObjectId(itemInput.itemId), tenantId: tId });
      if (!item) throw new NotFoundError(`Item '${itemInput.itemId}' not found in organization`);
      if (item.status !== 'ACTIVE') throw new BadRequestError(`Item '${item.name}' is inactive`);

      const uom = await UOM.findOne({ _id: new Types.ObjectId(itemInput.uomId), tenantId: tId });
      if (!uom) throw new NotFoundError(`UOM '${itemInput.uomId}' not found in organization`);

      const unitPrice = itemInput.estimatedUnitPrice ?? item.standardCost ?? 0;
      const lineTotal = Math.round(requestedQty * unitPrice * 100) / 100;
      computedEstimatedTotal += lineTotal;

      validatedItems.push({
        itemId: item._id,
        description: itemInput.description || item.name,
        requestedQuantity: requestedQty,
        approvedQuantity: 0,
        issuedQuantity: 0,
        remainingQuantity: requestedQty,
        availableQuantityAtCheck: 0,
        shortageQuantity: 0,
        uomId: uom._id,
        estimatedUnitPrice: unitPrice,
        estimatedTotal: lineTotal,
        requiredDate: itemInput.requiredDate ? new Date(itemInput.requiredDate) : undefined,
        remarks: itemInput.remarks,
      });
    }

    const prNumber = await documentNumberService.getNextNumber(tId, 'PURCHASE_REQUISITION');

    const pr = await PurchaseRequisition.create({
      tenantId: tId,
      prNumber,
      requesterId: uId,
      departmentId: data.departmentId ? new Types.ObjectId(data.departmentId) : undefined,
      warehouseId: wh._id,
      requiredDate: new Date(data.requiredDate),
      priority: data.priority || 'MEDIUM',
      purpose: data.purpose,
      notes: data.notes || data.purpose,
      items: validatedItems,
      estimatedTotal: computedEstimatedTotal,
      attachments: data.attachments || [],
      status: 'DRAFT',
      createdBy: uId,
    });

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.CREATE,
      entity: AuditEntity.PURCHASE,
      entityId: pr._id.toString(),
      details: `Created Purchase Requisition ${prNumber} for ${validatedItems.length} items totaling $${computedEstimatedTotal.toLocaleString()}`,
    });

    return this.getPRById(tId, pr._id);
  }

  async updatePR(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    data: any
  ): Promise<IPurchaseRequisition> {
    const pr = await this.getPRById(tenantId, id);
    if (pr.status !== 'DRAFT') {
      throw new BadRequestError(`Cannot modify Requisition in '${pr.status}' status`);
    }

    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    if (data.warehouseId) {
      const wh = await Warehouse.findOne({
        _id: new Types.ObjectId(data.warehouseId),
        tenantId: tId,
      });
      if (!wh) throw new NotFoundError('Warehouse not found');
      pr.warehouseId = wh._id;
    }

    if (data.departmentId) {
      const dept = await Department.findOne({
        _id: new Types.ObjectId(data.departmentId),
        tenantId: tId,
      });
      if (!dept) throw new NotFoundError('Department not found');
      pr.departmentId = dept._id;
    }

    if (data.requiredDate) pr.requiredDate = new Date(data.requiredDate);
    if (data.priority) pr.priority = data.priority;
    if (data.purpose !== undefined) pr.purpose = data.purpose;
    if (data.notes !== undefined) pr.notes = data.notes;
    if (data.attachments) pr.attachments = data.attachments;

    if (data.items && Array.isArray(data.items)) {
      const seenItemIds = new Set<string>();
      let computedEstimatedTotal = 0;
      const validatedItems = [];

      for (const itemInput of data.items) {
        const itId = itemInput.itemId?.toString();
        if (!itId) throw new BadRequestError('Invalid item in requisition');
        if (seenItemIds.has(itId)) {
          throw new BadRequestError('Duplicate item detected in requisition.');
        }
        seenItemIds.add(itId);

        const requestedQty = Number(itemInput.requestedQuantity);
        if (!requestedQty || requestedQty <= 0) {
          throw new BadRequestError('Quantity must be greater than 0');
        }

        const item = await Item.findOne({
          _id: new Types.ObjectId(itemInput.itemId),
          tenantId: tId,
        });
        if (!item) throw new NotFoundError(`Item '${itemInput.itemId}' not found`);

        const uom = await UOM.findOne({ _id: new Types.ObjectId(itemInput.uomId), tenantId: tId });
        if (!uom) throw new NotFoundError(`UOM not found`);

        const unitPrice = itemInput.estimatedUnitPrice ?? item.standardCost ?? 0;
        const lineTotal = Math.round(requestedQty * unitPrice * 100) / 100;
        computedEstimatedTotal += lineTotal;

        validatedItems.push({
          itemId: item._id,
          description: itemInput.description || item.name,
          requestedQuantity: requestedQty,
          approvedQuantity: 0,
          issuedQuantity: 0,
          remainingQuantity: requestedQty,
          availableQuantityAtCheck: 0,
          shortageQuantity: 0,
          uomId: uom._id,
          estimatedUnitPrice: unitPrice,
          estimatedTotal: lineTotal,
          requiredDate: itemInput.requiredDate ? new Date(itemInput.requiredDate) : undefined,
          remarks: itemInput.remarks,
        });
      }

      pr.items = validatedItems as any;
      pr.estimatedTotal = computedEstimatedTotal;
    }

    pr.updatedBy = uId;
    await pr.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.PURCHASE,
      entityId: pr._id.toString(),
      details: `Updated Purchase Requisition ${pr.prNumber}`,
    });

    return this.getPRById(tId, pr._id);
  }

  async submitPR(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IPurchaseRequisition> {
    const pr = await this.getPRById(tenantId, id);
    if (pr.status !== 'DRAFT') {
      throw new BadRequestError(`Only DRAFT requisitions can be submitted (Current: ${pr.status})`);
    }

    if (!pr.items || pr.items.length === 0) {
      throw new BadRequestError('Cannot submit requisition with no product items');
    }

    pr.status = 'PENDING_APPROVAL';
    pr.submittedAt = new Date();
    pr.updatedBy = new Types.ObjectId(userId);
    await pr.save();

    await auditRepository.create({
      tenantId: new Types.ObjectId(tenantId),
      userId: new Types.ObjectId(userId),
      action: AuditAction.STATUS_CHANGE,
      entity: AuditEntity.PURCHASE,
      entityId: pr._id.toString(),
      details: `Submitted Requisition ${pr.prNumber} for approval`,
      previousState: { status: 'DRAFT' },
      newState: { status: 'PENDING_APPROVAL' },
    });

    return this.getPRById(tenantId, pr._id);
  }

  async approvePR(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    payload?: ApprovePRPayload
  ): Promise<IPurchaseRequisition> {
    const pr = await this.getPRById(tenantId, id);
    if (pr.status !== 'SUBMITTED' && pr.status !== 'PENDING_APPROVAL') {
      throw new BadRequestError(
        `Only SUBMITTED or PENDING_APPROVAL requisitions can be approved (Current: ${pr.status})`
      );
    }

    let isPartial = false;

    if (payload?.items && Array.isArray(payload.items) && payload.items.length > 0) {
      for (const line of pr.items) {
        const lineItemIdStr = (line.itemId as any)?._id?.toString() || line.itemId?.toString();
        const itemApproval = payload.items.find(
          (pi) => pi.itemId === lineItemIdStr
        );
        if (itemApproval) {
          const approvedQty = Math.max(0, Math.min(line.requestedQuantity, Number(itemApproval.approvedQuantity) || 0));
          line.approvedQuantity = approvedQty;
          line.remainingQuantity = approvedQty;
          if (approvedQty < line.requestedQuantity) {
            isPartial = true;
          }
        } else {
          line.approvedQuantity = line.requestedQuantity;
          line.remainingQuantity = line.requestedQuantity;
        }
      }
    } else {
      // Full approval
      for (const line of pr.items) {
        line.approvedQuantity = line.requestedQuantity;
        line.remainingQuantity = line.requestedQuantity;
      }
    }

    pr.status = isPartial ? 'PARTIALLY_APPROVED' : 'APPROVED';
    pr.approvalComment = payload?.approvalComment || '';
    pr.approvedAt = new Date();
    pr.approvedBy = new Types.ObjectId(userId);
    pr.updatedBy = new Types.ObjectId(userId);
    await pr.save();

    await auditRepository.create({
      tenantId: new Types.ObjectId(tenantId),
      userId: new Types.ObjectId(userId),
      action: AuditAction.APPROVE,
      entity: AuditEntity.PURCHASE,
      entityId: pr._id.toString(),
      details: `Approved Requisition ${pr.prNumber} (Status: ${pr.status}). Comment: ${pr.approvalComment || 'N/A'}`,
      previousState: { status: pr.status === 'PARTIALLY_APPROVED' ? 'PENDING_APPROVAL' : 'SUBMITTED' },
      newState: { status: pr.status },
    });

    return this.getPRById(tenantId, pr._id);
  }

  async rejectPR(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    reason: string
  ): Promise<IPurchaseRequisition> {
    if (!reason || reason.trim().length < 3) {
      throw new BadRequestError('Rejection reason is required (minimum 3 characters)');
    }

    const pr = await this.getPRById(tenantId, id);
    if (pr.status !== 'SUBMITTED' && pr.status !== 'PENDING_APPROVAL') {
      throw new BadRequestError(
        `Only SUBMITTED or PENDING_APPROVAL requisitions can be rejected (Current: ${pr.status})`
      );
    }

    pr.status = 'REJECTED';
    pr.rejectedAt = new Date();
    pr.rejectedBy = new Types.ObjectId(userId);
    pr.rejectionReason = reason.trim();
    pr.updatedBy = new Types.ObjectId(userId);
    await pr.save();

    await auditRepository.create({
      tenantId: new Types.ObjectId(tenantId),
      userId: new Types.ObjectId(userId),
      action: AuditAction.REJECT,
      entity: AuditEntity.PURCHASE,
      entityId: pr._id.toString(),
      details: `Rejected Requisition ${pr.prNumber}. Reason: ${reason}`,
      newState: { status: 'REJECTED', reason },
    });

    return this.getPRById(tenantId, pr._id);
  }

  async cancelPR(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    reason: string
  ): Promise<IPurchaseRequisition> {
    if (!reason || reason.trim().length < 3) {
      throw new BadRequestError('Cancellation reason is required (minimum 3 characters)');
    }

    const pr = await this.getPRById(tenantId, id);
    const nonCancellableStatuses: PRStatus[] = ['ISSUED', 'FULFILLED', 'CANCELLED'];
    if (nonCancellableStatuses.includes(pr.status)) {
      throw new BadRequestError(`Cannot cancel a requisition in '${pr.status}' status`);
    }

    const hasAnyIssued = pr.items.some((it) => (it.issuedQuantity || 0) > 0);
    if (hasAnyIssued) {
      throw new BadRequestError('Cannot cancel a requisition that already has issued stock');
    }

    const prevStatus = pr.status;
    pr.status = 'CANCELLED';
    pr.cancelledAt = new Date();
    pr.cancelledBy = new Types.ObjectId(userId);
    pr.cancellationReason = reason.trim();
    pr.updatedBy = new Types.ObjectId(userId);
    await pr.save();

    await auditRepository.create({
      tenantId: new Types.ObjectId(tenantId),
      userId: new Types.ObjectId(userId),
      action: AuditAction.STATUS_CHANGE,
      entity: AuditEntity.PURCHASE,
      entityId: pr._id.toString(),
      details: `Cancelled Requisition ${pr.prNumber}. Reason: ${reason}`,
      previousState: { status: prevStatus },
      newState: { status: 'CANCELLED', reason },
    });

    return this.getPRById(tenantId, pr._id);
  }

  /**
   * Check live stock availability for all items in the requisition warehouse.
   * STRICTLY READ-ONLY CALCULATION. NEVER DEDUCTS STOCK.
   */
  async checkStockAvailability(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<{ pr: IPurchaseRequisition; isFullyAvailable: boolean }> {
    const tId = new Types.ObjectId(tenantId);
    const pr = await this.getPRById(tId, id);

    let hasAnyShortage = false;
    let allOutOfStock = true;

    for (const line of pr.items) {
      const itmId = (line.itemId as any)?._id || line.itemId;
      const whId = (pr.warehouseId as any)?._id || pr.warehouseId;

      // Find total available stock in warehouse for this item
      const balances = await InventoryBalance.find({
        tenantId: tId,
        itemId: new Types.ObjectId(itmId),
        warehouseId: new Types.ObjectId(whId),
      }).exec();

      const totalAvailable = balances.reduce(
        (sum, b) => sum + Math.max(0, b.availableQuantity || 0),
        0
      );

      line.availableQuantityAtCheck = totalAvailable;

      const targetQty = (line.approvedQuantity && line.approvedQuantity > 0)
        ? line.approvedQuantity
        : line.requestedQuantity;

      const remainingNeeded = Math.max(0, targetQty - (line.issuedQuantity || 0));
      const shortage = Math.max(0, remainingNeeded - totalAvailable);
      line.shortageQuantity = shortage;

      if (shortage > 0) {
        hasAnyShortage = true;
      }
      if (totalAvailable > 0) {
        allOutOfStock = false;
      }
    }

    // If requisition is in an approved status, reflect availability status
    if (['APPROVED', 'PARTIALLY_APPROVED', 'PARTIALLY_AVAILABLE', 'PURCHASE_REQUIRED'].includes(pr.status)) {
      if (hasAnyShortage) {
        pr.status = allOutOfStock ? 'PURCHASE_REQUIRED' : 'PARTIALLY_AVAILABLE';
      } else {
        pr.status = 'APPROVED';
      }
    }

    await pr.save();
    const updatedPr = await this.getPRById(tId, pr._id);
    return { pr: updatedPr, isFullyAvailable: !hasAnyShortage };
  }

  /**
   * ACTUAL STOCK ISSUE: The ONLY point where stock is decremented and Transaction Ledger is updated.
   * Concurrency-safe, atomic, negative stock protected.
   */
  async issueStockForRequisition(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    payload: IssuePRStockPayload
  ): Promise<IPurchaseRequisition> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const pr = await this.getPRById(tId, id);
    const allowedStatuses: PRStatus[] = [
      'APPROVED',
      'PARTIALLY_APPROVED',
      'PARTIALLY_AVAILABLE',
      'PURCHASE_REQUIRED',
      'PARTIALLY_ISSUED',
    ];

    if (!allowedStatuses.includes(pr.status)) {
      throw new BadRequestError(
        `Cannot issue stock for requisition in '${pr.status}' status. Requisition must be approved first.`
      );
    }

    if (!payload.itemsToIssue || !Array.isArray(payload.itemsToIssue) || payload.itemsToIssue.length === 0) {
      throw new BadRequestError('At least one item must be selected for stock issuance');
    }

    const whId = (pr.warehouseId as any)?._id || pr.warehouseId;

    // Phase 1: Pre-validation of all requested issues against approved limits & available stock
    for (const itemInput of payload.itemsToIssue) {
      const issueQty = Number(itemInput.quantity);
      if (!issueQty || issueQty <= 0) {
        throw new BadRequestError('Issue quantity must be greater than zero');
      }

      const line = pr.items.find(
        (it) =>
          it.itemId?.toString() === itemInput.itemId ||
          (it.itemId as any)?._id?.toString() === itemInput.itemId
      );

      if (!line) {
        throw new BadRequestError(`Item '${itemInput.itemId}' does not exist on this requisition`);
      }

      const itemDoc = line.itemId as any;
      const itemSku = itemDoc?.sku || itemDoc?.name || itemInput.itemId;

      const targetQty = (line.approvedQuantity && line.approvedQuantity > 0)
        ? line.approvedQuantity
        : line.requestedQuantity;

      const remainingAllowed = Math.max(0, targetQty - (line.issuedQuantity || 0));

      if (issueQty > remainingAllowed) {
        throw new BadRequestError(
          `Cannot issue ${issueQty} units of '${itemSku}'. Remaining approved quantity is only ${remainingAllowed}.`
        );
      }

      // Check current live stock in warehouse
      const balances = await InventoryBalance.find({
        tenantId: tId,
        itemId: new Types.ObjectId(itemInput.itemId),
        warehouseId: new Types.ObjectId(whId),
      }).exec();

      const totalAvailable = balances.reduce(
        (sum, b) => sum + Math.max(0, b.availableQuantity || 0),
        0
      );

      if (issueQty > totalAvailable) {
        throw new BadRequestError(
          `Insufficient stock for item '${itemSku}'. Available in warehouse: ${totalAvailable}, Requested to issue: ${issueQty}`
        );
      }
    }

    // Phase 2: Atomic Execution through centralized inventory engine
    const createdTxnIds: Types.ObjectId[] = [];

    for (const itemInput of payload.itemsToIssue) {
      const issueQty = Number(itemInput.quantity);

      const issueResult = await inventoryService.issueStock(tId, uId, {
        itemId: itemInput.itemId,
        warehouseId: whId,
        locationId: itemInput.locationId,
        batchNumber: itemInput.batchNumber,
        quantity: issueQty,
        transactionType: 'STOCK_ISSUE',
        referenceType: 'REQUISITION',
        referenceId: pr.prNumber,
        reason: payload.remarks || `Requisition issue: ${pr.prNumber}`,
        metadata: {
          requisitionId: pr._id.toString(),
          requisitionNumber: pr.prNumber,
          departmentId: pr.departmentId ? ((pr.departmentId as any)._id || pr.departmentId).toString() : undefined,
        },
      });

      createdTxnIds.push(issueResult.transaction._id);

      // Update line item in Requisition
      const line = pr.items.find(
        (it) =>
          it.itemId?.toString() === itemInput.itemId ||
          (it.itemId as any)?._id?.toString() === itemInput.itemId
      )!;

      line.issuedQuantity = (line.issuedQuantity || 0) + issueQty;
      const targetQty = (line.approvedQuantity && line.approvedQuantity > 0)
        ? line.approvedQuantity
        : line.requestedQuantity;
      line.remainingQuantity = Math.max(0, targetQty - line.issuedQuantity);
      line.availableQuantityAtCheck = Math.max(0, issueResult.balance.availableQuantity || 0);
      line.shortageQuantity = Math.max(0, line.remainingQuantity - line.availableQuantityAtCheck);
    }

    if (!pr.stockIssueTransactionIds) {
      pr.stockIssueTransactionIds = [];
    }
    pr.stockIssueTransactionIds.push(...createdTxnIds);

    // Phase 3: Evaluate overall fulfillment
    const allFulfilled = pr.items.every((line) => {
      const targetQty = (line.approvedQuantity && line.approvedQuantity > 0)
        ? line.approvedQuantity
        : line.requestedQuantity;
      return (line.issuedQuantity || 0) >= targetQty;
    });

    const prevStatus = pr.status;
    pr.status = allFulfilled ? 'FULFILLED' : 'PARTIALLY_ISSUED';
    pr.issuedAt = pr.issuedAt || new Date();
    if (allFulfilled) {
      pr.fulfilledAt = new Date();
    }
    pr.updatedBy = uId;
    await pr.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.STATUS_CHANGE,
      entity: AuditEntity.INVENTORY,
      entityId: pr._id.toString(),
      details: `Issued ${payload.itemsToIssue.length} items for Requisition ${pr.prNumber}. New status: ${pr.status}`,
      previousState: { status: prevStatus },
      newState: { status: pr.status },
    });

    return this.getPRById(tId, pr._id);
  }

  async deletePR(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<{ success: boolean }> {
    const pr = await this.getPRById(tenantId, id);
    if (pr.status !== 'DRAFT') {
      throw new BadRequestError(`Cannot delete requisition in status '${pr.status}'. Only DRAFT can be deleted.`);
    }

    await PurchaseRequisition.deleteOne({ _id: pr._id });

    await auditRepository.create({
      tenantId: new Types.ObjectId(tenantId),
      userId: new Types.ObjectId(userId),
      action: AuditAction.DELETE,
      entity: AuditEntity.PURCHASE,
      entityId: pr._id.toString(),
      details: `Deleted draft Requisition ${pr.prNumber}`,
    });

    return { success: true };
  }
}

export const purchaseRequisitionService = new PurchaseRequisitionService();
