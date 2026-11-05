import { z } from 'zod';

// --- MASTER DATA VALIDATORS ---
export const createCategorySchema = {
  body: z.object({
    name: z.string().min(2, 'Category name is required'),
    code: z.string().min(1, 'Category code is required'),
    description: z.string().optional(),
  }),
};

export const createSubCategorySchema = {
  body: z.object({
    categoryId: z.string().min(1, 'Category ID is required'),
    name: z.string().min(2, 'Subcategory name is required'),
    code: z.string().min(1, 'Subcategory code is required'),
    description: z.string().optional(),
  }),
};

export const createUomSchema = {
  body: z.object({
    name: z.string().min(1, 'UOM name is required'),
    code: z.string().min(1, 'UOM code is required'),
    symbol: z.string().min(1, 'UOM symbol is required'),
    type: z.enum(['COUNT', 'WEIGHT', 'VOLUME', 'LENGTH', 'PACKAGING', 'AREA', 'OTHER']).optional(),
    decimalPrecision: z.number().min(0).max(4).optional(),
  }),
};

export const createUomConversionSchema = {
  body: z.object({
    fromUomId: z.string().min(1, 'From UOM is required'),
    toUomId: z.string().min(1, 'To UOM is required'),
    conversionFactor: z.number().positive('Conversion factor must be positive'),
    roundingRule: z.enum(['ROUND', 'CEIL', 'FLOOR']).optional(),
  }),
};

export const createSupplierSchema = {
  body: z.object({
    supplierCode: z.string().optional(),
    name: z.string().min(2, 'Supplier name is required'),
    legalName: z.string().optional(),
    contactPerson: z.string().optional(),
    email: z.string().email('Invalid email format').optional().or(z.literal('')).nullable(),
    contactEmail: z.string().email('Invalid email format').optional().or(z.literal('')).nullable(),
    phone: z.string().optional(),
    taxNumber: z.string().optional(),
    taxId: z.string().optional(),
    paymentTerms: z.string().optional(),
    creditLimit: z.number().min(0, 'Credit limit must be 0 or more').optional(),
    currency: z.string().optional(),
    leadTimeDays: z.number().min(0).optional(),
    minOrderValue: z.number().min(0).optional(),
    rating: z.number().min(1).max(5).optional(),
    website: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional(),
    address: z
      .object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        postalCode: z.string().optional(),
      })
      .optional(),
    notes: z.string().optional(),
  }),
};

export const updateSupplierSchema = {
  body: z.object({
    supplierCode: z.string().optional(),
    name: z.string().min(2).optional(),
    legalName: z.string().optional(),
    contactPerson: z.string().optional(),
    email: z.string().email('Invalid email format').optional().or(z.literal('')).nullable(),
    contactEmail: z.string().email('Invalid email format').optional().or(z.literal('')).nullable(),
    phone: z.string().optional(),
    taxNumber: z.string().optional(),
    taxId: z.string().optional(),
    paymentTerms: z.string().optional(),
    creditLimit: z.number().min(0).optional(),
    currency: z.string().optional(),
    leadTimeDays: z.number().min(0).optional(),
    minOrderValue: z.number().min(0).optional(),
    rating: z.number().min(1).max(5).optional(),
    website: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional(),
    address: z
      .object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        postalCode: z.string().optional(),
      })
      .optional(),
    notes: z.string().optional(),
  }),
};

export const createCustomerSchema = {
  body: z.object({
    customerCode: z.string().min(1, 'Customer code is required'),
    name: z.string().min(2, 'Customer name is required'),
    legalName: z.string().optional(),
    contactPerson: z.string().optional(),
    email: z.string().email('Valid email is required'),
    phone: z.string().optional(),
    taxNumber: z.string().optional(),
    paymentTerms: z.string().optional(),
    currency: z.string().optional(),
    creditLimit: z.number().min(0).optional(),
    billingAddress: z
      .object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        postalCode: z.string().optional(),
      })
      .optional(),
    shippingAddress: z
      .object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        postalCode: z.string().optional(),
      })
      .optional(),
    notes: z.string().optional(),
  }),
};

export const createDepartmentSchema = {
  body: z.object({
    code: z.string().min(1, 'Department code is required'),
    name: z.string().min(2, 'Department name is required'),
    description: z.string().optional(),
    managerId: z.string().optional(),
  }),
};

export const createTaxCodeSchema = {
  body: z.object({
    code: z.string().min(1, 'Tax code is required'),
    name: z.string().min(2, 'Name is required'),
    rate: z.number().min(0, 'Tax rate cannot be negative'),
    type: z.enum(['GST', 'VAT', 'SALES_TAX', 'EXEMPT']).optional(),
    description: z.string().optional(),
  }),
};

