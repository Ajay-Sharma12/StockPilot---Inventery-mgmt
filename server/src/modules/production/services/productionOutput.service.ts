import { Types } from 'mongoose';
import { ProductionOutput, IProductionOutput } from '../models/productionOutput.model';
import { ProductionOrder } from '../models/productionOrder.model';
import { BOM } from '../models/bom.model';
import { ProductionBatch } from '../models/productionBatch.model';
import { ProductionQC } from '../models/productionQc.model';
import { Item } from '../../../models/item.model';
import { InventoryBalance } from '../../../models/inventoryBalance.model';
import { InventoryTransaction } from '../../../models/inventoryTransaction.model';
import { inventoryService } from '../../../services/inventory.service';
import { documentNumberService } from '../../../services/documentNumber.service';
import { auditRepository } from '../../../repositories/audit.repository';
import { AuditAction, AuditEntity } from '../../../config/constants';
import { BadRequestError, NotFoundError } from '../../../core/errors';

export interface CreateProductionOutputInput {
  productionOrderId: string | Types.ObjectId;
  producedQuantity: number;
  acceptedQuantity?: number;
  rejectedQuantity?: number;
  scrapQuantity?: number;
  scrapReason?: string;
  wastageQuantity?: number;
  wastageReason?: string;
  batchNumber?: string;
  expiryDate?: string | Date;
  warehouseId?: string | Types.ObjectId;
  qcStatus?: 'PENDING' | 'PASSED' | 'FAILED' | 'DISPOSITIONED';
  remarks?: string;
}

