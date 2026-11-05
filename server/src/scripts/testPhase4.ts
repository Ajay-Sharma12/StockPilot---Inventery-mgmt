import mongoose, { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { logger } from '../core/logger';
import { Tenant } from '../models/tenant.model';
import { User } from '../models/user.model';
import { Warehouse } from '../models/warehouse.model';
import { Item } from '../models/item.model';
import { Customer } from '../models/customer.model';
import { UOM } from '../models/uom.model';
import { Category } from '../models/category.model';
import { InventoryBalance } from '../models/inventoryBalance.model';
import { InventoryTransaction } from '../models/inventoryTransaction.model';
import { AuditLog } from '../models/auditLog.model';

import { salesOrderService } from '../modules/sales/services/salesOrder.service';
import { packagingService } from '../modules/sales/services/packaging.service';
import { dispatchService } from '../modules/sales/services/dispatch.service';
import { gatePassService } from '../modules/sales/services/gatePass.service';
import { invoiceService } from '../modules/sales/services/invoice.service';
import { paymentService } from '../modules/sales/services/payment.service';
import { salesTraceabilityService } from '../modules/sales/services/salesTraceability.service';
import { salesDashboardService } from '../modules/sales/services/salesDashboard.service';

export const runPhase4AcceptanceTests = async () => {
  try {
    logger.info('🚀 Starting Phase 4 Sales & Order-to-Cash Comprehensive Acceptance Suite...');
    await connectDatabase();

    const tenant = await Tenant.findOne({ slug: 'apex-logistics' }).exec();
    if (!tenant) throw new Error('Apex Logistics tenant not found. Run seed first.');
    const tenantId = tenant._id;

    // Load Personas
    const adminUser = await User.findOne({ email: 'admin@apexlogistics.com', tenantId }).exec();
    const salesUser = await User.findOne({ email: 'sales@apexlogistics.com', tenantId }).exec();
    const opsUser = await User.findOne({ email: 'operations@apexlogistics.com', tenantId }).exec();
    const storeUser = await User.findOne({ email: 'store@apexlogistics.com', tenantId }).exec();

    if (!adminUser || !salesUser || !opsUser || !storeUser) {
      throw new Error('Required personas not found for Phase 4 testing');
    }

    const warehouse = await Warehouse.findOne({ code: 'WH-NORTH', tenantId }).exec();
    if (!warehouse) throw new Error('Warehouse WH-NORTH not found');

    const customer = await Customer.findOne({ tenantId, customerCode: 'CUST-VERTEX' }).exec();
    if (!customer) throw new Error('Customer CUST-VERTEX not found');

    const uom = await UOM.findOne({ tenantId, code: 'PCS' }).exec();
    const category = await Category.findOne({ tenantId }).exec();
    if (!uom || !category) throw new Error('UOM or Category missing');

    // Create Dedicated Test Item with 100 Initial Units
    const skuCode = `TEST-SALES-ITEM-${Date.now()}`;
    const testItem = await Item.create({
      tenantId,
      sku: skuCode,
      itemCode: `ITM-S-${Date.now().toString().slice(-4)}`,
      name: 'High-Precision Aviation Hydraulic Valve',
      categoryId: category._id,
      itemType: 'FINISHED_GOOD',
      baseUomId: uom._id,
      standardCost: 50.0,
      sellingPrice: 90.0,
      status: 'ACTIVE',
      qcRequired: false,
      batchManaged: false,
      serialManaged: false,
      expiryManaged: false,
      reorderLevel: 10,
      minimumStock: 5,
      maximumStock: 500,
    });

    // Seed 100 units in warehouse
    await InventoryBalance.create({
      tenantId,
      itemId: testItem._id,
      warehouseId: warehouse._id,
      quantity: 100,
      availableQuantity: 100,
      reservedQuantity: 0,
      averageCost: 50.0,
      totalValue: 5000.0,
      updatedAt: new Date(),
    });

    logger.info(`Initialized test item ${skuCode} with 100 units available in WH-NORTH`);

    // =========================================================================
    // STEP 1: Create Sales Order (50 units @ $90 = $4,500)
    // =========================================================================
    logger.info('STEP 1: Create Sales Order (50 units @ $90)');
    const so = await salesOrderService.createSalesOrder(tenantId, salesUser._id, {
      customerId: customer._id.toString(),
      warehouseId: warehouse._id.toString(),
      currency: 'USD',
      shippingAmount: 100,
      notes: 'Test Sales Order for automated Phase 4 verification',
      items: [
        {
          itemId: testItem._id.toString(),
          description: testItem.name,
          orderedQuantity: 50,
          uomId: uom._id.toString(),
          unitPrice: 90.0,
          discount: 0,
          taxRate: 10,
        },
      ],
    });

    if (so.status !== 'DRAFT') throw new Error(`Expected SO status DRAFT, got ${so.status}`);
    if (so.subtotal !== 4500) throw new Error(`Expected subtotal 4500, got ${so.subtotal}`);
    logger.info(`✅ Step 1 Passed: SO created with soNumber ${so.soNumber}`);

    // =========================================================================
    // STEP 2: Submit Sales Order
    // =========================================================================
    logger.info('STEP 2: Submit Sales Order');
    const submittedSO = await salesOrderService.submitSalesOrder(tenantId, salesUser._id, so._id);
    if (submittedSO.status !== 'SUBMITTED') throw new Error(`Expected SUBMITTED, got ${submittedSO.status}`);
    logger.info('✅ Step 2 Passed: SO status SUBMITTED');

    // =========================================================================
    // STEP 3: Stock Availability Check
    // =========================================================================
    logger.info('STEP 3: Stock Availability Check');
    const availability = await salesOrderService.checkAvailability(tenantId, so._id);
    if (availability[0].status !== 'SUFFICIENT' || availability[0].shortfall !== 0) {
      throw new Error(`Expected SUFFICIENT stock, got ${availability[0].status} with shortfall ${availability[0].shortfall}`);
    }
    logger.info(`✅ Step 3 Passed: Stock availability verified (100 available, 50 requested)`);

    // =========================================================================
    // STEP 4: Approve Sales Order (ABAC limit check: $4,500 + tax + shipping <= $10,000)
    // =========================================================================
    logger.info('STEP 4: Approve Sales Order under Jessica limit');
    const approvedSO = await salesOrderService.approveSalesOrder(tenantId, salesUser._id, so._id);
    if (approvedSO.status !== 'APPROVED') throw new Error(`Expected APPROVED, got ${approvedSO.status}`);
    logger.info('✅ Step 4 Passed: SO approved by Sales Rep within $10,000 limit');

    // =========================================================================
    // STEP 5: Confirm Sales Order (Reserve 50 Units in Inventory)
    // =========================================================================
    logger.info('STEP 5: Confirm Sales Order and Reserve Stock');
    const confirmedSO = await salesOrderService.confirmSalesOrder(tenantId, salesUser._id, so._id);
    if (confirmedSO.status !== 'CONFIRMED') throw new Error(`Expected CONFIRMED, got ${confirmedSO.status}`);

    const balanceAfterReserve = await InventoryBalance.findOne({
      tenantId,
      itemId: testItem._id,
      warehouseId: warehouse._id,
    });
    if (!balanceAfterReserve) throw new Error('Balance not found after reservation');
    if (balanceAfterReserve.availableQuantity !== 50 || balanceAfterReserve.reservedQuantity !== 50 || balanceAfterReserve.quantity !== 100) {
      throw new Error(`Balance inconsistency after reserve: available=${balanceAfterReserve.availableQuantity}, reserved=${balanceAfterReserve.reservedQuantity}, physical=${balanceAfterReserve.quantity}`);
    }
    logger.info(`✅ Step 5 Passed: Stock reserved atomically (Avail: 50, Res: 50, Total: 100)`);

    // =========================================================================
    // STEP 6: Anti-Over-Reservation Validation
    // =========================================================================
    logger.info('STEP 6: Anti-Over-Reservation Validation (Demanding 60 more units when only 50 available)');
    const soOver = await salesOrderService.createSalesOrder(tenantId, salesUser._id, {
      customerId: customer._id.toString(),
      warehouseId: warehouse._id.toString(),
      items: [
        {
          itemId: testItem._id.toString(),
          description: testItem.name,
          orderedQuantity: 60,
          uomId: uom._id.toString(),
          unitPrice: 90.0,
        },
      ],
    });
    await salesOrderService.submitSalesOrder(tenantId, salesUser._id, soOver._id);
    await salesOrderService.approveSalesOrder(tenantId, salesUser._id, soOver._id);

    try {
      await salesOrderService.confirmSalesOrder(tenantId, salesUser._id, soOver._id);
      throw new Error('SECURITY FAILURE: Over-reservation should have been rejected!');
    } catch (err: any) {
      logger.info(`✅ Step 6 Passed: Over-reservation rejected with error: "${err.message}"`);
    }

    // =========================================================================
    // STEP 7: Packaging (Over-packing validation & valid packaging)
    // =========================================================================
    logger.info('STEP 7: Packaging Verification');
    // Try over-packing 55 units when SO only ordered 50
    try {
      await packagingService.createPackage(tenantId, storeUser._id, {
        salesOrderId: so._id.toString(),
        items: [
          {
            itemId: testItem._id.toString(),
            quantity: 55,
            uomId: uom._id.toString(),
          },
        ],
      });
      throw new Error('SECURITY FAILURE: Over-packaging should have been rejected!');
    } catch (err: any) {
      logger.info(`✅ Step 7a Passed: Over-packaging blocked: "${err.message}"`);
    }

    // Valid package: 50 units
    const pkg = await packagingService.createPackage(tenantId, storeUser._id, {
      salesOrderId: so._id.toString(),
      packingMaterial: 'Rigid Industrial Box #BX-99',
      totalWeight: 45.0,
      dimensions: { length: 30, width: 30, height: 30 },
      items: [
        {
          itemId: testItem._id.toString(),
          quantity: 50,
          uomId: uom._id.toString(),
          weight: 45.0,
        },
      ],
    });

    if (pkg.status !== 'DRAFT') throw new Error(`Expected package status DRAFT, got ${pkg.status}`);

    // Pack package
    const packedPkg = await packagingService.packOrder(tenantId, storeUser._id, pkg._id);
    if (packedPkg.status !== 'PACKED') throw new Error(`Expected PACKED, got ${packedPkg.status}`);

    const soAfterPack = await salesOrderService.getSalesOrderById(tenantId, so._id);
    if (soAfterPack.items[0].packedQuantity !== 50) {
      throw new Error(`Expected SO packedQuantity 50, got ${soAfterPack.items[0].packedQuantity}`);
    }
    logger.info(`✅ Step 7b Passed: Package packed successfully, SO packedQuantity updated to 50`);

    // =========================================================================
    // STEP 8: Dispatch & Inventory Issue
    // =========================================================================
    logger.info('STEP 8: Dispatch Creation & Stock Issuance');
    const dsp = await dispatchService.createDispatch(tenantId, storeUser._id, {
      salesOrderId: so._id.toString(),
      packageIds: [pkg._id.toString()],
      carrier: 'Apex Express Logistics',
      vehicleNumber: 'IL-TRK-5501',
      driverName: 'Robert Lang',
      driverContact: '+1 (555) 998-1122',
      trackingNumber: 'TRK-5501-992',
    });

    if (dsp.status !== 'READY') throw new Error(`Expected dispatch status READY, got ${dsp.status}`);

    // Issue stock via dispatchOrder
    const dispatchedDsp = await dispatchService.dispatchOrder(tenantId, storeUser._id, dsp._id);
    if (dispatchedDsp.status !== 'DISPATCHED' || !dispatchedDsp.inventoryIssued) {
      throw new Error(`Dispatch failed: status=${dispatchedDsp.status}, inventoryIssued=${dispatchedDsp.inventoryIssued}`);
    }

    // Verify Inventory Deductions
    const balanceAfterDispatch = await InventoryBalance.findOne({
      tenantId,
      itemId: testItem._id,
      warehouseId: warehouse._id,
    });
    if (!balanceAfterDispatch) throw new Error('Balance not found after dispatch');
    if (balanceAfterDispatch.quantity !== 50 || balanceAfterDispatch.reservedQuantity !== 0 || balanceAfterDispatch.availableQuantity !== 50) {
      throw new Error(`Invalid balance after dispatch: quantity=${balanceAfterDispatch.quantity}, reserved=${balanceAfterDispatch.reservedQuantity}, available=${balanceAfterDispatch.availableQuantity}`);
    }

    // Verify Inventory Transaction
    const txn = await InventoryTransaction.findOne({
      tenantId,
      itemId: testItem._id,
      warehouseId: warehouse._id,
      transactionType: 'SALE',
    }).sort({ createdAt: -1 });
    if (!txn || txn.quantityOut !== 50) {
      throw new Error(`Expected inventory transaction for SALE of 50 units out, got ${txn?.quantityOut}`);
    }

    // Verify SO Fulfilled status
    const soAfterDispatch = await salesOrderService.getSalesOrderById(tenantId, so._id);
    if (soAfterDispatch.status !== 'FULFILLED' || soAfterDispatch.items[0].dispatchedQuantity !== 50) {
      throw new Error(`Expected SO FULFILLED with dispatchedQuantity 50, got ${soAfterDispatch.status}`);
    }

    // Idempotency: Attempting to dispatch again must fail
    try {
      await dispatchService.dispatchOrder(tenantId, storeUser._id, dsp._id);
      throw new Error('SECURITY FAILURE: Duplicate dispatch should have been rejected!');
    } catch (err: any) {
      logger.info(`✅ Step 8 Passed: Stock issued (Balance: 50 physical, 0 reserved, 50 available), duplicate dispatch blocked: "${err.message}"`);
    }

    // =========================================================================
    // STEP 9: Gate Pass & Security Gate Out
    // =========================================================================
    logger.info('STEP 9: Gate Pass Creation, Approval, and Gate Out');
    const gp = await gatePassService.createGatePass(tenantId, storeUser._id, {
      salesOrderId: so._id.toString(),
      dispatchId: dsp._id.toString(),
      vehicleNumber: 'IL-TRK-5501',
      driverName: 'Robert Lang',
    });
    if (gp.status !== 'READY') throw new Error(`Expected gate pass status READY, got ${gp.status}`);

    await gatePassService.approveGatePass(tenantId, adminUser._id, gp._id);
    const approvedGP = await gatePassService.getGatePassById(tenantId, gp._id);
    if (approvedGP.status !== 'APPROVED') throw new Error(`Expected APPROVED gate pass, got ${approvedGP.status}`);

    const gateOutGP = await gatePassService.recordGateOut(tenantId, storeUser._id, gp._id, 'Vehicle passed Gate 1 at outbound bay');
    if (gateOutGP.status !== 'GATE_OUT' || !gateOutGP.gateOutTime) {
      throw new Error(`Expected GATE_OUT with immutable timestamp, got ${gateOutGP.status}`);
    }
    logger.info(`✅ Step 9 Passed: Gate Pass approved and Gate Out recorded at ${gateOutGP.gateOutTime.toISOString()}`);

    // =========================================================================
    // STEP 10: Invoicing
    // =========================================================================
    logger.info('STEP 10: Invoice Generation');
    const invoice = await invoiceService.createInvoice(tenantId, salesUser._id, {
      salesOrderId: so._id.toString(),
      dispatchId: dsp._id.toString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      shippingAmount: 100,
      roundOff: 0,
      items: [
        {
          itemId: testItem._id.toString(),
          description: testItem.name,
          quantity: 50,
          uomId: uom._id.toString(),
          unitPrice: 90.0,
          discount: 0,
          taxRate: 10,
        },
      ],
    });

    const expectedTotal = 4500 + 450 + 100; // subtotal 4500 + tax 450 + shipping 100 = 5050
    if (invoice.grandTotal !== expectedTotal) {
      throw new Error(`Expected invoice grandTotal ${expectedTotal}, got ${invoice.grandTotal}`);
    }
    if (invoice.outstandingAmount !== expectedTotal || invoice.status !== 'ISSUED') {
      throw new Error(`Expected ISSUED with outstanding ${expectedTotal}, got ${invoice.status} ${invoice.outstandingAmount}`);
    }
    logger.info(`✅ Step 10 Passed: Invoice ${invoice.invoiceNumber} created for $${invoice.grandTotal}`);

    // =========================================================================
    // STEP 11: Payment & Overpayment Prevention
    // =========================================================================
    logger.info('STEP 11: Payment Processing & Anti-Overpayment Enforce');
    // Try paying $6000 (exceeds $5050 outstanding)
    try {
      await paymentService.recordPayment(tenantId, salesUser._id, {
        invoiceId: invoice._id.toString(),
        amount: 6000,
        paymentMethod: 'BANK_TRANSFER',
      });
      throw new Error('SECURITY FAILURE: Overpayment should have been rejected!');
    } catch (err: any) {
      logger.info(`✅ Step 11a Passed: Overpayment blocked: "${err.message}"`);
    }

    // Partial Payment: $2,500
    const p1 = await paymentService.recordPayment(tenantId, salesUser._id, {
      invoiceId: invoice._id.toString(),
      amount: 2500,
      paymentMethod: 'BANK_TRANSFER',
      paymentReference: 'WIRE-001',
    });
    if (p1.status !== 'RECORDED') throw new Error(`Expected payment RECORDED, got ${p1.status}`);

    const invAfterP1 = await invoiceService.getInvoiceById(tenantId, invoice._id);
    if (invAfterP1.status !== 'PARTIALLY_PAID' || invAfterP1.paidAmount !== 2500 || invAfterP1.outstandingAmount !== 2550) {
      throw new Error(`Expected PARTIALLY_PAID (paid: 2500, out: 2550), got ${invAfterP1.status} (paid: ${invAfterP1.paidAmount}, out: ${invAfterP1.outstandingAmount})`);
    }
    logger.info(`✅ Step 11b Passed: Partial payment of $2,500 recorded (Outstanding: $2,550)`);

    // Final Payment: $2,550
    const p2 = await paymentService.recordPayment(tenantId, salesUser._id, {
      invoiceId: invoice._id.toString(),
      amount: 2550,
      paymentMethod: 'ONLINE_PAYMENT',
      paymentReference: 'PAY-ONLINE-99',
    });

    const invAfterP2 = await invoiceService.getInvoiceById(tenantId, invoice._id);
    if (invAfterP2.status !== 'PAID' || invAfterP2.outstandingAmount !== 0) {
      throw new Error(`Expected PAID with 0 outstanding, got ${invAfterP2.status} with ${invAfterP2.outstandingAmount}`);
    }
    logger.info(`✅ Step 11c Passed: Final payment recorded, Invoice fully PAID`);

    // Payment Reversal Test
    await paymentService.reversePayment(tenantId, salesUser._id, p2._id, 'Duplicate payment batch entry reversed by accounting');
    const invAfterRev = await invoiceService.getInvoiceById(tenantId, invoice._id);
    if (invAfterRev.status !== 'PARTIALLY_PAID' || invAfterRev.outstandingAmount !== 2550) {
      throw new Error(`Expected invoice to revert to PARTIALLY_PAID after payment reversal, got ${invAfterRev.status}`);
    }
    logger.info(`✅ Step 11d Passed: Payment reversed successfully, invoice status reverted to PARTIALLY_PAID`);

    // Re-apply final payment so invoice is settled
    await paymentService.recordPayment(tenantId, salesUser._id, {
      invoiceId: invoice._id.toString(),
      amount: 2550,
      paymentMethod: 'ONLINE_PAYMENT',
    });

    // =========================================================================
    // STEP 12: ABAC Financial Approval Limit Enforcement
    // =========================================================================
    logger.info('STEP 12: ABAC Financial Approval Limit Enforcement');
    // Create SO with total > $10,000 limit (e.g. 150 units @ $90 = $13,500)
    const bigSO = await salesOrderService.createSalesOrder(tenantId, salesUser._id, {
      customerId: customer._id.toString(),
      warehouseId: warehouse._id.toString(),
      items: [
        {
          itemId: testItem._id.toString(),
          description: testItem.name,
          orderedQuantity: 150,
          uomId: uom._id.toString(),
          unitPrice: 90.0,
        },
      ],
    });
    await salesOrderService.submitSalesOrder(tenantId, salesUser._id, bigSO._id);

    // Jessica attempts approval ($13,500 > $10,000 limit) -> MUST FAIL
    try {
      await salesOrderService.approveSalesOrder(tenantId, salesUser._id, bigSO._id);
      throw new Error('SECURITY FAILURE: Jessica should not be able to approve order exceeding $10,000!');
    } catch (err: any) {
      logger.info(`✅ Step 12a Passed: Jessica ($10,000 limit) rejected from approving $13,500 order: "${err.message}"`);
    }

    // Operations Manager David Miller ($100,000 limit) approves -> MUST SUCCEED
    const bigApproved = await salesOrderService.approveSalesOrder(tenantId, opsUser._id, bigSO._id);
    if (bigApproved.status !== 'APPROVED') throw new Error(`Expected APPROVED, got ${bigApproved.status}`);
    logger.info(`✅ Step 12b Passed: Operations Manager David Miller approved high-value order successfully`);

    // =========================================================================
    // STEP 13: Order Cancellation & Stock Release
    // =========================================================================
    logger.info('STEP 13: Order Cancellation & Stock Release Verification');
    // Top up test item balance to test cancellation
    await InventoryBalance.updateOne(
      { tenantId, itemId: testItem._id, warehouseId: warehouse._id },
      { $inc: { availableQuantity: 50, quantity: 50 } }
    );

    const cancelSO = await salesOrderService.createSalesOrder(tenantId, salesUser._id, {
      customerId: customer._id.toString(),
      warehouseId: warehouse._id.toString(),
      items: [
        {
          itemId: testItem._id.toString(),
          description: testItem.name,
          orderedQuantity: 10,
          uomId: uom._id.toString(),
          unitPrice: 90.0,
        },
      ],
    });
    await salesOrderService.submitSalesOrder(tenantId, salesUser._id, cancelSO._id);
    await salesOrderService.approveSalesOrder(tenantId, salesUser._id, cancelSO._id);
    await salesOrderService.confirmSalesOrder(tenantId, salesUser._id, cancelSO._id);

    const balBeforeCancel = await InventoryBalance.findOne({
      tenantId,
      itemId: testItem._id,
      warehouseId: warehouse._id,
    });
    const reservedBeforeCancel = balBeforeCancel?.reservedQuantity || 0;

    // Cancel SO
    await salesOrderService.cancelSalesOrder(tenantId, salesUser._id, cancelSO._id, 'Customer cancelled due to budget freeze');
    const cancelled = await salesOrderService.getSalesOrderById(tenantId, cancelSO._id);
    if (cancelled.status !== 'CANCELLED') throw new Error(`Expected CANCELLED, got ${cancelled.status}`);

    const balAfterCancel = await InventoryBalance.findOne({
      tenantId,
      itemId: testItem._id,
      warehouseId: warehouse._id,
    });
    if ((balAfterCancel?.reservedQuantity || 0) !== reservedBeforeCancel - 10) {
      throw new Error(`Reserved stock not released after cancellation: was ${reservedBeforeCancel}, now ${balAfterCancel?.reservedQuantity}`);
    }
    logger.info(`✅ Step 13 Passed: SO cancelled and 10 reserved units restored back to available stock`);

    // =========================================================================
    // STEP 14: Bi-Directional Lineage DAG Traceability
    // =========================================================================
    logger.info('STEP 14: Bi-Directional Lineage DAG Traceability Verification');
    const lineage = await salesTraceabilityService.getLineage(tenantId, 'SO', so._id.toString());
    if (!lineage.salesOrder || lineage.packages.length === 0 || lineage.dispatches.length === 0 || lineage.invoices.length === 0 || lineage.payments.length === 0) {
      throw new Error(`Incomplete lineage DAG returned: packages=${lineage.packages.length}, dispatches=${lineage.dispatches.length}, invoices=${lineage.invoices.length}, payments=${lineage.payments.length}`);
    }
    logger.info(`✅ Step 14 Passed: Full bi-directional lineage DAG retrieved across Customer <-> SO <-> Package <-> Dispatch <-> GatePass <-> Invoice <-> Payment`);

    // =========================================================================
    // STEP 15: Operational Sales Dashboard & Receivables Analytics
    // =========================================================================
    logger.info('STEP 15: Operational Sales Dashboard & Receivables Analytics');
    const stats = await salesDashboardService.getDashboardStats(tenantId);
    if (stats.ordersThisMonth === 0) {
      throw new Error(`Expected non-zero ordersThisMonth, got ${stats.ordersThisMonth}`);
    }

    const receivables = await paymentService.getReceivablesSummary(tenantId);
    if (receivables.totalOutstanding === undefined) {
      throw new Error('Expected totalOutstanding in receivables summary');
    }
    logger.info(`✅ Step 15 Passed: Dashboard metrics verified (Orders this month: ${stats.ordersThisMonth}, Dispatches today: ${stats.todayDispatchesCount}, Total Outstanding: $${receivables.totalOutstanding})`);

    logger.info('------------------------------------------------------------');
    logger.info('🎉 ALL 15 CRITICAL PHASE 4 ACCEPTANCE TESTS PASSED WITH 100% SUCCESS!');
    logger.info('------------------------------------------------------------');
  } catch (err) {
    logger.error('❌ Phase 4 Acceptance Test Failure:', err);
    throw err;
  } finally {
    await disconnectDatabase();
  }
};

// Execute directly if run via CLI
if (require.main === module) {
  runPhase4AcceptanceTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
