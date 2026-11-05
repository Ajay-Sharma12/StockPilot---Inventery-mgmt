export enum TenantPlan {
  FREE = 'FREE',
  STARTER = 'STARTER',
  GROWTH = 'GROWTH',
  ENTERPRISE = 'ENTERPRISE',
}

export enum TenantStatus {
  ACTIVE = 'ACTIVE',
  TRIAL = 'TRIAL',
  SUSPENDED = 'SUSPENDED',
  ARCHIVED = 'ARCHIVED',
  ARCHIVED_DEMO = 'ARCHIVED_DEMO',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  INVITED = 'INVITED',
  SUSPENDED = 'SUSPENDED',
}

export enum AuditAction {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  INVITE = 'INVITE',
  STATUS_CHANGE = 'STATUS_CHANGE',
  PASSWORD_RESET = 'PASSWORD_RESET',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
}

export enum AuditEntity {
  AUTH = 'AUTH',
  USER = 'USER',
  ROLE = 'ROLE',
  TENANT = 'TENANT',
  SETTINGS = 'SETTINGS',
  SUBSCRIPTION = 'SUBSCRIPTION',
  INVENTORY = 'INVENTORY',
  PURCHASE = 'PURCHASE',
  SALES = 'SALES',
  PRODUCTION = 'PRODUCTION',
  QC = 'QC',
  REPORTING = 'REPORTING',
  ANALYTICS = 'ANALYTICS',
  AI = 'AI',
}

export const SYSTEM_ROLE_SLUGS = {
  SUPER_ADMIN: 'super-admin',
  TENANT_ADMIN: 'tenant-admin',
  OPERATIONS_MANAGER: 'operations-manager',
  PURCHASE_OFFICER: 'purchase-officer',
  WAREHOUSE_CLERK: 'warehouse-clerk',
  SALES_REP: 'sales-representative',
  PRODUCTION_SUPERVISOR: 'production-supervisor',
  QC_INSPECTOR: 'qc-inspector',
  AUDITOR: 'auditor',
} as const;

export const DEFAULT_PLAN_ENTITLEMENTS: Record<
  TenantPlan,
  {
    features: Record<string, boolean>;
    quotas: Record<string, number>;
  }
> = {
  [TenantPlan.FREE]: {
    features: {
      sales: true,
      procurement: true,
      production: false,
      reports: true,
      ai: false,
      multiWarehouse: false,
      batchTracking: false,
      qualityControl: false,
      advancedAnalytics: true,
      apiAccess: false,
      customRoles: true,
      auditExport: false,
    },
    quotas: {
      maxUsers: 3,
      maxWarehouses: 1,
      maxProducts: 50,
    },
  },
  [TenantPlan.STARTER]: {
    features: {
      sales: true,
      procurement: true,
      production: true,
      reports: true,
      ai: false,
      multiWarehouse: false,
      batchTracking: true,
      qualityControl: true,
      advancedAnalytics: true,
      apiAccess: false,
      customRoles: true,
      auditExport: false,
    },
    quotas: {
      maxUsers: 10,
      maxWarehouses: 2,
      maxProducts: 1000,
    },
  },
  [TenantPlan.GROWTH]: {
    features: {
      sales: true,
      procurement: true,
      production: true,
      reports: true,
      ai: true,
      multiWarehouse: true,
      batchTracking: true,
      qualityControl: true,
      advancedAnalytics: true,
      apiAccess: false,
      customRoles: true,
      auditExport: true,
    },
    quotas: {
      maxUsers: 50,
      maxWarehouses: 10,
      maxProducts: 25000,
    },
  },
  [TenantPlan.ENTERPRISE]: {
    features: {
      sales: true,
      procurement: true,
      production: true,
      reports: true,
      ai: true,
      multiWarehouse: true,
      batchTracking: true,
      qualityControl: true,
      advancedAnalytics: true,
      apiAccess: true,
      customRoles: true,
      auditExport: true,
    },
    quotas: {
      maxUsers: 1000,
      maxWarehouses: 100,
      maxProducts: 500000,
    },
  },
};
