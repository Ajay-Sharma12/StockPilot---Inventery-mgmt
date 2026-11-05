import { Types } from 'mongoose';
import { Wastage, IWastage } from '../models/wastage.model';
import { InventoryBalance } from '../models/inventoryBalance.model';
import { Item } from '../models/item.model';
import { Warehouse, Bin } from '../models/warehouse.model';
import { WastageReason } from '../models/reason.model';
import { inventoryService } from './inventory.service';
import { documentNumberService } from './documentNumber.service';
import { auditRepository } from '../repositories/audit.repository';
import { AuditAction, AuditEntity } from '../config/constants';
import { BadRequestError, NotFoundError, ForbiddenError } from '../core/errors';
import { resolveWarehouseScope } from '../core/warehouseScope';

export class WastageService {
  async getWastages(
    tenantId: string | Types.ObjectId,
    filter: any = {},
    warehouseScope: string[] = [],
    page = 1,
    limit = 20
  ): Promise<{ items: any[]; total: number; page: number; limit: number }> {
    const tId = new Types.ObjectId(tenantId);
    const queryFilter: any = { tenantId: tId };

    if (filter.status) queryFilter.status = filter.status;

    const resolvedScope = await resolveWarehouseScope(tId, warehouseScope);

    if (filter.warehouseId) {
      if (resolvedScope.isRestricted && !resolvedScope.isAuthorized(filter.warehouseId)) {
        throw new ForbiddenError('You do not have access to view wastage for this warehouse');
      }
      queryFilter.warehouseId = new Types.ObjectId(filter.warehouseId);
    } else if (resolvedScope.isRestricted && resolvedScope.objectIds.length > 0) {
      queryFilter.warehouseId = { $in: resolvedScope.objectIds };
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Wastage.find(queryFilter)
        .populate('warehouseId', 'name code')
        .populate('locationId', 'code name')
        .populate('reportedBy', 'name email')
        .populate('approvedBy', 'name email')
        .populate('items.itemId', 'sku name standardCost')
        .populate('items.reasonId', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Wastage.countDocuments(queryFilter).exec(),
    ]);

    return { items, total, page, limit };
  }

