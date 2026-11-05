import { Schema, model, Document, Types } from 'mongoose';

export type StockCountStatus =
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface IStockCountItem {
  itemId: Types.ObjectId;
  batchNumber?: string;
  locationId?: Types.ObjectId;
  systemQuantity: number;
  countedQuantity: number;
  variance: number; // countedQuantity - systemQuantity
  varianceValue: number; // variance * unitCost
  unitCost: number;
  reasonId?: Types.ObjectId;
  remarks?: string;
}

export interface IStockCount extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  countNumber: string;
  warehouseId: Types.ObjectId;
  countDate: Date;
  assignedUsers: Types.ObjectId[];
  status: StockCountStatus;
  items: IStockCountItem[];
  plannedBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  completedAt?: Date;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const stockCountSchema = new Schema<IStockCount>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    countNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    countDate: {
      type: Date,
      default: Date.now,
    },
    assignedUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    status: {
      type: String,
      enum: ['PLANNED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'COMPLETED', 'CANCELLED'],
      default: 'PLANNED',
      index: true,
    },
    items: [
      {
        itemId: {
          type: Schema.Types.ObjectId,
          ref: 'Item',
          required: true,
        },
        batchNumber: String,
        locationId: {
          type: Schema.Types.ObjectId,
          ref: 'Bin',
        },
        systemQuantity: {
          type: Number,
          default: 0,
        },
        countedQuantity: {
          type: Number,
          default: 0,
        },
        variance: {
          type: Number,
          default: 0,
        },
        varianceValue: {
          type: Number,
          default: 0,
        },
        unitCost: {
          type: Number,
          default: 0,
        },
        reasonId: {
          type: Schema.Types.ObjectId,
          ref: 'StockAdjustmentReason',
        },
        remarks: String,
      },
    ],
    plannedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    completedAt: Date,
    remarks: String,
  },
  {
    timestamps: true,
  }
);

stockCountSchema.index({ tenantId: 1, countNumber: 1 }, { unique: true });
stockCountSchema.index({ tenantId: 1, status: 1, countDate: -1 });

export const StockCount = model<IStockCount>('StockCount', stockCountSchema);
