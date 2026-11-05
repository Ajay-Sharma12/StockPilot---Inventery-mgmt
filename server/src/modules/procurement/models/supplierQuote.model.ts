import { Schema, model, Document, Types } from 'mongoose';

export type SupplierQuoteStatus =
  | 'DRAFT'
  | 'RECEIVED'
  | 'UNDER_REVIEW'
  | 'SELECTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface ISupplierQuoteItem {
  _id?: Types.ObjectId;
  itemId: Types.ObjectId;
  rfqLineId?: Types.ObjectId;
  quantity: number;
  uomId: Types.ObjectId;
  unitPrice: number;
  discount: number;
  tax: number;
  deliveryDays?: number;
  lineTotal: number;
  remarks?: string;
}

export interface ISupplierQuote extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  quoteNumber: string;
  rfqId: Types.ObjectId;
  supplierId: Types.ObjectId;
  quoteDate: Date;
  validityDate: Date;
  deliveryDate?: Date;
  paymentTermsId?: Types.ObjectId;
  currency: string;
  shippingTerms?: string;
  discount: number;
  tax: number;
  subtotal: number;
  total: number;
  items: ISupplierQuoteItem[];
  attachments?: string[];
  notes?: string;
  status: SupplierQuoteStatus;
  submittedAt?: Date;
  finalizedAt?: Date;
  finalizedBy?: Types.ObjectId;
  selectionReason?: string;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const quoteItemSchema = new Schema<ISupplierQuoteItem>(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
    },
    rfqLineId: {
      type: Schema.Types.ObjectId,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.0001,
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
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    deliveryDays: {
      type: Number,
      default: 0,
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    remarks: {
      type: String,
      trim: true,
    },
  },
  { _id: true }
);

const supplierQuoteSchema = new Schema<ISupplierQuote>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    quoteNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    rfqId: {
      type: Schema.Types.ObjectId,
      ref: 'RFQ',
      required: true,
      index: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true,
    },
    quoteDate: {
      type: Date,
      default: Date.now,
    },
    validityDate: {
      type: Date,
      required: true,
    },
    deliveryDate: {
      type: Date,
    },
    paymentTermsId: {
      type: Schema.Types.ObjectId,
      ref: 'PaymentTerm',
    },
    currency: {
      type: String,
      default: 'USD',
    },
    shippingTerms: {
      type: String,
      trim: true,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    items: [quoteItemSchema],
    attachments: [
      {
        type: String,
      },
    ],
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'RECEIVED', 'UNDER_REVIEW', 'SELECTED', 'REJECTED', 'EXPIRED', 'CANCELLED'],
      default: 'RECEIVED',
      index: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    finalizedAt: {
      type: Date,
    },
    finalizedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    selectionReason: {
      type: String,
      trim: true,
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

supplierQuoteSchema.index({ tenantId: 1, quoteNumber: 1 }, { unique: true });
supplierQuoteSchema.index({ tenantId: 1, rfqId: 1 });
supplierQuoteSchema.index({ tenantId: 1, supplierId: 1 });
supplierQuoteSchema.index({ tenantId: 1, status: 1 });

export const SupplierQuote = model<ISupplierQuote>('SupplierQuote', supplierQuoteSchema);
