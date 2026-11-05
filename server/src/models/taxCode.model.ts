import { Schema, model, Document, Types } from 'mongoose';

export interface ITaxCode extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  code: string;
  name: string;
  rate: number;
  type: 'GST' | 'VAT' | 'SALES_TAX' | 'EXEMPT' | 'CUSTOM';
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const taxCodeSchema = new Schema<ITaxCode>(
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
    rate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    type: {
      type: String,
      enum: ['GST', 'VAT', 'SALES_TAX', 'EXEMPT', 'CUSTOM'],
      default: 'SALES_TAX',
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

taxCodeSchema.index({ tenantId: 1, code: 1 }, { unique: true });

export const TaxCode = model<ITaxCode>('TaxCode', taxCodeSchema);
