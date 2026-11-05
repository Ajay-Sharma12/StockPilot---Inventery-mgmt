import { z } from 'zod';

export const createPRSchema = z.object({
  departmentId: z.string().optional(),
  warehouseId: z.string().min(1, 'Warehouse ID is required'),
  requiredDate: z.string().datetime().or(z.string().min(1, 'Required date is required')),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  purpose: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  attachments: z.array(z.string()).optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1, 'Item is required'),
        description: z.string().optional(),
        requestedQuantity: z.number().positive('Quantity must be greater than 0'),
        uomId: z.string().min(1, 'UOM is required'),
        estimatedUnitPrice: z.number().nonnegative().optional().default(0),
        requiredDate: z.string().optional(),
        remarks: z.string().optional(),
      })
    )
    .min(1, 'At least one item is required in the requisition'),
});

export const updatePRSchema = createPRSchema.partial();

export const approvePRSchema = z.object({
  approvalComment: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        approvedQuantity: z.number().nonnegative(),
      })
    )
    .optional(),
});

export const issuePRStockSchema = z.object({
  itemsToIssue: z
    .array(
      z.object({
        itemId: z.string().min(1, 'Item ID is required'),
        quantity: z.number().positive('Quantity to issue must be greater than 0'),
        locationId: z.string().optional(),
        batchNumber: z.string().optional(),
        remarks: z.string().optional(),
      })
    )
    .min(1, 'At least one item must be issued'),
  remarks: z.string().max(500).optional(),
});

export const cancelPRSchema = z.object({
  reason: z.string().min(3, 'Cancellation reason is required (min 3 characters)'),
});

export const rejectPRSchema = z.object({
  reason: z.string().min(3, 'Rejection reason is required (min 3 characters)'),
});

export const createRFQSchema = z.object({
  sourceType: z.enum(['PURCHASE_REQUISITION', 'MANUAL']).default('MANUAL'),
  sourceId: z.string().optional(),
  sourcePRIds: z.array(z.string()).optional().default([]),
  responseDeadline: z.string().datetime().or(z.string().min(1, 'Response deadline is required')),
  requestedDeliveryDate: z.string().optional(),
  terms: z.string().optional(),
  notes: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  suppliers: z
    .array(
      z.object({
        supplierId: z.string().min(1, 'Supplier is required'),
        contact: z.string().optional(),
        remarks: z.string().optional(),
      })
    )
    .min(1, 'At least one supplier must be invited'),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1, 'Item is required'),
        prLineId: z.string().optional(),
        description: z.string().optional(),
        quantity: z.number().positive('Quantity must be greater than 0'),
        uomId: z.string().min(1, 'UOM is required'),
        requestedDeliveryDate: z.string().optional(),
        specifications: z.string().optional(),
        remarks: z.string().optional(),
      })
    )
    .min(1, 'At least one line item is required in the RFQ'),
});

export const updateRFQSchema = createRFQSchema.partial();

export const createSupplierQuoteSchema = z.object({
  rfqId: z.string().min(1, 'RFQ reference is required'),
  supplierId: z.string().min(1, 'Supplier is required'),
  validityDate: z.string().datetime().or(z.string().min(1, 'Validity date is required')),
  deliveryDate: z.string().optional(),
  paymentTermsId: z.string().optional(),
  currency: z.string().default('USD'),
  shippingTerms: z.string().optional(),
  discount: z.number().nonnegative().optional().default(0),
  tax: z.number().nonnegative().optional().default(0),
  notes: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1, 'Item is required'),
        rfqLineId: z.string().optional(),
        quantity: z.number().positive('Quantity must be greater than 0'),
        uomId: z.string().min(1, 'UOM is required'),
        unitPrice: z.number().nonnegative('Unit price must be non-negative'),
        discount: z.number().nonnegative().optional().default(0),
        tax: z.number().nonnegative().optional().default(0),
        deliveryDays: z.number().nonnegative().optional().default(0),
        remarks: z.string().optional(),
      })
    )
    .min(1, 'At least one quoted line item is required'),
});

export const finalizeQuoteSchema = z.object({
  selectionReason: z.string().min(3, 'Selection reason is required (min 3 characters)'),
});