export class ProductionOutputService {
  async recordOutput(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    input: CreateProductionOutputInput
  ): Promise<{
    output: IProductionOutput;
    order: any;
    batch?: any;
    qcInspection?: any;
    transaction?: any;
  }> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);
    const pOrderId = new Types.ObjectId(input.productionOrderId);

    if (input.producedQuantity <= 0) {
      throw new BadRequestError('Produced quantity must be greater than zero');
    }

    const order = await ProductionOrder.findOne({ _id: pOrderId, tenantId: tId }).exec();
    if (!order) throw new NotFoundError('Production Order not found');

    if (order.status !== 'RELEASED' && order.status !== 'IN_PROGRESS' && order.status !== 'PAUSED') {
      throw new BadRequestError(
        `Cannot record output in '${order.status}' status. Order must be released or in-progress.`
      );
    }

    // Auto-advance RELEASED orders to IN_PROGRESS
    if (order.status === 'RELEASED') {
      order.status = 'IN_PROGRESS';
      if (!order.actualStartDate) {
        order.actualStartDate = new Date();
        order.startedBy = uId;
        order.startedAt = new Date();
      }
    }

    const item = await Item.findOne({ _id: order.productionItemId, tenantId: tId }).exec();
    if (!item) throw new NotFoundError('Manufactured item not found');

    const warehouseId = input.warehouseId
      ? new Types.ObjectId(input.warehouseId)
      : (order.warehouseId as Types.ObjectId);

    // 1. Batch Resolution
    let batchNumber = input.batchNumber?.trim();
    if (!batchNumber) {
      batchNumber = await documentNumberService.getNextNumber(tId, 'PRODUCTION_BATCH');
    }

    let batch = await ProductionBatch.findOne({ tenantId: tId, batchNumber }).exec();
    if (!batch) {
      batch = await ProductionBatch.create({
        tenantId: tId,
        batchNumber,
        productionOrderId: order._id,
        itemId: item._id,
        manufacturingDate: new Date(),
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
        quantity: input.producedQuantity,
        uomId: order.uomId,
        status: input.qcStatus === 'PASSED' ? 'RELEASED' : 'QUARANTINED',
        notes: input.remarks?.trim(),
        createdBy: uId,
      });
    } else {
      batch.quantity += input.producedQuantity;
      if (input.qcStatus === 'PASSED') {
        batch.status = 'RELEASED';
      }
      await batch.save();
    }

    // 2. Quantities calculation
    const produced = Number(input.producedQuantity);
    let rejected = input.rejectedQuantity !== undefined ? Number(input.rejectedQuantity) : 0;
    let accepted = input.acceptedQuantity !== undefined
      ? Number(input.acceptedQuantity)
      : Math.max(0, produced - rejected);
    const scrap = Number(input.scrapQuantity) || 0;
    const wastage = Number(input.wastageQuantity) || 0;

    // If marked PASSED directly and accepted not specified, accept all produced minus rejected
    if (input.qcStatus === 'PASSED' && input.acceptedQuantity === undefined) {
      accepted = Math.max(0, produced - rejected);
    }

    if (accepted + rejected > produced) {
      throw new BadRequestError(
        `Accepted (${accepted}) + Rejected (${rejected}) cannot exceed Produced quantity (${produced})`
      );
    }

    // 3. QC Record
    const qcNumber = await documentNumberService.getNextNumber(tId, 'PRODUCTION_QC');
    const isDirectDisposition = input.qcStatus === 'PASSED' || input.qcStatus === 'FAILED';

    const qcInspection = await ProductionQC.create({
      tenantId: tId,
      qcNumber,
      productionOrderId: order._id,
      itemId: item._id,
      batchId: batch._id,
      batchNumber: batch.batchNumber,
      inspectedQuantity: produced,
      acceptedQuantity: accepted,
      rejectedQuantity: rejected,
      heldQuantity: isDirectDisposition ? 0 : produced,
      reworkQuantity: 0,
      inspectorId: uId,
      results: [
        { parameter: 'Visual Surface Finish', status: input.qcStatus === 'FAILED' ? 'FAIL' : 'PASS' },
        { parameter: 'Dimensional Tolerance', status: input.qcStatus === 'FAILED' ? 'FAIL' : 'PASS' },
        { parameter: 'Operational Test Run', status: input.qcStatus === 'FAILED' ? 'FAIL' : 'PASS' },
      ],
      overallResult: input.qcStatus === 'PASSED' ? 'PASS' : input.qcStatus === 'FAILED' ? 'FAIL' : 'HOLD',
      status: isDirectDisposition ? 'DISPOSITIONED' : 'PENDING',
      disposition: input.qcStatus === 'PASSED' ? 'ACCEPT' : input.qcStatus === 'FAILED' ? 'REJECT' : undefined,
      dispositionedAt: isDirectDisposition ? new Date() : undefined,
      dispositionedBy: isDirectDisposition ? uId : undefined,
      dispositionNotes: input.remarks || (isDirectDisposition ? 'Auto-dispositioned with output submission' : undefined),
      createdBy: uId,
    });

    // 4. ATOMIC STOCK MOVEMENT:
    // Only accepted quantity enters Finished Goods Inventory!
    let inventoryTxn: any = null;
    if (accepted > 0) {
      const receipt = await inventoryService.receiveStock(tId, uId, {
        itemId: item._id,
        warehouseId,
        quantity: accepted,
        batchNumber: batch.batchNumber,
        transactionType: 'PRODUCTION_OUTPUT',
        referenceType: 'PRODUCTION_ORDER',
        referenceId: order.productionOrderNumber,
        reason: `Production output accepted from order ${order.productionOrderNumber}`,
        metadata: {
          qcNumber: qcInspection.qcNumber,
          batchNumber: batch.batchNumber,
          plannedQuantity: order.plannedQuantity,
          producedQuantity: produced,
          acceptedQuantity: accepted,
          rejectedQuantity: rejected,
        },
      });
      inventoryTxn = receipt.transaction;
      qcInspection.inventoryReceiptTransactionId = receipt.transaction._id;
      await qcInspection.save();
    }

    // 5. Create ProductionOutput document
    const outputNumber = await documentNumberService.getNextNumber(tId, 'PRODUCTION_OUTPUT');
    const output = await ProductionOutput.create({
      tenantId: tId,
      outputNumber,
      productionOrderId: order._id,
      productionOrderNumber: order.productionOrderNumber,
      itemId: item._id,
      bomId: order.bomId,
      bomVersion: order.bomVersion,
      batchId: batch._id,
      batchNumber: batch.batchNumber,
      warehouseId,
      plannedQuantity: order.plannedQuantity,
      producedQuantity: produced,
      acceptedQuantity: accepted,
      rejectedQuantity: rejected,
      scrapQuantity: scrap,
      scrapReason: input.scrapReason?.trim(),
      wastageQuantity: wastage,
      wastageReason: input.wastageReason?.trim(),
      uomId: order.uomId,
      productionDate: new Date(),
      qcStatus: isDirectDisposition ? (accepted > 0 ? 'PASSED' : 'FAILED') : 'PENDING',
      qcInspectionId: qcInspection._id,
      inventoryTransactionId: inventoryTxn ? inventoryTxn._id : undefined,
      remarks: input.remarks?.trim(),
      createdBy: uId,
      updatedBy: uId,
    });

    // 6. Update order yield and status
    order.yieldQuantity += produced;
    if (rejected > 0) order.rejectedQuantity += rejected;
    if (scrap > 0) order.scrapQuantity += scrap;
    order.batchNumber = batch.batchNumber;

    if (order.yieldQuantity >= order.plannedQuantity) {
      order.status = 'COMPLETED';
      order.actualEndDate = new Date();
      order.completedBy = uId;
      order.completedAt = new Date();
    }
    order.updatedBy = uId;
    await order.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.CREATE,
      entity: AuditEntity.PRODUCTION,
      entityId: output._id.toString(),
      details: `Recorded Production Output ${output.outputNumber} (${produced} produced, ${accepted} accepted into stock) for order ${order.productionOrderNumber}`,
    });

    return {
      output,
      order,
      batch,
      qcInspection,
      transaction: inventoryTxn,
    };
  }

  async getProductionOutputs(
    tenantId: string | Types.ObjectId,
    query: {
      page?: number;
      limit?: number;
      productionOrderId?: string;
      itemId?: string;
      warehouseId?: string;
      batchNumber?: string;
      qcStatus?: string;
      search?: string;
    } = {}
  ): Promise<{ data: IProductionOutput[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: any = { tenantId: new Types.ObjectId(tenantId) };
    if (query.productionOrderId) filter.productionOrderId = new Types.ObjectId(query.productionOrderId);
    if (query.itemId) filter.itemId = new Types.ObjectId(query.itemId);
    if (query.warehouseId) filter.warehouseId = new Types.ObjectId(query.warehouseId);
    if (query.batchNumber) filter.batchNumber = query.batchNumber.trim();
    if (query.qcStatus && query.qcStatus !== 'ALL') filter.qcStatus = query.qcStatus;

    if (query.search) {
      filter.$or = [
        { outputNumber: { $regex: query.search.trim(), $options: 'i' } },
        { productionOrderNumber: { $regex: query.search.trim(), $options: 'i' } },
        { batchNumber: { $regex: query.search.trim(), $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      ProductionOutput.find(filter)
        .populate('productionOrderId', 'productionOrderNumber status plannedQuantity yieldQuantity')
        .populate('itemId', 'sku name itemCode standardCost')
        .populate('warehouseId', 'name code')
        .populate('uomId', 'code name symbol')
        .populate('batchId', 'batchNumber manufacturingDate expiryDate status')
        .populate('qcInspectionId', 'qcNumber overallResult status acceptedQuantity rejectedQuantity')
        .populate('inventoryTransactionId', 'transactionNumber balanceBefore balanceAfter')
        .populate('createdBy', 'name email')
        .sort({ productionDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      ProductionOutput.countDocuments(filter).exec(),
    ]);

    // Sync any outputs with their linked QC inspections if out of sync
    for (const out of data) {
      const qc: any = out.qcInspectionId;
      if (qc && (qc.status === 'DISPOSITIONED' || qc.status === 'INSPECTED')) {
        const targetStatus =
          qc.status === 'DISPOSITIONED'
            ? (qc.overallResult === 'FAIL' || qc.acceptedQuantity === 0 ? 'FAILED' : 'PASSED')
            : 'INSPECTED';

        const needsStatusUpdate = out.qcStatus !== targetStatus;
        const needsQtyUpdate =
          qc.status === 'DISPOSITIONED' &&
          typeof qc.acceptedQuantity === 'number' &&
          (out.acceptedQuantity !== qc.acceptedQuantity || out.rejectedQuantity !== qc.rejectedQuantity);

        if (needsStatusUpdate || needsQtyUpdate) {
          out.qcStatus = targetStatus as any;
          if (needsQtyUpdate) {
            out.acceptedQuantity = qc.acceptedQuantity;
            out.rejectedQuantity = qc.rejectedQuantity;
          }
          await ProductionOutput.updateOne(
            { _id: out._id },
            {
              $set: {
                qcStatus: targetStatus,
                acceptedQuantity: out.acceptedQuantity,
                rejectedQuantity: out.rejectedQuantity,
              },
            }
          ).exec();
        }
      }
    }

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getProductionOutputById(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IProductionOutput> {
    const output = await ProductionOutput.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    })
      .populate('itemId', 'sku name itemCode standardCost')
      .populate('productionOrderId')
      .populate('bomId')
      .populate('warehouseId', 'name code')
      .populate('uomId', 'code name symbol')
      .populate('batchId')
      .populate('qcInspectionId')
      .populate('inventoryTransactionId')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .exec();

    if (!output) throw new NotFoundError('Production Output record not found');
    return output;
  }

  // --- MATRICES ---

  async getMaterialConsumptionMatrix(
    tenantId: string | Types.ObjectId,
    filters: {
      warehouseId?: string;
      productionOrderId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{ rows: any[]; summary: Record<string, any> }> {
    const tId = new Types.ObjectId(tenantId);
    const query: any = { tenantId: tId };

    if (filters.warehouseId) query.warehouseId = new Types.ObjectId(filters.warehouseId);
    if (filters.productionOrderId) query._id = new Types.ObjectId(filters.productionOrderId);
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = filters.startDate;
      if (filters.endDate) query.createdAt.$lte = filters.endDate;
    }

    const orders = await ProductionOrder.find(query)
      .populate('productionItemId', 'sku name')
      .populate('warehouseId', 'name code')
      .populate('materials.itemId', 'sku name itemCode standardCost')
      .populate('materials.uomId', 'code name symbol')
      .sort({ createdAt: -1 })
      .exec();

    const rows: any[] = [];
    let totalPlannedQty = 0;
    let totalActualQty = 0;
    let totalScrapQty = 0;

    for (const order of orders) {
      for (const mat of order.materials) {
        const item: any = mat.itemId || {};
        const uom: any = mat.uomId || {};
        const planned = mat.plannedQuantity || 0;
        const actual = mat.actualConsumedQuantity || 0;
        const scrap = mat.scrapQuantity || 0;
        const variance = Math.round((actual - planned) * 100) / 100;
        const variancePercent =
          planned > 0 ? Math.round(((actual - planned) / planned) * 1000) / 10 : 0;

        totalPlannedQty += planned;
        totalActualQty += actual;
        totalScrapQty += scrap;

        rows.push({
          productionOrderId: order._id,
          productionOrderNumber: order.productionOrderNumber,
          productName: (order.productionItemId as any)?.name || 'Finished Good',
          productSku: (order.productionItemId as any)?.sku || 'N/A',
          bomVersion: order.bomVersion || 1,
          materialId: item._id,
          materialName: item.name || 'Component',
          materialSku: item.sku || 'N/A',
          uom: uom.code || uom.name || 'Units',
          bomRequiredQuantity: planned,
          actualConsumedQuantity: actual,
          variance,
          variancePercentage: `${variancePercent > 0 ? '+' : ''}${variancePercent}%`,
          varianceNumber: variancePercent,
          scrapWastage: scrap,
          warehouse: (order.warehouseId as any)?.name || 'Default Facility',
          batchNumber: mat.batchNumber || order.batchNumber || 'N/A',
          productionDate: order.actualStartDate || order.createdAt,
          status: variance > 0 ? 'OVER_CONSUMED' : variance < 0 ? 'SAVING' : 'ON_TARGET',
        });
      }
    }

    return {
      rows,
      summary: {
        totalLines: rows.length,
        totalPlannedQuantity: Math.round(totalPlannedQty * 100) / 100,
        totalActualQuantity: Math.round(totalActualQty * 100) / 100,
        totalScrapQuantity: Math.round(totalScrapQty * 100) / 100,
        netVariance: Math.round((totalActualQty - totalPlannedQty) * 100) / 100,
      },
    };
  }

  async getProductionOutputMatrix(
    tenantId: string | Types.ObjectId,
    filters: {
      warehouseId?: string;
      productionOrderId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{ rows: any[]; summary: Record<string, any> }> {
    const tId = new Types.ObjectId(tenantId);
    const query: any = { tenantId: tId };

    if (filters.warehouseId) query.warehouseId = new Types.ObjectId(filters.warehouseId);
    if (filters.productionOrderId) query.productionOrderId = new Types.ObjectId(filters.productionOrderId);
    if (filters.startDate || filters.endDate) {
      query.productionDate = {};
      if (filters.startDate) query.productionDate.$gte = filters.startDate;
      if (filters.endDate) query.productionDate.$lte = filters.endDate;
    }

    const outputs = await ProductionOutput.find(query)
      .populate('itemId', 'sku name itemCode')
      .populate('warehouseId', 'name code')
      .populate('uomId', 'code name')
      .populate('qcInspectionId', 'qcNumber overallResult status acceptedQuantity rejectedQuantity')
      .sort({ productionDate: -1, createdAt: -1 })
      .exec();

    let totalPlanned = 0;
    let totalProduced = 0;
    let totalAccepted = 0;
    let totalRejected = 0;
    let totalScrap = 0;

    const rows = outputs.map((out) => {
      const planned = out.plannedQuantity || 0;
      const produced = out.producedQuantity || 0;
      const qc: any = out.qcInspectionId;
      let effectiveStatus = out.qcStatus;
      let accepted = out.acceptedQuantity || 0;
      let rejected = out.rejectedQuantity || 0;
      const scrap = out.scrapQuantity || 0;

      if (qc && (qc.status === 'DISPOSITIONED' || qc.status === 'INSPECTED')) {
        effectiveStatus =
          qc.status === 'DISPOSITIONED'
            ? (qc.overallResult === 'FAIL' || qc.acceptedQuantity === 0 ? 'FAILED' : 'PASSED')
            : 'INSPECTED';
        if (qc.status === 'DISPOSITIONED' && typeof qc.acceptedQuantity === 'number') {
          accepted = qc.acceptedQuantity;
          rejected = qc.rejectedQuantity ?? rejected;
        }
      }

      totalPlanned += planned;
      totalProduced += produced;
      totalAccepted += accepted;
      totalRejected += rejected;
      totalScrap += scrap;

      const variance = Math.round((produced - planned) * 100) / 100;
      const yieldPercent =
        planned > 0
          ? Math.round((accepted / planned) * 1000) / 10
          : produced > 0
          ? Math.round((accepted / produced) * 1000) / 10
          : 0;

      return {
        outputId: out._id,
        outputNumber: out.outputNumber,
        productionOrderId: out.productionOrderId,
        productionOrderNumber: out.productionOrderNumber,
        productName: (out.itemId as any)?.name || 'Finished Good',
        productSku: (out.itemId as any)?.sku || 'N/A',
        bomVersion: out.bomVersion,
        plannedQuantity: planned,
        producedQuantity: produced,
        acceptedQuantity: accepted,
        rejectedQuantity: rejected,
        scrapWastage: scrap,
        variance,
        yieldPercentage: `${yieldPercent}%`,
        yieldNumber: yieldPercent,
        qcStatus: effectiveStatus,
        batchNumber: out.batchNumber || 'N/A',
        warehouse: (out.warehouseId as any)?.name || 'Default Warehouse',
        productionDate: out.productionDate,
      };
    });

    return {
      rows,
      summary: {
        totalOutputs: rows.length,
        totalPlannedQuantity: Math.round(totalPlanned * 100) / 100,
        totalProducedQuantity: Math.round(totalProduced * 100) / 100,
        totalAcceptedQuantity: Math.round(totalAccepted * 100) / 100,
        totalRejectedQuantity: Math.round(totalRejected * 100) / 100,
        totalScrapQuantity: Math.round(totalScrap * 100) / 100,
        averageYield:
          totalPlanned > 0
            ? `${Math.round((totalAccepted / totalPlanned) * 1000) / 10}%`
            : totalProduced > 0
            ? `${Math.round((totalAccepted / totalProduced) * 1000) / 10}%`
            : '100%',
      },
    };
  }

  async getProductionDashboard(
    tenantId: string | Types.ObjectId,
    filters: { warehouseId?: string } = {}
  ): Promise<any> {
    const tId = new Types.ObjectId(tenantId);
    const orderFilter: any = { tenantId: tId };
    const outputFilter: any = { tenantId: tId };

    if (filters.warehouseId) {
      orderFilter.warehouseId = new Types.ObjectId(filters.warehouseId);
      outputFilter.warehouseId = new Types.ObjectId(filters.warehouseId);
    }

    const [
      orders,
      outputs,
      qcPendingCount,
      activeBomsCount,
      totalBatchesCount,
    ] = await Promise.all([
      ProductionOrder.find(orderFilter)
        .populate('productionItemId', 'sku name')
        .populate('warehouseId', 'name code')
        .sort({ createdAt: -1 })
        .exec(),
      ProductionOutput.find(outputFilter).exec(),
      ProductionQC.countDocuments({ tenantId: tId, status: 'PENDING' }).exec(),
      BOM.countDocuments({ tenantId: tId, status: 'ACTIVE' }).exec(),
      ProductionBatch.countDocuments({ tenantId: tId }).exec(),
    ]);

    let plannedProduction = 0;
    let actualProduction = 0;
    let acceptedOutput = 0;
    let rejectedOutput = 0;
    let totalMaterialConsumption = 0;
    let totalWastage = 0;

    let inProgressOrders = 0;
    let completedOrders = 0;

    for (const order of orders) {
      plannedProduction += order.plannedQuantity || 0;
      actualProduction += order.yieldQuantity || 0;
      rejectedOutput += order.rejectedQuantity || 0;
      totalWastage += order.scrapQuantity || 0;

      if (order.status === 'IN_PROGRESS') inProgressOrders++;
      if (order.status === 'COMPLETED' || order.status === 'CLOSED') completedOrders++;

      for (const mat of order.materials) {
        totalMaterialConsumption += mat.actualConsumedQuantity || 0;
      }
    }

    let totalProducedOutputs = 0;
    let totalAcceptedOutputs = 0;
    let totalRejectedOutputs = 0;
    let totalScrapOutputs = 0;
    let totalWastageOutputs = 0;

    for (const out of outputs) {
      totalProducedOutputs += out.producedQuantity || 0;
      totalAcceptedOutputs += out.acceptedQuantity || 0;
      totalRejectedOutputs += out.rejectedQuantity || 0;
      totalScrapOutputs += out.scrapQuantity || 0;
      totalWastageOutputs += out.wastageQuantity || 0;
      acceptedOutput += out.acceptedQuantity || 0;
    }

    const effectiveTotalOutputs = outputs.length;
    const effectiveTotalProduced = totalProducedOutputs > 0 ? totalProducedOutputs : actualProduction;
    const effectiveTotalAccepted = totalAcceptedOutputs > 0 ? totalAcceptedOutputs : Math.max(0, actualProduction - rejectedOutput - totalWastage);
    const effectiveTotalRejected = totalRejectedOutputs > 0 ? totalRejectedOutputs : rejectedOutput;
    const effectiveTotalScrap = totalScrapOutputs > 0 ? totalScrapOutputs : totalWastage;
    const effectiveTotalWastage = totalWastageOutputs > 0 ? totalWastageOutputs : totalWastage;

    const avgYieldRate = effectiveTotalProduced > 0
      ? effectiveTotalAccepted / effectiveTotalProduced
      : 1;
    const avgScrapRate = effectiveTotalProduced > 0
      ? (effectiveTotalScrap + effectiveTotalRejected) / effectiveTotalProduced
      : 0;

    const summary = {
      totalOutputs: effectiveTotalOutputs,
      totalProduced: Math.round(effectiveTotalProduced * 100) / 100,
      totalAccepted: Math.round(effectiveTotalAccepted * 100) / 100,
      totalRejected: Math.round(effectiveTotalRejected * 100) / 100,
      totalScrap: Math.round(effectiveTotalScrap * 100) / 100,
      totalWastage: Math.round(effectiveTotalWastage * 100) / 100,
      avgYieldRate: Math.round(avgYieldRate * 1000) / 1000,
      avgScrapRate: Math.round(avgScrapRate * 1000) / 1000,
    };

    const averageYield =
      plannedProduction > 0
        ? Math.round((acceptedOutput / plannedProduction) * 1000) / 10
        : actualProduction > 0
        ? Math.round((acceptedOutput / actualProduction) * 1000) / 10
        : 100;

    // Recent work orders
    const recentOrders = orders.slice(0, 5).map((o) => ({
      _id: o._id,
      productionOrderNumber: o.productionOrderNumber,
      productName: (o.productionItemId as any)?.name,
      plannedQuantity: o.plannedQuantity,
      yieldQuantity: o.yieldQuantity,
      status: o.status,
      priority: o.priority,
      createdAt: o.createdAt,
    }));

    return {
      summary,
      metrics: {
        plannedProduction: Math.round(plannedProduction * 100) / 100,
        actualProduction: Math.round(actualProduction * 100) / 100,
        acceptedOutput: Math.round(acceptedOutput * 100) / 100,
        rejectedOutput: Math.round(rejectedOutput * 100) / 100,
        pendingQC: qcPendingCount,
        inProgressOrders,
        completedOrders,
        materialShortage: 0,
        totalMaterialConsumption: Math.round(totalMaterialConsumption * 100) / 100,
        totalWastage: Math.round(totalWastage * 100) / 100,
        averageYield: `${averageYield}%`,
        finishedGoodsOutput: Math.round(acceptedOutput * 100) / 100,
        activeBOMs: activeBomsCount,
        totalBatches: totalBatchesCount,
      },
      recentOrders,
    };
  }
}

export const productionOutputService = new ProductionOutputService();
