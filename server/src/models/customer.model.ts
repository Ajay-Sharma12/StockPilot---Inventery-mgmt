import { Schema, model, Document, Types } from 'mongoose';

export interface ICustomer extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  customerCode: string;
  name: string;
  legalName?: string;
  contactPerson?: string;
  email: string;
  phone?: string;
  billingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  shippingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  taxNumber?: string;
  paymentTerms?: string;
  currency?: string;
  creditLimit: number;
  status: 'ACTIVE' | 'INACTIVE' | 'ON_HOLD';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    customerCode: {
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
    legalName: {
      type: String,
      trim: true,
    },
    contactPerson: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    billingAddress: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String,
    },
    shippingAddress: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String,
    },
    taxNumber: {
      type: String,
      trim: true,
    },
    paymentTerms: {
      type: String,
      default: 'IMMEDIATE',
    },
    currency: {
      type: String,
      default: 'USD',
    },
    creditLimit: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'ON_HOLD'],
      default: 'ACTIVE',
      index: true,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

customerSchema.index({ tenantId: 1, customerCode: 1 }, { unique: true });

export const Customer = model<ICustomer>('Customer', customerSchema);
