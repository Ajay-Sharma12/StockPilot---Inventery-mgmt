import { Schema, model, Document, Types } from 'mongoose';

export type PRPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type PRStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PARTIALLY_APPROVED'
  | 'REJECTED'
  | 'STOCK_CHECK_PENDING'
  | 'PARTIALLY_AVAILABLE'
  | 'PURCHASE_REQUIRED'
  | 'PARTIALLY_ISSUED'
  | 'ISSUED'
  | 'FULFILLED'
  | 'CONVERTED'
  | 'CLOSED'
  | 'CANCELLED';

export interface IPurchaseRequisitionItem {
  _id?: Types.ObjectId;
  itemId: Types.ObjectId;
  description?: string;
  requestedQuantity: number;
  approvedQuantity?: number;
  issuedQuantity?: number;
  remainingQuantity?: number;
  availableQuantityAtCheck?: number;
  shortageQuantity?: number;
  uomId: Types.ObjectId;
  estimatedUnitPrice: number;
  estimatedTotal: number;
  requiredDate?: Date;
  remarks?: string;
}

export interface IPurchaseRequisition extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  prNumber: string;
  requesterId: Types.ObjectId;
  departmentId?: Types.ObjectId;
  warehouseId: Types.ObjectId;
  requiredDate: Date;
  priority: PRPriority;
  purpose?: string;
  notes?: string;
  items: IPurchaseRequisitionItem[];
  estimatedTotal: number;
  attachments?: string[];
  status: PRStatus;
  approvalComment?: string;
  submittedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  issuedAt?: Date;
  fulfilledAt?: Date;
  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;
  cancellationReason?: string;
  approvedBy?: Types.ObjectId;
  rejectedBy?: Types.ObjectId;
  rejectionReason?: string;
  stockIssueTransactionIds?: Types.ObjectId[];
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const prItemSchema = new Schema<IPurchaseRequisitionItem>(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    requestedQuantity: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    approvedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    issuedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    remainingQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    availableQuantityAtCheck: {
      type: Number,
      default: 0,
      min: 0,
    },
    shortageQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    uomId: {
      type: Schema.Types.ObjectId,
      ref: 'UOM',
      required: true,
    },
    estimatedUnitPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    estimatedTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    requiredDate: {
      type: Date,
    },
    remarks: {
      type: String,
      trim: true,
    },
  },
  { _id: true }
);

const purchaseRequisitionSchema = new Schema<IPurchaseRequisition>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    prNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    requesterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    requiredDate: {
      type: Date,
      required: true,
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
      index: true,
    },
    purpose: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    items: [prItemSchema],
    estimatedTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    attachments: [
      {
        type: String,
      },
    ],
    status: {
      type: String,
      enum: [
        'DRAFT',
        'SUBMITTED',
        'PENDING_APPROVAL',
        'APPROVED',
        'PARTIALLY_APPROVED',
        'REJECTED',
        'STOCK_CHECK_PENDING',
        'PARTIALLY_AVAILABLE',
        'PURCHASE_REQUIRED',
        'PARTIALLY_ISSUED',
        'ISSUED',
        'FULFILLED',
        'CONVERTED',
        'CLOSED',
        'CANCELLED',
      ],
      default: 'DRAFT',
      index: true,
    },
    approvalComment: {
      type: String,
      trim: true,
    },
    submittedAt: {
      type: Date,
    },
    approvedAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },
    issuedAt: {
      type: Date,
    },
    fulfilledAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    stockIssueTransactionIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'InventoryTransaction',
      },
    ],
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

purchaseRequisitionSchema.index({ tenantId: 1, prNumber: 1 }, { unique: true });
purchaseRequisitionSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
purchaseRequisitionSchema.index({ tenantId: 1, requesterId: 1, createdAt: -1 });
purchaseRequisitionSchema.index({ tenantId: 1, warehouseId: 1 });

export const PurchaseRequisition = model<IPurchaseRequisition>(
  'PurchaseRequisition',
  purchaseRequisitionSchema
);
