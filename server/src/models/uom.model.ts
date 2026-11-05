import { Schema, model, Document, Types } from 'mongoose';

export type UOMType = 'COUNT' | 'WEIGHT' | 'VOLUME' | 'LENGTH' | 'PACKAGING' | 'AREA' | 'OTHER';

export interface IUOM extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string;
  code: string;
  symbol: string;
  type: UOMType;
  decimalPrecision: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const uomSchema = new Schema<IUOM>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    symbol: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['COUNT', 'WEIGHT', 'VOLUME', 'LENGTH', 'PACKAGING', 'AREA', 'OTHER'],
      default: 'COUNT',
      index: true,
    },
    decimalPrecision: {
      type: Number,
      default: 0,
      min: 0,
      max: 4,
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

uomSchema.index({ tenantId: 1, code: 1 }, { unique: true });

export const UOM = model<IUOM>('UOM', uomSchema);

export interface IUOMConversion extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  fromUomId: Types.ObjectId;
  toUomId: Types.ObjectId;
  conversionFactor: number;
  roundingRule: 'ROUND' | 'CEIL' | 'FLOOR';
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const uomConversionSchema = new Schema<IUOMConversion>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    fromUomId: {
      type: Schema.Types.ObjectId,
      ref: 'UOM',
      required: true,
      index: true,
    },
    toUomId: {
      type: Schema.Types.ObjectId,
      ref: 'UOM',
      required: true,
      index: true,
    },
    conversionFactor: {
      type: Number,
      required: true,
      min: 0.000001,
    },
    roundingRule: {
      type: String,
      enum: ['ROUND', 'CEIL', 'FLOOR'],
      default: 'ROUND',
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

uomConversionSchema.index({ tenantId: 1, fromUomId: 1, toUomId: 1 }, { unique: true });

export const UOMConversion = model<IUOMConversion>('UOMConversion', uomConversionSchema);
