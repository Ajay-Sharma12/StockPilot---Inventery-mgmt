import { Schema, model, Document, Types } from 'mongoose';

export type ProductionQCOverallResult = 'PASS' | 'FAIL' | 'CONDITIONAL' | 'HOLD';
export type ProductionQCStatus = 'PENDING' | 'INSPECTED' | 'DISPOSITIONED';
export type ProductionQCDisposition = 'ACCEPT' | 'REJECT' | 'HOLD' | 'REWORK' | 'SCRAP';

export interface IProductionQCResultItem {
  parameter: string;
  expected?: string;
  actual?: string;
  status: 'PASS' | 'FAIL' | 'NA';
}

export interface IProductionQCInspection extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  qcNumber: string;
  productionOrderId: Types.ObjectId;
  itemId: Types.ObjectId;
  batchId?: Types.ObjectId;
  batchNumber?: string;
  inspectedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  heldQuantity: number;
  reworkQuantity: number;
  inspectorId: Types.ObjectId;
  results: IProductionQCResultItem[];
  overallResult: ProductionQCOverallResult;
  status: ProductionQCStatus;
  disposition?: ProductionQCDisposition;
  remarks?: string;
  dispositionNotes?: string;
  dispositionedAt?: Date;
  dispositionedBy?: Types.ObjectId;
  reworkOrderId?: Types.ObjectId;
  inventoryReceiptTransactionId?: Types.ObjectId;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const qcResultItemSchema = new Schema<IProductionQCResultItem>(
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

const productionQcSchema = new Schema<IProductionQCInspection>(
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
    productionOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductionOrder',
      required: true,
      index: true,
    },
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
      index: true,
    },
    batchId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductionBatch',
    },
    batchNumber: {
      type: String,
      trim: true,
    },
    inspectedQuantity: {
      type: Number,
      required: true,
      min: 0,
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
    reworkQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    inspectorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    results: {
      type: [qcResultItemSchema],
      default: [],
    },
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
    disposition: {
      type: String,
      enum: ['ACCEPT', 'REJECT', 'HOLD', 'REWORK', 'SCRAP'],
    },
    remarks: {
      type: String,
      trim: true,
    },
    dispositionNotes: {
      type: String,
      trim: true,
    },
    dispositionedAt: {
      type: Date,
    },
    dispositionedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reworkOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductionOrder',
    },
    inventoryReceiptTransactionId: {
      type: Schema.Types.ObjectId,
      ref: 'InventoryTransaction',
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
  { timestamps: true }
);

productionQcSchema.index({ tenantId: 1, qcNumber: 1 }, { unique: true });
productionQcSchema.index({ tenantId: 1, productionOrderId: 1 });
productionQcSchema.index({ tenantId: 1, overallResult: 1 });

export const ProductionQC = model<IProductionQCInspection>('ProductionQC', productionQcSchema);
