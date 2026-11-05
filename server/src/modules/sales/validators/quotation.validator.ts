import { z } from 'zod';

export const quotationItemSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
  description: z.string().optional(),
  quantity: z.number().positive('Quantity must be greater than zero'),
  uomId: z.string().min(1, 'UOM is required'),
  unitPrice: z.number().nonnegative('Unit price must be non-negative'),
  discount: z.number().nonnegative().optional().default(0),
  taxRate: z.number().nonnegative().optional().default(0),
  remarks: z.string().optional(),
});

export const createQuotationSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  warehouseId: z.string().min(1, 'Fulfillment warehouse is required'),
  validUntil: z.string().min(1, 'Validity date is required'),
  currency: z.string().optional().default('USD'),
  shippingAmount: z.number().nonnegative().optional().default(0),
  termsAndConditions: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(quotationItemSchema).min(1, 'At least one line item is required'),
});

export const updateQuotationSchema = z.object({
  customerId: z.string().optional(),
  warehouseId: z.string().optional(),
  validUntil: z.string().optional(),
  currency: z.string().optional(),
  shippingAmount: z.number().nonnegative().optional(),
  termsAndConditions: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(quotationItemSchema).optional(),
});

export const rejectQuotationSchema = z.object({
  reason: z.string().min(2, 'Rejection reason must be at least 2 characters'),
});
