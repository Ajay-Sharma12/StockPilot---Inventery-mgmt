import { Schema, model, Document, Types } from 'mongoose';

export type SalesOrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CONFIRMED'
  | 'PARTIALLY_FULFILLED'
  | 'FULFILLED'
  | 'CANCELLED';

export type SalesOrderApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXEMPT';

export interface ISalesOrderItem {
  _id?: Types.ObjectId;
  itemId: Types.ObjectId;
  description?: string;
  orderedQuantity: number;
  uomId: Types.ObjectId;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  lineSubtotal: number;
  lineTotal: number;
  warehouseId?: Types.ObjectId;
  allocatedQuantity: number;
  packedQuantity: number;
  dispatchedQuantity: number;
  invoicedQuantity: number;
  pendingQuantity: number;
  remarks?: string;
}

export interface ISalesOrder extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  soNumber: string;
  customerId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  deliveryAddress?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  billingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  paymentTermId?: Types.ObjectId;
  orderDate: Date;
  requestedDeliveryDate?: Date;
  currency: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingAmount: number;
  grandTotal: number;
  notes?: string;
  attachments?: string[];
  status: SalesOrderStatus;
  approvalStatus: SalesOrderApprovalStatus;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  rejectedBy?: Types.ObjectId;
  rejectedAt?: Date;
  rejectionReason?: string;
  confirmedBy?: Types.ObjectId;
  confirmedAt?: Date;
  cancelledBy?: Types.ObjectId;
  cancelledAt?: Date;
  cancellationReason?: string;
  items: ISalesOrderItem[];
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const salesOrderItemSchema = new Schema<ISalesOrderItem>({
  itemId: {
    type: Schema.Types.ObjectId,
    ref: 'Item',
    required: true,
  },
  description: {
    type: String,
    trim: true,
  },
  orderedQuantity: {
    type: Number,
    required: true,
    min: [0.0001, 'Ordered quantity must be greater than zero'],
  },
  uomId: {
    type: Schema.Types.ObjectId,
    ref: 'UOM',
    required: true,
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
  },
  taxRate: {
    type: Number,
    default: 0,
    min: 0,
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  lineSubtotal: {
    type: Number,
    required: true,
    min: 0,
  },
  lineTotal: {
    type: Number,
    required: true,
    min: 0,
  },
  warehouseId: {
    type: Schema.Types.ObjectId,
    ref: 'Warehouse',
  },
  allocatedQuantity: {
    type: Number,
    default: 0,
    min: 0,
  },
  packedQuantity: {
    type: Number,
    default: 0,
    min: 0,
  },
  dispatchedQuantity: {
    type: Number,
    default: 0,
    min: 0,
  },
  invoicedQuantity: {
    type: Number,
    default: 0,
    min: 0,
  },
  pendingQuantity: {
    type: Number,
    default: 0,
    min: 0,
  },
  remarks: {
    type: String,
    trim: true,
  },
});

const salesOrderSchema = new Schema<ISalesOrder>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    soNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
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
    deliveryAddress: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String,
    },
    billingAddress: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String,
    },
    paymentTermId: {
      type: Schema.Types.ObjectId,
      ref: 'PaymentTerm',
    },
    orderDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    requestedDeliveryDate: {
      type: Date,
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
    },
    subtotal: {
      type: Number,
      required: true,
      default: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    shippingAmount: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
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
        'APPROVED',
        'REJECTED',
        'CONFIRMED',
        'PARTIALLY_FULFILLED',
        'FULFILLED',
        'CANCELLED',
      ],
      default: 'DRAFT',
      index: true,
    },
    approvalStatus: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'EXEMPT'],
      default: 'PENDING',
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: Date,
    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectedAt: Date,
    rejectionReason: String,
    confirmedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    confirmedAt: Date,
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    cancelledAt: Date,
    cancellationReason: String,
    items: [salesOrderItemSchema],
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

salesOrderSchema.index({ tenantId: 1, soNumber: 1 }, { unique: true });
salesOrderSchema.index({ tenantId: 1, status: 1, orderDate: -1 });
salesOrderSchema.index({ tenantId: 1, customerId: 1 });
salesOrderSchema.index({ tenantId: 1, warehouseId: 1 });

export const SalesOrder = model<ISalesOrder>('SalesOrder', salesOrderSchema);
