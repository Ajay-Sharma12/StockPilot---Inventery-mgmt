import { Schema, model, Document, Types } from 'mongoose';

export type BOMStatus = 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface IBOMComponent {
  itemId: Types.ObjectId;
  quantity: number;
  uomId: Types.ObjectId;
  scrapPercentage: number; // e.g. 5 for 5%
  sequence: number; // Operation sequence step (10, 20, 30...)
  operationCode?: string; // e.g. 'CASTING', 'ASSEMBLY', 'WIRING', 'TESTING'
  remarks?: string;
}

export interface IBOM extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  bomNumber: string;
  name: string;
  finishedItemId: Types.ObjectId;
  version: number;
  description?: string;
  quantity: number; // Base batch yield quantity (typically 1 or batch size)
  uomId: Types.ObjectId;
  components: IBOMComponent[];
  status: BOMStatus;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  isDefault: boolean;
  routingNotes?: string;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const bomComponentSchema = new Schema<IBOMComponent>(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [0.0001, 'Component quantity must be greater than zero'],
    },
    uomId: {
      type: Schema.Types.ObjectId,
      ref: 'UOM',
      required: true,
    },
    scrapPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    sequence: {
      type: Number,
      default: 10,
    },
    operationCode: {
      type: String,
      trim: true,
    },
    remarks: {
      type: String,
      trim: true,
    },
  },
  { _id: true }
);

const bomSchema = new Schema<IBOM>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    bomNumber: {
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
    finishedItemId: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
      index: true,
    },
    version: {
      type: Number,
      required: true,
      default: 1,
    },
    description: {
      type: String,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
      min: [0.0001, 'Batch quantity must be greater than zero'],
    },
    uomId: {
      type: Schema.Types.ObjectId,
      ref: 'UOM',
      required: true,
    },
    components: {
      type: [bomComponentSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'INACTIVE', 'ARCHIVED'],
      default: 'DRAFT',
      index: true,
    },
    effectiveFrom: {
      type: Date,
    },
    effectiveTo: {
      type: Date,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    routingNotes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Compound indexes
bomSchema.index({ tenantId: 1, bomNumber: 1 }, { unique: true });
bomSchema.index({ tenantId: 1, finishedItemId: 1, version: 1 }, { unique: true });
bomSchema.index({ tenantId: 1, finishedItemId: 1, isDefault: 1 });
bomSchema.index({ tenantId: 1, status: 1 });

export const BOM = model<IBOM>('BOM', bomSchema);
