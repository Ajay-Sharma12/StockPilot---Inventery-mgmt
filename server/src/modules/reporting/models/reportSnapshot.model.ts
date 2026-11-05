import { Schema, model, Document, Types } from 'mongoose';

export interface IReportSnapshot extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  snapshotNumber: string;
  reportType: string;
  category: 'INVENTORY' | 'PROCUREMENT' | 'SALES' | 'PRODUCTION' | 'QC';
  filters: Record<string, any>;
  data: any[];
  summary?: Record<string, any>;
  generatedBy: Types.ObjectId;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const reportSnapshotSchema = new Schema<IReportSnapshot>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    snapshotNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    reportType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['INVENTORY', 'PROCUREMENT', 'SALES', 'PRODUCTION', 'QC'],
      required: true,
      index: true,
    },
    filters: {
      type: Schema.Types.Mixed,
      default: {},
    },
    data: [{
      type: Schema.Types.Mixed,
    }],
    summary: {
      type: Schema.Types.Mixed,
    },
    generatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

reportSnapshotSchema.index({ tenantId: 1, snapshotNumber: 1 }, { unique: true });
reportSnapshotSchema.index({ tenantId: 1, reportType: 1, generatedAt: -1 });

export const ReportSnapshot = model<IReportSnapshot>('ReportSnapshot', reportSnapshotSchema);
