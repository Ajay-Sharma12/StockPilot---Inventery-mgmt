import { Schema, model, Document, Types } from 'mongoose';

export type ProductionOutputQCStatus = 'PENDING' | 'INSPECTED' | 'DISPOSITIONED' | 'PASSED' | 'FAILED';

export interface IProductionOutput extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  outputNumber: string;
  productionOrderId: Types.ObjectId;
  productionOrderNumber: string;
  itemId: Types.ObjectId;
  bomId: Types.ObjectId;
  bomVersion: number;
  batchId?: Types.ObjectId;
  batchNumber?: string;
  warehouseId: Types.ObjectId;
  plannedQuantity: number;
  producedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  scrapQuantity: number;
  scrapReason?: string;
  wastageQuantity: number;
  wastageReason?: string;
  uomId: Types.ObjectId;
  productionDate: Date;
  qcStatus: ProductionOutputQCStatus;
  qcInspectionId?: Types.ObjectId;
  inventoryTransactionId?: Types.ObjectId;
  remarks?: string;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const productionOutputSchema = new Schema<IProductionOutput>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    outputNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    productionOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductionOrder',
      required: true,
      index: true,
    },
    productionOrderNumber: {
      type: String,
      required: true,
      trim: true,
    },
    itemId: {
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
    batchId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductionBatch',
      index: true,
    },
    batchNumber: {
      type: String,
      trim: true,
      index: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    plannedQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    producedQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    acceptedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    rejectedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    scrapQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    scrapReason: {
      type: String,
      trim: true,
    },
    wastageQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    wastageReason: {
      type: String,
      trim: true,
    },
    uomId: {
      type: Schema.Types.ObjectId,
      ref: 'UOM',
      required: true,
    },
    productionDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    qcStatus: {
      type: String,
      enum: ['PENDING', 'INSPECTED', 'DISPOSITIONED', 'PASSED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    qcInspectionId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductionQC',
    },
    inventoryTransactionId: {
      type: Schema.Types.ObjectId,
      ref: 'InventoryTransaction',
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
  { timestamps: true }
);

productionOutputSchema.index({ tenantId: 1, outputNumber: 1 }, { unique: true });
productionOutputSchema.index({ tenantId: 1, productionOrderId: 1 });
productionOutputSchema.index({ tenantId: 1, itemId: 1 });
productionOutputSchema.index({ tenantId: 1, warehouseId: 1 });
productionOutputSchema.index({ tenantId: 1, batchNumber: 1 });
productionOutputSchema.index({ tenantId: 1, productionDate: -1 });

export const ProductionOutput = model<IProductionOutput>('ProductionOutput', productionOutputSchema);
