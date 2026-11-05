import { Types } from 'mongoose';
import { logger } from '../core/logger';
import { Item } from '../models/item.model';
import { Customer } from '../models/customer.model';
import { Warehouse } from '../models/warehouse.model';
import { UOM } from '../models/uom.model';
import { salesOrderService } from '../modules/sales/services/salesOrder.service';
import { packagingService } from '../modules/sales/services/packaging.service';
import { dispatchService } from '../modules/sales/services/dispatch.service';
import { gatePassService } from '../modules/sales/services/gatePass.service';
import { invoiceService } from '../modules/sales/services/invoice.service';
import { paymentService } from '../modules/sales/services/payment.service';

export const seedPhase4Data = async (
  tenantId: Types.ObjectId,
  adminUserId: Types.ObjectId,
  salesUserId: Types.ObjectId,
  storeUserId: Types.ObjectId,
  opsUserId: Types.ObjectId
) => {
  logger.info('📦 Seeding Phase 4 Sales & Order-to-Cash Data...');

  const warehouse = await Warehouse.findOne({ tenantId, code: 'WH-NORTH' });
  const itemSteel = await Item.findOne({ tenantId, sku: 'RM-STEEL-01' });
  const itemAlum = await Item.findOne({ tenantId, sku: 'RM-ALUM-02' });
  const customerVertex = await Customer.findOne({ tenantId, customerCode: 'CUST-VERTEX' });
  const customerTitan = await Customer.findOne({ tenantId, customerCode: 'CUST-TITAN' });
  const uomPcs = await UOM.findOne({ tenantId, code: 'PCS' });

  if (!warehouse || !itemSteel || !customerVertex || !uomPcs) {
    logger.warn('Prerequisites for Phase 4 seed missing; skipping seedPhase4Data');
    return;
  }

  // =========================================================================
  // SCENARIO 1: Complete Order-to-Cash Lifecycle (SO -> PKG -> DSP -> GP -> INV -> PAY)
  // =========================================================================
  logger.info('Seeding Scenario 1: Fully Dispatched, Invoiced & Partially Paid Order');

  const so1 = await salesOrderService.createSalesOrder(tenantId, salesUserId, {
    customerId: customerVertex._id.toString(),
    warehouseId: warehouse._id.toString(),
    currency: 'USD',
    shippingAmount: 50,
    notes: 'Urgent aerospace structural alloy replenishment. Requires prompt dispatch.',
    items: [
      {
        itemId: itemSteel._id.toString(),
        description: itemSteel.name,
        orderedQuantity: 20,
        uomId: uomPcs._id.toString(),
        unitPrice: 35.0,
        discount: 20,
        taxRate: 5,
      },
    ],
  });

  // Submit SO
  await salesOrderService.submitSalesOrder(tenantId, salesUserId, so1._id);

  // Approve SO (under Jessica's $10,000 approval limit)
  await salesOrderService.approveSalesOrder(tenantId, salesUserId, so1._id);

  // Confirm SO (reserves 20 units of RM-STEEL-01 in warehouse)
  await salesOrderService.confirmSalesOrder(tenantId, salesUserId, so1._id);

  // Create Package
  const pkg1 = await packagingService.createPackage(tenantId, storeUserId, {
    salesOrderId: so1._id.toString(),
    packingMaterial: 'Heavy Duty Wooden Crate #CR-12',
    totalWeight: 140.5,
    dimensions: { length: 120, width: 40, height: 40 },
    notes: 'Securely strapped with bubble wrap and steel bands.',
    items: [
      {
        itemId: itemSteel._id.toString(),
        quantity: 20,
        uomId: uomPcs._id.toString(),
        batchNumber: 'BATCH-2026-001',
        weight: 140,
        remarks: 'Batch inspection verified OK',
      },
    ],
  });

  // Pack Package
  await packagingService.packOrder(tenantId, storeUserId, pkg1._id);

  // Create Dispatch
  const dsp1 = await dispatchService.createDispatch(tenantId, storeUserId, {
    salesOrderId: so1._id.toString(),
    packageIds: [pkg1._id.toString()],
    carrier: 'Apex Logistics Freightways',
    vehicleNumber: 'IL-TRK-7749',
    driverName: 'Tom Hayes',
    driverContact: '+1 (555) 432-8811',
    trackingNumber: 'TRK-APX-899120',
    remarks: 'Pre-scheduled delivery to Vertex Chicago Facility',
  });

  // Dispatch shipment (physically issues stock from reserved quantity)
  await dispatchService.dispatchOrder(tenantId, storeUserId, dsp1._id);

  // Create Security Gate Pass
  const gp1 = await gatePassService.createGatePass(tenantId, storeUserId, {
    salesOrderId: so1._id.toString(),
    dispatchId: dsp1._id.toString(),
    vehicleNumber: 'IL-TRK-7749',
    driverName: 'Tom Hayes',
    driverContact: '+1 (555) 432-8811',
    remarks: 'Commercial invoice copy provided to driver',
  });

  // Approve Gate Pass
  await gatePassService.approveGatePass(tenantId, adminUserId, gp1._id);

  // Gate Out
  await gatePassService.recordGateOut(tenantId, storeUserId, gp1._id, 'Vehicle exited via North Security Gate 2 at outbound lane.');

  // Create Customer Invoice
  const inv1 = await invoiceService.createInvoice(tenantId, salesUserId, {
    salesOrderId: so1._id.toString(),
    dispatchId: dsp1._id.toString(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    shippingAmount: 50,
    roundOff: 0,
    notes: 'Payment due Net 30 days. Remit to Apex Logistics Chase Bank Account.',
    items: [
      {
        itemId: itemSteel._id.toString(),
        description: itemSteel.name,
        quantity: 20,
        uomId: uomPcs._id.toString(),
        unitPrice: 35.0,
        discount: 20,
        taxRate: 5,
        batchNumber: 'BATCH-2026-001',
      },
    ],
  });

  // Record Partial Payment
  await paymentService.recordPayment(tenantId, salesUserId, {
    invoiceId: inv1._id.toString(),
    amount: 400.0,
    paymentMethod: 'BANK_TRANSFER',
    paymentReference: 'WIRE-VTX-099418',
    notes: 'Initial 50% deposit received via wire transfer',
  });

  // =========================================================================
  // SCENARIO 2: High Value Sales Order (ABAC Limit Enforcement)
  // Exceeds Jessica's limit ($10,000) -> $15,000 total -> pending Ops/Admin
  // =========================================================================
  if (customerTitan && itemAlum) {
    logger.info('Seeding Scenario 2: High-Value Sales Order requiring Manager Approval');

    const so2 = await salesOrderService.createSalesOrder(tenantId, salesUserId, {
      customerId: customerTitan._id.toString(),
      warehouseId: warehouse._id.toString(),
      currency: 'USD',
      shippingAmount: 250,
      notes: 'High-volume alloy batch for heavy robotics fabrication.',
      items: [
        {
          itemId: itemAlum._id.toString(),
          description: itemAlum.name,
          orderedQuantity: 30,
          uomId: uomPcs._id.toString(),
          unitPrice: 400.0, // Subtotal = $12,000 > $10,000 limit
          discount: 0,
          taxRate: 8,
        },
      ],
    });

    await salesOrderService.submitSalesOrder(tenantId, salesUserId, so2._id);
    // Left as SUBMITTED so user can test approval with David Miller or rejection with Jessica Reynolds
  }

  // =========================================================================
  // SCENARIO 3: Confirmed Order Ready for Packaging Queue
  // =========================================================================
  logger.info('Seeding Scenario 3: Confirmed Order in Warehouse Packaging Queue');

  const so3 = await salesOrderService.createSalesOrder(tenantId, salesUserId, {
    customerId: customerVertex._id.toString(),
    warehouseId: warehouse._id.toString(),
    currency: 'USD',
    shippingAmount: 25,
    notes: 'Secondary batch for testing laboratory calibration.',
    items: [
      {
        itemId: itemSteel._id.toString(),
        description: itemSteel.name,
        orderedQuantity: 10,
        uomId: uomPcs._id.toString(),
        unitPrice: 35.0,
        discount: 0,
        taxRate: 5,
      },
    ],
  });

  await salesOrderService.submitSalesOrder(tenantId, salesUserId, so3._id);
  await salesOrderService.approveSalesOrder(tenantId, salesUserId, so3._id);
  await salesOrderService.confirmSalesOrder(tenantId, salesUserId, so3._id);

  logger.info('✅ Phase 4 Sales & Order-to-Cash Data Seeded Successfully!');
};
