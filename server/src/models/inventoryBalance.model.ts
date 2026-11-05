import { Schema, model, Document, Types } from 'mongoose';

export interface IInventoryBalance extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  itemId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  locationId?: Types.ObjectId;
  batchNumber?: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  averageCost: number;
  totalValue: number;
  updatedAt: Date;
}

const inventoryBalanceSchema = new Schema<IInventoryBalance>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
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
    batchNumber: {
      type: String,
      trim: true,
      default: '',
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
    },
    reservedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    availableQuantity: {
      type: Number,
      default: 0,
    },
    averageCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalValue: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

inventoryBalanceSchema.index(
  {
    tenantId: 1,
    itemId: 1,
    warehouseId: 1,
    locationId: 1,
    batchNumber: 1,
  },
  { unique: true }
);

inventoryBalanceSchema.index({ tenantId: 1, warehouseId: 1, quantity: 1 });

export const InventoryBalance = model<IInventoryBalance>('InventoryBalance', inventoryBalanceSchema);
