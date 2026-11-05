import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const objectIdOrObject = z.union([
  z.string().regex(objectIdRegex, 'Invalid ObjectId'),
  z.object({ _id: z.string().regex(objectIdRegex) }).transform((o) => o._id),
]);

const optionalObjectIdOrObject = z
  .union([
    z.string().regex(objectIdRegex, 'Invalid ObjectId'),
    z.object({ _id: z.string().regex(objectIdRegex) }).transform((o) => o._id),
    z.literal(''),
    z.null(),
  ])
  .optional()
  .nullable()
  .transform((val) => {
    if (!val) return undefined;
    if (typeof val === 'object' && '_id' in val) return (val as any)._id;
    return val === '' ? undefined : val;
  });

export const bomComponentSchema = z.object({
  itemId: objectIdOrObject,
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  uomId: optionalObjectIdOrObject,
  scrapPercentage: z.coerce.number().min(0).max(100).default(0),
  sequence: z.coerce.number().int().positive().default(10),
  operationCode: z.string().trim().optional().nullable().transform((v) => v || undefined),
  remarks: z.string().trim().optional().nullable().transform((v) => v || undefined),
});

export const createBOMSchema = z.object({
  name: z.string().min(2, 'BOM name must be at least 2 characters').trim(),
  finishedItemId: objectIdOrObject,
  description: z.string().trim().optional().nullable().transform((v) => v || undefined),
  quantity: z.coerce.number().positive('Quantity must be greater than zero').default(1),
  uomId: optionalObjectIdOrObject,
  components: z.array(bomComponentSchema).min(1, 'At least one component is required'),
  effectiveFrom: z.union([z.string(), z.date(), z.literal(''), z.null()]).optional().nullable(),
  effectiveTo: z.union([z.string(), z.date(), z.literal(''), z.null()]).optional().nullable(),
  isDefault: z.boolean().default(false),
  routingNotes: z.string().trim().optional().nullable().transform((v) => v || undefined),
});

export const updateBOMSchema = createBOMSchema.partial();

export const createProductionOrderSchema = z.object({
  productionItemId: z.string().regex(objectIdRegex, 'Invalid production Item ID'),
  bomId: z.string().regex(objectIdRegex, 'Invalid BOM ID'),
  plannedQuantity: z.number().positive('Planned quantity must be greater than zero'),
  warehouseId: z.string().regex(objectIdRegex, 'Invalid Warehouse ID'),
  productionLocation: z.string().trim().optional(),
  plannedStartDate: z.string().optional().or(z.literal('')),
  plannedEndDate: z.string().optional().or(z.literal('')),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  notes: z.string().trim().optional(),
});

export const updateProductionOrderSchema = createProductionOrderSchema.partial();

export const cancelProductionOrderSchema = z.object({
  reason: z.string().min(3, 'Cancellation reason required').trim(),
});

export const consumeMaterialSchema = z.object({
  itemId: z.string().regex(objectIdRegex, 'Invalid Item ID'),
  quantity: z.number().positive('Consumed quantity must be greater than zero'),
  batchNumber: z.string().trim().optional(),
  warehouseId: z.string().regex(objectIdRegex, 'Invalid Warehouse ID').optional().or(z.literal('')),
  scrapQuantity: z.number().min(0).default(0),
  remarks: z.string().trim().optional(),
});

export const returnMaterialSchema = z.object({
  itemId: z.string().regex(objectIdRegex, 'Invalid Item ID'),
  quantity: z.number().positive('Returned quantity must be greater than zero'),
  batchNumber: z.string().trim().optional(),
  warehouseId: z.string().regex(objectIdRegex, 'Invalid Warehouse ID').optional().or(z.literal('')),
  remarks: z.string().trim().optional(),
});

export const recordOutputSchema = z.object({
  producedQuantity: z.number().positive('Produced quantity must be greater than zero'),
  acceptedQuantity: z.number().min(0).optional(),
  rejectedQuantity: z.number().min(0).optional(),
  scrapQuantity: z.number().min(0).default(0),
  scrapReason: z.string().trim().optional(),
  wastageQuantity: z.number().min(0).default(0),
  wastageReason: z.string().trim().optional(),
  batchNumber: z.string().trim().optional(),
  expiryDate: z.string().optional().or(z.literal('')),
  warehouseId: z.string().regex(objectIdRegex, 'Invalid Warehouse ID').optional().or(z.literal('')),
  qcStatus: z.enum(['PENDING', 'PASSED', 'FAILED', 'DISPOSITIONED']).optional(),
  notes: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
});

export const createProductionQCSchema = z.object({
  productionOrderId: z.string().regex(objectIdRegex, 'Invalid Production Order ID'),
  inspectedQuantity: z.number().positive('Inspected quantity must be greater than zero'),
  batchNumber: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
});

export const qcResultItemSchema = z.object({
  parameter: z.string().min(1, 'Parameter name required').trim(),
  expected: z.string().trim().optional(),
  actual: z.string().trim().optional(),
  status: z.enum(['PASS', 'FAIL', 'NA']),
});

export const inspectProductionQCSchema = z.object({
  results: z.array(qcResultItemSchema).min(1, 'At least one inspection parameter result is required'),
  overallResult: z.enum(['PASS', 'FAIL', 'CONDITIONAL', 'HOLD']),
  remarks: z.string().trim().optional(),
});

export const dispositionProductionQCSchema = z.object({
  disposition: z.enum(['ACCEPT', 'REJECT', 'HOLD', 'REWORK', 'SCRAP']),
  acceptedQuantity: z.number().min(0),
  rejectedQuantity: z.number().min(0).default(0),
  heldQuantity: z.number().min(0).default(0),
  reworkQuantity: z.number().min(0).default(0),
  dispositionNotes: z.string().min(3, 'Disposition notes required').trim(),
});

export const createProductionOutputSchema = z.object({
  productionOrderId: z.string().regex(objectIdRegex, 'Invalid Production Order ID'),
  producedQuantity: z.number().positive('Produced quantity must be greater than zero'),
  acceptedQuantity: z.number().min(0).optional(),
  rejectedQuantity: z.number().min(0).optional(),
  scrapQuantity: z.number().min(0).default(0),
  scrapReason: z.string().trim().optional(),
  wastageQuantity: z.number().min(0).default(0),
  wastageReason: z.string().trim().optional(),
  batchNumber: z.string().trim().optional(),
  expiryDate: z.string().optional(),
  warehouseId: z.string().regex(objectIdRegex, 'Invalid Warehouse ID').optional(),
  qcStatus: z.enum(['PENDING', 'PASSED', 'FAILED', 'DISPOSITIONED']).optional(),
  remarks: z.string().trim().optional(),
});

