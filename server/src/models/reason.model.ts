import { Schema, model, Document, Types } from 'mongoose';

export interface IWastageReason extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  code: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const wastageReasonSchema = new Schema<IWastageReason>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
  },
  {
    timestamps: true,
  }
);

wastageReasonSchema.index({ tenantId: 1, code: 1 }, { unique: true });

export const WastageReason = model<IWastageReason>('WastageReason', wastageReasonSchema);

export interface IStockAdjustmentReason extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  code: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const stockAdjustmentReasonSchema = new Schema<IStockAdjustmentReason>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
  },
  {
    timestamps: true,
  }
);

stockAdjustmentReasonSchema.index({ tenantId: 1, code: 1 }, { unique: true });

export const StockAdjustmentReason = model<IStockAdjustmentReason>(
  'StockAdjustmentReason',
  stockAdjustmentReasonSchema
);
