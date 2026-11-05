import { Schema, model, Document, Types } from 'mongoose';

export type ProductionOrderStatus =
  | 'DRAFT'
  | 'PLANNED'
  | 'APPROVED'
  | 'RELEASED'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'CLOSED';

export type ProductionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface IProductionOrderMaterial {
  _id?: Types.ObjectId;
  itemId: Types.ObjectId;
  plannedQuantity: number;
  reservedQuantity: number;
  issuedQuantity: number;
  actualConsumedQuantity: number;
  returnedQuantity: number;
  scrapQuantity: number;
  uomId: Types.ObjectId;
  batchNumber?: string;
  unitCost: number;
  operationCode?: string;
}

export interface IProductionOrder extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  productionOrderNumber: string;
  productionItemId: Types.ObjectId;
  bomId: Types.ObjectId;
  bomVersion: number;
  plannedQuantity: number;
  uomId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  productionLocation?: string;
  plannedStartDate?: Date;
  plannedEndDate?: Date;
  actualStartDate?: Date;
  actualEndDate?: Date;
  priority: ProductionPriority;
  status: ProductionOrderStatus;
  plannedMaterialCost: number;
  actualMaterialCost: number;
  plannedLaborCost: number;
  actualLaborCost: number;
  yieldQuantity: number;
  scrapQuantity: number;
  rejectedQuantity: number;
  batchNumber?: string;
  notes?: string;
  materials: IProductionOrderMaterial[];
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  releasedBy?: Types.ObjectId;
  releasedAt?: Date;
  startedBy?: Types.ObjectId;
  startedAt?: Date;
  completedBy?: Types.ObjectId;
  completedAt?: Date;
  cancelledBy?: Types.ObjectId;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const productionOrderMaterialSchema = new Schema<IProductionOrderMaterial>(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
    },
    plannedQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    reservedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    issuedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    actualConsumedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    returnedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    scrapQuantity: {
      type: Number,
      default: 0,
      min: 0,
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
    unitCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    operationCode: {
      type: String,
      trim: true,
    },
  },
  { _id: true }
);

const productionOrderSchema = new Schema<IProductionOrder>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    productionOrderNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    productionItemId: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
      index: true,
    },
    bomId: {
      type: Schema.Types.ObjectId,
      ref: 'BOM',
      required: true,
      index: true,
    },
    bomVersion: {
      type: Number,
      required: true,
      default: 1,
    },
    plannedQuantity: {
      type: Number,
      required: true,
      min: [0.0001, 'Planned quantity must be greater than zero'],
    },
    uomId: {
      type: Schema.Types.ObjectId,
      ref: 'UOM',
      required: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    productionLocation: {
      type: String,
      trim: true,
      default: 'Assembly Line 1',
    },
    plannedStartDate: {
      type: Date,
    },
    plannedEndDate: {
      type: Date,
    },
    actualStartDate: {
      type: Date,
    },
    actualEndDate: {
      type: Date,
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
      index: true,
    },
    status: {
      type: String,
      enum: [
        'DRAFT',
        'PLANNED',
        'APPROVED',
        'RELEASED',
        'IN_PROGRESS',
        'PAUSED',
        'COMPLETED',
        'CANCELLED',
        'CLOSED',
      ],
      default: 'DRAFT',
      index: true,
    },
    plannedMaterialCost: {
      type: Number,
      default: 0,
    },
    actualMaterialCost: {
      type: Number,
      default: 0,
    },
    plannedLaborCost: {
      type: Number,
      default: 0,
    },
    actualLaborCost: {
      type: Number,
      default: 0,
    },
    yieldQuantity: {
      type: Number,
      default: 0,
    },
    scrapQuantity: {
      type: Number,
      default: 0,
    },
    rejectedQuantity: {
      type: Number,
      default: 0,
    },
    batchNumber: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    materials: {
      type: [productionOrderMaterialSchema],
      default: [],
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
    releasedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    releasedAt: {
      type: Date,
    },
    startedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    startedAt: {
      type: Date,
    },
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    completedAt: {
      type: Date,
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
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
  { timestamps: true }
);

// Indexes
productionOrderSchema.index({ tenantId: 1, productionOrderNumber: 1 }, { unique: true });
productionOrderSchema.index({ tenantId: 1, status: 1 });
productionOrderSchema.index({ tenantId: 1, warehouseId: 1 });
productionOrderSchema.index({ tenantId: 1, plannedStartDate: 1 });

export const ProductionOrder = model<IProductionOrder>('ProductionOrder', productionOrderSchema);
