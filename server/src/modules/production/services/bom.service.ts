import { Types } from 'mongoose';
import { BOM, IBOM, BOMStatus } from '../models/bom.model';
import { Item } from '../../../models/item.model';
import { documentNumberService } from '../../../services/documentNumber.service';
import { auditRepository } from '../../../repositories/audit.repository';
import { AuditAction, AuditEntity } from '../../../config/constants';
import { BadRequestError, NotFoundError } from '../../../core/errors';

export interface CreateBOMInput {
  name: string;
  finishedItemId: string | Types.ObjectId;
  description?: string;
  quantity?: number;
  uomId: string | Types.ObjectId;
  components: Array<{
    itemId: string | Types.ObjectId;
    quantity: number;
    uomId: string | Types.ObjectId;
    scrapPercentage?: number;
    sequence?: number;
    operationCode?: string;
    remarks?: string;
  }>;
  effectiveFrom?: string | Date;
  effectiveTo?: string | Date;
  isDefault?: boolean;
  routingNotes?: string;
}

export interface UpdateBOMInput extends Partial<CreateBOMInput> {}

export class BOMService {
  async getBOMs(
    tenantId: string | Types.ObjectId,
    query: {
      page?: number;
      limit?: number;
      status?: BOMStatus;
      finishedItemId?: string;
      search?: string;
    } = {}
  ): Promise<{ data: IBOM[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: any = { tenantId: new Types.ObjectId(tenantId) };
    if (query.status && (query.status as string) !== 'ALL') filter.status = query.status;
    if (query.finishedItemId && Types.ObjectId.isValid(query.finishedItemId)) {
      filter.finishedItemId = new Types.ObjectId(query.finishedItemId);
    }
    if (query.search) {
      filter.$or = [
        { bomNumber: { $regex: query.search.trim(), $options: 'i' } },
        { name: { $regex: query.search.trim(), $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      BOM.find(filter)
        .populate('finishedItemId', 'sku name itemCode standardCost baseUomId')
        .populate('uomId', 'code name')
        .populate('components.itemId', 'sku name itemCode standardCost')
        .populate('components.uomId', 'code name')
        .populate('createdBy', 'name email')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      BOM.countDocuments(filter).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getBOMById(tenantId: string | Types.ObjectId, id: string | Types.ObjectId): Promise<IBOM> {
    const bom = await BOM.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    })
      .populate('finishedItemId', 'sku name itemCode standardCost baseUomId')
      .populate('uomId', 'code name')
      .populate('components.itemId', 'sku name itemCode standardCost')
      .populate('components.uomId', 'code name')
      .populate('createdBy', 'name email')
      .exec();

    if (!bom) throw new NotFoundError('Bill of Materials not found');
    return bom;
  }

  /**
   * Recursive DFS cycle detector to prevent circular BOM dependencies:
   * Product A -> Component B -> Component C -> Product A
   */
  async checkCircularBOM(
    tenantId: Types.ObjectId,
    rootFinishedItemId: Types.ObjectId,
    componentItemIds: Types.ObjectId[],
    visited = new Set<string>()
  ): Promise<void> {
    const rootIdStr = rootFinishedItemId.toString();

    for (const compId of componentItemIds) {
      const compIdStr = compId.toString();

      if (compIdStr === rootIdStr) {
        throw new BadRequestError(
          'Circular BOM dependency detected: Product cannot contain itself as a component'
        );
      }

      if (visited.has(compIdStr)) continue;
      visited.add(compIdStr);

      // Check if this component has its own BOM
      const subBOMs = await BOM.find({
        tenantId,
        finishedItemId: compId,
        status: { $in: ['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE'] },
      }).exec();

      for (const subBOM of subBOMs) {
        const subCompIds = subBOM.components.map((c) => c.itemId);
        await this.checkCircularBOM(tenantId, rootFinishedItemId, subCompIds, visited);
      }
    }
  }

  async createBOM(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    input: CreateBOMInput
  ): Promise<IBOM> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);
    const finishedItemId = new Types.ObjectId(input.finishedItemId);

    // Verify finished item exists
    const item = await Item.findOne({ _id: finishedItemId, tenantId: tId }).exec();
    if (!item) throw new NotFoundError('Finished item not found');

    const componentIds = input.components.map((c) => new Types.ObjectId(c.itemId));

    // Circular dependency check
    await this.checkCircularBOM(tId, finishedItemId, componentIds);

    // Determine version number
    const highestVersionBOM = await BOM.findOne({ tenantId: tId, finishedItemId })
      .sort({ version: -1 })
      .exec();
    const version = highestVersionBOM ? highestVersionBOM.version + 1 : 1;

    const bomNumber = await documentNumberService.getNextNumber(tId, 'BOM');

    const bomUomId = input.uomId && Types.ObjectId.isValid(input.uomId)
      ? new Types.ObjectId(input.uomId)
      : (item.baseUomId || item._id);

    const resolvedComponents = await Promise.all(
      input.components.map(async (c, idx) => {
        const compItemId = new Types.ObjectId(c.itemId);
        let compUomId = c.uomId && Types.ObjectId.isValid(c.uomId) ? new Types.ObjectId(c.uomId) : undefined;
        if (!compUomId) {
          const compItem = await Item.findOne({ _id: compItemId, tenantId: tId }).select('baseUomId').lean().exec();
          compUomId = compItem?.baseUomId ? new Types.ObjectId(compItem.baseUomId) : bomUomId;
        }

        return {
          itemId: compItemId,
          quantity: Number(c.quantity) || 1,
          uomId: compUomId,
          scrapPercentage: Number(c.scrapPercentage) || 0,
          sequence: Number(c.sequence) || (idx + 1) * 10,
          operationCode: c.operationCode?.trim() || 'ASSEMBLY',
          remarks: c.remarks?.trim(),
        };
      })
    );

    const bom = await BOM.create({
      tenantId: tId,
      bomNumber,
      name: input.name.trim(),
      finishedItemId,
      version,
      description: input.description?.trim(),
      quantity: input.quantity || 1,
      uomId: bomUomId,
      components: resolvedComponents,
      status: 'DRAFT',
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : undefined,
      effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : undefined,
      isDefault: Boolean(input.isDefault),
      routingNotes: input.routingNotes?.trim(),
      createdBy: uId,
    });

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.CREATE,
      entity: AuditEntity.PRODUCTION,
      entityId: bom._id.toString(),
      details: `Created BOM ${bom.bomNumber} v${bom.version} for item ${item.name}`,
    });

    return this.getBOMById(tId, bom._id);
  }

