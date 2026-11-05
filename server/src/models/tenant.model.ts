import { Schema, model, Document, Types } from 'mongoose';
import { TenantPlan, TenantStatus } from '../config/constants';

export interface ITenantSettings {
  currency: string;
  timezone: string;
  dateFormat: string;
  logoUrl?: string;
  fiscalYearStartMonth: number;
}

export interface ITenant extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  status: TenantStatus;
  plan: TenantPlan;
  contactEmail: string;
  phone?: string;
  organizationType?: string;
  country?: string;
  termsAcceptedAt?: Date;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  settings: ITenantSettings;
  createdAt: Date;
  updatedAt: Date;
}

const tenantSchema = new Schema<ITenant>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(TenantStatus),
      default: TenantStatus.ACTIVE,
      index: true,
    },
    plan: {
      type: String,
      enum: Object.values(TenantPlan),
      default: TenantPlan.FREE,
      index: true,
    },
    contactEmail: {
      type: String,
      default: '',
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    organizationType: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
    termsAcceptedAt: {
      type: Date,
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String,
    },
    settings: {
      currency: { type: String, default: 'USD' },
      timezone: { type: String, default: 'UTC' },
      dateFormat: { type: String, default: 'YYYY-MM-DD' },
      logoUrl: { type: String },
      fiscalYearStartMonth: { type: Number, default: 1 },
    },
  },
  {
    timestamps: true,
  }
);

export const Tenant = model<ITenant>('Tenant', tenantSchema);
