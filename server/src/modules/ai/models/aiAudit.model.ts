import { Schema, model, Document, Types } from 'mongoose';

export interface IAIAuditLog extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  requestType: string;
  dataScope: string[];
  feature: string;
  provider: string;
  responseStatus: 'SUCCESS' | 'ERROR' | 'THROTTLED';
  usageMetadata?: Record<string, any>;
  createdAt: Date;
}

const aiAuditSchema = new Schema<IAIAuditLog>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    requestType: {
      type: String,
      required: true,
    },
    dataScope: {
      type: [String],
      default: [],
    },
    feature: {
      type: String,
      required: true,
    },
    provider: {
      type: String,
      required: true,
      default: 'StockPilot-Deterministic-Engine',
    },
    responseStatus: {
      type: String,
      enum: ['SUCCESS', 'ERROR', 'THROTTLED'],
      default: 'SUCCESS',
    },
    usageMetadata: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

aiAuditSchema.index({ tenantId: 1, createdAt: -1 });

export const AIAudit = model<IAIAuditLog>('AIAudit', aiAuditSchema);
