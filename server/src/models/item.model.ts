import { Schema, model, Document, Types } from 'mongoose';

export type ItemType =
  | 'RAW_MATERIAL'
  | 'FINISHED_GOOD'
  | 'SEMI_FINISHED'
  | 'CONSUMABLE'
  | 'PACKAGING'
  | 'SERVICE'
  | 'OTHER';

export interface IItem extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  sku: string;
  itemCode: string;
  name: string;
  description?: string;
  categoryId: Types.ObjectId;
  subCategoryId?: Types.ObjectId;
  itemType: ItemType;
  baseUomId: Types.ObjectId;
  purchaseUomId?: Types.ObjectId;
  salesUomId?: Types.ObjectId;
  conversionFactor?: number;
  batchManaged: boolean;
  serialManaged: boolean;
  expiryManaged: boolean;
  qcRequired: boolean;
  reorderLevel: number;
  minimumStock: number;
  maximumStock: number;
  standardCost: number;
  sellingPrice: number;
  taxCodeId?: Types.ObjectId;
  status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<IItem>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    itemCode: {
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
    description: {
      type: String,
      trim: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    subCategoryId: {
      type: Schema.Types.ObjectId,
      ref: 'SubCategory',
    },
    itemType: {
      type: String,
      enum: [
        'RAW_MATERIAL',
        'FINISHED_GOOD',
        'SEMI_FINISHED',
        'CONSUMABLE',
        'PACKAGING',
        'SERVICE',
        'OTHER',
      ],
      default: 'RAW_MATERIAL',
      index: true,
    },
    baseUomId: {
      type: Schema.Types.ObjectId,
      ref: 'UOM',
      required: true,
    },
    purchaseUomId: {
      type: Schema.Types.ObjectId,
      ref: 'UOM',
    },
    salesUomId: {
      type: Schema.Types.ObjectId,
      ref: 'UOM',
    },
    conversionFactor: {
      type: Number,
      default: 1,
    },
    batchManaged: {
      type: Boolean,
      default: false,
    },
    serialManaged: {
      type: Boolean,
      default: false,
    },
    expiryManaged: {
      type: Boolean,
      default: false,
    },
    qcRequired: {
      type: Boolean,
      default: false,
    },
    reorderLevel: {
      type: Number,
      default: 0,
      min: 0,
    },
    minimumStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    maximumStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    standardCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    sellingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxCodeId: {
      type: Schema.Types.ObjectId,
      ref: 'TaxCode',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'DISCONTINUED'],
      default: 'ACTIVE',
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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

itemSchema.index({ tenantId: 1, sku: 1 }, { unique: true });
itemSchema.index({ tenantId: 1, itemCode: 1 }, { unique: true });
itemSchema.index({ tenantId: 1, name: 1 });

export const Item = model<IItem>('Item', itemSchema);
