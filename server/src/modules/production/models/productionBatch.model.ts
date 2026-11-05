import { Schema, model, Document, Types } from 'mongoose';

export type ProductionBatchStatus = 'ACTIVE' | 'QUARANTINED' | 'RELEASED' | 'REJECTED';

export interface IProductionBatch extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  batchNumber: string;
  productionOrderId: Types.ObjectId;
  itemId: Types.ObjectId;
  manufacturingDate: Date;
  expiryDate?: Date;
  quantity: number;
  uomId: Types.ObjectId;
  status: ProductionBatchStatus;
  notes?: string;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const productionBatchSchema = new Schema<IProductionBatch>(
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
    manufacturingDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
    },
    quantity: {
      type: Number,
      required: true,
      min: [0, 'Batch quantity cannot be negative'],
    },
    uomId: {
      type: Schema.Types.ObjectId,
      ref: 'UOM',
      required: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'QUARANTINED', 'RELEASED', 'REJECTED'],
      default: 'QUARANTINED', // Quarantined until QC releases it
      index: true,
    },
    notes: {
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
  { timestamps: true }
);

productionBatchSchema.index({ tenantId: 1, batchNumber: 1 }, { unique: true });
productionBatchSchema.index({ tenantId: 1, itemId: 1 });

export const ProductionBatch = model<IProductionBatch>('ProductionBatch', productionBatchSchema);
