import { Schema, model, Document, Types } from 'mongoose';
import { AuditAction, AuditEntity } from '../config/constants';

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  tenantId?: Types.ObjectId | null;
  userId?: Types.ObjectId | null;
  userName?: string;
  userEmail?: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  details?: string;
  previousState?: Record<string, any>;
  newState?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    userName: {
      type: String,
    },
    userEmail: {
      type: String,
    },
    action: {
      type: String,
      enum: Object.values(AuditAction),
      required: true,
      index: true,
    },
    entity: {
      type: String,
      enum: Object.values(AuditEntity),
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      index: true,
    },
    details: {
      type: String,
    },
    previousState: {
      type: Schema.Types.Mixed,
    },
    newState: {
      type: Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

auditLogSchema.index({ tenantId: 1, createdAt: -1 });

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);
