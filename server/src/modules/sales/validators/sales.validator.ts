import { z } from 'zod';

export const addressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
});

export const createSalesOrderSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  deliveryAddress: addressSchema.optional(),
  billingAddress: addressSchema.optional(),
  paymentTermId: z.string().optional(),
  orderDate: z.string().datetime().or(z.string().min(1)).optional(),
  requestedDeliveryDate: z.string().datetime().or(z.string().min(1)).optional(),
  currency: z.string().default('USD'),
  shippingAmount: z.number().nonnegative().optional().default(0),
  notes: z.string().max(1000).optional(),
  attachments: z.array(z.string()).optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1, 'Item is required'),
        description: z.string().optional(),
        orderedQuantity: z.number().positive('Ordered quantity must be greater than zero'),
        uomId: z.string().min(1, 'UOM is required'),
        unitPrice: z.number().nonnegative('Unit price must be non-negative'),
        discount: z.number().nonnegative().optional().default(0),
        taxRate: z.number().nonnegative().optional().default(0),
        remarks: z.string().optional(),
      })
    )
    .min(1, 'At least one line item is required in the sales order'),
});

export const updateSalesOrderSchema = createSalesOrderSchema.partial();

export const rejectSalesOrderSchema = z.object({
  reason: z.string().optional().default('Rejected by reviewer'),
});

export const cancelSalesOrderSchema = z.object({
  reason: z.string().optional().default('Cancelled by user'),
});

export const createPackageSchema = z.object({
  salesOrderId: z.string().min(1, 'Sales Order ID is required'),
  packingMaterial: z.string().optional(),
  totalWeight: z.number().nonnegative().optional(),
  dimensions: z
    .object({
      length: z.number().nonnegative().optional(),
      width: z.number().nonnegative().optional(),
      height: z.number().nonnegative().optional(),
    })
    .optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1, 'Item ID is required'),
        quantity: z.number().positive('Quantity must be greater than zero'),
        uomId: z.string().min(1, 'UOM is required'),
        batchNumber: z.string().optional(),
        serialNumbers: z.array(z.string()).optional(),
        weight: z.number().nonnegative().optional(),
        remarks: z.string().optional(),
      })
    )
    .min(1, 'At least one line item is required in the package'),
});

export const createDispatchSchema = z.object({
  salesOrderId: z.string().min(1, 'Sales Order ID is required'),
  packageIds: z.array(z.string().min(1)).min(1, 'At least one package is required'),
  carrier: z.string().optional(),
  vehicleNumber: z.string().optional(),
  driverName: z.string().optional(),
  driverContact: z.string().optional(),
  trackingNumber: z.string().optional(),
  shippingAddress: addressSchema.optional(),
  dispatchDate: z.string().datetime().or(z.string().min(1)).optional(),
  remarks: z.string().optional(),
});

export const createGatePassSchema = z.object({
  salesOrderId: z.string().min(1, 'Sales Order ID is required'),
  dispatchId: z.string().min(1, 'Dispatch ID is required'),
  invoiceId: z.string().optional(),
  vehicleNumber: z.string().optional(),
  driverName: z.string().optional(),
  driverContact: z.string().optional(),
  remarks: z.string().optional(),
});

export const gateOutSchema = z.object({
  notes: z.string().optional(),
});

export const createInvoiceSchema = z.object({
  salesOrderId: z.string().min(1, 'Sales Order ID is required'),
  dispatchId: z.string().optional(),
  invoiceDate: z.string().datetime().or(z.string().min(1)).optional(),
  dueDate: z.string().datetime().or(z.string().min(1, 'Due date is required')),
  paymentTermId: z.string().optional(),
  shippingAmount: z.number().nonnegative().optional().default(0),
  roundOff: z.number().optional().default(0),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1, 'Item ID is required'),
        description: z.string().optional(),
        quantity: z.number().positive('Quantity must be greater than zero'),
        uomId: z.string().min(1, 'UOM is required'),
        unitPrice: z.number().nonnegative('Unit price must be non-negative'),
        discount: z.number().nonnegative().optional().default(0),
        taxRate: z.number().nonnegative().optional().default(0),
        batchNumber: z.string().optional(),
        serialNumbers: z.array(z.string()).optional(),
      })
    )
    .min(1, 'At least one line item is required in the invoice'),
});

export const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  paymentDate: z.string().datetime().or(z.string().min(1)).optional(),
  amount: z.number().positive('Payment amount must be greater than zero'),
  paymentMethod: z
    .enum(['CASH', 'BANK_TRANSFER', 'CARD', 'ONLINE_PAYMENT', 'OTHER'])
    .default('BANK_TRANSFER'),
  paymentReference: z.string().optional(),
  currency: z.string().default('USD'),
  notes: z.string().optional(),
});

export const reversePaymentSchema = z.object({
  reason: z.string().min(3, 'Reversal reason must be at least 3 characters'),
});
