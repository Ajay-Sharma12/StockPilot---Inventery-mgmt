import { Schema, model, Document, Types } from 'mongoose';

export type StockAdjustmentStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

export interface IStockAdjustmentItem {
  itemId: Types.ObjectId;
  batchNumber?: string;
  serialNumber?: string;
  currentQuantity: number;
  adjustedQuantity: number;
  difference: number; // positive = stock in, negative = stock out
  unitCost: number;
  reasonId?: Types.ObjectId;
  remarks?: string;
}

export interface IStockAdjustment extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  adjustmentNumber: string;
  warehouseId: Types.ObjectId;
  locationId?: Types.ObjectId;
  items: IStockAdjustmentItem[];
  status: StockAdjustmentStatus;
  requestedBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  reason?: string;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const stockAdjustmentSchema = new Schema<IStockAdjustment>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    adjustmentNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    locationId: {
      type: Schema.Types.ObjectId,
      ref: 'Bin',
    },
    items: [
      {
        itemId: {
          type: Schema.Types.ObjectId,
          ref: 'Item',
          required: true,
        },
        batchNumber: String,
        serialNumber: String,
        currentQuantity: {
          type: Number,
          required: true,
        },
        adjustedQuantity: {
          type: Number,
          required: true,
          min: 0,
        },
        difference: {
          type: Number,
          required: true,
        },
        unitCost: {
          type: Number,
          default: 0,
        },
        reasonId: {
          type: Schema.Types.ObjectId,
          ref: 'StockAdjustmentReason',
        },
        remarks: String,
      },
    ],
    status: {
      type: String,
      enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'COMPLETED'],
      default: 'DRAFT',
      index: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reason: String,
    remarks: String,
  },
  {
    timestamps: true,
  }
);

stockAdjustmentSchema.index({ tenantId: 1, adjustmentNumber: 1 }, { unique: true });
stockAdjustmentSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

export const StockAdjustment = model<IStockAdjustment>('StockAdjustment', stockAdjustmentSchema);