export const createPaymentTermSchema = {
  body: z.object({
    code: z.string().min(1, 'Payment term code is required'),
    name: z.string().min(2, 'Name is required'),
    days: z.number().min(0, 'Days must be 0 or more'),
    description: z.string().optional(),
  }),
};

export const createCurrencySchema = {
  body: z.object({
    code: z.string().min(1, 'Currency code is required'),
    name: z.string().min(2, 'Name is required'),
    symbol: z.string().min(1, 'Symbol is required'),
    decimalPrecision: z.number().min(0).max(4).optional(),
    isDefault: z.boolean().optional(),
  }),
};

export const createReasonSchema = {
  body: z.object({
    code: z.string().min(1, 'Reason code is required'),
    name: z.string().min(2, 'Name is required'),
    description: z.string().optional(),
  }),
};

// --- WAREHOUSE HIERARCHY VALIDATORS ---
export const createWarehouseSchema = {
  body: z.object({
    code: z.string().min(1, 'Warehouse code is required'),
    name: z.string().min(2, 'Warehouse name is required'),
    type: z.enum(['MAIN', 'REGIONAL', 'TRANSIT', 'PLANT', 'QUARANTINE', 'OTHER']).optional(),
    managerId: z.string().optional(),
    address: z
      .object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        postalCode: z.string().optional(),
      })
      .optional(),
  }),
};

export const createZoneSchema = {
  body: z.object({
    warehouseId: z.string().min(1, 'Warehouse ID is required'),
    code: z.string().min(1, 'Zone code is required'),
    name: z.string().min(2, 'Zone name is required'),
  }),
};

export const createRackSchema = {
  body: z.object({
    warehouseId: z.string().min(1, 'Warehouse ID is required'),
    zoneId: z.string().min(1, 'Zone ID is required'),
    code: z.string().min(1, 'Rack code is required'),
    name: z.string().min(1, 'Rack name is required'),
  }),
};

export const createBinSchema = {
  body: z.object({
    warehouseId: z.string().min(1, 'Warehouse ID is required'),
    zoneId: z.string().min(1, 'Zone ID is required'),
    rackId: z.string().min(1, 'Rack ID is required'),
    code: z.string().min(1, 'Bin code is required'),
    name: z.string().min(1, 'Bin name is required'),
    capacity: z.number().positive().optional(),
  }),
};

// --- ITEM MASTER VALIDATORS ---
export const createItemSchema = {
  body: z.object({
    sku: z.string().min(2, 'SKU is required'),
    itemCode: z.string().optional(),
    name: z.string().min(2, 'Item name is required'),
    description: z.string().optional(),
    categoryId: z.string().min(1, 'Category is required'),
    subCategoryId: z.string().optional(),
    itemType: z
      .enum([
        'RAW_MATERIAL',
        'FINISHED_GOOD',
        'SEMI_FINISHED',
        'CONSUMABLE',
        'PACKAGING',
        'SERVICE',
        'OTHER',
      ])
      .optional(),
    baseUomId: z.string().min(1, 'Base UOM is required'),
    purchaseUomId: z.string().optional(),
    salesUomId: z.string().optional(),
    conversionFactor: z.number().positive().optional(),
    batchManaged: z.boolean().optional(),
    serialManaged: z.boolean().optional(),
    expiryManaged: z.boolean().optional(),
    qcRequired: z.boolean().optional(),
    reorderLevel: z.number().min(0).optional(),
    minimumStock: z.number().min(0).optional(),
    maximumStock: z.number().min(0).optional(),
    standardCost: z.number().min(0).optional(),
    sellingPrice: z.number().min(0).optional(),
    taxCodeId: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']).optional(),
    openingStock: z.number().min(0).optional(),
    initialStock: z.number().min(0).optional(),
    warehouseId: z.string().optional(),
    initialWarehouseId: z.string().optional(),
    initialUnitCost: z.number().min(0).optional(),
    batchNumber: z.string().optional(),
  }),
};

export const addStockSchema = {
  body: z.object({
    quantity: z.number().positive('Quantity must be greater than zero'),
    warehouseId: z.string().optional(),
    unitCost: z.number().min(0).optional(),
    batchNumber: z.string().optional(),
    notes: z.string().optional(),
  }),
};

