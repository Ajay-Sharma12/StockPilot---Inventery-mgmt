import { Schema, model, Document, Types } from 'mongoose';

export type RFQStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'PARTIALLY_RESPONDED'
  | 'FULLY_RESPONDED'
  | 'CLOSED'
  | 'CANCELLED';

export type RFQSupplierStatus = 'INVITED' | 'QUOTED' | 'DECLINED';

export interface IRFQSupplier {
  _id?: Types.ObjectId;
  supplierId: Types.ObjectId;
  contact?: string;
  issueDate?: Date;
  responseDeadline?: Date;
  status: RFQSupplierStatus;
  remarks?: string;
  emailSent?: boolean;
  smsSent?: boolean;
  notifiedAt?: Date;
}

export interface IRFQItem {
  _id?: Types.ObjectId;
  itemId: Types.ObjectId;
  prLineId?: Types.ObjectId;
  description?: string;
  quantity: number;
  uomId: Types.ObjectId;
  requestedDeliveryDate?: Date;
  specifications?: string;
  remarks?: string;
}

export interface IRFQ extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  rfqNumber: string;
  sourceType: 'PURCHASE_REQUISITION' | 'MANUAL';
  sourceId?: Types.ObjectId;
  sourcePRIds: Types.ObjectId[];
  issueDate: Date;
  responseDeadline: Date;
  requestedDeliveryDate?: Date;
  terms?: string;
  notes?: string;
  attachments?: string[];
  status: RFQStatus;
  suppliers: IRFQSupplier[];
  items: IRFQItem[];
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const rfqSupplierSchema = new Schema<IRFQSupplier>(
  {
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
    },
    contact: {
      type: String,
      trim: true,
    },
    issueDate: {
      type: Date,
    },
    responseDeadline: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['INVITED', 'QUOTED', 'DECLINED'],
      default: 'INVITED',
    },
    remarks: {
      type: String,
      trim: true,
    },
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
  },
  { _id: true }
);

const rfqItemSchema = new Schema<IRFQItem>(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
    },
    prLineId: {
      type: Schema.Types.ObjectId,
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
    requestedDeliveryDate: {
      type: Date,
    },
    specifications: {
      type: String,
      trim: true,
    },
    remarks: {
      type: String,
      trim: true,
    },
  },
  { _id: true }
);

const rfqSchema = new Schema<IRFQ>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    rfqNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    sourceType: {
      type: String,
      enum: ['PURCHASE_REQUISITION', 'MANUAL'],
      default: 'MANUAL',
      index: true,
    },
    sourceId: {
      type: Schema.Types.ObjectId,
      ref: 'PurchaseRequisition',
    },
    sourcePRIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'PurchaseRequisition',
      },
    ],
    issueDate: {
      type: Date,
      default: Date.now,
    },
    responseDeadline: {
      type: Date,
      required: true,
    },
    requestedDeliveryDate: {
      type: Date,
    },
    terms: {
      type: String,
      trim: true,
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
      enum: ['DRAFT', 'ISSUED', 'PARTIALLY_RESPONDED', 'FULLY_RESPONDED', 'CLOSED', 'CANCELLED'],
      default: 'DRAFT',
      index: true,
    },
    suppliers: [rfqSupplierSchema],
    items: [rfqItemSchema],
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

rfqSchema.index({ tenantId: 1, rfqNumber: 1 }, { unique: true });
rfqSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

export const RFQ = model<IRFQ>('RFQ', rfqSchema);
