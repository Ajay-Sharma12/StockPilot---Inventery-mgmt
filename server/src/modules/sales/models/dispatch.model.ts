import { Schema, model, Document, Types } from 'mongoose';

export type DispatchStatus = 'DRAFT' | 'READY' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';

export interface IDispatch extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  dispatchNumber: string;
  salesOrderId: Types.ObjectId;
  customerId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  packageIds: Types.ObjectId[];
  carrier?: string;
  vehicleNumber?: string;
  driverName?: string;
  driverContact?: string;
  trackingNumber?: string;
  shippingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  dispatchDate: Date;
  status: DispatchStatus;
  inventoryIssued: boolean;
  inventoryTransactionIds: Types.ObjectId[];
  remarks?: string;
  dispatchedBy?: Types.ObjectId;
  dispatchedAt?: Date;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const dispatchSchema = new Schema<IDispatch>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    dispatchNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    salesOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'SalesOrder',
      required: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    packageIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Package',
      },
    ],
    carrier: {
      type: String,
      trim: true,
    },
    vehicleNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
    driverName: {
      type: String,
      trim: true,
    },
    driverContact: {
      type: String,
      trim: true,
    },
    trackingNumber: {
      type: String,
      trim: true,
    },
    shippingAddress: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String,
    },
    dispatchDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'READY', 'DISPATCHED', 'DELIVERED', 'CANCELLED'],
      default: 'DRAFT',
      index: true,
    },
    inventoryIssued: {
      type: Boolean,
      default: false,
      index: true,
    },
    inventoryTransactionIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'InventoryTransaction',
      },
    ],
    remarks: {
      type: String,
      trim: true,
    },
    dispatchedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    dispatchedAt: Date,
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

dispatchSchema.index({ tenantId: 1, dispatchNumber: 1 }, { unique: true });
dispatchSchema.index({ tenantId: 1, salesOrderId: 1 });
dispatchSchema.index({ tenantId: 1, status: 1 });

export const Dispatch = model<IDispatch>('Dispatch', dispatchSchema);
