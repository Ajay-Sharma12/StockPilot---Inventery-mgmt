import { Schema, model, Document, Types } from 'mongoose';

export type QuotationStatus =
  | 'DRAFT'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CONVERTED';

export interface IQuotationItem {
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
  remarks?: string;
}

export interface IQuotation extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  quotationNumber: string;
  customerId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  quotationDate: Date;
  validUntil: Date;
  currency: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingAmount: number;
  grandTotal: number;
  items: IQuotationItem[];
  termsAndConditions?: string;
  notes?: string;
  status: QuotationStatus;
  convertedSalesOrderId?: Types.ObjectId;
  sentAt?: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  publicToken?: string;
  clientFeedback?: string;
  clientAcceptedAt?: Date;
  clientRejectedAt?: Date;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const quotationItemSchema = new Schema<IQuotationItem>(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
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
      min: [0, 'Unit price cannot be negative'],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
    },
    taxRate: {
      type: Number,
      default: 0,
      min: [0, 'Tax rate cannot be negative'],
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
    remarks: {
      type: String,
      trim: true,
    },
  },
  { _id: true }
);

const quotationSchema = new Schema<IQuotation>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    quotationNumber: {
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
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
    },
    quotationDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    validUntil: {
      type: Date,
      required: true,
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      trim: true,
    },
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
    grandTotal: {
      type: Number,
      required: true,
      default: 0,
    },
    items: {
      type: [quotationItemSchema],
      required: true,
      validate: [(val: any[]) => val.length > 0, 'Quotation must have at least one line item'],
    },
    termsAndConditions: {
      type: String,
      trim: true,
      default: '1. Prices are valid until expiration date. 2. Standard commercial delivery terms apply.',
    },
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'],
      default: 'DRAFT',
      index: true,
    },
    convertedSalesOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'SalesOrder',
    },
    sentAt: Date,
    acceptedAt: Date,
    rejectedAt: Date,
    rejectionReason: String,
    publicToken: {
      type: String,
      index: true,
      sparse: true,
    },
    clientFeedback: String,
    clientAcceptedAt: Date,
    clientRejectedAt: Date,
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

quotationSchema.index({ tenantId: 1, quotationNumber: 1 }, { unique: true });
quotationSchema.index({ tenantId: 1, status: 1 });
quotationSchema.index({ tenantId: 1, customerId: 1 });

export const Quotation = model<IQuotation>('Quotation', quotationSchema);