export const createPOSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  warehouseId: z.string().min(1, 'Delivery warehouse is required'),
  expectedDeliveryDate: z.string().datetime().or(z.string().min(1, 'Expected delivery date is required')),
  sourceQuoteId: z.string().optional(),
  sourceRFQId: z.string().optional(),
  sourcePRIds: z.array(z.string()).optional().default([]),
  paymentTermsId: z.string().optional(),
  currency: z.string().default('USD'),
  shippingTerms: z.string().optional(),
  discount: z.number().nonnegative().optional().default(0),
  tax: z.number().nonnegative().optional().default(0),
  notes: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1, 'Item is required'),
        description: z.string().optional(),
        quantity: z.number().positive('Quantity must be greater than 0'),
        uomId: z.string().min(1, 'UOM is required'),
        unitPrice: z.number().nonnegative('Unit price must be non-negative'),
        discount: z.number().nonnegative().optional().default(0),
        tax: z.number().nonnegative().optional().default(0),
        expectedDeliveryDate: z.string().optional(),
        remarks: z.string().optional(),
      })
    )
    .min(1, 'At least one line item is required in the PO'),
});

export const updatePOSchema = createPOSchema.partial().extend({
  revisionReason: z.string().optional(),
});

export const rejectPOSchema = z.object({
  reason: z.string().min(3, 'Rejection reason is required (min 3 characters)'),
});

export const createGRNSchema = z.object({
  purchaseOrderId: z.string().min(1, 'Purchase Order reference is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  receiptDate: z.string().optional(),
  deliveryChallanNumber: z.string().optional(),
  deliveryChallanDate: z.string().optional(),
  transporterName: z.string().optional(),
  vehicleNumber: z.string().optional(),
  lrNumber: z.string().optional(),
  packageCount: z.number().int().nonnegative().optional(),
  notifySupplier: z.boolean().optional(),
  recipientEmail: z.string().email().optional().or(z.literal('')),
  recipientPhone: z.string().optional(),
  remarks: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1, 'Item is required'),
        poLineId: z.string().min(1, 'PO line reference is required'),
        receivedQuantity: z.number().positive('Received quantity must be greater than 0'),
        uomId: z.string().min(1, 'UOM is required'),
        batchNumber: z.string().optional(),
        manufacturingDate: z.string().optional(),
        expiryDate: z.string().optional(),
        qcRequired: z.boolean().optional(),
        remarks: z.string().optional(),
      })
    )
    .min(1, 'At least one item must be received in the GRN'),
});

export const cancelGRNSchema = z.object({
  reason: z.string().min(3, 'Cancellation reason is required (min 3 characters)'),
});

export const createQCSchema = z.object({
  grnId: z.string().min(1, 'GRN reference is required'),
  grnLineId: z.string().min(1, 'GRN line reference is required'),
  itemId: z.string().min(1, 'Item reference is required'),
  batchNumber: z.string().optional(),
  inspectedQuantity: z.number().positive('Inspected quantity must be greater than 0'),
  templateId: z.string().optional(),
  results: z
    .array(
      z.object({
        parameter: z.string().min(1, 'Parameter name is required'),
        expected: z.string().optional(),
        actual: z.string().optional(),
        status: z.enum(['PASS', 'FAIL', 'NA']).default('PASS'),
      })
    )
    .optional()
    .default([]),
  overallResult: z.enum(['PASS', 'FAIL', 'CONDITIONAL', 'HOLD']),
  remarks: z.string().optional(),
});

export const dispositionQCSchema = z
  .object({
    acceptedQuantity: z.number().nonnegative('Accepted quantity must be non-negative'),
    rejectedQuantity: z.number().nonnegative('Rejected quantity must be non-negative'),
    heldQuantity: z.number().nonnegative('Held quantity must be non-negative'),
    locationId: z.string().optional(),
    dispositionNotes: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) =>
      Boolean(
        (data.dispositionNotes && data.dispositionNotes.trim().length >= 2) ||
        (data.notes && data.notes.trim().length >= 2)
      ),
    {
      message: 'Disposition notes are required (minimum 2 characters)',
      path: ['dispositionNotes'],
    }
  );
