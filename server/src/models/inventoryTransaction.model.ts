import { Schema, model, Document, Types } from 'mongoose';

export type InventoryTransactionType =
  | 'OPENING_BALANCE'
  | 'GENERIC_RECEIPT'
  | 'GENERIC_ISSUE'
  | 'STOCK_ISSUE'
  | 'PURCHASE_RECEIPT'
  | 'SALE'
  | 'PRODUCTION_RECEIPT'
  | 'PRODUCTION_OUTPUT'
  | 'PRODUCTION_CONSUMPTION'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'STOCK_ADJUSTMENT'
  | 'WASTAGE'
  | 'CYCLE_COUNT_ADJUSTMENT'
  | 'RETURN_IN'
  | 'RETURN_OUT'
  | 'OTHER';

export interface IInventoryTransaction extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  transactionNumber: string;
  itemId: Types.ObjectId;
  batchNumber?: string;
  serialNumber?: string;
  warehouseId: Types.ObjectId;
  locationId?: Types.ObjectId;
  transactionType: InventoryTransactionType;
  referenceType?: string;
  referenceId?: string;
  quantityIn: number;
  quantityOut: number;
  balanceBefore: number;  // Stock BEFORE this transaction
  balanceAfter: number;   // Stock AFTER this transaction
  unitCost: number;
  totalValue: number;
  userId?: Types.ObjectId;
  transactionDate: Date;
  reason?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const inventoryTransactionSchema = new Schema<IInventoryTransaction>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    transactionNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
      index: true,
    },
    batchNumber: {
      type: String,
      trim: true,
    },
    serialNumber: {
      type: String,
      trim: true,
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
    transactionType: {
      type: String,
      required: true,
      index: true,
    },
    referenceType: {
      type: String,
    },
    referenceId: {
      type: String,
      index: true,
    },
    quantityIn: {
      type: Number,
      default: 0,
      min: 0,
    },
    quantityOut: {
      type: Number,
      default: 0,
      min: 0,
    },
    balanceBefore: {
      type: Number,
      required: true,
      default: 0,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    unitCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalValue: {
      type: Number,
      default: 0,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    transactionDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable ledger: no updatedAt!
  }
);

inventoryTransactionSchema.index({ tenantId: 1, itemId: 1, transactionDate: -1 });
inventoryTransactionSchema.index({ tenantId: 1, warehouseId: 1, transactionDate: -1 });
inventoryTransactionSchema.index({ tenantId: 1, transactionType: 1, transactionDate: -1 });

export const InventoryTransaction = model<IInventoryTransaction>(
  'InventoryTransaction',
  inventoryTransactionSchema
);