export const updateItemSchema = {
  body: z.object({
    sku: z.string().min(2).optional(),
    name: z.string().min(2).optional(),
    description: z.string().optional(),
    categoryId: z.string().optional(),
    subCategoryId: z.string().optional(),
    itemType: z
      .enum([
        'RAW_MATERIAL',
        'FINISHED_GOOD',
        'SEMI_FINISHED',
        'CONSUMABLE',
        'PACKAGING',
        'SERVICE',
        'OTHER',
      ])
      .optional(),
    baseUomId: z.string().optional(),
    purchaseUomId: z.string().optional(),
    salesUomId: z.string().optional(),
    conversionFactor: z.number().positive().optional(),
    batchManaged: z.boolean().optional(),
    serialManaged: z.boolean().optional(),
    expiryManaged: z.boolean().optional(),
    qcRequired: z.boolean().optional(),
    reorderLevel: z.number().min(0).optional(),
    minimumStock: z.number().min(0).optional(),
    maximumStock: z.number().min(0).optional(),
    standardCost: z.number().min(0).optional(),
    sellingPrice: z.number().min(0).optional(),
    taxCodeId: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']).optional(),
  }),
};

// --- STOCK TRANSACTIONS VALIDATORS ---
export const receiveStockSchema = {
  body: z.object({
    itemId: z.string().min(1, 'Item is required'),
    warehouseId: z.string().min(1, 'Warehouse is required'),
    locationId: z.string().optional(),
    batchNumber: z.string().optional(),
    serialNumber: z.string().optional(),
    quantity: z.number().positive('Quantity must be greater than zero'),
    unitCost: z.number().min(0).optional(),
    reason: z.string().optional(),
  }),
};

export const issueStockSchema = {
  body: z.object({
    itemId: z.string().min(1, 'Item is required'),
    warehouseId: z.string().min(1, 'Warehouse is required'),
    locationId: z.string().optional(),
    batchNumber: z.string().optional(),
    serialNumber: z.string().optional(),
    quantity: z.number().positive('Quantity must be greater than zero'),
    reason: z.string().optional(),
  }),
};

// --- STOCK TRANSFER VALIDATORS ---
export const createStockTransferSchema = {
  body: z.object({
    fromWarehouseId: z.string().min(1, 'Source warehouse is required'),
    toWarehouseId: z.string().min(1, 'Destination warehouse is required'),
    fromLocationId: z.string().optional(),
    toLocationId: z.string().optional(),
    items: z
      .array(
        z.object({
          itemId: z.string().min(1, 'Item ID is required'),
          batchNumber: z.string().optional(),
          requestedQuantity: z.number().positive('Requested quantity must be positive'),
        })
      )
      .min(1, 'At least one item is required'),
    remarks: z.string().optional(),
  }),
};

export const receiveStockTransferSchema = {
  body: z.object({
    receivedQuantities: z.record(z.string(), z.number().min(0)).optional(),
  }),
};

// --- STOCK ADJUSTMENT VALIDATORS ---
export const createStockAdjustmentSchema = {
  body: z.object({
    warehouseId: z.string().min(1, 'Warehouse is required'),
    locationId: z.string().optional(),
    items: z
      .array(
        z.object({
          itemId: z.string().min(1, 'Item is required'),
          batchNumber: z.string().optional(),
          adjustedQuantity: z.number().min(0, 'Adjusted quantity cannot be negative'),
          reasonId: z.string().optional(),
          remarks: z.string().optional(),
        })
      )
      .min(1, 'At least one item is required'),
    reason: z.string().optional(),
    remarks: z.string().optional(),
  }),
};

// --- WASTAGE VALIDATORS ---
export const createWastageSchema = {
  body: z.object({
    warehouseId: z.string().min(1, 'Warehouse is required'),
    locationId: z.string().optional(),
    items: z
      .array(
        z.object({
          itemId: z.string().min(1, 'Item is required'),
          batchNumber: z.string().optional(),
          quantity: z.number().positive('Quantity must be greater than zero'),
          reasonId: z.string().optional(),
          remarks: z.string().optional(),
        })
      )
      .min(1, 'At least one item is required'),
    remarks: z.string().optional(),
  }),
};

// --- STOCK COUNT VALIDATORS ---
export const createStockCountSchema = {
  body: z.object({
    warehouseId: z.string().min(1, 'Warehouse is required'),
    countDate: z.string().datetime().optional(),
    assignedUsers: z.array(z.string()).optional(),
    itemIds: z.array(z.string()).optional(),
    remarks: z.string().optional(),
  }),
};

export const recordStockCountSchema = {
  body: z.object({
    items: z
      .array(
        z.object({
          _id: z.string().optional(),
          itemId: z.string().min(1, 'Item ID is required'),
          batchNumber: z.string().nullable().optional(),
          locationId: z.string().nullable().optional(),
          countedQuantity: z.number().min(0, 'Counted quantity cannot be negative'),
          reasonId: z.string().nullable().optional(),
          remarks: z.string().nullable().optional(),
        })
      )
      .min(1, 'At least one item count is required'),
  }),
};
