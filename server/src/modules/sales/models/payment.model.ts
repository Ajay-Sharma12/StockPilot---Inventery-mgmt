import { Schema, model, Document, Types } from 'mongoose';

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'ONLINE_PAYMENT' | 'OTHER';
export type PaymentStatus = 'RECORDED' | 'REVERSED';

export interface IPayment extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  paymentNumber: string;
  invoiceId: Types.ObjectId;
  customerId: Types.ObjectId;
  paymentDate: Date;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  currency: string;
  notes?: string;
  receivedBy: Types.ObjectId;
  status: PaymentStatus;
  reversedBy?: Types.ObjectId;
  reversedAt?: Date;
  reversalReason?: string;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    paymentNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Payment amount must be greater than zero'],
    },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'BANK_TRANSFER', 'CARD', 'ONLINE_PAYMENT', 'OTHER'],
      default: 'BANK_TRANSFER',
    },
    paymentReference: {
      type: String,
      trim: true,
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
    },
    notes: String,
    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['RECORDED', 'REVERSED'],
      default: 'RECORDED',
      index: true,
    },
    reversedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reversedAt: Date,
    reversalReason: String,
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
  {
    timestamps: true,
  }
);

paymentSchema.index({ tenantId: 1, paymentNumber: 1 }, { unique: true });
paymentSchema.index({ tenantId: 1, customerId: 1, paymentDate: -1 });
paymentSchema.index({ tenantId: 1, invoiceId: 1 });

export const Payment = model<IPayment>('Payment', paymentSchema);
