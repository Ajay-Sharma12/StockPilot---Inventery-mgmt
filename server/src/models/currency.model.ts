import { Schema, model, Document, Types } from 'mongoose';

export interface ICurrencyMaster extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  code: string;
  name: string;
  symbol: string;
  decimalPrecision: number;
  isDefault: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const currencyMasterSchema = new Schema<ICurrencyMaster>(
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
    symbol: {
      type: String,
      required: true,
      trim: true,
    },
    decimalPrecision: {
      type: Number,
      default: 2,
      min: 0,
      max: 4,
    },
    isDefault: {
      type: Boolean,
      default: false,
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

currencyMasterSchema.index({ tenantId: 1, code: 1 }, { unique: true });

export const CurrencyMaster = model<ICurrencyMaster>('CurrencyMaster', currencyMasterSchema);
