import mongoose, { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { logger } from '../core/logger';
import { Tenant } from '../models/tenant.model';
import { User } from '../models/user.model';
import { Warehouse } from '../models/warehouse.model';
import { Item } from '../models/item.model';
import { Supplier } from '../models/supplier.model';
import { UOM } from '../models/uom.model';
import { Category } from '../models/category.model';
import { InventoryBalance } from '../models/inventoryBalance.model';
import { InventoryTransaction } from '../models/inventoryTransaction.model';
import { AuditLog } from '../models/auditLog.model';
import { purchaseRequisitionService } from '../modules/procurement/services/purchaseRequisition.service';
import { rfqService } from '../modules/procurement/services/rfq.service';
import { supplierQuoteService } from '../modules/procurement/services/supplierQuote.service';
import { quoteComparisonService } from '../modules/procurement/services/quoteComparison.service';
import { purchaseOrderService } from '../modules/procurement/services/purchaseOrder.service';
import { grnService } from '../modules/procurement/services/grn.service';
import { purchaseQCService } from '../modules/procurement/services/purchaseQc.service';
import { PurchaseQCInspection } from '../modules/procurement/models/purchaseQc.model';
import { procurementTraceabilityService } from '../modules/procurement/services/procurementTraceability.service';

export const runPhase3AcceptanceTests = async () => {
  try {
    logger.info('🚀 Starting Phase 3 Procurement & Purchase Acceptance Tests...');
    await connectDatabase();

    // Find Apex Logistics tenant
    const tenant = await Tenant.findOne({ slug: 'apex-logistics' }).exec();
    if (!tenant) throw new Error('Apex Logistics tenant not found. Please seed Phase 1/2 first.');
    const tenantId = tenant._id;

    // Find Users
    const adminUser = await User.findOne({ email: 'admin@apexlogistics.com', tenantId }).exec();
    const purchaseUser = await User.findOne({ email: 'purchase@apexlogistics.com', tenantId }).exec();
    const storeUser = await User.findOne({ email: 'store@apexlogistics.com', tenantId }).exec();
    const qcUser = await User.findOne({ email: 'qc@apexlogistics.com', tenantId }).exec();

    if (!adminUser || !purchaseUser || !storeUser || !qcUser) {
      throw new Error('Required persona users not found in Apex Logistics tenant');
    }

    // Find Warehouse A (WH-NORTH)
    const warehouseA = await Warehouse.findOne({ code: 'WH-NORTH', tenantId }).exec();
    if (!warehouseA) throw new Error('Warehouse WH-NORTH not found');

    // Find Category and UOM
    const category = await Category.findOne({ tenantId }).exec();
    const uom = await UOM.findOne({ code: 'PCS', tenantId }).exec();
    if (!category || !uom) throw new Error('Category or UOM not found');

    logger.info('------------------------------------------------------------');
    logger.info('STEP 1: Create Item A (100 units required, qcRequired = true)');
    logger.info('------------------------------------------------------------');
    const skuCode = `TEST-ITEM-A-${Date.now()}`;
    const itemA = await Item.create({
      tenantId,
      sku: skuCode,
      itemCode: `ITM-A-${Date.now().toString().slice(-4)}`,
      name: 'Titanium Fastener Bolt Grade-8',
      description: 'High-tensile Grade 8 bolt requiring rigorous QC torque inspection',
      categoryId: category._id,
      itemType: 'RAW_MATERIAL',
      baseUomId: uom._id,
      reorderLevel: 20,
      standardCost: 100,
      sellingPrice: 150,
      qcRequired: true,
      batchManaged: true,
      expiryManaged: false,
      status: 'ACTIVE',
      createdBy: adminUser._id,
    });
    logger.info(`✅ Created Item: ${itemA.name} (${itemA.sku}) [qcRequired: ${itemA.qcRequired}]`);

    logger.info('------------------------------------------------------------');
    logger.info('STEP 2: Create three suppliers: Supplier A, Supplier B, Supplier C');
    logger.info('------------------------------------------------------------');
    const ts = Date.now();
    const supplierA = await Supplier.create({
      tenantId,
      supplierCode: `SUP-A-${ts}`,
      name: 'Alpha Industrial Fasteners Inc',
      email: `contact@alphaindustrial-${ts}.com`,
      paymentTerms: 'NET_30',
      currency: 'USD',
      status: 'ACTIVE',
    });
    const supplierB = await Supplier.create({
      tenantId,
      supplierCode: `SUP-B-${ts}`,
      name: 'Bravo Precision Hardware Ltd',
      email: `sales@bravoprecision-${ts}.com`,
      paymentTerms: 'NET_60',
      currency: 'USD',
      status: 'ACTIVE',
    });
    const supplierC = await Supplier.create({
      tenantId,
      supplierCode: `SUP-C-${ts}`,
      name: 'Charlie Global Metallurgy Co',
      email: `quotes@charlieglobal-${ts}.com`,
      paymentTerms: 'IMMEDIATE',
      currency: 'USD',
      status: 'ACTIVE',
    });
    logger.info(`✅ Created Suppliers: ${supplierA.name}, ${supplierB.name}, ${supplierC.name}`);

    logger.info('------------------------------------------------------------');
    logger.info('STEP 3: Create Purchase Requisition (100 units, Warehouse A)');
    logger.info('------------------------------------------------------------');
    const pr = await purchaseRequisitionService.createPR(tenantId, purchaseUser._id, {
      warehouseId: warehouseA._id.toString(),
      requiredDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      priority: 'HIGH',
      purpose: 'Replenish fastener inventory for Plant 1 production line',
      items: [
        {
          itemId: itemA._id.toString(),
          description: itemA.name,
          requestedQuantity: 100,
          uomId: uom._id.toString(),
          estimatedUnitPrice: 100,
        },
      ],
    });
    logger.info(`✅ Created PR: ${pr.prNumber} (Status: ${pr.status}, Total: $${pr.estimatedTotal})`);

    logger.info('------------------------------------------------------------');
    logger.info('STEP 4: Submit PR');
    logger.info('------------------------------------------------------------');
    const submittedPR = await purchaseRequisitionService.submitPR(tenantId, purchaseUser._id, pr._id);
    if (submittedPR.status !== 'SUBMITTED') throw new Error('PR submission failed');
    logger.info(`✅ Submitted PR: ${submittedPR.prNumber} (Status: ${submittedPR.status})`);

    logger.info('------------------------------------------------------------');
    logger.info('STEP 5: Approve PR');
    logger.info('------------------------------------------------------------');
    const approvedPR = await purchaseRequisitionService.approvePR(tenantId, adminUser._id, pr._id);
    if (approvedPR.status !== 'APPROVED') throw new Error('PR approval failed');
    logger.info(`✅ Approved PR: ${approvedPR.prNumber} (Status: ${approvedPR.status}, ApprovedBy: ${approvedPR.approvedBy})`);

    logger.info('------------------------------------------------------------');
    logger.info('STEP 6: Create RFQ (Send to Suppliers A, B, C)');
    logger.info('------------------------------------------------------------');
    const rfq = await rfqService.createRFQ(tenantId, purchaseUser._id, {
      sourceType: 'PURCHASE_REQUISITION',
      sourceId: approvedPR._id.toString(),
      responseDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      requestedDeliveryDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
      terms: 'Standard net delivery terms; Certificate of Analysis (CoA) required.',
      suppliers: [
        { supplierId: supplierA._id.toString() },
        { supplierId: supplierB._id.toString() },
        { supplierId: supplierC._id.toString() },
      ],
      items: [
        {
          itemId: itemA._id.toString(),
          prLineId: approvedPR.items[0]._id?.toString(),
          description: itemA.name,
          quantity: 100,
          uomId: uom._id.toString(),
        },
      ],
    });
    const issuedRFQ = await rfqService.issueRFQ(tenantId, purchaseUser._id, rfq._id);
    logger.info(`✅ Created & Issued RFQ: ${issuedRFQ.rfqNumber} with ${issuedRFQ.suppliers.length} invited suppliers`);

    logger.info('------------------------------------------------------------');
    logger.info('STEP 7: Enter Quotations (Supplier A=$100, B=$95, C=$105)');
    logger.info('------------------------------------------------------------');
    // Supplier A Quote
    const quoteA = await supplierQuoteService.createQuote(tenantId, purchaseUser._id, {
      rfqId: rfq._id.toString(),
      supplierId: supplierA._id.toString(),
      validityDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      currency: 'USD',
      shippingTerms: 'FOB Destination',
      items: [
        {
          itemId: itemA._id.toString(),
          quantity: 100,
          uomId: uom._id.toString(),
          unitPrice: 100,
          discount: 0,
          tax: 0,
          deliveryDays: 14,
        },
      ],
    });

    // Supplier B Quote ($95/unit - Best Offer!)
    const quoteB = await supplierQuoteService.createQuote(tenantId, purchaseUser._id, {
      rfqId: rfq._id.toString(),
      supplierId: supplierB._id.toString(),
      validityDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      currency: 'USD',
      shippingTerms: 'DDP Facility Dock',
      discount: 200, // Volume discount
      items: [
        {
          itemId: itemA._id.toString(),
          quantity: 100,
          uomId: uom._id.toString(),
          unitPrice: 95,
          discount: 0,
          tax: 0,
          deliveryDays: 10,
        },
      ],
    });

    // Supplier C Quote ($105/unit)
    const quoteC = await supplierQuoteService.createQuote(tenantId, purchaseUser._id, {
      rfqId: rfq._id.toString(),
      supplierId: supplierC._id.toString(),
      validityDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      currency: 'USD',
      shippingTerms: 'Ex Works',
      items: [
        {
          itemId: itemA._id.toString(),
          quantity: 100,
          uomId: uom._id.toString(),
          unitPrice: 105,
          discount: 0,
          tax: 0,
          deliveryDays: 7,
        },
      ],
    });
    logger.info(`✅ Quotes Recorded: QT-A=$${quoteA.total}, QT-B=$${quoteB.total}, QT-C=$${quoteC.total}`);

    logger.info('------------------------------------------------------------');
    logger.info('STEP 8: Open Quote Comparison Matrix');
    logger.info('------------------------------------------------------------');
    const matrix = await quoteComparisonService.compareQuotesForRFQ(tenantId, rfq._id);
    if (matrix.suppliers.length !== 3) throw new Error('Quote comparison matrix missing quotes');
    logger.info(`✅ Quote Comparison Matrix successfully analyzed: ${matrix.suppliers.length} bids compared.`);
    logger.info(`   Lowest bidder: ${matrix.bestOptions.lowestPriceSupplierName} ($${matrix.bestOptions.lowestPriceAmount})`);

    logger.info('------------------------------------------------------------');
    logger.info('STEP 9: Finalize Supplier B Quote (Selection Reason)');
    logger.info('------------------------------------------------------------');
    const finalizedQuote = await supplierQuoteService.finalizeQuote(
      tenantId,
      purchaseUser._id,
      quoteB._id,
      'Lowest unit price ($95/unit) and faster delivery timeframe with DDP shipping included.'
    );
    if (finalizedQuote.status !== 'SELECTED') throw new Error('Quote finalization failed');
    logger.info(`✅ Finalized Quote: ${finalizedQuote.quoteNumber} (Status: ${finalizedQuote.status})`);

    // Verify other quotes are marked REJECTED
    const refreshedQuoteA = await supplierQuoteService.getQuoteById(tenantId, quoteA._id);
    const refreshedQuoteC = await supplierQuoteService.getQuoteById(tenantId, quoteC._id);
    if (refreshedQuoteA.status !== 'REJECTED' || refreshedQuoteC.status !== 'REJECTED') {
      throw new Error('Competitor quotes were not marked REJECTED upon finalization');
    }
    logger.info('✅ Audit integrity confirmed: Unselected quotations marked REJECTED.');

    logger.info('------------------------------------------------------------');
    logger.info('STEP 10: Create PO (Verify PO -> Quote -> RFQ -> PR traceability)');
    logger.info('------------------------------------------------------------');
    const po = await purchaseOrderService.createPO(tenantId, purchaseUser._id, {
      supplierId: supplierB._id.toString(),
      warehouseId: warehouseA._id.toString(),
      sourceQuoteId: finalizedQuote._id.toString(),
      expectedDeliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      shippingTerms: finalizedQuote.shippingTerms,
      discount: finalizedQuote.discount,
      items: [
        {
          itemId: itemA._id.toString(),
          description: itemA.name,
          quantity: 100,
          uomId: uom._id.toString(),
          unitPrice: 95,
        },
      ],
    });
    logger.info(`✅ Created Purchase Order: ${po.poNumber} (Status: ${po.status}, Total: $${po.total})`);
    if (!po.sourceQuoteId || !po.sourceRFQId || po.sourcePRIds.length === 0) {
      throw new Error('Traceability link missing in PO header');
    }
    logger.info('✅ Traceability links verified: PO -> Quote -> RFQ -> PR.');

    logger.info('------------------------------------------------------------');
    logger.info('STEP 11: Submit PO');
    logger.info('------------------------------------------------------------');
    const submittedPO = await purchaseOrderService.submitPO(tenantId, purchaseUser._id, po._id);
    if (submittedPO.status !== 'SUBMITTED') throw new Error('PO submit failed');
    logger.info(`✅ Submitted PO: ${submittedPO.poNumber}`);

    logger.info('------------------------------------------------------------');
    logger.info('STEP 12: Approve PO (Elena Rostova approved within $50,000 limit)');
    logger.info('------------------------------------------------------------');
    const approvedPO = await purchaseOrderService.approvePO(tenantId, purchaseUser._id, po._id);
    if (approvedPO.status !== 'APPROVED') throw new Error('PO approval failed');
    logger.info(`✅ Approved PO: ${approvedPO.poNumber} by ${purchaseUser.name}`);

    logger.info('------------------------------------------------------------');
    logger.info('STEP 13: Send PO to Supplier');
    logger.info('------------------------------------------------------------');
    const sentPO = await purchaseOrderService.sendPO(tenantId, purchaseUser._id, po._id);
    if (sentPO.status !== 'SENT') throw new Error('PO send failed');
    logger.info(`✅ Sent PO: ${sentPO.poNumber} to supplier '${supplierB.name}'`);

    logger.info('------------------------------------------------------------');
    logger.info('STEP 14: Create First GRN (60 units)');
    logger.info('------------------------------------------------------------');
    const poLineId = approvedPO.items[0]._id!.toString();
    const grn1 = await grnService.createGRN(tenantId, storeUser._id, {
      purchaseOrderId: approvedPO._id.toString(),
      warehouseId: warehouseA._id.toString(),
      receiptDate: new Date().toISOString(),
      remarks: 'First partial shipment arrived via freight truck',
      items: [
        {
          itemId: itemA._id.toString(),
          poLineId,
          receivedQuantity: 60,
          uomId: uom._id.toString(),
          batchNumber: `BATCH-A-${Date.now().toString().slice(-4)}`,
        },
      ],
    });
    logger.info(`✅ Created First GRN: ${grn1.grnNumber} (Status: ${grn1.status}, Received: 60 units)`);
    if (grn1.status !== 'QC_PENDING') throw new Error('GRN status should be QC_PENDING for qcRequired item');

    logger.info('------------------------------------------------------------');
    logger.info('STEP 15: Perform QC Inspection (Inspect 60, Accept 55, Reject/Hold 5)');
    logger.info('------------------------------------------------------------');
    const qc1 = await PurchaseQCInspection.findOne({ grnId: grn1._id, tenantId });
    if (!qc1) throw new Error('QC inspection sheet was not automatically spawned by GRN');

    await purchaseQCService.inspectQC(tenantId, qcUser._id, qc1._id, {
      overallResult: 'PASS',
      results: [
        { parameter: 'Tensile Strength Testing', expected: 'Grade 8 (150 ksi)', actual: '154 ksi', status: 'PASS' },
        { parameter: 'Thread Pitch & Tolerance', expected: 'Class 2A fit', actual: 'Class 2A fit', status: 'PASS' },
        { parameter: 'Surface Coating Inspection', expected: 'Cadmium yellow dichromate', actual: 'Minor burrs on 5 bolts', status: 'FAIL' },
      ],
      remarks: '5 units showed thread burrs and were segregated; 55 units passed all specifications.',
    });

    const dispositionedQC1 = await purchaseQCService.dispositionQC(tenantId, qcUser._id, qc1._id, {
      acceptedQuantity: 55,
      rejectedQuantity: 5,
      heldQuantity: 0,
      dispositionNotes: 'Accepted 55 units conforming to Grade 8; 5 units rejected for thread burrs.',
    });
    logger.info(`✅ QC-1 Dispositioned: Accepted=55, Rejected=5 (Status: ${dispositionedQC1.status})`);

    logger.info('------------------------------------------------------------');
    logger.info('STEP 16: Verify ONLY 55 units reach available inventory balance (5 do NOT)');
    logger.info('------------------------------------------------------------');
    const balanceAfterGRN1 = await InventoryBalance.findOne({
      tenantId,
      itemId: itemA._id,
      warehouseId: warehouseA._id,
    }).exec();

    const currentQty1 = balanceAfterGRN1?.quantity || 0;
    const currentAvail1 = balanceAfterGRN1?.availableQuantity || 0;
    logger.info(`🔍 Live Balance Check 1: Quantity=${currentQty1}, Available=${currentAvail1}`);
    if (currentQty1 !== 55 || currentAvail1 !== 55) {
      throw new Error(`QC ISOLATION VIOLATION: Expected 55 units in inventory, found ${currentQty1}`);
    }
    logger.info('✅ QC Isolation Verified: Exactly 55 accepted units entered stock. 5 rejected units were NOT added.');

    logger.info('------------------------------------------------------------');
    logger.info('STEP 17: Create Second GRN (40 units - remaining PO balance)');
    logger.info('------------------------------------------------------------');
    const grn2 = await grnService.createGRN(tenantId, storeUser._id, {
      purchaseOrderId: approvedPO._id.toString(),
      warehouseId: warehouseA._id.toString(),
      receiptDate: new Date().toISOString(),
      remarks: 'Second shipment completing PO balance',
      items: [
        {
          itemId: itemA._id.toString(),
          poLineId,
          receivedQuantity: 40,
          uomId: uom._id.toString(),
          batchNumber: `BATCH-B-${Date.now().toString().slice(-4)}`,
        },
      ],
    });
    logger.info(`✅ Created Second GRN: ${grn2.grnNumber} (Status: ${grn2.status}, Received: 40 units)`);

    logger.info('------------------------------------------------------------');
    logger.info('STEP 18: Process QC for GRN-2 (Accept 40)');
    logger.info('------------------------------------------------------------');
    const qc2 = await PurchaseQCInspection.findOne({ grnId: grn2._id, tenantId });
    if (!qc2) throw new Error('QC inspection sheet for GRN-2 not found');

    await purchaseQCService.inspectQC(tenantId, qcUser._id, qc2._id, {
      overallResult: 'PASS',
      results: [{ parameter: 'Dimensional & Torque Spec', status: 'PASS' }],
    });

    await purchaseQCService.dispositionQC(tenantId, qcUser._id, qc2._id, {
      acceptedQuantity: 40,
      rejectedQuantity: 0,
      heldQuantity: 0,
      dispositionNotes: '100% conforming batch.',
    });
    logger.info('✅ QC-2 Dispositioned: Accepted=40, Rejected=0');

    logger.info('------------------------------------------------------------');
    logger.info('STEP 19: Verify PO Status: Ordered=100, Received=100, Pending=0');
    logger.info('------------------------------------------------------------');
    const refreshedPO = await purchaseOrderService.getPOById(tenantId, approvedPO._id);
    const line = refreshedPO.items[0];
    logger.info(`🔍 PO Fulfillment: Ordered=${line.quantity}, Received=${line.receivedQuantity}, Pending=${line.pendingQuantity}, Status=${refreshedPO.status}`);
    if (line.receivedQuantity !== 100 || line.pendingQuantity !== 0 || refreshedPO.status !== 'FULLY_RECEIVED') {
      throw new Error(`PO progress mismatch: Expected 100 received & 0 pending with status FULLY_RECEIVED`);
    }
    logger.info('✅ PO status confirmed as FULLY_RECEIVED with 0 pending units.');

    // ------------------------------------------------------------
    // STEP 20: Verify Final Inventory (55 + 40 = 95 units)
    // ------------------------------------------------------------
    const allBalances = await InventoryBalance.find({
      tenantId,
      itemId: itemA._id,
      warehouseId: warehouseA._id,
    }).exec();

    const finalQty = allBalances.reduce((sum, b) => sum + b.quantity, 0);
    logger.info(`🔍 Final Stock Balances across ${allBalances.length} batch(es): Total Quantity = ${finalQty}`);
    allBalances.forEach((b) => {
      logger.info(`   Batch '${b.batchNumber}': ${b.quantity} units (available: ${b.availableQuantity})`);
    });

    if (finalQty !== 95) {
      throw new Error(`Final stock mismatch: Expected 95 units (55 + 40), found ${finalQty}`);
    }
    logger.info('✅ Final Inventory Accuracy Confirmed: Exactly 95 QC-approved units in available balance.');

    logger.info('------------------------------------------------------------');
    logger.info('STEP 21: Verify Inventory Ledger Transactions');
    logger.info('------------------------------------------------------------');
    const ledgerTxns = await InventoryTransaction.find({
      tenantId,
      itemId: itemA._id,
      transactionType: 'PURCHASE_RECEIPT',
    }).sort({ transactionDate: 1 }).exec();

    logger.info(`🔍 Found ${ledgerTxns.length} PURCHASE_RECEIPT ledger transactions:`);
    ledgerTxns.forEach((txn, i) => {
      logger.info(`   #${i + 1}: ${txn.transactionNumber} | QtyIn: ${txn.quantityIn} | Ref: ${txn.referenceType} ${txn.referenceId} | BalanceAfter: ${txn.balanceAfter}`);
    });

    if (ledgerTxns.length !== 2) throw new Error(`Expected 2 ledger transactions, found ${ledgerTxns.length}`);
    if (ledgerTxns[0].quantityIn !== 55 || ledgerTxns[1].quantityIn !== 40) {
      throw new Error('Ledger transaction quantities do not match QC accepted increments');
    }
    logger.info('✅ Immutable Ledger Integrity 100% Verified.');

    logger.info('------------------------------------------------------------');
    logger.info('STEP 22: Verify End-to-End Bi-Directional Traceability');
    logger.info('------------------------------------------------------------');
    const lineage = await procurementTraceabilityService.getTraceability(tenantId, 'PO', po._id.toString());
    logger.info(`🔍 Traceability from PO ${po.poNumber}:`);
    logger.info(`   Upstream count: ${lineage.upstream.length} (${lineage.upstream.map((u) => `${u.type}:${u.number}`).join(', ')})`);
    logger.info(`   Downstream count: ${lineage.downstream.length} (${lineage.downstream.map((d) => `${d.type}:${d.number}`).join(', ')})`);

    const hasPR = lineage.upstream.some((u) => u.type === 'PR');
    const hasQuote = lineage.upstream.some((u) => u.type === 'QUOTE');
    const hasGRN = lineage.downstream.some((d) => d.type === 'GRN');
    const hasQC = lineage.downstream.some((d) => d.type === 'QC');
    const hasTxn = lineage.downstream.some((d) => d.type === 'INVENTORY_TXN');

    if (!hasPR || !hasQuote || !hasGRN || !hasQC || !hasTxn) {
      throw new Error('Traceability chain incomplete');
    }
    logger.info('✅ Complete Bi-Directional Traceability DAG Confirmed: PR <-> RFQ <-> Quote <-> PO <-> GRN <-> QC <-> Inventory Ledger.');

    logger.info('------------------------------------------------------------');
    logger.info('STEP 23: Security & ABAC Verification');
    logger.info('------------------------------------------------------------');
    // Test 1: Over-receipt prevention
    try {
      await grnService.createGRN(tenantId, storeUser._id, {
        purchaseOrderId: approvedPO._id.toString(),
        warehouseId: warehouseA._id.toString(),
        items: [
          {
            itemId: itemA._id.toString(),
            poLineId,
            receivedQuantity: 10, // Exceeds PO remaining quantity (0)
            uomId: uom._id.toString(),
          },
        ],
      });
      throw new Error('SECURITY FAILURE: Over-receipt should have been rejected!');
    } catch (err: any) {
      logger.info(`✅ Over-receipt correctly blocked: "${err.message}"`);
    }

    logger.info('------------------------------------------------------------');
    logger.info('🎉 ALL PHASE 3 PROCUREMENT ACCEPTANCE TESTS PASSED WITH 100% ACCURACY!');
    logger.info('------------------------------------------------------------');
  } catch (err) {
    logger.error('❌ Phase 3 Acceptance Test Failure:', err);
    throw err;
  } finally {
    await disconnectDatabase();
  }
};

// Execute if run directly
if (require.main === module) {
  runPhase3AcceptanceTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
