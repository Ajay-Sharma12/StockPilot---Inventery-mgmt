import { Schema, model, Document, Types } from 'mongoose';
import './warehouse.model';
import './reason.model';
import './user.model';
import './item.model';

export type WastageStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

export interface IWastageItem {
  itemId: Types.ObjectId;
  batchNumber?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  reasonId?: Types.ObjectId;
  remarks?: string;
}

export interface IWastage extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  wastageNumber: string;
  warehouseId: Types.ObjectId;
  locationId?: Types.ObjectId;
  items: IWastageItem[];
  status: WastageStatus;
  reportedBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const wastageSchema = new Schema<IWastage>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    wastageNumber: {
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
    locationId: {
      type: Schema.Types.ObjectId,
      ref: 'Bin',
    },
    items: [
      {
        itemId: {
          type: Schema.Types.ObjectId,
          ref: 'Item',
          required: true,
        },
        batchNumber: String,
        quantity: {
          type: Number,
          required: true,
          min: 0.0001,
        },
        unitCost: {
          type: Number,
          default: 0,
        },
        totalCost: {
          type: Number,
          default: 0,
        },
        reasonId: {
          type: Schema.Types.ObjectId,
          ref: 'WastageReason',
        },
        remarks: String,
      },
    ],
    status: {
      type: String,
      enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'COMPLETED'],
      default: 'DRAFT',
      index: true,
    },
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    remarks: String,
  },
  {
    timestamps: true,
  }
);

wastageSchema.index({ tenantId: 1, wastageNumber: 1 }, { unique: true });
wastageSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

export const Wastage = model<IWastage>('Wastage', wastageSchema);
