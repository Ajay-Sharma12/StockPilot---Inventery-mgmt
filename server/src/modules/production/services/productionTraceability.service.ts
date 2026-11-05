import { Types } from 'mongoose';
import { ProductionOrder } from '../models/productionOrder.model';
import { BOM } from '../models/bom.model';
import { ProductionBatch } from '../models/productionBatch.model';
import { ProductionQC } from '../models/productionQc.model';
import { InventoryTransaction } from '../../../models/inventoryTransaction.model';
import { Item } from '../../../models/item.model';
import { GoodsReceiptNote } from '../../procurement/models/grn.model';
import { NotFoundError } from '../../../core/errors';

export interface ProductionTraceabilityDAG {
  bom: any;
  productionOrder: any;
  materials: any[];
  batch: any;
  qcInspection: any;
  finishedGoodsReceipt: any;
  inventoryTransactions: any[];
  inboundGRNs?: any[];
}

export class ProductionTraceabilityService {
  async getLineage(
    tenantId: string | Types.ObjectId,
    docType: 'BOM' | 'ORDER' | 'BATCH' | 'QC' | 'GRN',
    identifier: string
  ): Promise<ProductionTraceabilityDAG> {
    const tId = new Types.ObjectId(tenantId);
    let productionOrderId: Types.ObjectId | null = null;
    const isObjectId = Types.ObjectId.isValid(identifier);

    switch (docType) {
      case 'GRN': {
        const query: any = { tenantId: tId };
        if (isObjectId) query.$or = [{ _id: identifier }, { grnNumber: identifier }];
        else query.grnNumber = identifier;
        const grn = await GoodsReceiptNote.findOne(query).exec();
        if (!grn) throw new NotFoundError(`Goods Receipt Note '${identifier}' not found`);
        const grnItemIds = grn.items.map((i: any) => i.itemId);
        const order = await ProductionOrder.findOne({
          tenantId: tId,
          'materials.itemId': { $in: grnItemIds },
        }).sort({ createdAt: -1 }).exec();
        if (!order) {
          const anyOrder = await ProductionOrder.findOne({ tenantId: tId }).sort({ createdAt: -1 }).exec();
          if (!anyOrder) throw new NotFoundError(`No production orders found in tenant graph`);
          productionOrderId = anyOrder._id;
        } else {
          productionOrderId = order._id;
        }
        break;
      }
      case 'ORDER': {
        const query: any = { tenantId: tId };
        if (isObjectId) query.$or = [{ _id: identifier }, { productionOrderNumber: identifier }];
        else query.productionOrderNumber = identifier;
        const order = await ProductionOrder.findOne(query).exec();
        if (!order) throw new NotFoundError(`Production Order '${identifier}' not found`);
        productionOrderId = order._id;
        break;
      }
      case 'BOM': {
        const query: any = { tenantId: tId };
        if (isObjectId) query.$or = [{ _id: identifier }, { bomNumber: identifier }];
        else query.bomNumber = identifier;
        const bom = await BOM.findOne(query).exec();
        if (!bom) throw new NotFoundError(`BOM '${identifier}' not found`);
        // Find most recent order linked to this BOM
        const order = await ProductionOrder.findOne({ tenantId: tId, bomId: bom._id }).sort({ createdAt: -1 }).exec();
        if (!order) throw new NotFoundError(`No production orders found using BOM '${bom.bomNumber}'`);
        productionOrderId = order._id;
        break;
      }
      case 'BATCH': {
        const query: any = { tenantId: tId };
        if (isObjectId) query.$or = [{ _id: identifier }, { batchNumber: identifier }];
        else query.batchNumber = identifier;
        const batch = await ProductionBatch.findOne(query).exec();
        if (!batch) throw new NotFoundError(`Production Batch '${identifier}' not found`);
        productionOrderId = batch.productionOrderId;
        break;
      }
      case 'QC': {
        const query: any = { tenantId: tId };
        if (isObjectId) query.$or = [{ _id: identifier }, { qcNumber: identifier }];
        else query.qcNumber = identifier;
        const qc = await ProductionQC.findOne(query).exec();
        if (!qc) throw new NotFoundError(`Production QC Inspection '${identifier}' not found`);
        productionOrderId = qc.productionOrderId;
        break;
      }
    }

    if (!productionOrderId) {
      throw new NotFoundError('Could not resolve Production Order context');
    }

    // Load full document DAG
    const order = await ProductionOrder.findOne({ _id: productionOrderId, tenantId: tId })
      .populate('productionItemId', 'sku name itemCode standardCost')
      .populate('uomId', 'code name')
      .populate('warehouseId', 'name code')
      .populate('materials.itemId', 'sku name itemCode standardCost')
      .populate('materials.uomId', 'code name')
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('completedBy', 'name email')
      .exec();

    if (!order) throw new NotFoundError('Production Order not found');

    const [bom, batch, qcInspection, inventoryTransactions] = await Promise.all([
      BOM.findOne({ _id: order.bomId, tenantId: tId })
        .populate('finishedItemId', 'sku name itemCode')
        .populate('components.itemId', 'sku name itemCode standardCost')
        .populate('components.uomId', 'code name')
        .exec(),
      ProductionBatch.findOne({ productionOrderId: order._id, tenantId: tId }).exec(),
      ProductionQC.findOne({ productionOrderId: order._id, tenantId: tId })
        .populate('inspectorId', 'name email')
        .populate('dispositionedBy', 'name email')
        .exec(),
      InventoryTransaction.find({
        tenantId: tId,
        $or: [
          { referenceId: order.productionOrderNumber },
          { referenceId: order._id.toString() },
          { referenceType: 'PRODUCTION_ORDER' },
        ],
      })
        .populate('itemId', 'sku name itemCode')
        .populate('warehouseId', 'name code')
        .sort({ createdAt: 1 })
        .exec(),
    ]);

    let finishedGoodsReceipt: any = null;
    if (qcInspection?.inventoryReceiptTransactionId) {
      finishedGoodsReceipt = await InventoryTransaction.findOne({
        _id: qcInspection.inventoryReceiptTransactionId,
        tenantId: tId,
      })
        .populate('itemId', 'sku name itemCode')
        .populate('warehouseId', 'name code')
        .exec();
    }

    // Trace inbound Goods Receipt Notes (GRNs) for the consumed raw materials
    let inboundGRNs: any[] = [];
    try {
      const materialItemIds = (order.materials || [])
        .map((m: any) => (m.itemId as any)?._id || m.itemId)
        .filter(Boolean);
      if (materialItemIds.length > 0) {
        inboundGRNs = await GoodsReceiptNote.find({
          tenantId: tId,
          'items.itemId': { $in: materialItemIds },
        })
          .populate('supplierId', 'name supplierCode')
          .populate('purchaseOrderId', 'poNumber total')
          .sort({ createdAt: -1 })
          .limit(5)
          .exec();
      }
    } catch {
      inboundGRNs = [];
    }

    return {
      bom,
      productionOrder: order,
      materials: order.materials,
      batch,
      qcInspection,
      finishedGoodsReceipt,
      inventoryTransactions,
      inboundGRNs,
    };
  }

