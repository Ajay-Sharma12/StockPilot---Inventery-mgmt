import { Schema, model, Document, Types } from 'mongoose';

export type WarehouseType = 'MAIN' | 'REGIONAL' | 'TRANSIT' | 'PLANT' | 'QUARANTINE' | 'OTHER';

export interface IWarehouse extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  code: string;
  name: string;
  type: WarehouseType;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  managerId?: Types.ObjectId;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const warehouseSchema = new Schema<IWarehouse>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    code: {
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
    type: {
      type: String,
      enum: ['MAIN', 'REGIONAL', 'TRANSIT', 'PLANT', 'QUARANTINE', 'OTHER'],
      default: 'MAIN',
      index: true,
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String,
    },
    managerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

warehouseSchema.index({ tenantId: 1, code: 1 }, { unique: true });

export const Warehouse = model<IWarehouse>('Warehouse', warehouseSchema);

export interface IZone extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  code: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const zoneSchema = new Schema<IZone>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    code: {
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
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
  },
  {
    timestamps: true,
  }
);

zoneSchema.index({ tenantId: 1, warehouseId: 1, code: 1 }, { unique: true });

export const Zone = model<IZone>('Zone', zoneSchema);

export interface IRack extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  zoneId: Types.ObjectId;
  code: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const rackSchema = new Schema<IRack>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    zoneId: {
      type: Schema.Types.ObjectId,
      ref: 'Zone',
      required: true,
      index: true,
    },
    code: {
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
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
  },
  {
    timestamps: true,
  }
);

rackSchema.index({ tenantId: 1, zoneId: 1, code: 1 }, { unique: true });

export const Rack = model<IRack>('Rack', rackSchema);

export interface IBin extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  zoneId: Types.ObjectId;
  rackId: Types.ObjectId;
  code: string;
  name: string;
  capacity?: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const binSchema = new Schema<IBin>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    zoneId: {
      type: Schema.Types.ObjectId,
      ref: 'Zone',
      required: true,
      index: true,
    },
    rackId: {
      type: Schema.Types.ObjectId,
      ref: 'Rack',
      required: true,
      index: true,
    },
    code: {
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
    capacity: {
      type: Number,
      min: 0,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
  },
  {
    timestamps: true,
  }
);

binSchema.index({ tenantId: 1, rackId: 1, code: 1 }, { unique: true });

export const Bin = model<IBin>('Bin', binSchema);
