import { Schema, model, Document, Types } from 'mongoose';

export interface IPaymentTerm extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  code: string;
  name: string;
  days: number;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const paymentTermSchema = new Schema<IPaymentTerm>(
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
    days: {
      type: Number,
      required: true,
      min: 0,
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

paymentTermSchema.index({ tenantId: 1, code: 1 }, { unique: true });

export const PaymentTerm = model<IPaymentTerm>('PaymentTerm', paymentTermSchema);
