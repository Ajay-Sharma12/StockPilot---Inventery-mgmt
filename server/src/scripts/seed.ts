import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { logger } from '../core/logger';
import { Tenant, ITenant } from '../models/tenant.model';
import { Role, IRole } from '../models/role.model';
import { User } from '../models/user.model';
import { TenantSubscription } from '../models/subscription.model';
import { AuditLog } from '../models/auditLog.model';
import { RefreshToken } from '../models/refreshToken.model';
import {
  TenantPlan,
  TenantStatus,
  UserStatus,
  AuditAction,
  AuditEntity,
  SYSTEM_ROLE_SLUGS,
  DEFAULT_PLAN_ENTITLEMENTS,
} from '../config/constants';
import { PERMISSIONS } from '../config/permissions.config';

export const seedDatabase = async () => {
  try {
    await connectDatabase();
    logger.info('🌱 Starting StockPilot Enterprise Database Seeding...');

    // 1. Clean existing collections
    await Promise.all([
      Tenant.deleteMany({}),
      Role.deleteMany({}),
      User.deleteMany({}),
      TenantSubscription.deleteMany({}),
      AuditLog.deleteMany({}),
      RefreshToken.deleteMany({}),
    ]);
    logger.info('🧹 Cleaned existing database collections');

    // 2. Seed System Roles (tenantId: null)
    const systemRoles = [
      {
        name: 'Platform Super Administrator',
        slug: SYSTEM_ROLE_SLUGS.SUPER_ADMIN,
        description: 'Global control across platform tenants, subscriptions, and system audits',
        permissions: ['*'],
        isSystemRole: true,
      },
      {
        name: 'Tenant Administrator',
        slug: SYSTEM_ROLE_SLUGS.TENANT_ADMIN,
        description: 'Full organizational authority over users, roles, settings, entitlements, and modules',
        permissions: [
          PERMISSIONS.TENANT_READ,
          PERMISSIONS.TENANT_UPDATE,
          PERMISSIONS.USERS_READ,
          PERMISSIONS.USERS_CREATE,
          PERMISSIONS.USERS_UPDATE,
          PERMISSIONS.USERS_DELETE,
          PERMISSIONS.USERS_MANAGE,
          PERMISSIONS.ROLES_READ,
          PERMISSIONS.ROLES_CREATE,
          PERMISSIONS.ROLES_UPDATE,
          PERMISSIONS.ROLES_DELETE,
          PERMISSIONS.SUBSCRIPTION_READ,
          PERMISSIONS.SUBSCRIPTION_MANAGE,
          PERMISSIONS.AUDIT_READ,
          PERMISSIONS.AUDIT_EXPORT,
          PERMISSIONS.INVENTORY_READ,
          PERMISSIONS.INVENTORY_CREATE,
          PERMISSIONS.INVENTORY_UPDATE,
          PERMISSIONS.INVENTORY_ADJUST,
          PERMISSIONS.INVENTORY_TRANSFER,
          PERMISSIONS.INVENTORY_COUNT,
          PERMISSIONS.WAREHOUSE_READ,
          PERMISSIONS.WAREHOUSE_MANAGE,
          PERMISSIONS.PURCHASE_READ,
          PERMISSIONS.PURCHASE_CREATE,
          PERMISSIONS.PURCHASE_UPDATE,
          PERMISSIONS.PURCHASE_APPROVE,
          PERMISSIONS.SUPPLIERS_READ,
          PERMISSIONS.SUPPLIERS_MANAGE,
          PERMISSIONS.GRN_READ,
          PERMISSIONS.GRN_CREATE,
          // Phase 3 Granular Procurement Permissions
          PERMISSIONS.PR_VIEW,
          PERMISSIONS.PR_CREATE,
          PERMISSIONS.PR_EDIT,
          PERMISSIONS.PR_DELETE,
          PERMISSIONS.PR_SUBMIT,
          PERMISSIONS.PR_APPROVE,
          PERMISSIONS.PR_REJECT,
          PERMISSIONS.PR_EXPORT,
          PERMISSIONS.RFQ_VIEW,
          PERMISSIONS.RFQ_CREATE,
          PERMISSIONS.RFQ_EDIT,
          PERMISSIONS.RFQ_ISSUE,
          PERMISSIONS.RFQ_CLOSE,
          PERMISSIONS.RFQ_EXPORT,
          PERMISSIONS.QUOTE_VIEW,
          PERMISSIONS.QUOTE_CREATE,
          PERMISSIONS.QUOTE_EDIT,
          PERMISSIONS.QUOTE_FINALIZE,
          PERMISSIONS.QUOTE_REJECT,
          PERMISSIONS.QUOTE_EXPORT,
          PERMISSIONS.PO_VIEW,
          PERMISSIONS.PO_CREATE,
          PERMISSIONS.PO_EDIT,
          PERMISSIONS.PO_SUBMIT,
          PERMISSIONS.PO_APPROVE,
          PERMISSIONS.PO_REJECT,
          PERMISSIONS.PO_SEND,
          PERMISSIONS.PO_CANCEL,
          PERMISSIONS.PO_EXPORT,
          PERMISSIONS.GRN_VIEW,
          PERMISSIONS.GRN_EDIT,
          PERMISSIONS.GRN_RECEIVE,
          PERMISSIONS.GRN_COMPLETE,
          PERMISSIONS.GRN_CANCEL,
          PERMISSIONS.PURCHASE_QC_VIEW,
          PERMISSIONS.PURCHASE_QC_CREATE,
          PERMISSIONS.PURCHASE_QC_INSPECT,
          PERMISSIONS.PURCHASE_QC_APPROVE,
          PERMISSIONS.PURCHASE_QC_REJECT,
          PERMISSIONS.PURCHASE_QC_HOLD,
          PERMISSIONS.PURCHASE_QC_DISPOSITION,
          PERMISSIONS.SALES_READ,
          PERMISSIONS.SALES_CREATE,
          PERMISSIONS.SALES_UPDATE,
          PERMISSIONS.SALES_APPROVE,
          PERMISSIONS.CUSTOMERS_READ,
          PERMISSIONS.CUSTOMERS_MANAGE,
          PERMISSIONS.DISPATCH_MANAGE,
          PERMISSIONS.INVOICES_READ,
          PERMISSIONS.INVOICES_CREATE,
          PERMISSIONS.PAYMENTS_READ,
          PERMISSIONS.PAYMENTS_CREATE,
          PERMISSIONS.GATEPASS_READ,
          PERMISSIONS.GATEPASS_MANAGE,
          PERMISSIONS.SO_VIEW,
          PERMISSIONS.SO_CREATE,
          PERMISSIONS.SO_EDIT,
          PERMISSIONS.SO_SUBMIT,
          PERMISSIONS.SO_APPROVE,
          PERMISSIONS.SO_REJECT,
          PERMISSIONS.SO_CONFIRM,
          PERMISSIONS.SO_CANCEL,
          PERMISSIONS.SO_ALLOCATE,
          PERMISSIONS.SO_EXPORT,
          PERMISSIONS.PKG_VIEW,
          PERMISSIONS.PKG_CREATE,
          PERMISSIONS.PKG_PACK,
          PERMISSIONS.PKG_CANCEL,
          PERMISSIONS.DISPATCH_VIEW,
          PERMISSIONS.DISPATCH_CREATE,
          PERMISSIONS.DISPATCH_DISPATCH,
          PERMISSIONS.DISPATCH_CANCEL,
          PERMISSIONS.GATEPASS_VIEW,
          PERMISSIONS.GATEPASS_CREATE,
          PERMISSIONS.GATEPASS_APPROVE,
          PERMISSIONS.GATEPASS_GATEOUT,
          PERMISSIONS.GATEPASS_CLOSE,
          PERMISSIONS.INVOICE_VIEW,
          PERMISSIONS.INVOICE_CREATE,
          PERMISSIONS.INVOICE_ISSUE,
          PERMISSIONS.INVOICE_CANCEL,
          PERMISSIONS.INVOICE_EXPORT,
          PERMISSIONS.PAYMENT_VIEW,
          PERMISSIONS.PAYMENT_CREATE,
          PERMISSIONS.PAYMENT_REVERSE,
          PERMISSIONS.PAYMENT_EXPORT,
          PERMISSIONS.PRODUCTION_READ,
          PERMISSIONS.PRODUCTION_CREATE,
          PERMISSIONS.PRODUCTION_UPDATE,
          PERMISSIONS.BOM_READ,
          PERMISSIONS.BOM_MANAGE,
          PERMISSIONS.BATCH_MANAGE,
          PERMISSIONS.QC_READ,
          PERMISSIONS.QC_INSPECT,
          PERMISSIONS.QC_TEMPLATES,
          PERMISSIONS.QC_APPROVE,
          PERMISSIONS.REPORTS_READ,
          PERMISSIONS.REPORTS_EXPORT,
        ],
        isSystemRole: true,
      },
      {
        name: 'Operations Manager',
        slug: SYSTEM_ROLE_SLUGS.OPERATIONS_MANAGER,
        description: 'Cross-functional operational oversight of inventory, procurement, and production',
        permissions: [
          PERMISSIONS.TENANT_READ,
          PERMISSIONS.INVENTORY_READ,
          PERMISSIONS.INVENTORY_CREATE,
          PERMISSIONS.INVENTORY_UPDATE,
          PERMISSIONS.INVENTORY_ADJUST,
          PERMISSIONS.INVENTORY_TRANSFER,
          PERMISSIONS.INVENTORY_COUNT,
          PERMISSIONS.WAREHOUSE_READ,
          PERMISSIONS.PURCHASE_READ,
          PERMISSIONS.PURCHASE_CREATE,
          PERMISSIONS.PURCHASE_UPDATE,
          PERMISSIONS.PURCHASE_APPROVE,
          PERMISSIONS.SUPPLIERS_READ,
          PERMISSIONS.GRN_READ,
          PERMISSIONS.PR_VIEW,
          PERMISSIONS.PR_APPROVE,
          PERMISSIONS.PR_REJECT,
          PERMISSIONS.RFQ_VIEW,
          PERMISSIONS.RFQ_CREATE,
          PERMISSIONS.QUOTE_VIEW,
          PERMISSIONS.QUOTE_FINALIZE,
          PERMISSIONS.PO_VIEW,
          PERMISSIONS.PO_CREATE,
          PERMISSIONS.PO_APPROVE,
          PERMISSIONS.PO_REJECT,
          PERMISSIONS.PO_SEND,
          PERMISSIONS.GRN_VIEW,
          PERMISSIONS.GRN_RECEIVE,
          PERMISSIONS.PURCHASE_QC_VIEW,
          PERMISSIONS.PURCHASE_QC_APPROVE,
          PERMISSIONS.PURCHASE_QC_DISPOSITION,
          PERMISSIONS.SALES_READ,
          PERMISSIONS.CUSTOMERS_READ,
          PERMISSIONS.PRODUCTION_READ,
          PERMISSIONS.PRODUCTION_CREATE,
          PERMISSIONS.PRODUCTION_UPDATE,
          PERMISSIONS.BOM_READ,
          PERMISSIONS.BATCH_MANAGE,
          PERMISSIONS.QC_READ,
          PERMISSIONS.AUDIT_READ,
          PERMISSIONS.REPORTS_READ,
          PERMISSIONS.REPORTS_EXPORT,
        ],
        isSystemRole: true,
      },
      {
        name: 'Purchase Officer',
        slug: SYSTEM_ROLE_SLUGS.PURCHASE_OFFICER,
        description: 'Procurement execution, RFQs, purchase orders, vendor management and goods receipts',
        permissions: [
          PERMISSIONS.PURCHASE_READ,
          PERMISSIONS.PURCHASE_CREATE,
          PERMISSIONS.PURCHASE_UPDATE,
          PERMISSIONS.PURCHASE_APPROVE,
          PERMISSIONS.SUPPLIERS_READ,
          PERMISSIONS.SUPPLIERS_MANAGE,
          PERMISSIONS.GRN_READ,
          PERMISSIONS.GRN_CREATE,
          PERMISSIONS.PR_VIEW,
          PERMISSIONS.PR_CREATE,
          PERMISSIONS.PR_EDIT,
          PERMISSIONS.PR_SUBMIT,
          PERMISSIONS.PR_APPROVE,
          PERMISSIONS.RFQ_VIEW,
          PERMISSIONS.RFQ_CREATE,
          PERMISSIONS.RFQ_EDIT,
          PERMISSIONS.RFQ_ISSUE,
          PERMISSIONS.QUOTE_VIEW,
          PERMISSIONS.QUOTE_CREATE,
          PERMISSIONS.QUOTE_EDIT,
          PERMISSIONS.QUOTE_FINALIZE,
          PERMISSIONS.PO_VIEW,
          PERMISSIONS.PO_CREATE,
          PERMISSIONS.PO_EDIT,
          PERMISSIONS.PO_SUBMIT,
          PERMISSIONS.PO_APPROVE,
          PERMISSIONS.PO_SEND,
          PERMISSIONS.GRN_VIEW,
          PERMISSIONS.GRN_RECEIVE,
          PERMISSIONS.INVENTORY_READ,
          PERMISSIONS.REPORTS_READ,
        ],
        isSystemRole: true,
      },
      {
        name: 'Warehouse Clerk',
        slug: SYSTEM_ROLE_SLUGS.WAREHOUSE_CLERK,
        description: 'Store operations, stock adjustments, stock transfers, and physical counts in assigned facilities',
        permissions: [
          PERMISSIONS.INVENTORY_READ,
          PERMISSIONS.INVENTORY_ADJUST,
          PERMISSIONS.INVENTORY_TRANSFER,
          PERMISSIONS.INVENTORY_COUNT,
          PERMISSIONS.WAREHOUSE_READ,
          PERMISSIONS.GRN_READ,
          PERMISSIONS.GRN_CREATE,
          PERMISSIONS.GRN_VIEW,
          PERMISSIONS.GRN_RECEIVE,
          PERMISSIONS.DISPATCH_MANAGE,
        ],
        isSystemRole: true,
      },
      {
        name: 'Sales Representative',
        slug: SYSTEM_ROLE_SLUGS.SALES_REP,
        description: 'Customer order capture, quotations, invoicing, packaging, and dispatch tracking',
        permissions: [
          PERMISSIONS.SALES_READ,
          PERMISSIONS.SALES_CREATE,
          PERMISSIONS.SALES_UPDATE,
          PERMISSIONS.SALES_APPROVE,
          PERMISSIONS.CUSTOMERS_READ,
          PERMISSIONS.CUSTOMERS_MANAGE,
          PERMISSIONS.INVOICES_READ,
          PERMISSIONS.INVOICES_CREATE,
          PERMISSIONS.PAYMENTS_READ,
          PERMISSIONS.PAYMENTS_CREATE,
          PERMISSIONS.GATEPASS_READ,
          PERMISSIONS.GATEPASS_MANAGE,
          PERMISSIONS.DISPATCH_MANAGE,
          PERMISSIONS.SO_VIEW,
          PERMISSIONS.SO_CREATE,
          PERMISSIONS.SO_EDIT,
          PERMISSIONS.SO_SUBMIT,
          PERMISSIONS.SO_APPROVE,
          PERMISSIONS.SO_REJECT,
          PERMISSIONS.SO_CONFIRM,
          PERMISSIONS.SO_CANCEL,
          PERMISSIONS.SO_ALLOCATE,
          PERMISSIONS.SO_EXPORT,
          PERMISSIONS.PKG_VIEW,
          PERMISSIONS.PKG_CREATE,
          PERMISSIONS.PKG_PACK,
          PERMISSIONS.PKG_CANCEL,
          PERMISSIONS.DISPATCH_VIEW,
          PERMISSIONS.DISPATCH_CREATE,
          PERMISSIONS.DISPATCH_DISPATCH,
          PERMISSIONS.DISPATCH_CANCEL,
          PERMISSIONS.GATEPASS_VIEW,
          PERMISSIONS.GATEPASS_CREATE,
          PERMISSIONS.GATEPASS_APPROVE,
          PERMISSIONS.GATEPASS_GATEOUT,
          PERMISSIONS.GATEPASS_CLOSE,
          PERMISSIONS.INVOICE_VIEW,
          PERMISSIONS.INVOICE_CREATE,
          PERMISSIONS.INVOICE_ISSUE,
          PERMISSIONS.INVOICE_CANCEL,
          PERMISSIONS.INVOICE_EXPORT,
          PERMISSIONS.PAYMENT_VIEW,
          PERMISSIONS.PAYMENT_CREATE,
          PERMISSIONS.PAYMENT_REVERSE,
          PERMISSIONS.PAYMENT_EXPORT,
          PERMISSIONS.INVENTORY_READ,
          PERMISSIONS.REPORTS_READ,
        ],
        isSystemRole: true,
      },
      {
        name: 'Production Supervisor',
        slug: SYSTEM_ROLE_SLUGS.PRODUCTION_SUPERVISOR,
        description: 'Plant manufacturing work orders, Bill of Materials (BOM), batch tracking, and material consumption',
        permissions: [
          PERMISSIONS.PRODUCTION_READ,
          PERMISSIONS.PRODUCTION_CREATE,
          PERMISSIONS.PRODUCTION_UPDATE,
          PERMISSIONS.BOM_READ,
          PERMISSIONS.BATCH_MANAGE,
          PERMISSIONS.INVENTORY_READ,
          PERMISSIONS.QC_READ,
          PERMISSIONS.REPORTS_READ,
        ],
        isSystemRole: true,
      },
      {
        name: 'QC Inspector',
        slug: SYSTEM_ROLE_SLUGS.QC_INSPECTOR,
        description: 'Quality checklists, incoming shipment inspections, batch sign-offs, and compliance quarantine',
        permissions: [
          PERMISSIONS.QC_READ,
          PERMISSIONS.QC_INSPECT,
          PERMISSIONS.QC_TEMPLATES,
          PERMISSIONS.QC_APPROVE,
          PERMISSIONS.PURCHASE_QC_VIEW,
          PERMISSIONS.PURCHASE_QC_CREATE,
          PERMISSIONS.PURCHASE_QC_INSPECT,
          PERMISSIONS.PURCHASE_QC_APPROVE,
          PERMISSIONS.PURCHASE_QC_REJECT,
          PERMISSIONS.PURCHASE_QC_HOLD,
          PERMISSIONS.PURCHASE_QC_DISPOSITION,
          PERMISSIONS.INVENTORY_READ,
          PERMISSIONS.BATCH_MANAGE,
          PERMISSIONS.REPORTS_READ,
        ],
        isSystemRole: true,
      },
      {
        name: 'Compliance Auditor',
        slug: SYSTEM_ROLE_SLUGS.AUDITOR,
        description: 'Strictly read-only access for compliance, audit trail analysis, and governance reporting',
        permissions: [
          PERMISSIONS.AUDIT_READ,
          PERMISSIONS.AUDIT_EXPORT,
          PERMISSIONS.REPORTS_READ,
          PERMISSIONS.REPORTS_EXPORT,
          PERMISSIONS.TENANT_READ,
          PERMISSIONS.USERS_READ,
          PERMISSIONS.ROLES_READ,
          PERMISSIONS.INVENTORY_READ,
          PERMISSIONS.PURCHASE_READ,
          PERMISSIONS.PR_VIEW,
          PERMISSIONS.RFQ_VIEW,
          PERMISSIONS.QUOTE_VIEW,
          PERMISSIONS.PO_VIEW,
          PERMISSIONS.GRN_VIEW,
          PERMISSIONS.PURCHASE_QC_VIEW,
          PERMISSIONS.SALES_READ,
          PERMISSIONS.PRODUCTION_READ,
          PERMISSIONS.QC_READ,
        ],
        isSystemRole: true,
      },
    ];

    const seededRoles = await Role.insertMany(systemRoles);
    logger.info(`✅ Seeded ${seededRoles.length} system roles`);

    const roleMap = new Map<string, IRole>();
    seededRoles.forEach((r) => roleMap.set(r.slug, r as IRole));

    // 3. Seed Primary Tenant: Apex Industrial Logistics (Growth Plan)
    const apexTenant = await Tenant.create({
      name: 'Apex Industrial Logistics',
      slug: 'apex-logistics',
      status: TenantStatus.ACTIVE,
      plan: TenantPlan.GROWTH,
      contactEmail: 'contact@apexlogistics.com',
      phone: '+1 (555) 392-8491',
      address: {
        street: '742 Evergreen Industrial Parkway',
        city: 'Chicago',
        state: 'IL',
        country: 'United States',
        postalCode: '60601',
      },
      settings: {
        currency: 'USD',
        timezone: 'America/Chicago',
        dateFormat: 'YYYY-MM-DD',
        fiscalYearStartMonth: 1,
        logoUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=128&auto=format&fit=crop&q=80',
      },
    });

    const growthEntitlements = DEFAULT_PLAN_ENTITLEMENTS[TenantPlan.GROWTH];
    await TenantSubscription.create({
      tenantId: apexTenant._id,
      planId: TenantPlan.GROWTH,
      status: 'ACTIVE',
      features: new Map(Object.entries(growthEntitlements.features)),
      quotas: new Map(Object.entries(growthEntitlements.quotas)),
      billingCycle: 'ANNUAL',
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });

    // 4. Seed Secondary Tenant: Nova Dynamics (Starter Plan)
    const novaTenant = await Tenant.create({
      name: 'Nova Dynamics',
      slug: 'nova-dynamics',
      status: TenantStatus.ACTIVE,
      plan: TenantPlan.STARTER,
      contactEmail: 'hello@novadynamics.io',
      phone: '+1 (555) 781-9920',
      address: {
        street: '100 Silicon Ave, Suite 400',
        city: 'Austin',
        state: 'TX',
        country: 'United States',
        postalCode: '78701',
      },
      settings: {
        currency: 'USD',
        timezone: 'America/Chicago',
        dateFormat: 'YYYY-MM-DD',
        fiscalYearStartMonth: 4,
      },
    });

    const starterEntitlements = DEFAULT_PLAN_ENTITLEMENTS[TenantPlan.STARTER];
    await TenantSubscription.create({
      tenantId: novaTenant._id,
      planId: TenantPlan.STARTER,
      status: 'ACTIVE',
      features: new Map(Object.entries(starterEntitlements.features)),
      quotas: new Map(Object.entries(starterEntitlements.quotas)),
      billingCycle: 'MONTHLY',
    });

    logger.info('✅ Seeded 2 Tenants (Apex Industrial Logistics [GROWTH], Nova Dynamics [STARTER])');

    // 5. Seed Users & Personas
    const defaultPassword = 'Password123!';
    const passwordHash = await bcrypt.hash(defaultPassword, 12);

    const usersToSeed = [
      // 1. Super Admin
      {
        name: 'StockPilot Super Admin',
        email: 'superadmin@stockpilot.io',
        tenantId: null,
        status: UserStatus.ACTIVE,
        roles: [roleMap.get(SYSTEM_ROLE_SLUGS.SUPER_ADMIN)!._id],
        directPermissions: ['*'],
        accessScope: {
          warehouses: [],
          department: 'Platform Governance',
          maxApprovalLimit: 999999999,
        },
        isSuperAdmin: true,
      },
      // 2. Tenant Admin (Apex Logistics)
      {
        name: 'Sarah Connor',
        email: 'admin@apexlogistics.com',
        tenantId: apexTenant._id,
        status: UserStatus.ACTIVE,
        roles: [roleMap.get(SYSTEM_ROLE_SLUGS.TENANT_ADMIN)!._id],
        directPermissions: [],
        accessScope: {
          warehouses: [],
          department: 'Executive Management',
          maxApprovalLimit: 1000000,
        },
        isSuperAdmin: false,
      },
      // 3. Operations Manager
      {
        name: 'David Miller',
        email: 'operations@apexlogistics.com',
        tenantId: apexTenant._id,
        status: UserStatus.ACTIVE,
        roles: [roleMap.get(SYSTEM_ROLE_SLUGS.OPERATIONS_MANAGER)!._id],
        directPermissions: [],
        accessScope: {
          warehouses: [],
          department: 'Operations',
          maxApprovalLimit: 100000,
        },
        isSuperAdmin: false,
      },
      // 4. Purchase Officer (ABAC: Max Approval Limit $50,000)
      {
        name: 'Elena Rostova',
        email: 'purchase@apexlogistics.com',
        tenantId: apexTenant._id,
        status: UserStatus.ACTIVE,
        roles: [roleMap.get(SYSTEM_ROLE_SLUGS.PURCHASE_OFFICER)!._id],
        directPermissions: [],
        accessScope: {
          warehouses: [],
          department: 'Procurement',
          maxApprovalLimit: 50000,
        },
        isSuperAdmin: false,
      },
      // 5. Warehouse Clerk (ABAC: Assigned to WH-NORTH, WH-CENTRAL only)
      {
        name: 'Marcus Vance',
        email: 'store@apexlogistics.com',
        tenantId: apexTenant._id,
        status: UserStatus.ACTIVE,
        roles: [roleMap.get(SYSTEM_ROLE_SLUGS.WAREHOUSE_CLERK)!._id],
        directPermissions: [],
        accessScope: {
          warehouses: ['WH-NORTH', 'WH-CENTRAL'],
          department: 'Warehousing & Logistics',
          maxApprovalLimit: 0,
        },
        isSuperAdmin: false,
      },
      // 6. Sales Representative
      {
        name: 'Jessica Reynolds',
        email: 'sales@apexlogistics.com',
        tenantId: apexTenant._id,
        status: UserStatus.ACTIVE,
        roles: [roleMap.get(SYSTEM_ROLE_SLUGS.SALES_REP)!._id],
        directPermissions: [],
        accessScope: {
          warehouses: [],
          department: 'Commercial Sales',
          maxApprovalLimit: 10000,
        },
        isSuperAdmin: false,
      },
      // 7. Production Supervisor
      {
        name: 'Viktor Alvarez',
        email: 'production@apexlogistics.com',
        tenantId: apexTenant._id,
        status: UserStatus.ACTIVE,
        roles: [roleMap.get(SYSTEM_ROLE_SLUGS.PRODUCTION_SUPERVISOR)!._id],
        directPermissions: [],
        accessScope: {
          warehouses: [],
          department: 'Plant 1 Manufacturing',
          maxApprovalLimit: 15000,
        },
        isSuperAdmin: false,
      },
      // 8. QC Inspector
      {
        name: 'Dr. Mei Chen',
        email: 'qc@apexlogistics.com',
        tenantId: apexTenant._id,
        status: UserStatus.ACTIVE,
        roles: [roleMap.get(SYSTEM_ROLE_SLUGS.QC_INSPECTOR)!._id],
        directPermissions: [],
        accessScope: {
          warehouses: [],
          department: 'Quality Assurance',
          maxApprovalLimit: 0,
        },
        isSuperAdmin: false,
      },
      // 9. Compliance Auditor
      {
        name: 'Arthur Davies',
        email: 'auditor@apexlogistics.com',
        tenantId: apexTenant._id,
        status: UserStatus.ACTIVE,
        roles: [roleMap.get(SYSTEM_ROLE_SLUGS.AUDITOR)!._id],
        directPermissions: [],
        accessScope: {
          warehouses: [],
          department: 'Internal Audit & Governance',
          maxApprovalLimit: 0,
        },
        isSuperAdmin: false,
      },
      // 10. Nova Dynamics Admin
      {
        name: 'Alex Mercer',
        email: 'alex@novadynamics.io',
        tenantId: novaTenant._id,
        status: UserStatus.ACTIVE,
        roles: [roleMap.get(SYSTEM_ROLE_SLUGS.TENANT_ADMIN)!._id],
        directPermissions: [],
        accessScope: {
          warehouses: [],
          department: 'Executive Management',
          maxApprovalLimit: 500000,
        },
        isSuperAdmin: false,
      },
    ];

    for (const u of usersToSeed) {
      await User.create({
        ...u,
        passwordHash,
      });
    }

    logger.info(`✅ Seeded ${usersToSeed.length} user accounts with password: '${defaultPassword}'`);

    // 6. Seed Baseline Audit Logs
    const sampleLogs = [
      {
        tenantId: apexTenant._id,
        userName: 'Sarah Connor',
        userEmail: 'admin@apexlogistics.com',
        action: AuditAction.CREATE,
        entity: AuditEntity.TENANT,
        entityId: apexTenant._id.toString(),
        details: 'Organization initial workspace provisioned on GROWTH plan',
        ipAddress: '192.168.1.1',
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      },
      {
        tenantId: apexTenant._id,
        userName: 'Sarah Connor',
        userEmail: 'admin@apexlogistics.com',
        action: AuditAction.INVITE,
        entity: AuditEntity.USER,
        details: 'Invited Elena Rostova (purchase@apexlogistics.com) as Purchase Officer',
        ipAddress: '192.168.1.1',
        createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000),
      },
      {
        tenantId: apexTenant._id,
        userName: 'Sarah Connor',
        userEmail: 'admin@apexlogistics.com',
        action: AuditAction.UPDATE,
        entity: AuditEntity.SETTINGS,
        details: 'Configured default currency to USD and fiscal year start month to January',
        ipAddress: '192.168.1.1',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
      {
        tenantId: apexTenant._id,
        userName: 'David Miller',
        userEmail: 'operations@apexlogistics.com',
        action: AuditAction.LOGIN,
        entity: AuditEntity.AUTH,
        details: 'Operations console login via SSO',
        ipAddress: '192.168.1.45',
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      },
      {
        tenantId: apexTenant._id,
        userName: 'Elena Rostova',
        userEmail: 'purchase@apexlogistics.com',
        action: AuditAction.LOGIN,
        entity: AuditEntity.AUTH,
        details: 'Purchase officer login from desktop client',
        ipAddress: '192.168.1.88',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
    ];

    await AuditLog.insertMany(sampleLogs);
    logger.info(`✅ Seeded ${sampleLogs.length} baseline audit trail entries`);

    // 7. Seed Phase 2 Master Data & Centralized Inventory Engine
    const { seedPhase2Data } = await import('./seedPhase2');
    const adminUser = await User.findOne({ email: 'admin@apexlogistics.com' });
    if (adminUser) {
      await seedPhase2Data(apexTenant._id, adminUser._id);
    }

    // 8. Seed Phase 3 Procurement & Purchase Management
    const { seedPhase3Data } = await import('./seedPhase3');
    const purchaseUser = await User.findOne({ email: 'purchase@apexlogistics.com' });
    const storeUser = await User.findOne({ email: 'store@apexlogistics.com' });
    const qcUser = await User.findOne({ email: 'qc@apexlogistics.com' });

    if (adminUser && purchaseUser && storeUser && qcUser) {
      await seedPhase3Data(
        apexTenant._id,
        adminUser._id,
        purchaseUser._id,
        storeUser._id,
        qcUser._id
      );
    }

    // 9. Seed Phase 4 Sales & Order-to-Cash
    const { seedPhase4Data } = await import('./seedPhase4');
    const salesUser = await User.findOne({ email: 'sales@apexlogistics.com' });
    const opsUser = await User.findOne({ email: 'operations@apexlogistics.com' });

    if (adminUser && salesUser && storeUser && opsUser) {
      await seedPhase4Data(
        apexTenant._id,
        adminUser._id,
        salesUser._id,
        storeUser._id,
        opsUser._id
      );
    }

    logger.info('🎉 StockPilot Enterprise Database Seed Completed Successfully!');
    await disconnectDatabase();
  } catch (error) {
    logger.error('❌ Error during database seeding:', error);
    process.exit(1);
  }
};

// Execute if called directly
if (require.main === module) {
  seedDatabase();
}