  async getWastageById(tenantId: string | Types.ObjectId, id: string | Types.ObjectId): Promise<IWastage> {
    const wastage = await Wastage.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    })
      .populate('warehouseId', 'name code')
      .populate('locationId', 'code name')
      .populate('reportedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('items.itemId', 'sku name standardCost')
      .populate('items.reasonId', 'name code')
      .exec();

    if (!wastage) throw new NotFoundError('Wastage record not found');
    return wastage;
  }

  async createWastage(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    data: {
      warehouseId: string;
      locationId?: string;
      items: Array<{
        itemId: string;
        batchNumber?: string;
        quantity: number;
        reasonId?: string;
        remarks?: string;
      }>;
      remarks?: string;
    },
    warehouseScope: string[] = []
  ): Promise<IWastage> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const resolvedScope = await resolveWarehouseScope(tId, warehouseScope);
    if (resolvedScope.isRestricted && !resolvedScope.isAuthorized(data.warehouseId)) {
      throw new ForbiddenError('You do not have permission to log wastage for this warehouse');
    }

    if (!data.items || data.items.length === 0) {
      throw new BadRequestError('At least one item is required in the wastage report');
    }

    const hasValidLocation = Boolean(data.locationId && Types.ObjectId.isValid(data.locationId));
    const validLocationId = hasValidLocation ? new Types.ObjectId(data.locationId) : undefined;

    // Capture unit cost and calculate total scrap cost
    const processedItems = await Promise.all(
      data.items.map(async (item) => {
        if (item.quantity <= 0) {
          throw new BadRequestError('Wastage quantity must be greater than zero');
        }

        const itmObjId = new Types.ObjectId(item.itemId);

        // 1. Try finding balance at specific location & batch
        const balance = await InventoryBalance.findOne({
          tenantId: tId,
          itemId: itmObjId,
          warehouseId: new Types.ObjectId(data.warehouseId),
          ...(validLocationId ? { locationId: validLocationId } : {}),
          ...(item.batchNumber ? { batchNumber: item.batchNumber } : {}),
        }).exec();

        let unitCost = balance && balance.averageCost > 0 ? balance.averageCost : 0;

        // 2. If zero, try any balance for this item in this warehouse or across tenant
        if (!unitCost) {
          const anyBal = await InventoryBalance.findOne({
            tenantId: tId,
            itemId: itmObjId,
            averageCost: { $gt: 0 },
          }).sort({ updatedAt: -1 }).exec();

          if (anyBal) {
            unitCost = anyBal.averageCost;
          } else {
            // 3. Fallback to Item standardCost
            const itemDoc = await Item.findOne({ _id: itmObjId, tenantId: tId }).select('standardCost sellingPrice').exec();
            unitCost = itemDoc?.standardCost || 0;
          }
        }

        const totalCost = Math.round(item.quantity * unitCost * 100) / 100;
        const validReason = item.reasonId && Types.ObjectId.isValid(item.reasonId) ? new Types.ObjectId(item.reasonId) : undefined;

        return {
          itemId: itmObjId,
          batchNumber: item.batchNumber?.trim() || undefined,
          quantity: item.quantity,
          unitCost,
          totalCost,
          reasonId: validReason,
          remarks: item.remarks?.trim() || undefined,
        };
      })
    );

    const wastageNumber = await documentNumberService.getNextNumber(tId, 'WASTAGE');

    const createdWastage = await Wastage.create({
      tenantId: tId,
      wastageNumber,
      warehouseId: new Types.ObjectId(data.warehouseId),
      locationId: validLocationId,
      items: processedItems,
      status: 'DRAFT',
      reportedBy: uId,
      remarks: data.remarks?.trim() || undefined,
    });

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.CREATE,
      entity: AuditEntity.INVENTORY,
      entityId: createdWastage._id.toString(),
      details: `Logged scrap request ${wastageNumber} with ${processedItems.length} item(s)`,
    });

    return createdWastage;
  }

  async approveWastage(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    warehouseScope: string[] = []
  ): Promise<IWastage> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);
    const wastage = await this.getWastageById(tId, id);

    if (wastage.status !== 'DRAFT' && wastage.status !== 'SUBMITTED') {
      throw new BadRequestError(`Cannot approve wastage in status '${wastage.status}'`);
    }

    const whIdStr = (wastage.warehouseId as any)?._id?.toString() || wastage.warehouseId.toString();
    const resolvedScope = await resolveWarehouseScope(tId, warehouseScope);
    if (resolvedScope.isRestricted && !resolvedScope.isAuthorized(whIdStr)) {
      throw new ForbiddenError('You do not have permission to approve wastage for this warehouse');
    }

    // Deduct damaged / expired goods through Central Inventory Engine
    for (const itm of wastage.items) {
      const itmId = (itm.itemId as any)?._id || itm.itemId;
      const whId = (wastage.warehouseId as any)?._id || wastage.warehouseId;
      const locIdRaw = (wastage.locationId as any)?._id || wastage.locationId;
      const locId = locIdRaw && Types.ObjectId.isValid(locIdRaw.toString()) ? locIdRaw.toString() : undefined;

      await inventoryService.issueStock(tId, uId, {
        itemId: itmId.toString ? itmId.toString() : itmId,
        warehouseId: whId.toString ? whId.toString() : whId,
        locationId: locId,
        batchNumber: itm.batchNumber,
        quantity: itm.quantity,
        transactionType: 'WASTAGE',
        referenceType: 'WASTAGE',
        referenceId: wastage._id.toString(),
        reason: `Wastage Scrap ${wastage.wastageNumber}${itm.remarks ? ` - ${itm.remarks}` : ''}`,
      });
    }

    wastage.status = 'COMPLETED';
    wastage.approvedBy = uId;
    await wastage.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.APPROVE,
      entity: AuditEntity.INVENTORY,
      entityId: wastage._id.toString(),
      details: `Approved scrap record ${wastage.wastageNumber} and wrote off stock value`,
    });

    return wastage;
  }

  async rejectWastage(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    remarks?: string,
    warehouseScope: string[] = []
  ): Promise<IWastage> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);
    const wastage = await this.getWastageById(tId, id);

    if (wastage.status !== 'DRAFT' && wastage.status !== 'SUBMITTED') {
      throw new BadRequestError(`Cannot reject wastage in status '${wastage.status}'`);
    }

    const whIdStr = (wastage.warehouseId as any)?._id?.toString() || wastage.warehouseId.toString();
    const resolvedScope = await resolveWarehouseScope(tId, warehouseScope);
    if (resolvedScope.isRestricted && !resolvedScope.isAuthorized(whIdStr)) {
      throw new ForbiddenError('You do not have permission to reject wastage for this warehouse');
    }

    wastage.status = 'REJECTED';
    wastage.approvedBy = uId;
    if (remarks) {
      wastage.remarks = wastage.remarks ? `${wastage.remarks} | Rejected: ${remarks}` : `Rejected: ${remarks}`;
    }
    await wastage.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.REJECT,
      entity: AuditEntity.INVENTORY,
      entityId: wastage._id.toString(),
      details: `Rejected scrap record ${wastage.wastageNumber}`,
    });

    return wastage;
  }
}

export const wastageService = new WastageService();
