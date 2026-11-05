import { Request } from 'express';
import { Types } from 'mongoose';
import { ITenant } from '../models/tenant.model';
import { IUser } from '../models/user.model';
import { TenantPlan } from '../config/constants';

export interface TokenPayload {
  userId: string;
  email: string;
  tenantId?: string | null;
  roles: string[];
  permissions: string[];
  isSuperAdmin: boolean;
}

export interface AuthenticatedUser {
  _id: Types.ObjectId;
  tenantId?: Types.ObjectId | null;
  name: string;
  email: string;
  status: string;
  roles: string[]; // Slugs or Names
  permissions: string[]; // Computed flat array of codes
  accessScope: {
    warehouses?: string[];
    department?: string;
    maxApprovalLimit?: number;
  };
  isSuperAdmin: boolean;
}

export interface AuthenticatedTenant {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  status: string;
  plan: TenantPlan;
  contactEmail?: string;
  phone?: string;
  organizationType?: string;
  country?: string;
  address?: any;
  settings: Record<string, any>;
  features?: Record<string, boolean>;
  quotas?: Record<string, number>;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  tenant?: AuthenticatedTenant;
  requestId?: string;
}
