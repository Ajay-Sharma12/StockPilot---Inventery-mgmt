import { Schema, model, Document, Types } from 'mongoose';

export type POStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'SENT'
  | 'PARTIALLY_RECEIVED'
  | 'FULLY_RECEIVED'
  | 'CLOSED'
  | 'CANCELLED';

export interface IPOItem {
  _id?: Types.ObjectId;
  itemId: Types.ObjectId;
  description?: string;
  quantity: number;
  uomId: Types.ObjectId;
  unitPrice: number;
  discount: number;
  tax: number;
  lineTotal: number;
  expectedDeliveryDate?: Date;
  receivedQuantity: number;
  pendingQuantity: number;
  remarks?: string;
}

export interface IPORevision {
  revisionNumber: number;
  previousValues: Record<string, any>;
  changedFields: string[];
  reason: string;
  changedBy: Types.ObjectId;
  changedAt: Date;
}

export interface IPurchaseOrder extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  poNumber: string;
  supplierId: Types.ObjectId;
  sourceQuoteId?: Types.ObjectId;
  sourceRFQId?: Types.ObjectId;
  sourcePRIds: Types.ObjectId[];
  orderDate: Date;
  expectedDeliveryDate: Date;
  warehouseId: Types.ObjectId;
  paymentTermsId?: Types.ObjectId;
  currency: string;
  shippingTerms?: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes?: string;
  attachments?: string[];
  status: POStatus;
  revisions: IPORevision[];
  items: IPOItem[];
  emailSent?: boolean;
  smsSent?: boolean;
  notifiedAt?: Date;
  sentAt?: Date;
  createdBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  rejectedBy?: Types.ObjectId;
  rejectedAt?: Date;
  rejectionReason?: string;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const poItemSchema = new Schema<IPOItem>(
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
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    expectedDeliveryDate: {
      type: Date,
    },
    receivedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    pendingQuantity: {
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

const poRevisionSchema = new Schema<IPORevision>(
  {
    revisionNumber: { type: Number, required: true },
    previousValues: { type: Schema.Types.Mixed, required: true },
    changedFields: [{ type: String, required: true }],
    reason: { type: String, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const purchaseOrderSchema = new Schema<IPurchaseOrder>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    poNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true,
    },
    sourceQuoteId: {
      type: Schema.Types.ObjectId,
      ref: 'SupplierQuote',
    },
    sourceRFQId: {
      type: Schema.Types.ObjectId,
      ref: 'RFQ',
    },
    sourcePRIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'PurchaseRequisition',
      },
    ],
    orderDate: {
      type: Date,
      default: Date.now,
    },
    expectedDeliveryDate: {
      type: Date,
      required: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
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
    subtotal: {
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
    total: {
      type: Number,
      required: true,
      min: 0,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    attachments: [
      {
        type: String,
      },
    ],
    status: {
      type: String,
      enum: [
        'DRAFT',
        'SUBMITTED',
        'APPROVED',
        'REJECTED',
        'SENT',
        'PARTIALLY_RECEIVED',
        'FULLY_RECEIVED',
        'CLOSED',
        'CANCELLED',
      ],
      default: 'DRAFT',
      index: true,
    },
    items: [poItemSchema],
    revisions: [poRevisionSchema],
    emailSent: {
      type: Boolean,
      default: false,
    },
    smsSent: {
      type: Boolean,
      default: false,
    },
    notifiedAt: {
      type: Date,
    },
    sentAt: {
      type: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
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

purchaseOrderSchema.index({ tenantId: 1, poNumber: 1 }, { unique: true });
purchaseOrderSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
purchaseOrderSchema.index({ tenantId: 1, supplierId: 1, createdAt: -1 });
purchaseOrderSchema.index({ tenantId: 1, warehouseId: 1 });

export const PurchaseOrder = model<IPurchaseOrder>('PurchaseOrder', purchaseOrderSchema);
