import mongoose, { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { logger } from '../core/logger';
import { Tenant } from '../models/tenant.model';
import { TenantSubscription } from '../models/subscription.model';
import { User } from '../models/user.model';
import { Role } from '../models/role.model';
import { Warehouse } from '../models/warehouse.model';
import { Item } from '../models/item.model';
import { Category } from '../models/category.model';
import { UOM } from '../models/uom.model';
import { InventoryBalance } from '../models/inventoryBalance.model';
import { InventoryTransaction } from '../models/inventoryTransaction.model';
import { BOM } from '../modules/production/models/bom.model';
import { ProductionOrder } from '../modules/production/models/productionOrder.model';
import { ProductionBatch } from '../modules/production/models/productionBatch.model';
import { ProductionQC } from '../modules/production/models/productionQc.model';
import { ReportSnapshot } from '../modules/reporting/models/reportSnapshot.model';
import { PERMISSIONS } from '../config/permissions.config';
import { SYSTEM_ROLE_SLUGS } from '../config/constants';

export const seedPhase5Data = async (
  tenantId: Types.ObjectId,
  adminUserId: Types.ObjectId,
  prodUserId?: Types.ObjectId,
  qcUserId?: Types.ObjectId
) => {
  logger.info('📦 Seeding Phase 5 Production, Reporting, Analytics & AI Data...');

  // 1. Ensure Subscription Entitlements (production: true, reports: true, ai: true, analytics: true)
  const subscription = await TenantSubscription.findOne({ tenantId }).exec();
  if (subscription) {
    const features = subscription.features || new Map();
    features.set('production', true);
    features.set('reports', true);
    features.set('ai', true);
    features.set('analytics', true);
    subscription.features = features;
    await subscription.save();
    logger.info('✅ Updated TenantSubscription with Phase 5 entitlements');
  }

  // 2. Update Role Permissions
  await Role.updateMany(
    { slug: SYSTEM_ROLE_SLUGS.TENANT_ADMIN },
    { $set: { permissions: Object.values(PERMISSIONS) } }
  );

  const prodSupervisorPermissions = [
    PERMISSIONS.PRODUCTION_READ,
    PERMISSIONS.PRODUCTION_CREATE,
    PERMISSIONS.PRODUCTION_UPDATE,
    PERMISSIONS.PROD_VIEW,
    PERMISSIONS.PROD_CREATE,
    PERMISSIONS.PROD_EDIT,
    PERMISSIONS.PROD_SUBMIT,
    PERMISSIONS.PROD_APPROVE,
    PERMISSIONS.PROD_RELEASE,
    PERMISSIONS.PROD_START,
    PERMISSIONS.PROD_PAUSE,
    PERMISSIONS.PROD_RESUME,
    PERMISSIONS.PROD_COMPLETE,
    PERMISSIONS.PROD_CANCEL,
    PERMISSIONS.PROD_CONSUME,
    PERMISSIONS.PROD_RECEIVE,
    PERMISSIONS.PROD_EXPORT,
    PERMISSIONS.BOM_READ,
    PERMISSIONS.BOM_MANAGE,
    PERMISSIONS.BOM_VIEW,
    PERMISSIONS.BOM_CREATE,
    PERMISSIONS.BOM_EDIT,
    PERMISSIONS.BOM_APPROVE,
    PERMISSIONS.BOM_ACTIVATE,
    PERMISSIONS.BOM_ARCHIVE,
    PERMISSIONS.BATCH_MANAGE,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.QC_READ,
    PERMISSIONS.PROD_QC_VIEW,
    PERMISSIONS.PROD_QC_CREATE,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.REPORTS_PRODUCTION_VIEW,
    PERMISSIONS.REPORTS_INVENTORY_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.AI_ACCESS,
    PERMISSIONS.AI_INSIGHTS,
  ];
  await Role.updateMany(
    { slug: SYSTEM_ROLE_SLUGS.PRODUCTION_SUPERVISOR },
    { $set: { permissions: prodSupervisorPermissions } }
  );

  const qcInspectorPermissions = [
    PERMISSIONS.QC_READ,
    PERMISSIONS.QC_INSPECT,
    PERMISSIONS.QC_TEMPLATES,
    PERMISSIONS.QC_APPROVE,
    PERMISSIONS.PURCHASE_QC_VIEW,
    PERMISSIONS.PURCHASE_QC_CREATE,
    PERMISSIONS.PURCHASE_QC_INSPECT,
    PERMISSIONS.PURCHASE_QC_APPROVE,
    PERMISSIONS.PURCHASE_QC_REJECT,
    PERMISSIONS.PURCHASE_QC_HOLD,
    PERMISSIONS.PURCHASE_QC_DISPOSITION,
    PERMISSIONS.PROD_QC_VIEW,
    PERMISSIONS.PROD_QC_CREATE,
    PERMISSIONS.PROD_QC_INSPECT,
    PERMISSIONS.PROD_QC_APPROVE,
    PERMISSIONS.PROD_QC_REJECT,
    PERMISSIONS.PROD_QC_HOLD,
    PERMISSIONS.PROD_QC_REWORK,
    PERMISSIONS.PROD_QC_SCRAP,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.BATCH_MANAGE,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_QC_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
  ];
  await Role.updateMany(
    { slug: SYSTEM_ROLE_SLUGS.QC_INSPECTOR },
    { $set: { permissions: qcInspectorPermissions } }
  );

  // Update Viktor Alvarez and Dr. Mei Chen accessScope
  const warehouses = await Warehouse.find({ tenantId }).exec();
  const allWhIds = warehouses.map((w) => w._id.toString());
  const allWhCodes = warehouses.map((w) => w.code);

  await User.updateOne(
    { tenantId, email: 'production@apexlogistics.com' },
    {
      $set: {
        'accessScope.warehouses': allWhIds,
        'accessScope.warehouseCodes': allWhCodes,
        'approvalLimits.productionOrder': 50000,
      },
    }
  );

  await User.updateOne(
    { tenantId, email: 'qc@apexlogistics.com' },
    {
      $set: {
        'accessScope.warehouses': allWhIds,
        'accessScope.warehouseCodes': allWhCodes,
      },
    }
  );

  // 3. Categories & UOM
  let catMfg = await Category.findOne({ tenantId, name: 'Manufactured Assemblies' }).exec();
  if (!catMfg) {
    catMfg = await Category.create({
      tenantId,
      name: 'Manufactured Assemblies',
      code: 'CAT-MFG',
      description: 'Precision mechanical assemblies and finished products produced in-house',
      isActive: true,
    });
  }

  let catRaw = await Category.findOne({ tenantId, code: 'CAT-RAW' }).exec();
  if (!catRaw) {
    catRaw = await Category.findOne({ tenantId }).exec();
  }

  const uomPcs = await UOM.findOne({ tenantId, code: 'PCS' }).exec();
  const uomBase = uomPcs || (await UOM.findOne({ tenantId }).exec());
  if (!uomBase) throw new Error('UOM not found');

  const whNorth = (await Warehouse.findOne({ tenantId, code: 'WH-NORTH' }).exec()) || warehouses[0];
  if (!whNorth) throw new Error('Warehouse not found');

  // 4. Raw Materials
  const rawMaterials = [
    {
      sku: 'RM-STEEL-01',
      itemCode: 'ITM-RM-001',
      name: 'Structural Alloy Steel Rod (10mm)',
      itemType: 'RAW_MATERIAL' as const,
      standardCost: 12.5,
      sellingPrice: 18.0,
      qty: 350,
    },
    {
      sku: 'RM-ALUM-02',
      itemCode: 'ITM-RM-002',
      name: 'Aerospace Grade Aluminum Billet 7075-T6',
      itemType: 'RAW_MATERIAL' as const,
      standardCost: 28.0,
      sellingPrice: 42.0,
      qty: 250,
    },
    {
      sku: 'RM-GSKT-01',
      itemCode: 'ITM-RM-003',
      name: 'High-Temp Fluoroelastomer Sealing Gasket',
      itemType: 'RAW_MATERIAL' as const,
      standardCost: 6.5,
      sellingPrice: 11.0,
      qty: 500,
    },
    {
      sku: 'RM-MTR-01',
      itemCode: 'ITM-RM-004',
      name: 'Brushless High-Torque Electric Motor Core',
      itemType: 'RAW_MATERIAL' as const,
      standardCost: 75.0,
      sellingPrice: 115.0,
      qty: 120,
    },
  ];

  const seededItemsMap = new Map<string, any>();

  for (const rm of rawMaterials) {
    let item = await Item.findOne({ tenantId, sku: rm.sku }).exec();
    if (!item) {
      item = await Item.create({
        tenantId,
        sku: rm.sku,
        itemCode: rm.itemCode,
        name: rm.name,
        categoryId: catRaw?._id || catMfg._id,
        itemType: rm.itemType,
        baseUomId: uomBase._id,
        batchManaged: true,
        reorderLevel: 25,
        minimumStock: 10,
        maximumStock: 1000,
        standardCost: rm.standardCost,
        sellingPrice: rm.sellingPrice,
        status: 'ACTIVE',
      });
    }
    seededItemsMap.set(rm.sku, item);

    let balance = await InventoryBalance.findOne({
      tenantId,
      itemId: item._id,
      warehouseId: whNorth._id,
    }).exec();

    if (!balance) {
      await InventoryBalance.create({
        tenantId,
        itemId: item._id,
        warehouseId: whNorth._id,
        quantity: rm.qty,
        reservedQuantity: 0,
        availableQuantity: rm.qty,
        averageCost: rm.standardCost,
        totalValue: rm.qty * rm.standardCost,
      });

      await InventoryTransaction.create({
        tenantId,
        transactionNumber: `TXN-SEED-RM-${rm.sku}`,
        transactionType: 'OPENING_BALANCE',
        itemId: item._id,
        warehouseId: whNorth._id,
        quantity: rm.qty,
        unitCost: rm.standardCost,
        totalCost: rm.qty * rm.standardCost,
        balanceAfter: rm.qty,
        notes: 'Phase 5 Initial Seed Stock for Manufacturing Components',
      });
    } else if (balance.availableQuantity < 50) {
      balance.quantity += rm.qty;
      balance.availableQuantity += rm.qty;
      balance.totalValue += rm.qty * rm.standardCost;
      await balance.save();
    }
  }

  // 5. Finished Good Item
  let fgPump = await Item.findOne({ tenantId, sku: 'FG-PUMP-01' }).exec();
  if (!fgPump) {
    fgPump = await Item.create({
      tenantId,
      sku: 'FG-PUMP-01',
      itemCode: 'ITM-FG-001',
      name: 'Industrial High-Pressure Hydraulic Pump Assembly',
      description: 'Multi-stage variable displacement hydraulic pump engineered for industrial robotics',
      categoryId: catMfg._id,
      itemType: 'FINISHED_GOOD',
      baseUomId: uomBase._id,
      batchManaged: true,
      qcRequired: true,
      reorderLevel: 10,
      minimumStock: 5,
      maximumStock: 100,
      standardCost: 155.0,
      sellingPrice: 380.0,
      status: 'ACTIVE',
    });
  }
  seededItemsMap.set('FG-PUMP-01', fgPump);

  // 6. Seed BOM v1 and BOM v2
  let bomV1 = await BOM.findOne({ tenantId, bomNumber: 'BOM-PUMP-V1' }).exec();
  if (!bomV1) {
    bomV1 = await BOM.create({
      tenantId,
      bomNumber: 'BOM-PUMP-V1',
      name: 'Standard Hydraulic Pump Assembly BOM',
      finishedItemId: fgPump._id,
      version: 1,
      status: 'ACTIVE',
      quantity: 1,
      uomId: uomBase._id,
      isDefault: true,
      routingNotes: 'Standard production configuration with verified tolerance parameters',
      components: [
        {
          itemId: seededItemsMap.get('RM-STEEL-01')._id,
          quantity: 2,
          uomId: uomBase._id,
          scrapPercentage: 2.0,
          sequence: 10,
          operationCode: 'MACHINING',
          remarks: 'High tensile support shafts',
        },
        {
          itemId: seededItemsMap.get('RM-ALUM-02')._id,
          quantity: 1,
          uomId: uomBase._id,
          scrapPercentage: 1.0,
          sequence: 20,
          operationCode: 'CNC_MILLING',
          remarks: 'Precision CNC machined casing',
        },
        {
          itemId: seededItemsMap.get('RM-GSKT-01')._id,
          quantity: 4,
          uomId: uomBase._id,
          scrapPercentage: 5.0,
          sequence: 30,
          operationCode: 'SEALING',
          remarks: 'Pressure seals',
        },
        {
          itemId: seededItemsMap.get('RM-MTR-01')._id,
          quantity: 1,
          uomId: uomBase._id,
          scrapPercentage: 0.0,
          sequence: 40,
          operationCode: 'ELECTRICAL',
          remarks: 'Core drive unit',
        },
      ],
      approvedBy: adminUserId,
      approvedAt: new Date(),
      effectiveFrom: new Date(),
      createdBy: adminUserId,
    });
    logger.info(`✅ Seeded Active BOM: ${bomV1.bomNumber}`);
  }

  let bomV2 = await BOM.findOne({ tenantId, bomNumber: 'BOM-PUMP-V2' }).exec();
  if (!bomV2) {
    bomV2 = await BOM.create({
      tenantId,
      bomNumber: 'BOM-PUMP-V2',
      name: 'High-Efficiency Hydraulic Pump Assembly (Optimized Gaskets)',
      finishedItemId: fgPump._id,
      version: 2,
      status: 'DRAFT',
      quantity: 1,
      uomId: uomBase._id,
      isDefault: false,
      routingNotes: 'Draft engineering revision targeting lower gasket scrap and higher throughput',
      components: [
        {
          itemId: seededItemsMap.get('RM-STEEL-01')._id,
          quantity: 2,
          uomId: uomBase._id,
          scrapPercentage: 1.0,
          sequence: 10,
        },
        {
          itemId: seededItemsMap.get('RM-ALUM-02')._id,
          quantity: 1,
          uomId: uomBase._id,
          scrapPercentage: 1.0,
          sequence: 20,
        },
        {
          itemId: seededItemsMap.get('RM-GSKT-01')._id,
          quantity: 3,
          uomId: uomBase._id,
          scrapPercentage: 2.0,
          sequence: 30,
        },
        {
          itemId: seededItemsMap.get('RM-MTR-01')._id,
          quantity: 1,
          uomId: uomBase._id,
          scrapPercentage: 0.0,
          sequence: 40,
        },
      ],
      createdBy: adminUserId,
    });
    logger.info(`✅ Seeded Draft BOM Revision: ${bomV2.bomNumber}`);
  }

  // 7. Seed Production Batches and Orders
  let prodOrder1 = await ProductionOrder.findOne({ tenantId, productionOrderNumber: 'PROD-202609-001' }).exec();
  if (!prodOrder1) {
    const orderId1 = new Types.ObjectId();
    const batch1 = await ProductionBatch.create({
      tenantId,
      batchNumber: 'BAT-202609-001',
      productionOrderId: orderId1,
      itemId: fgPump._id,
      manufacturingDate: new Date(Date.now() - 48 * 3600 * 1000),
      expiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      quantity: 20,
      uomId: uomBase._id,
      status: 'RELEASED',
      notes: 'Initial production validation batch',
      createdBy: adminUserId,
    });

    prodOrder1 = await ProductionOrder.create({
      _id: orderId1,
      tenantId,
      productionOrderNumber: 'PROD-202609-001',
      bomId: bomV1._id,
      bomVersion: 1,
      productionItemId: fgPump._id,
      warehouseId: whNorth._id,
      uomId: uomBase._id,
      plannedQuantity: 20,
      actualYieldQuantity: 20,
      scrapQuantity: 0,
      status: 'COMPLETED',
      priority: 'HIGH',
      plannedStartDate: new Date(Date.now() - 48 * 3600 * 1000),
      plannedEndDate: new Date(Date.now() - 24 * 3600 * 1000),
      actualStartDate: new Date(Date.now() - 46 * 3600 * 1000),
      actualEndDate: new Date(Date.now() - 26 * 3600 * 1000),
      batchNumber: batch1.batchNumber,
      materials: [
        {
          itemId: seededItemsMap.get('RM-STEEL-01')._id,
          plannedQuantity: 40.8,
          reservedQuantity: 40.8,
          issuedQuantity: 40.8,
          actualConsumedQuantity: 40.8,
          returnedQuantity: 0,
          scrapQuantity: 0.8,
          uomId: uomBase._id,
          unitCost: 12.5,
        },
        {
          itemId: seededItemsMap.get('RM-ALUM-02')._id,
          plannedQuantity: 20.2,
          reservedQuantity: 20.2,
          issuedQuantity: 20.2,
          actualConsumedQuantity: 20.2,
          returnedQuantity: 0,
          scrapQuantity: 0.2,
          uomId: uomBase._id,
          unitCost: 28.0,
        },
        {
          itemId: seededItemsMap.get('RM-GSKT-01')._id,
          plannedQuantity: 84.0,
          reservedQuantity: 84.0,
          issuedQuantity: 84.0,
          actualConsumedQuantity: 84.0,
          returnedQuantity: 0,
          scrapQuantity: 4.0,
          uomId: uomBase._id,
          unitCost: 6.5,
        },
        {
          itemId: seededItemsMap.get('RM-MTR-01')._id,
          plannedQuantity: 20.0,
          reservedQuantity: 20.0,
          issuedQuantity: 20.0,
          actualConsumedQuantity: 20.0,
          returnedQuantity: 0,
          scrapQuantity: 0.0,
          uomId: uomBase._id,
          unitCost: 75.0,
        },
      ],
      notes: 'Fully completed and inspected pilot production run',
      approvedBy: adminUserId,
      approvedAt: new Date(Date.now() - 50 * 3600 * 1000),
      createdBy: adminUserId,
    });

    await ProductionQC.create({
      tenantId,
      qcNumber: 'QCP-202609-001',
      productionOrderId: prodOrder1._id,
      batchId: batch1._id,
      batchNumber: batch1.batchNumber,
      itemId: fgPump._id,
      inspectedQuantity: 20,
      acceptedQuantity: 20,
      rejectedQuantity: 0,
      heldQuantity: 0,
      reworkQuantity: 0,
      status: 'DISPOSITIONED',
      overallResult: 'PASS',
      disposition: 'ACCEPT',
      dispositionNotes: 'Passed all operational pressure, acoustic and seal integrity tests with zero deviations.',
      dispositionedAt: new Date(Date.now() - 25 * 3600 * 1000),
      dispositionedBy: adminUserId,
      inspectorId: qcUserId || adminUserId,
      results: [
        {
          parameter: 'Hydraulic Burst Pressure (Bar)',
          expected: '350 Bar minimum',
          actual: '362 Bar',
          status: 'PASS',
        },
        {
          parameter: 'Flange Acoustic Decibels',
          expected: '< 65 dB at 2000 RPM',
          actual: '58 dB',
          status: 'PASS',
        },
        {
          parameter: 'Micro-leakage Sensor Check',
          expected: '0.00 ml/min leakage',
          actual: '0.00 ml/min',
          status: 'PASS',
        },
      ],
      createdBy: adminUserId,
    });

    logger.info(`✅ Seeded Completed Order ${prodOrder1.productionOrderNumber} and QC QCP-202609-001`);
  }

  let prodOrder2 = await ProductionOrder.findOne({ tenantId, productionOrderNumber: 'PROD-202609-002' }).exec();
  if (!prodOrder2) {
    const orderId2 = new Types.ObjectId();
    const batch2 = await ProductionBatch.create({
      tenantId,
      batchNumber: 'BAT-202609-002',
      productionOrderId: orderId2,
      itemId: fgPump._id,
      manufacturingDate: new Date(),
      expiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      quantity: 15,
      uomId: uomBase._id,
      status: 'QUARANTINED',
      notes: 'Active manufacturing run batch',
      createdBy: adminUserId,
    });

    await ProductionOrder.create({
      _id: orderId2,
      tenantId,
      productionOrderNumber: 'PROD-202609-002',
      bomId: bomV1._id,
      bomVersion: 1,
      productionItemId: fgPump._id,
      warehouseId: whNorth._id,
      uomId: uomBase._id,
      plannedQuantity: 15,
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      plannedStartDate: new Date(),
      plannedEndDate: new Date(Date.now() + 24 * 3600 * 1000),
      actualStartDate: new Date(),
      batchNumber: batch2.batchNumber,
      materials: [
        {
          itemId: seededItemsMap.get('RM-STEEL-01')._id,
          plannedQuantity: 30.6,
          reservedQuantity: 30.6,
          issuedQuantity: 15.0,
          actualConsumedQuantity: 15.0,
          returnedQuantity: 0,
          scrapQuantity: 0,
          uomId: uomBase._id,
          unitCost: 12.5,
        },
        {
          itemId: seededItemsMap.get('RM-ALUM-02')._id,
          plannedQuantity: 15.15,
          reservedQuantity: 15.15,
          issuedQuantity: 0,
          actualConsumedQuantity: 0,
          returnedQuantity: 0,
          scrapQuantity: 0,
          uomId: uomBase._id,
          unitCost: 28.0,
        },
        {
          itemId: seededItemsMap.get('RM-GSKT-01')._id,
          plannedQuantity: 63.0,
          reservedQuantity: 63.0,
          issuedQuantity: 30.0,
          actualConsumedQuantity: 30.0,
          returnedQuantity: 0,
          scrapQuantity: 0,
          uomId: uomBase._id,
          unitCost: 6.5,
        },
        {
          itemId: seededItemsMap.get('RM-MTR-01')._id,
          plannedQuantity: 15.0,
          reservedQuantity: 15.0,
          issuedQuantity: 0,
          actualConsumedQuantity: 0,
          returnedQuantity: 0,
          scrapQuantity: 0,
          uomId: uomBase._id,
          unitCost: 75.0,
        },
      ],
      notes: 'In-progress high-demand assembly run',
      approvedBy: adminUserId,
      approvedAt: new Date(),
      createdBy: adminUserId,
    });
    logger.info('✅ Seeded In-Progress Order: PROD-202609-002');
  }

  let prodOrder3 = await ProductionOrder.findOne({ tenantId, productionOrderNumber: 'PROD-202609-003' }).exec();
  if (!prodOrder3) {
    await ProductionOrder.create({
      tenantId,
      productionOrderNumber: 'PROD-202609-003',
      bomId: bomV1._id,
      bomVersion: 1,
      productionItemId: fgPump._id,
      warehouseId: whNorth._id,
      uomId: uomBase._id,
      plannedQuantity: 10,
      status: 'RELEASED',
      priority: 'URGENT',
      plannedStartDate: new Date(Date.now() + 12 * 3600 * 1000),
      plannedEndDate: new Date(Date.now() + 36 * 3600 * 1000),
      materials: [
        {
          itemId: seededItemsMap.get('RM-STEEL-01')._id,
          plannedQuantity: 20.4,
          reservedQuantity: 20.4,
          issuedQuantity: 0,
          actualConsumedQuantity: 0,
          returnedQuantity: 0,
          scrapQuantity: 0,
          uomId: uomBase._id,
          unitCost: 12.5,
        },
      ],
      notes: 'Priority batch staged and released for shift start',
      approvedBy: adminUserId,
      approvedAt: new Date(),
      createdBy: adminUserId,
    });
    logger.info('✅ Seeded Released Order: PROD-202609-003');
  }

  let prodOrder4 = await ProductionOrder.findOne({ tenantId, productionOrderNumber: 'PROD-202609-004' }).exec();
  if (!prodOrder4) {
    await ProductionOrder.create({
      tenantId,
      productionOrderNumber: 'PROD-202609-004',
      bomId: bomV1._id,
      bomVersion: 1,
      productionItemId: fgPump._id,
      warehouseId: whNorth._id,
      uomId: uomBase._id,
      plannedQuantity: 50,
      status: 'DRAFT',
      priority: 'LOW',
      plannedStartDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      plannedEndDate: new Date(Date.now() + 10 * 24 * 3600 * 1000),
      materials: [
        {
          itemId: seededItemsMap.get('RM-STEEL-01')._id,
          plannedQuantity: 102.0,
          reservedQuantity: 0,
          issuedQuantity: 0,
          actualConsumedQuantity: 0,
          returnedQuantity: 0,
          scrapQuantity: 0,
          uomId: uomBase._id,
          unitCost: 12.5,
        },
      ],
      notes: 'Quarterly bulk forecast order in drafting phase',
      createdBy: adminUserId,
    });
    logger.info('✅ Seeded Draft Order: PROD-202609-004');
  }

  // 8. Seed Sample Report Snapshot
  const reportSnapshot = await ReportSnapshot.findOne({ tenantId, snapshotNumber: 'RPT-PROD-202609-001' }).exec();
  if (!reportSnapshot) {
    await ReportSnapshot.create({
      tenantId,
      snapshotNumber: 'RPT-PROD-202609-001',
      reportType: 'PRODUCTION_YIELD',
      category: 'PRODUCTION',
      filters: {
        warehouseId: whNorth._id.toString(),
        dateRange: 'LAST_30_DAYS',
      },
      data: [
        {
          orderNumber: 'PROD-202609-001',
          sku: 'FG-PUMP-01',
          plannedQty: 20,
          completedQty: 20,
          yieldRate: '100%',
          status: 'COMPLETED',
        },
      ],
      summary: {
        totalOrders: 1,
        totalProduced: 20,
        averageYield: '100%',
      },
      generatedBy: adminUserId,
    });
    logger.info('✅ Seeded Sample Report Snapshot: RPT-PROD-202609-001');
  }

  logger.info('🎉 Phase 5 Database Seeding Completed Successfully!');
};

export const seedPhase5 = async () => {
  try {
    await connectDatabase();
    const tenant = await Tenant.findOne({ slug: 'apex-logistics' }).exec();
    if (!tenant) throw new Error('Tenant apex-logistics not found');
    const admin = await User.findOne({ tenantId: tenant._id, email: 'admin@apexlogistics.com' }).exec();
    const prod = await User.findOne({ tenantId: tenant._id, email: 'production@apexlogistics.com' }).exec();
    const qc = await User.findOne({ tenantId: tenant._id, email: 'qc@apexlogistics.com' }).exec();

    if (!admin) throw new Error('Admin user not found');
    await seedPhase5Data(tenant._id, admin._id, prod?._id, qc?._id);
  } finally {
    await disconnectDatabase();
  }
};

if (require.main === module) {
  seedPhase5()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
