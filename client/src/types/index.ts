export type TenantPlan = 'FREE' | 'STARTER' | 'GROWTH' | 'ENTERPRISE';
export type TenantStatus = 'ACTIVE' | 'TRIAL' | 'SUSPENDED';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'INVITED' | 'SUSPENDED';

export interface UserAccessScope {
  warehouses: string[];
  department?: string;
  businessUnit?: string;
  store?: string;
  maxApprovalLimit?: number;
  restrictToOwnedDocuments?: boolean;
}

export interface UserProfile {
  id: string;
  _id?: string;
  tenantId?: string | null;
  name: string;
  email: string;
  phone?: string;
  status: UserStatus;
  roles: Array<{ id: string; name: string; slug: string }> | string[];
  directPermissions?: string[];
  permissions?: string[];
  accessScope: UserAccessScope;
  isSuperAdmin: boolean;
  lastLoginAt?: string;
  createdAt?: string;
}

export interface TenantSettings {
  currency: string;
  timezone: string;
  dateFormat: string;
  logoUrl?: string;
  fiscalYearStartMonth: number;
}

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  plan: TenantPlan;
  contactEmail?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  settings: TenantSettings;
  features?: Record<string, boolean>;
  quotas?: Record<string, number>;
}

export interface RoleDefinition {
  _id?: string;
  id?: string;
  name: string;
  slug: string;
  description?: string;
  permissions: string[];
  isSystemRole: boolean;
  tenantId?: string | null;
}

export interface PermissionDefinition {
  code: string;
  name: string;
  category: string;
  description: string;
}

export interface AuditLogItem {
  _id: string;
  tenantId?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
  previousState?: any;
  newState?: any;
  ipAddress?: string;
  createdAt: string;
}

export interface DemoPersona {
  key: string;
  name: string;
  role: string;
  email: string;
  badge: string;
  description: string;
  color: string;
}

export interface SubscriptionData {
  plan: TenantPlan;
  features: Record<string, boolean>;
  quotas: Record<string, number>;
  usage: {
    userCount: number;
  };
}
