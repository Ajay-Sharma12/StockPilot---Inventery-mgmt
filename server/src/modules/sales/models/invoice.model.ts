import { Schema, model, Document, Types } from 'mongoose';

export type InvoiceStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'VOID';

export interface IInvoiceItem {
  _id?: Types.ObjectId;
  itemId: Types.ObjectId;
  description?: string;
  quantity: number;
  uomId: Types.ObjectId;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  lineSubtotal: number;
  lineTotal: number;
  batchNumber?: string;
  serialNumbers?: string[];
}

export interface IInvoice extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  invoiceNumber: string;
  customerId: Types.ObjectId;
  salesOrderId: Types.ObjectId;
  dispatchId?: Types.ObjectId;
  invoiceDate: Date;
  dueDate: Date;
  paymentTermId?: Types.ObjectId;
  currency: string;
  items: IInvoiceItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingAmount: number;
  roundOff: number;
  grandTotal: number;
  paidAmount: number;
  outstandingAmount: number;
  status: InvoiceStatus;
  notes?: string;
  issuedAt?: Date;
  issuedBy?: Types.ObjectId;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceItemSchema = new Schema<IInvoiceItem>({
  itemId: {
    type: Schema.Types.ObjectId,
    ref: 'Item',
    required: true,
  },
  description: String,
  quantity: {
    type: Number,
    required: true,
    min: [0.0001, 'Quantity must be greater than zero'],
  },
  uomId: {
    type: Schema.Types.ObjectId,
    ref: 'UOM',
    required: true,
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  discount: {
    type: Number,
    default: 0,
  },
  taxRate: {
    type: Number,
    default: 0,
  },
  taxAmount: {
    type: Number,
    default: 0,
  },
  lineSubtotal: {
    type: Number,
    required: true,
  },
  lineTotal: {
    type: Number,
    required: true,
  },
  batchNumber: String,
  serialNumbers: [String],
});

const invoiceSchema = new Schema<IInvoice>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    salesOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'SalesOrder',
      required: true,
      index: true,
    },
    dispatchId: {
      type: Schema.Types.ObjectId,
      ref: 'Dispatch',
    },
    invoiceDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    paymentTermId: {
      type: Schema.Types.ObjectId,
      ref: 'PaymentTerm',
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
    },
    items: [invoiceItemSchema],
    subtotal: {
      type: Number,
      required: true,
      default: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    shippingAmount: {
      type: Number,
      default: 0,
    },
    roundOff: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      default: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    outstandingAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'VOID'],
      default: 'DRAFT',
      index: true,
    },
    notes: String,
    issuedAt: Date,
    issuedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

invoiceSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ tenantId: 1, customerId: 1, status: 1 });
invoiceSchema.index({ tenantId: 1, dueDate: 1 });

export const Invoice = model<IInvoice>('Invoice', invoiceSchema);
