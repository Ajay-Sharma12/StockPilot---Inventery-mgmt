import { Types } from 'mongoose';
import { logger } from '../core/logger';
import { Category, SubCategory } from '../models/category.model';
import { UOM, UOMConversion } from '../models/uom.model';
import { TaxCode } from '../models/taxCode.model';
import { PaymentTerm } from '../models/paymentTerm.model';
import { CurrencyMaster } from '../models/currency.model';
import { WastageReason, StockAdjustmentReason } from '../models/reason.model';
import { Department } from '../models/department.model';
import { Warehouse, Zone, Rack, Bin } from '../models/warehouse.model';
import { Supplier } from '../models/supplier.model';
import { Customer } from '../models/customer.model';
import { Item } from '../models/item.model';
import { InventoryBalance } from '../models/inventoryBalance.model';
import { InventoryTransaction } from '../models/inventoryTransaction.model';
import { User } from '../models/user.model';

export const seedPhase2Data = async (tenantId: Types.ObjectId, adminUserId: Types.ObjectId) => {
  logger.info('📦 Seeding Phase 2 Master Data & Centralized Inventory Engine...');

  // 1. Categories
  const catRaw = await Category.create({
    tenantId,
    name: 'Raw Materials',
    code: 'RAW_MAT',
    description: 'Direct materials used in production assembly and fabrication',
    status: 'ACTIVE',
    createdBy: adminUserId,
  });

  const catFin = await Category.create({
    tenantId,
    name: 'Finished Goods',
    code: 'FIN_GOOD',
    description: 'Completed products ready for customer fulfillment',
    status: 'ACTIVE',
    createdBy: adminUserId,
  });

  const catPkg = await Category.create({
    tenantId,
    name: 'Packaging Materials',
    code: 'PKG_MAT',
    description: 'Crates, cartons, protective liners and shipping materials',
    status: 'ACTIVE',
    createdBy: adminUserId,
  });

  const catCons = await Category.create({
    tenantId,
    name: 'Consumables & Tools',
    code: 'CONSUM',
    description: 'Lubricants, coolants, drill bits and workshop consumables',
    status: 'ACTIVE',
    createdBy: adminUserId,
  });

  // SubCategories
  await SubCategory.create([
    {
      tenantId,
      categoryId: catRaw._id,
      name: 'Structural Alloys',
      code: 'SUB_ALLOY',
      status: 'ACTIVE',
    },
    {
      tenantId,
      categoryId: catRaw._id,
      name: 'Aerospace Billets',
      code: 'SUB_AERO',
      status: 'ACTIVE',
    },
    {
      tenantId,
      categoryId: catFin._id,
      name: 'Turbine Assemblies',
      code: 'SUB_TURB',
      status: 'ACTIVE',
    },
  ]);

  // 2. Units of Measure (UOM)
  const uomPcs = await UOM.create({
    tenantId,
    name: 'Pieces',
    code: 'PCS',
    symbol: 'pc',
    type: 'COUNT',
    decimalPrecision: 0,
    status: 'ACTIVE',
  });

  const uomKg = await UOM.create({
    tenantId,
    name: 'Kilogram',
    code: 'KG',
    symbol: 'kg',
    type: 'WEIGHT',
    decimalPrecision: 2,
    status: 'ACTIVE',
  });

  const uomLtr = await UOM.create({
    tenantId,
    name: 'Liter',
    code: 'LTR',
    symbol: 'L',
    type: 'VOLUME',
    decimalPrecision: 2,
    status: 'ACTIVE',
  });

  const uomBox = await UOM.create({
    tenantId,
    name: 'Cargo Box (24-pk)',
    code: 'BOX',
    symbol: 'bx',
    type: 'PACKAGING',
    decimalPrecision: 0,
    status: 'ACTIVE',
  });

  await UOM.create({
    tenantId,
    name: 'Meter',
    code: 'MTR',
    symbol: 'm',
    type: 'LENGTH',
    decimalPrecision: 2,
    status: 'ACTIVE',
  });

  // UOM Conversion (1 BOX = 24 PCS)
  await UOMConversion.create({
    tenantId,
    fromUomId: uomBox._id,
    toUomId: uomPcs._id,
    conversionFactor: 24,
    roundingRule: 'ROUND',
    status: 'ACTIVE',
  });

  // 3. Tax Codes
  const taxGst = await TaxCode.create({
    tenantId,
    name: 'GST Standard 18%',
    code: 'GST_18',
    rate: 18,
    type: 'GST',
    description: 'Standard Goods & Services Tax',
    status: 'ACTIVE',
  });

  await TaxCode.create({
    tenantId,
    name: 'Exempt / Zero Rated',
    code: 'EXEMPT',
    rate: 0,
    type: 'EXEMPT',
    description: 'Tax-exempt raw materials',
    status: 'ACTIVE',
  });

  // 4. Payment Terms
  await PaymentTerm.create([
    { tenantId, name: 'Net 30 Days', code: 'NET_30', days: 30, status: 'ACTIVE' },
    { tenantId, name: 'Immediate On Receipt', code: 'IMMEDIATE', days: 0, status: 'ACTIVE' },
    { tenantId, name: 'Net 60 Days', code: 'NET_60', days: 60, status: 'ACTIVE' },
  ]);

  // 5. Currencies
  await CurrencyMaster.create([
    { tenantId, name: 'US Dollar', code: 'USD', symbol: '$', decimalPrecision: 2, isDefault: true, status: 'ACTIVE' },
    { tenantId, name: 'Euro', code: 'EUR', symbol: '€', decimalPrecision: 2, isDefault: false, status: 'ACTIVE' },
    { tenantId, name: 'British Pound', code: 'GBP', symbol: '£', decimalPrecision: 2, isDefault: false, status: 'ACTIVE' },
  ]);

  // 6. Reasons
  await WastageReason.create([
    { tenantId, name: 'Physical Handling Damage', code: 'DAMAGED', description: 'Forklift or transit shock damage', status: 'ACTIVE' },
    { tenantId, name: 'Expired Shelf-Life', code: 'EXPIRED', description: 'Chemical degradation past expiry', status: 'ACTIVE' },
    { tenantId, name: 'Engineering Scrap', code: 'OBSOLETE', description: 'Obsolete revision or machining error', status: 'ACTIVE' },
  ]);

  await StockAdjustmentReason.create([
    { tenantId, name: 'Cycle Count Audit Variance', code: 'CYCLE_COUNT_VARIANCE', description: 'Reconciliation from physical stock count', status: 'ACTIVE' },
    { tenantId, name: 'Internal Prototype Consumption', code: 'RND_CONSUMPTION', description: 'Unrecorded engineering testing', status: 'ACTIVE' },
    { tenantId, name: 'Data Entry Correction', code: 'ENTRY_CORRECTION', description: 'Clerical error adjustment', status: 'ACTIVE' },
  ]);

  // 7. Departments
  await Department.create([
    { tenantId, name: 'Warehousing & Logistics', code: 'WHS', status: 'ACTIVE' },
    { tenantId, name: 'Procurement', code: 'PROC', status: 'ACTIVE' },
    { tenantId, name: 'Plant 1 Manufacturing', code: 'MFG', status: 'ACTIVE' },
    { tenantId, name: 'Quality Assurance', code: 'QA', status: 'ACTIVE' },
  ]);

  // 8. Warehouses & Hierarchy
  const whNorth = await Warehouse.create({
    tenantId,
    code: 'WH-NORTH',
    name: 'Northern Hub Logistics Center',
    type: 'MAIN',
    address: {
      street: '104 Industrial Way',
      city: 'Chicago',
      state: 'IL',
      country: 'USA',
      postalCode: '60611',
    },
    status: 'ACTIVE',
  });

  const whCentral = await Warehouse.create({
    tenantId,
    code: 'WH-CENTRAL',
    name: 'Central Distribution Depot',
    type: 'REGIONAL',
    address: {
      street: '550 Logistics Blvd',
      city: 'Des Plaines',
      state: 'IL',
      country: 'USA',
      postalCode: '60016',
    },
    status: 'ACTIVE',
  });

  const whQuarantine = await Warehouse.create({
    tenantId,
    code: 'WH-QUARANTINE',
    name: 'Quarantine & QC Holding Depot',
    type: 'QUARANTINE',
    address: {
      street: '104 Industrial Way, Bay 9',
      city: 'Chicago',
      state: 'IL',
      country: 'USA',
      postalCode: '60611',
    },
    status: 'ACTIVE',
  });

  // Zones, Racks, Bins in WH-NORTH
  const zoneA = await Zone.create({
    tenantId,
    warehouseId: whNorth._id,
    code: 'ZN-A',
    name: 'Heavy Alloys & Billets Zone',
    status: 'ACTIVE',
  });

  const zoneB = await Zone.create({
    tenantId,
    warehouseId: whNorth._id,
    code: 'ZN-B',
    name: 'Finished Assemblies Zone',
    status: 'ACTIVE',
  });

  const rackA1 = await Rack.create({
    tenantId,
    warehouseId: whNorth._id,
    zoneId: zoneA._id,
    code: 'RK-A1',
    name: 'High-Density Rack A1',
    status: 'ACTIVE',
  });

  const binA101 = await Bin.create({
    tenantId,
    warehouseId: whNorth._id,
    zoneId: zoneA._id,
    rackId: rackA1._id,
    code: 'BIN-A101',
    name: 'Heavy Storage Bay A1-01',
    capacity: 1000,
    status: 'ACTIVE',
  });

  const binA102 = await Bin.create({
    tenantId,
    warehouseId: whNorth._id,
    zoneId: zoneA._id,
    rackId: rackA1._id,
    code: 'BIN-A102',
    name: 'Heavy Storage Bay A1-02',
    capacity: 1000,
    status: 'ACTIVE',
  });

  // Update Marcus Vance's accessScope to include warehouse IDs & codes
  await User.updateMany(
    { email: 'store@apexlogistics.com' },
    {
      $set: {
        'accessScope.warehouses': [
          whNorth._id.toString(),
          whCentral._id.toString(),
          'WH-NORTH',
          'WH-CENTRAL',
        ],
      },
    }
  );

  // 9. Suppliers
  await Supplier.create([
    {
      tenantId,
      supplierCode: 'SUP-STEEL',
      name: 'Apex Steel & Metallurgy Corp',
      legalName: 'Apex Steel & Metallurgy International Ltd',
      contactPerson: 'Robert Vance',
      email: 'supply@apexsteel.com',
      phone: '+1 (555) 234-5678',
      currency: 'USD',
      status: 'ACTIVE',
      notes: 'Primary structural alloys provider with ISO-9001 certification',
    },
    {
      tenantId,
      supplierCode: 'SUP-GLOBAL',
      name: 'Global Precision Components',
      legalName: 'Global Precision Engineering Gmbh',
      contactPerson: 'Klaus Schmidt',
      email: 'orders@globalprecision.com',
      phone: '+1 (555) 876-5432',
      currency: 'USD',
      status: 'ACTIVE',
      notes: 'High tolerance turbine blades and specialized hardware',
    },
    {
      tenantId,
      supplierCode: 'SUP-ECOPACK',
      name: 'EcoPack Industrial Solutions',
      contactPerson: 'Dana Lewis',
      email: 'sales@ecopack.com',
      currency: 'USD',
      status: 'ACTIVE',
    },
  ]);

  // 10. Customers
  await Customer.create([
    {
      tenantId,
      customerCode: 'CUST-VERTEX',
      name: 'Vertex Aerospace Systems',
      legalName: 'Vertex Aerospace Systems Corporation',
      contactPerson: 'Commander Jack O’Neill',
      email: 'procurement@vertexaero.com',
      phone: '+1 (555) 765-4321',
      creditLimit: 500000,
      currency: 'USD',
      status: 'ACTIVE',
    },
    {
      tenantId,
      customerCode: 'CUST-TITAN',
      name: 'Titan Heavy Dynamics Inc',
      contactPerson: 'Hannah Montana',
      email: 'orders@titandynamics.com',
      creditLimit: 250000,
      currency: 'USD',
      status: 'ACTIVE',
    },
  ]);

  // 11. Items
  const itemSteel = await Item.create({
    tenantId,
    sku: 'RM-STEEL-01',
    itemCode: 'ITM-00001',
    name: 'Structural Alloy Steel Rod (10mm)',
    description: 'High tensile cold-drawn alloy steel rod suitable for structural aerospace framing',
    categoryId: catRaw._id,
    itemType: 'RAW_MATERIAL',
    baseUomId: uomPcs._id,
    reorderLevel: 50,
    minimumStock: 20,
    maximumStock: 500,
    standardCost: 12.5,
    sellingPrice: 18.0,
    taxCodeId: taxGst._id,
    batchManaged: true,
    status: 'ACTIVE',
    createdBy: adminUserId,
  });

  const itemAlum = await Item.create({
    tenantId,
    sku: 'RM-ALUM-02',
    itemCode: 'ITM-00002',
    name: 'Aerospace Grade Aluminum Billet 7075-T6',
    description: 'High strength aluminum alloy billet for CNC precision milling',
    categoryId: catRaw._id,
    itemType: 'RAW_MATERIAL',
    baseUomId: uomKg._id,
    reorderLevel: 30,
    minimumStock: 10,
    maximumStock: 300,
    standardCost: 28.0,
    sellingPrice: 42.0,
    taxCodeId: taxGst._id,
    batchManaged: true,
    status: 'ACTIVE',
    createdBy: adminUserId,
  });

  const itemTurbine = await Item.create({
    tenantId,
    sku: 'FG-TURB-01',
    itemCode: 'ITM-00003',
    name: 'High-Efficiency Micro Turbine Rotor Assembly',
    description: 'Precision balanced rotor assembly calibrated for industrial power generators',
    categoryId: catFin._id,
    itemType: 'FINISHED_GOOD',
    baseUomId: uomPcs._id,
    reorderLevel: 15,
    minimumStock: 5,
    maximumStock: 100,
    standardCost: 145.0,
    sellingPrice: 320.0,
    taxCodeId: taxGst._id,
    serialManaged: true,
    status: 'ACTIVE',
    createdBy: adminUserId,
  });

  const itemBox = await Item.create({
    tenantId,
    sku: 'PKG-BOX-24',
    itemCode: 'ITM-00004',
    name: 'Reinforced Corrugated Heavy Cargo Crate',
    description: 'Double-walled impact resistant export crates',
    categoryId: catPkg._id,
    itemType: 'PACKAGING',
    baseUomId: uomBox._id,
    reorderLevel: 100,
    minimumStock: 40,
    maximumStock: 1000,
    standardCost: 4.2,
    sellingPrice: 7.5,
    status: 'ACTIVE',
    createdBy: adminUserId,
  });

  const itemLube = await Item.create({
    tenantId,
    sku: 'CNS-LUB-01',
    itemCode: 'ITM-00005',
    name: 'Synthetic High-Temperature Gear Lubricant',
    description: 'ISO VG 320 synthetic lubricant for high-torque gearbox maintenance',
    categoryId: catCons._id,
    itemType: 'CONSUMABLE',
    baseUomId: uomLtr._id,
    reorderLevel: 25,
    minimumStock: 10,
    maximumStock: 200,
    standardCost: 18.5,
    sellingPrice: 28.0,
    status: 'ACTIVE',
    createdBy: adminUserId,
  });

  // 12. Initial Balances and Immutable Ledger Transactions
  const stockSeedData = [
    {
      item: itemSteel,
      wh: whNorth,
      loc: binA101,
      batch: 'BATCH-2026-001',
      qty: 120,
      cost: 12.5,
    },
    {
      item: itemSteel,
      wh: whCentral,
      loc: undefined,
      batch: 'BATCH-2026-002',
      qty: 45,
      cost: 12.5,
    },
    {
      item: itemAlum,
      wh: whNorth,
      loc: binA102,
      batch: 'ALUM-B992',
      qty: 85,
      cost: 28.0,
    },
    {
      item: itemTurbine,
      wh: whNorth,
      loc: undefined,
      batch: '',
      qty: 12, // Critical low stock (reorder is 15)
      cost: 145.0,
    },
    {
      item: itemBox,
      wh: whCentral,
      loc: undefined,
      batch: '',
      qty: 350,
      cost: 4.2,
    },
  ];

  let txnCounter = 1000;
  for (const s of stockSeedData) {
    const totalVal = Math.round(s.qty * s.cost * 100) / 100;

    await InventoryBalance.create({
      tenantId,
      itemId: s.item._id,
      warehouseId: s.wh._id,
      locationId: s.loc?._id,
      batchNumber: s.batch,
      quantity: s.qty,
      reservedQuantity: 0,
      availableQuantity: s.qty,
      averageCost: s.cost,
      totalValue: totalVal,
      updatedAt: new Date(),
    });

    txnCounter++;
    await InventoryTransaction.create({
      tenantId,
      transactionNumber: `TXN-${txnCounter}`,
      itemId: s.item._id,
      batchNumber: s.batch,
      warehouseId: s.wh._id,
      locationId: s.loc?._id,
      transactionType: 'OPENING_BALANCE',
      referenceType: 'MANUAL',
      quantityIn: s.qty,
      quantityOut: 0,
      balanceAfter: s.qty,
      unitCost: s.cost,
      totalValue: totalVal,
      userId: adminUserId,
      transactionDate: new Date(),
      reason: 'Initial system opening inventory balance',
    });
  }

  logger.info('🎉 Phase 2 Master Data & Inventory Engine Seed Completed Successfully!');
};