  async updateBOM(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    input: UpdateBOMInput
  ): Promise<IBOM> {
    const tId = new Types.ObjectId(tenantId);
    const bom = await this.getBOMById(tId, id);

    if (bom.status === 'ARCHIVED') {
      throw new BadRequestError('Archived BOMs cannot be edited');
    }

    if (bom.status === 'ACTIVE') {
      throw new BadRequestError(
        'Active BOM cannot be edited directly. Clone a new version instead.'
      );
    }

    if (input.components && input.components.length > 0) {
      const compIds = input.components.map((c) => new Types.ObjectId(c.itemId));
      await this.checkCircularBOM(tId, bom.finishedItemId, compIds);
      bom.components = input.components.map((c, idx) => ({
        itemId: new Types.ObjectId(c.itemId),
        quantity: c.quantity,
        uomId: new Types.ObjectId(c.uomId),
        scrapPercentage: c.scrapPercentage || 0,
        sequence: c.sequence || (idx + 1) * 10,
        operationCode: c.operationCode?.trim() || 'ASSEMBLY',
        remarks: c.remarks?.trim(),
      })) as any;
    }

    if (input.name) bom.name = input.name.trim();
    if (input.description !== undefined) bom.description = input.description?.trim();
    if (input.quantity) bom.quantity = input.quantity;
    if (input.uomId) bom.uomId = new Types.ObjectId(input.uomId);
    if (input.effectiveFrom !== undefined)
      bom.effectiveFrom = input.effectiveFrom ? new Date(input.effectiveFrom) : undefined;
    if (input.effectiveTo !== undefined)
      bom.effectiveTo = input.effectiveTo ? new Date(input.effectiveTo) : undefined;
    if (input.isDefault !== undefined) bom.isDefault = Boolean(input.isDefault);
    if (input.routingNotes !== undefined) bom.routingNotes = input.routingNotes?.trim();

    bom.updatedBy = new Types.ObjectId(userId);
    await bom.save();

    return this.getBOMById(tId, bom._id);
  }

