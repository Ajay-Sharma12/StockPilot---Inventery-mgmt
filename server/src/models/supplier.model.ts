import { Schema, model, Document, Types } from 'mongoose';

export interface ISupplier extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  supplierCode: string;
  name: string;
  legalName?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  leadTimeDays?: number;
  minOrderValue?: number;
  rating?: number;
  taxId?: string;
  contactEmail?: string;
  website?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  taxNumber?: string;
  paymentTerms?: string;
  creditLimit?: number;
  currency?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  notes?: string;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const supplierSchema = new Schema<ISupplier>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    supplierCode: {
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
      required: false,
      default: '',
      lowercase: true,
      trim: true,
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    address: {
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
    taxId: {
      type: String,
      trim: true,
    },
    leadTimeDays: {
      type: Number,
      default: 7,
      min: 0,
    },
    minOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    rating: {
      type: Number,
      default: 3,
      min: 1,
      max: 5,
    },
    paymentTerms: {
      type: String,
      default: '30_DAYS',
    },
    creditLimit: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'BLOCKED'],
      default: 'ACTIVE',
      index: true,
    },
    notes: {
      type: String,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

supplierSchema.index({ tenantId: 1, supplierCode: 1 }, { unique: true });
supplierSchema.index({ tenantId: 1, status: 1 });
supplierSchema.index({ tenantId: 1, name: 1 });

export const Supplier = model<ISupplier>('Supplier', supplierSchema);
