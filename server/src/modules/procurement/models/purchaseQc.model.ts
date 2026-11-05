import { Schema, model, Document, Types } from 'mongoose';

export type QCOverallResult = 'PASS' | 'FAIL' | 'CONDITIONAL' | 'HOLD';
export type QCInspectionStatus = 'PENDING' | 'INSPECTED' | 'DISPOSITIONED';

export interface IQCResultItem {
  parameter: string;
  expected?: string;
  actual?: string;
  status: 'PASS' | 'FAIL' | 'NA';
}

export interface IPurchaseQCInspection extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  qcNumber: string;
  grnId: Types.ObjectId;
  grnLineId: Types.ObjectId;
  itemId: Types.ObjectId;
  batchNumber?: string;
  inspectedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  heldQuantity: number;
  inspectorId: Types.ObjectId;
  templateId?: string;
  results: IQCResultItem[];
  overallResult: QCOverallResult;
  status: QCInspectionStatus;
  remarks?: string;
  attachments?: string[];
  inspectedAt?: Date;
  dispositionedAt?: Date;
  dispositionedBy?: Types.ObjectId;
  dispositionNotes?: string;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const qcResultSchema = new Schema<IQCResultItem>(
  {
    parameter: {
      type: String,
      required: true,
      trim: true,
    },
    expected: {
      type: String,
      trim: true,
    },
    actual: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['PASS', 'FAIL', 'NA'],
      default: 'PASS',
    },
  },
  { _id: false }
);

const purchaseQCSchema = new Schema<IPurchaseQCInspection>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    qcNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    grnId: {
      type: Schema.Types.ObjectId,
      ref: 'GoodsReceiptNote',
      required: true,
      index: true,
    },
    grnLineId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
      index: true,
    },
    batchNumber: {
      type: String,
      trim: true,
    },
    inspectedQuantity: {
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
    inspectorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    templateId: {
      type: String,
    },
    results: [qcResultSchema],
    overallResult: {
      type: String,
      enum: ['PASS', 'FAIL', 'CONDITIONAL', 'HOLD'],
      default: 'HOLD',
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'INSPECTED', 'DISPOSITIONED'],
      default: 'PENDING',
      index: true,
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
    inspectedAt: {
      type: Date,
    },
    dispositionedAt: {
      type: Date,
    },
    dispositionedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    dispositionNotes: {
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

purchaseQCSchema.index({ tenantId: 1, qcNumber: 1 }, { unique: true });
purchaseQCSchema.index({ tenantId: 1, grnId: 1 });
purchaseQCSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

export const PurchaseQCInspection = model<IPurchaseQCInspection>(
  'PurchaseQCInspection',
  purchaseQCSchema
);
