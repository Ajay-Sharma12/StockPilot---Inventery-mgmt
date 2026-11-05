import { Schema, model, Document, Types } from 'mongoose';
import { UserStatus } from '../config/constants';

export interface IUserAccessScope {
  warehouses: string[];
  department?: string;
  businessUnit?: string;
  store?: string;
  maxApprovalLimit?: number;
  restrictToOwnedDocuments?: boolean;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  tenantId?: Types.ObjectId | null;
  name: string;
  email: string;
  passwordHash: string;
  phone?: string;
  status: UserStatus;
  roles: Types.ObjectId[];
  directPermissions: string[];
  accessScope: IUserAccessScope;
  isSuperAdmin: boolean;
  lastLoginAt?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  termsAcceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // Do not return by default
    },
    phone: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.ACTIVE,
      index: true,
    },
    roles: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Role',
      },
    ],
    directPermissions: [
      {
        type: String,
      },
    ],
    accessScope: {
      warehouses: {
        type: [String],
        default: [],
      },
      department: {
        type: String,
      },
      businessUnit: {
        type: String,
      },
      store: {
        type: String,
      },
      maxApprovalLimit: {
        type: Number,
        default: 0,
      },
      restrictToOwnedDocuments: {
        type: Boolean,
        default: false,
      },
    },
    isSuperAdmin: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastLoginAt: {
      type: Date,
    },
    passwordResetTokenHash: {
      type: String,
      select: false,
      index: true,
    },
    passwordResetExpiresAt: {
      type: Date,
    },
    termsAcceptedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Email uniqueness per tenant; for super admins (tenantId: null), email must still be unique globally
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });

export const User = model<IUser>('User', userSchema);