  async traceRawMaterialBatch(
    tenantId: string | Types.ObjectId,
    rawItemId: string | Types.ObjectId,
    batchNumber?: string
  ): Promise<{
    matchedItems?: any[];
    consumedInOrders: any[];
    finishedGoodsBatches: any[];
  }> {
    const tId = new Types.ObjectId(tenantId);
    const identifier = String(rawItemId || '').trim();

    if (!identifier) {
      return {
        matchedItems: [],
        consumedInOrders: [],
        finishedGoodsBatches: [],
      };
    }

    const isObjectId = Types.ObjectId.isValid(identifier);
    const matchedItemIds: Types.ObjectId[] = [];

    if (isObjectId) {
      matchedItemIds.push(new Types.ObjectId(identifier));
    }

    // Escape special regex characters to safely search by SKU, itemCode, or name
    const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const items = await Item.find({
      tenantId: tId,
      $or: [
        ...(isObjectId ? [{ _id: new Types.ObjectId(identifier) }] : []),
        { sku: { $regex: escaped, $options: 'i' } },
        { itemCode: { $regex: escaped, $options: 'i' } },
        { name: { $regex: escaped, $options: 'i' } },
      ],
    })
      .select('_id sku itemCode name itemType standardCost')
      .limit(20)
      .exec();

    items.forEach((it) => {
      if (!matchedItemIds.some((id) => id.equals(it._id))) {
        matchedItemIds.push(it._id);
      }
    });

    // Match in production orders: either materials.itemId OR materials.batchNumber
    const orClauses: any[] = [];
    if (matchedItemIds.length > 0) {
      orClauses.push({ 'materials.itemId': { $in: matchedItemIds } });
    }
    orClauses.push({ 'materials.batchNumber': { $regex: escaped, $options: 'i' } });

    const query: any = {
      tenantId: tId,
      $or: orClauses,
    };

    if (batchNumber) {
      query['materials.batchNumber'] = batchNumber;
    }

    const orders = await ProductionOrder.find(query)
      .populate('productionItemId', 'sku name itemCode')
      .populate('warehouseId', 'name code')
      .populate('bomId', 'bomNumber name')
      .populate('materials.itemId', 'sku name itemCode standardCost')
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();

    const orderIds = orders.map((o) => o._id);
    const batches = await ProductionBatch.find({
      tenantId: tId,
      productionOrderId: { $in: orderIds },
    })
      .populate('itemId', 'sku name itemCode')
      .populate('uomId', 'code name')
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();

    return {
      matchedItems: items,
      consumedInOrders: orders,
      finishedGoodsBatches: batches,
    };
  }
}

export const productionTraceabilityService = new ProductionTraceabilityService();
