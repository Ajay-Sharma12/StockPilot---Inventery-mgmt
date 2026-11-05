import { Types } from 'mongoose';
import { logger } from '../core/logger';
import { Item } from '../models/item.model';
import { Supplier } from '../models/supplier.model';
import { Warehouse } from '../models/warehouse.model';
import { UOM } from '../models/uom.model';
import { Department } from '../models/department.model';
import { purchaseRequisitionService } from '../modules/procurement/services/purchaseRequisition.service';
import { rfqService } from '../modules/procurement/services/rfq.service';
import { supplierQuoteService } from '../modules/procurement/services/supplierQuote.service';
import { purchaseOrderService } from '../modules/procurement/services/purchaseOrder.service';
import { grnService } from '../modules/procurement/services/grn.service';
import { purchaseQCService } from '../modules/procurement/services/purchaseQc.service';
import { PurchaseQCInspection } from '../modules/procurement/models/purchaseQc.model';

export const seedPhase3Data = async (
  tenantId: Types.ObjectId,
  adminUserId: Types.ObjectId,
  purchaseUserId: Types.ObjectId,
  storeUserId: Types.ObjectId,
  qcUserId: Types.ObjectId
) => {
  logger.info('🛍️ Seeding Phase 3 Procurement & Purchase Management Data...');

  const warehouse = await Warehouse.findOne({ tenantId, code: 'WH-NORTH' });
  const department = await Department.findOne({ tenantId, code: 'PROC' });
  const itemSteel = await Item.findOne({ tenantId, sku: 'RM-STEEL-01' });
  const itemAlum = await Item.findOne({ tenantId, sku: 'RM-ALUM-02' });
  const supplierSteel = await Supplier.findOne({ tenantId, supplierCode: 'SUP-STEEL' });
  const supplierGlobal = await Supplier.findOne({ tenantId, supplierCode: 'SUP-GLOBAL' });
  const uomPcs = await UOM.findOne({ tenantId, code: 'PCS' });

  if (!warehouse || !itemSteel || !supplierSteel || !uomPcs) {
    logger.warn('Prerequisites for Phase 3 seed missing; skipping seedPhase3Data');
    return;
  }

  // 1. Seed Purchase Requisition (Approved)
  const pr = await purchaseRequisitionService.createPR(tenantId, purchaseUserId, {
    warehouseId: warehouse._id.toString(),
    departmentId: department?._id.toString(),
    requiredDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    priority: 'HIGH',
    purpose: 'Quarterly structural alloy replenishment for Plant 1 fabrication',
    items: [
      {
        itemId: itemSteel._id.toString(),
        description: itemSteel.name,
        requestedQuantity: 200,
        uomId: uomPcs._id.toString(),
        estimatedUnitPrice: itemSteel.standardCost || 12.5,
      },
    ],
  });

  await purchaseRequisitionService.submitPR(tenantId, purchaseUserId, pr._id);
  await purchaseRequisitionService.approvePR(tenantId, adminUserId, pr._id);

  // 2. Seed RFQ
  const rfq = await rfqService.createRFQ(tenantId, purchaseUserId, {
    sourceType: 'PURCHASE_REQUISITION',
    sourceId: pr._id.toString(),
    responseDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    terms: 'Net 30 payment terms, CoA certification on alloy composition.',
    suppliers: [
      { supplierId: supplierSteel._id.toString() },
      ...(supplierGlobal ? [{ supplierId: supplierGlobal._id.toString() }] : []),
    ],
    items: [
      {
        itemId: itemSteel._id.toString(),
        prLineId: pr.items[0]._id?.toString(),
        quantity: 200,
        uomId: uomPcs._id.toString(),
      },
    ],
  });
  await rfqService.issueRFQ(tenantId, purchaseUserId, rfq._id);

  // 3. Seed Supplier Quotations
  const quoteA = await supplierQuoteService.createQuote(tenantId, purchaseUserId, {
    rfqId: rfq._id.toString(),
    supplierId: supplierSteel._id.toString(),
    validityDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    shippingTerms: 'FOB North Warehouse Dock',
    items: [
      {
        itemId: itemSteel._id.toString(),
        quantity: 200,
        uomId: uomPcs._id.toString(),
        unitPrice: 11.8,
        deliveryDays: 7,
      },
    ],
  });

  if (supplierGlobal) {
    await supplierQuoteService.createQuote(tenantId, purchaseUserId, {
      rfqId: rfq._id.toString(),
      supplierId: supplierGlobal._id.toString(),
      validityDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      shippingTerms: 'Ex Works',
      items: [
        {
          itemId: itemSteel._id.toString(),
          quantity: 200,
          uomId: uomPcs._id.toString(),
          unitPrice: 12.2,
          deliveryDays: 14,
        },
      ],
    });
  }

  // 4. Finalize winning quote from Apex Steel
  const finalizedQuote = await supplierQuoteService.finalizeQuote(
    tenantId,
    purchaseUserId,
    quoteA._id,
    'Preferred supplier with ISO-9001 certified heat lot tracking and competitive unit cost ($11.80/unit)'
  );

  // 5. Seed Purchase Order
  const po = await purchaseOrderService.createPO(tenantId, purchaseUserId, {
    supplierId: supplierSteel._id.toString(),
    warehouseId: warehouse._id.toString(),
    sourceQuoteId: finalizedQuote._id.toString(),
    expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    shippingTerms: finalizedQuote.shippingTerms,
    items: [
      {
        itemId: itemSteel._id.toString(),
        description: itemSteel.name,
        quantity: 200,
        uomId: uomPcs._id.toString(),
        unitPrice: 11.8,
      },
    ],
  });

  await purchaseOrderService.submitPO(tenantId, purchaseUserId, po._id);
  await purchaseOrderService.approvePO(tenantId, purchaseUserId, po._id);
  await purchaseOrderService.sendPO(tenantId, purchaseUserId, po._id);

  // 6. Seed Inbound GRN (Partial receipt 120 units)
  const grn = await grnService.createGRN(tenantId, storeUserId, {
    purchaseOrderId: po._id.toString(),
    warehouseId: warehouse._id.toString(),
    remarks: 'First partial container arrived at North Receiving Dock',
    items: [
      {
        itemId: itemSteel._id.toString(),
        poLineId: po.items[0]._id!.toString(),
        receivedQuantity: 120,
        uomId: uomPcs._id.toString(),
        batchNumber: 'LOT-STL-2026-01',
      },
    ],
  });

  // 7. Seed QC Inspection for GRN
  const qc = await PurchaseQCInspection.findOne({ grnId: grn._id, tenantId });
  if (qc) {
    await purchaseQCService.inspectQC(tenantId, qcUserId, qc._id, {
      overallResult: 'PASS',
      results: [
        { parameter: 'Material Test Report (MTR)', expected: 'AISI 4140 spec', actual: 'Verified AISI 4140', status: 'PASS' },
        { parameter: 'Visual Surface Inspection', expected: 'No cracks or oxidation', actual: 'Clean cold-drawn finish', status: 'PASS' },
      ],
      remarks: 'Certified aerospace heat lot verified.',
    });

    await purchaseQCService.dispositionQC(tenantId, qcUserId, qc._id, {
      acceptedQuantity: 120,
      rejectedQuantity: 0,
      heldQuantity: 0,
      dispositionNotes: '100% accepted into active stock.',
    });
  }

  logger.info('🎉 Phase 3 Procurement & Purchase Management Seed Completed Successfully!');
};
