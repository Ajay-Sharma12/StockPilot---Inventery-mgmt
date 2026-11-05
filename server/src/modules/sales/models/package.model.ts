import { Schema, model, Document, Types } from 'mongoose';

export type PackageStatus = 'DRAFT' | 'PACKING' | 'PACKED' | 'CANCELLED';

export interface IPackageItem {
  _id?: Types.ObjectId;
  itemId: Types.ObjectId;
  quantity: number;
  uomId: Types.ObjectId;
  batchNumber?: string;
  serialNumbers?: string[];
  weight?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  remarks?: string;
}

export interface IPackage extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  packageNumber: string;
  salesOrderId: Types.ObjectId;
  customerId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  items: IPackageItem[];
  totalWeight?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  packingMaterial?: string;
  packedBy?: Types.ObjectId;
  packedDate?: Date;
  status: PackageStatus;
  notes?: string;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const packageItemSchema = new Schema<IPackageItem>({
  itemId: {
    type: Schema.Types.ObjectId,
    ref: 'Item',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: [0.0001, 'Quantity must be greater than zero'],
  },
  uomId: {
    type: Schema.Types.ObjectId,
    ref: 'UOM',
    required: true,
  },
  batchNumber: {
    type: String,
    trim: true,
  },
  serialNumbers: [
    {
      type: String,
      trim: true,
    },
  ],
  weight: Number,
  dimensions: {
    length: Number,
    width: Number,
    height: Number,
  },
  remarks: String,
});

const packageSchema = new Schema<IPackage>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    packageNumber: {
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
    items: [packageItemSchema],
    totalWeight: Number,
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
    },
    packingMaterial: {
      type: String,
      trim: true,
    },
    packedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    packedDate: Date,
    status: {
      type: String,
      enum: ['DRAFT', 'PACKING', 'PACKED', 'CANCELLED'],
      default: 'DRAFT',
      index: true,
    },
    notes: {
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

packageSchema.index({ tenantId: 1, packageNumber: 1 }, { unique: true });
packageSchema.index({ tenantId: 1, salesOrderId: 1 });
packageSchema.index({ tenantId: 1, status: 1 });

export const Package = model<IPackage>('Package', packageSchema);
