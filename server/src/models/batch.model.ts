import { Schema, model, Document, Types } from 'mongoose';

export interface IBatch extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  batchNumber: string;
  itemId: Types.ObjectId;
  warehouseId?: Types.ObjectId;
  manufacturingDate?: Date;
  expiryDate?: Date;
  quantity: number;
  status: 'ACTIVE' | 'QUARANTINE' | 'EXPIRED' | 'DEPLETED';
  createdAt: Date;
  updatedAt: Date;
}

const batchSchema = new Schema<IBatch>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    batchNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
      index: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
    },
    manufacturingDate: {
      type: Date,
    },
    expiryDate: {
      type: Date,
    },
    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'QUARANTINE', 'EXPIRED', 'DEPLETED'],
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

batchSchema.index({ tenantId: 1, itemId: 1, batchNumber: 1 }, { unique: true });

export const Batch = model<IBatch>('Batch', batchSchema);
