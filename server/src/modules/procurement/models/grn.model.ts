import { Schema, model, Document, Types } from 'mongoose';

export type GRNStatus =
  | 'DRAFT'
  | 'RECEIVED'
  | 'QC_PENDING'
  | 'PARTIALLY_ACCEPTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface IGRNItem {
  _id?: Types.ObjectId;
  itemId: Types.ObjectId;
  poLineId: Types.ObjectId;
  orderedQuantity: number;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  heldQuantity: number;
  pendingQuantity: number;
  uomId: Types.ObjectId;
  batchNumber?: string;
  manufacturingDate?: Date;
  expiryDate?: Date;
  qcRequired: boolean;
  remarks?: string;
}

export interface IGoodsReceiptNote extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  grnNumber: string;
  purchaseOrderId: Types.ObjectId;
  supplierId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  receiptDate: Date;
  receivedBy: Types.ObjectId;
  status: GRNStatus;
  deliveryChallanNumber?: string;
  deliveryChallanDate?: Date;
  transporterName?: string;
  vehicleNumber?: string;
  lrNumber?: string;
  packageCount?: number;
  supplierNotifiedEmail?: boolean;
  supplierNotifiedSMS?: boolean;
  notifiedAt?: Date;
  cancellationReason?: string;
  remarks?: string;
  attachments?: string[];
  items: IGRNItem[];
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const grnItemSchema = new Schema<IGRNItem>(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
    },
    poLineId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    orderedQuantity: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    receivedQuantity: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    acceptedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    rejectedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    heldQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    pendingQuantity: {
      type: Number,
      default: 0,
    },
    uomId: {
      type: Schema.Types.ObjectId,
      ref: 'UOM',
      required: true,
    },
    batchNumber: {
      type: String,
      trim: true,
    },
    manufacturingDate: {
      type: Date,
    },
    expiryDate: {
      type: Date,
    },
    qcRequired: {
      type: Boolean,
      default: false,
    },
    remarks: {
      type: String,
      trim: true,
    },
  },
  { _id: true }
);

const goodsReceiptNoteSchema = new Schema<IGoodsReceiptNote>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    grnNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    purchaseOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      required: true,
      index: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    receiptDate: {
      type: Date,
      default: Date.now,
    },
    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: [
        'DRAFT',
        'RECEIVED',
        'QC_PENDING',
        'PARTIALLY_ACCEPTED',
        'ACCEPTED',
        'REJECTED',
        'COMPLETED',
        'CANCELLED',
      ],
      default: 'DRAFT',
      index: true,
    },
    deliveryChallanNumber: {
      type: String,
      trim: true,
    },
    deliveryChallanDate: {
      type: Date,
    },
    transporterName: {
      type: String,
      trim: true,
    },
    vehicleNumber: {
      type: String,
      trim: true,
    },
    lrNumber: {
      type: String,
      trim: true,
    },
    packageCount: {
      type: Number,
      min: 0,
    },
    supplierNotifiedEmail: {
      type: Boolean,
      default: false,
    },
    supplierNotifiedSMS: {
      type: Boolean,
      default: false,
    },
    notifiedAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    remarks: {
      type: String,
      trim: true,
    },
    attachments: [
      {
        type: String,
      },
    ],
    items: [grnItemSchema],
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

goodsReceiptNoteSchema.index({ tenantId: 1, grnNumber: 1 }, { unique: true });
goodsReceiptNoteSchema.index({ tenantId: 1, purchaseOrderId: 1 });
goodsReceiptNoteSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

export const GoodsReceiptNote = model<IGoodsReceiptNote>(
  'GoodsReceiptNote',
  goodsReceiptNoteSchema
);
