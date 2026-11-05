import { Schema, model, Document, Types } from 'mongoose';

export type StockTransferStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'DISPATCHED'
  | 'RECEIVED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface IStockTransferItem {
  itemId: Types.ObjectId;
  batchNumber?: string;
  serialNumber?: string;
  requestedQuantity: number;
  dispatchedQuantity: number;
  receivedQuantity: number;
  unitCost: number;
}

export interface IStockTransfer extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  transferNumber: string;
  fromWarehouseId: Types.ObjectId;
  fromLocationId?: Types.ObjectId;
  toWarehouseId: Types.ObjectId;
  toLocationId?: Types.ObjectId;
  items: IStockTransferItem[];
  status: StockTransferStatus;
  requestedBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  dispatchedBy?: Types.ObjectId;
  receivedBy?: Types.ObjectId;
  requestedDate: Date;
  dispatchedDate?: Date;
  receivedDate?: Date;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const stockTransferSchema = new Schema<IStockTransfer>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    transferNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    fromWarehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    fromLocationId: {
      type: Schema.Types.ObjectId,
      ref: 'Bin',
    },
    toWarehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    toLocationId: {
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
        serialNumber: String,
        requestedQuantity: {
          type: Number,
          required: true,
          min: 0.0001,
        },
        dispatchedQuantity: {
          type: Number,
          default: 0,
          min: 0,
        },
        receivedQuantity: {
          type: Number,
          default: 0,
          min: 0,
        },
        unitCost: {
          type: Number,
          default: 0,
        },
      },
    ],
    status: {
      type: String,
      enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'DISPATCHED', 'RECEIVED', 'COMPLETED', 'CANCELLED'],
      default: 'DRAFT',
      index: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    dispatchedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    requestedDate: {
      type: Date,
      default: Date.now,
    },
    dispatchedDate: Date,
    receivedDate: Date,
    remarks: String,
  },
  {
    timestamps: true,
  }
);

stockTransferSchema.index({ tenantId: 1, transferNumber: 1 }, { unique: true });
stockTransferSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

export const StockTransfer = model<IStockTransfer>('StockTransfer', stockTransferSchema);
