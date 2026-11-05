import { Schema, model, Document, Types } from 'mongoose';

export type GatePassStatus = 'DRAFT' | 'READY' | 'APPROVED' | 'GATE_OUT' | 'CLOSED';

export interface IGatePass extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  gatePassNumber: string;
  salesOrderId: Types.ObjectId;
  dispatchId: Types.ObjectId;
  invoiceId?: Types.ObjectId;
  customerId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  vehicleNumber?: string;
  driverName?: string;
  driverContact?: string;
  packageIds: Types.ObjectId[];
  items?: {
    itemId: Types.ObjectId;
    description?: string;
    quantity: number;
    uomId: Types.ObjectId;
  }[];
  gateOutTime?: Date;
  securityOfficerId?: Types.ObjectId;
  status: GatePassStatus;
  remarks?: string;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const gatePassSchema = new Schema<IGatePass>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    gatePassNumber: {
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
    dispatchId: {
      type: Schema.Types.ObjectId,
      ref: 'Dispatch',
      required: true,
      index: true,
    },
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
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
    packageIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Package',
      },
    ],
    items: [
      {
        itemId: {
          type: Schema.Types.ObjectId,
          ref: 'Item',
          required: true,
        },
        description: String,
        quantity: Number,
        uomId: {
          type: Schema.Types.ObjectId,
          ref: 'UOM',
        },
      },
    ],
    gateOutTime: Date,
    securityOfficerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['DRAFT', 'READY', 'APPROVED', 'GATE_OUT', 'CLOSED'],
      default: 'DRAFT',
      index: true,
    },
    remarks: {
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
  },
  {
    timestamps: true,
  }
);

gatePassSchema.index({ tenantId: 1, gatePassNumber: 1 }, { unique: true });
gatePassSchema.index({ tenantId: 1, dispatchId: 1 });
gatePassSchema.index({ tenantId: 1, status: 1 });

export const GatePass = model<IGatePass>('GatePass', gatePassSchema);
