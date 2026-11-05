import { Schema, model, Document, Types } from 'mongoose';
import { TenantPlan } from '../config/constants';

export interface ITenantSubscription extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  planId: TenantPlan;
  status: 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'CANCELLED';
  features: Map<string, boolean>;
  quotas: Map<string, number>;
  billingCycle: 'MONTHLY' | 'ANNUAL';
  validUntil: Date;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ITenantSubscription>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true,
      index: true,
    },
    planId: {
      type: String,
      enum: Object.values(TenantPlan),
      default: TenantPlan.FREE,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELLED'],
      default: 'ACTIVE',
      index: true,
    },
    features: {
      type: Map,
      of: Boolean,
      default: {},
    },
    quotas: {
      type: Map,
      of: Number,
      default: {},
    },
    billingCycle: {
      type: String,
      enum: ['MONTHLY', 'ANNUAL'],
      default: 'MONTHLY',
    },
    validUntil: {
      type: Date,
      default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default 1 year
    },
  },
  {
    timestamps: true,
  }
);

export const TenantSubscription = model<ITenantSubscription>(
  'TenantSubscription',
  subscriptionSchema
);