  async submitBOM(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IBOM> {
    const bom = await this.getBOMById(tenantId, id);
    if (bom.status !== 'DRAFT') {
      throw new BadRequestError(`Cannot submit BOM in '${bom.status}' status`);
    }
    bom.status = 'UNDER_REVIEW';
    bom.updatedBy = new Types.ObjectId(userId);
    await bom.save();
    return this.getBOMById(tenantId, bom._id);
  }

  async approveBOM(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IBOM> {
    const bom = await this.getBOMById(tenantId, id);
    if (bom.status !== 'UNDER_REVIEW' && bom.status !== 'DRAFT') {
      throw new BadRequestError(`Cannot approve BOM in '${bom.status}' status`);
    }
    bom.status = 'APPROVED';
    bom.approvedBy = new Types.ObjectId(userId);
    bom.approvedAt = new Date();
    bom.updatedBy = new Types.ObjectId(userId);
    await bom.save();
    return this.getBOMById(tenantId, bom._id);
  }

  async activateBOM(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IBOM> {
    const tId = new Types.ObjectId(tenantId);
    const bom = await this.getBOMById(tId, id);

    if (bom.status !== 'APPROVED' && bom.status !== 'UNDER_REVIEW' && bom.status !== 'DRAFT') {
      throw new BadRequestError(`Cannot activate BOM in '${bom.status}' status`);
    }

    // Deactivate previous active BOMs for this finished item if this is default or if requested
    if (bom.isDefault) {
      await BOM.updateMany(
        { tenantId: tId, finishedItemId: bom.finishedItemId, _id: { $ne: bom._id } },
        { $set: { isDefault: false } }
      ).exec();
    }

    bom.status = 'ACTIVE';
    bom.effectiveFrom = bom.effectiveFrom || new Date();
    bom.updatedBy = new Types.ObjectId(userId);
    await bom.save();

    await auditRepository.create({
      tenantId: tId,
      userId: new Types.ObjectId(userId),
      action: AuditAction.APPROVE,
      entity: AuditEntity.PRODUCTION,
      entityId: bom._id.toString(),
      details: `Activated BOM ${bom.bomNumber} v${bom.version}`,
    });

    return this.getBOMById(tId, bom._id);
  }

  async archiveBOM(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IBOM> {
    const bom = await this.getBOMById(tenantId, id);
    bom.status = 'ARCHIVED';
    bom.isDefault = false;
    bom.effectiveTo = new Date();
    bom.updatedBy = new Types.ObjectId(userId);
    await bom.save();
    return this.getBOMById(tenantId, bom._id);
  }

  async cloneNewVersion(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IBOM> {
    const sourceBOM = await this.getBOMById(tenantId, id);

    return this.createBOM(tenantId, userId, {
      name: `${sourceBOM.name} (v${sourceBOM.version + 1})`,
      finishedItemId: sourceBOM.finishedItemId._id || sourceBOM.finishedItemId,
      description: sourceBOM.description,
      quantity: sourceBOM.quantity,
      uomId: sourceBOM.uomId._id || sourceBOM.uomId,
      components: sourceBOM.components.map((c) => ({
        itemId: c.itemId._id || c.itemId,
        quantity: c.quantity,
        uomId: c.uomId._id || c.uomId,
        scrapPercentage: c.scrapPercentage,
        sequence: c.sequence,
        operationCode: c.operationCode,
        remarks: c.remarks,
      })),
      routingNotes: sourceBOM.routingNotes,
      isDefault: false,
    });
  }
}

export const bomService = new BOMService();
