import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../core/types';
import { authService } from '../services/auth.service';
import { sendSuccess, sendCreated } from '../core/responseHandler';
import { User } from '../models/user.model';
import { Tenant } from '../models/tenant.model';
import { TenantSubscription } from '../models/subscription.model';
import { IRole, Role } from '../models/role.model';
import { DEFAULT_PLAN_ENTITLEMENTS, TenantPlan, SYSTEM_ROLE_SLUGS, UserStatus } from '../config/constants';
import { Types } from 'mongoose';

export class AuthController {
  async login(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, tenantSlug } = req.body;
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      console.log('🔑 [LOGIN ATTEMPT]', { 
        email: email ? email.trim().toLowerCase() : undefined, 
        tenantSlug, 
        passwordLength: password?.length 
      });

      const result = await authService.login(email, password, tenantSlug, ipAddress, userAgent);
      console.log('✅ [LOGIN SUCCESS]', { email, tenant: result.tenant?.slug });
      sendSuccess(res, result, 'Logged in successfully');
    } catch (error: any) {
      console.error('❌ [LOGIN FAILED]', { 
        email: req.body?.email, 
        error: error.message,
        statusCode: error.statusCode 
      });
      next(error);
    }
  }

  async registerTenant(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.registerTenant(req.body);
      sendCreated(res, result, 'Organization registered successfully');
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await authService.refreshToken(refreshToken, ipAddress, userAgent);
      sendSuccess(res, result, 'Token refreshed successfully');
    } catch (error) {
      next(error);
    }
  }

  async logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      await authService.logout(refreshToken, req.user?._id?.toString());
      sendSuccess(res, null, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  async me(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?._id;
      if (!userId) {
        sendSuccess(res, { user: null, tenant: null }, 'No active session');
        return;
      }

      const user = await User.findById(userId).populate<{ roles: IRole[] }>('roles').exec();
      if (!user) {
        sendSuccess(res, { user: null, tenant: null }, 'User not found');
        return;
      }

      // Populate roles in both object and slug format for complete frontend compatibility
      const populatedRoles = (user.roles as any[]) || [];
      const roleObjects = populatedRoles.map((r) => ({
        id: r._id?.toString() || r.slug || 'role',
        name: r.name || r.slug || 'Role',
        slug: r.slug || r.name || 'role',
      }));
      const roleSlugs = populatedRoles.map((r) => r.slug || r.name);

      // Permissions
      const permSet = new Set<string>(user.directPermissions || []);
      for (const r of populatedRoles) {
        if (Array.isArray(r.permissions)) {
          r.permissions.forEach((p: string) => permSet.add(p));
        }
      }
      const permissions = user.isSuperAdmin ? ['*'] : Array.from(permSet);

      let tenantData: any = null;
      const targetTenantId =
        user.tenantId ||
        (req.headers['x-tenant-id'] as string) ||
        (req.query?.tenantId as string);

      if (targetTenantId && Types.ObjectId.isValid(targetTenantId.toString())) {
        const tenant = await Tenant.findById(targetTenantId).exec();
        if (tenant) {
          const sub = await TenantSubscription.findOne({ tenantId: tenant._id }).exec();
          const planConfig =
            DEFAULT_PLAN_ENTITLEMENTS[tenant.plan] || DEFAULT_PLAN_ENTITLEMENTS[TenantPlan.FREE];
          const features = sub?.features
            ? Object.fromEntries(sub.features.entries())
            : planConfig.features;
          const quotas = sub?.quotas
            ? Object.fromEntries(sub.quotas.entries())
            : planConfig.quotas;

          tenantData = {
            id: tenant._id.toString(),
            _id: tenant._id.toString(),
            name: tenant.name,
            slug: tenant.slug,
            plan: tenant.plan,
            status: tenant.status,
            contactEmail: tenant.contactEmail,
            phone: tenant.phone,
            organizationType: tenant.organizationType,
            country: tenant.country,
            address: tenant.address,
            settings: tenant.settings,
            features,
            quotas,
          };
        }
      }

      // If superadmin and no tenant resolved yet, pick default active tenant
      if (!tenantData && user.isSuperAdmin) {
        const defaultTenant = await Tenant.findOne({ status: 'ACTIVE' }).exec();
        if (defaultTenant) {
          const sub = await TenantSubscription.findOne({ tenantId: defaultTenant._id }).exec();
          const planConfig =
            DEFAULT_PLAN_ENTITLEMENTS[defaultTenant.plan] ||
            DEFAULT_PLAN_ENTITLEMENTS[TenantPlan.FREE];
          const features = sub?.features
            ? Object.fromEntries(sub.features.entries())
            : planConfig.features;
          const quotas = sub?.quotas
            ? Object.fromEntries(sub.quotas.entries())
            : planConfig.quotas;

          tenantData = {
            id: defaultTenant._id.toString(),
            _id: defaultTenant._id.toString(),
            name: defaultTenant.name,
            slug: defaultTenant.slug,
            plan: defaultTenant.plan,
            status: defaultTenant.status,
            contactEmail: defaultTenant.contactEmail,
            phone: defaultTenant.phone,
            organizationType: defaultTenant.organizationType,
            country: defaultTenant.country,
            address: defaultTenant.address,
            settings: defaultTenant.settings,
            features,
            quotas,
          };
        }
      }

      const formattedUser = {
        id: user._id.toString(),
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: user.status,
        tenantId: user.tenantId ? user.tenantId.toString() : null,
        roles: roleObjects,
        roleSlugs,
        permissions,
        accessScope: user.accessScope || { warehouses: [] },
        isSuperAdmin: user.isSuperAdmin,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      };

      sendSuccess(
        res,
        {
          user: formattedUser,
          tenant: tenantData,
        },
        'Active session profile retrieved'
      );
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, tenantSlug } = req.body;
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await authService.forgotPassword(email, tenantSlug, ipAddress, userAgent);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, password } = req.body;
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await authService.resetPassword(token, password, ipAddress, userAgent);
      sendSuccess(res, null, result.message);
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await authService.changePassword(
        req.user!._id.toString(),
        currentPassword,
        newPassword,
        ipAddress,
        userAgent
      );
      sendSuccess(res, null, result.message);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Returns all roles belonging to Nike company (@shoes) and their current assignment status.
   * If a role is not assigned to any user, it returns with status: 'Unassigned'.
   * Excludes all other companies.
   */
  async getAssignedRoles(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');

      // 1. Identify Nike tenant (slug: 'shoes' or name: 'nike')
      let nikeTenant: any = null;
      try {
        nikeTenant = await Tenant.findOne({ slug: 'shoes' }).lean();
        if (!nikeTenant) {
          nikeTenant = await Tenant.findOne({ name: { $regex: /^nike$/i } }).lean();
        }
      } catch (_) {}

      // 2. Fetch all system roles and any Nike custom roles
      let allRoles: any[] = [];
      try {
        allRoles = await Role.find({
          $or: [
            { isSystemRole: true },
            { tenantId: nikeTenant ? nikeTenant._id : null },
          ],
        })
          .sort({ isSystemRole: -1, name: 1 })
          .lean();
      } catch (_) {}

      // 3. Fetch active users belonging to Nike
      let nikeUsers: any[] = [];
      try {
        if (nikeTenant) {
          nikeUsers = await User.find({
            status: UserStatus.ACTIVE,
            $or: [
              { tenantId: nikeTenant._id },
              { isSuperAdmin: true },
            ],
          })
            .populate('roles')
            .populate('tenantId', 'name slug')
            .sort({ updatedAt: -1 })
            .lean();
        }
      } catch (_) {}

      // If database was empty or reconnecting, read from persistent stockpilot-backup.json
      if (!nikeTenant || allRoles.length === 0 || nikeUsers.length === 0) {
        const backupPaths = [
          path.resolve(process.cwd(), '.mongo-data/stockpilot-backup.json'),
          path.resolve(process.cwd(), 'server/.mongo-data/stockpilot-backup.json'),
          path.resolve(__dirname, '../../../.mongo-data/stockpilot-backup.json'),
        ];
        for (const bp of backupPaths) {
          if (fs.existsSync(bp)) {
            try {
              const bData = JSON.parse(fs.readFileSync(bp, 'utf-8'));
              if (!nikeTenant && Array.isArray(bData.tenants)) {
                nikeTenant = bData.tenants.find(
                  (t: any) => t.slug === 'shoes' || t.name?.toLowerCase() === 'nike'
                );
              }
              if (allRoles.length === 0 && Array.isArray(bData.roles)) {
                allRoles = bData.roles;
              }
              if (nikeUsers.length === 0 && Array.isArray(bData.users) && nikeTenant) {
                const bRoles = Array.isArray(bData.roles) ? bData.roles : [];
                nikeUsers = bData.users
                  .filter(
                    (u: any) =>
                      u.tenantId === nikeTenant._id ||
                      u.tenantId?.toString() === nikeTenant._id?.toString() ||
                      u.isSuperAdmin
                  )
                  .map((u: any) => {
                    const populatedRoles = (u.roles || [])
                      .map((rId: any) =>
                        bRoles.find(
                          (r: any) => r._id === rId || r._id?.toString() === rId?.toString()
                        )
                      )
                      .filter(Boolean);
                    return {
                      ...u,
                      roles: populatedRoles,
                      tenantId: nikeTenant,
                    };
                  });
              }
              if (nikeTenant && allRoles.length > 0) break;
            } catch (_) {}
          }
        }
      }

      const tenantSlug = nikeTenant?.slug || 'shoes';
      const tenantName = nikeTenant?.name || 'nike';

      // Standard priority order for roles
      const standardRoleOrder: Record<string, number> = {
        'tenant-admin': 1,
        'purchase-officer': 2,
        'qc-inspector': 3,
        'super-admin': 4,
        'operations-manager': 5,
        'warehouse-clerk': 6,
        'sales-representative': 7,
        'production-supervisor': 8,
        'auditor': 9,
      };

      // Standard system role definitions
      const systemRoleDefinitions: Array<{ name: string; slug: string; description: string }> = [
        {
          name: 'Tenant Administrator',
          slug: 'tenant-admin',
          description: 'Full organizational authority over users, roles & settings',
        },
        {
          name: 'Purchase Officer',
          slug: 'purchase-officer',
          description: 'Procurement execution, RFQs, purchase orders & vendor receipts',
        },
        {
          name: 'QC Inspector',
          slug: 'qc-inspector',
          description: 'Quality checklists, incoming shipment inspections & QA sign-offs',
        },
        {
          name: 'Platform Super Administrator',
          slug: 'super-admin',
          description: 'Global system governance & platform management',
        },
        {
          name: 'Operations Manager',
          slug: 'operations-manager',
          description: 'Cross-functional operational oversight of inventory & procurement',
        },
        {
          name: 'Warehouse Clerk',
          slug: 'warehouse-clerk',
          description: 'Store operations, inventory adjustments & bin transfers',
        },
        {
          name: 'Sales Representative',
          slug: 'sales-representative',
          description: 'Customer quotations, sales orders & dispatch tracking',
        },
        {
          name: 'Production Supervisor',
          slug: 'production-supervisor',
          description: 'Work orders, BOM tracking & batch logging',
        },
        {
          name: 'Compliance Auditor',
          slug: 'auditor',
          description: 'Audit trail analysis & compliance governance reporting',
        },
      ];

      // Build unique map of all roles for Nike
      const rolesMap = new Map<
        string,
        { roleName: string; roleSlug: string; description: string; isSystemRole: boolean }
      >();

      for (const sysDef of systemRoleDefinitions) {
        rolesMap.set(sysDef.slug, {
          roleName: sysDef.name,
          roleSlug: sysDef.slug,
          description: sysDef.description,
          isSystemRole: true,
        });
      }

      for (const r of allRoles) {
        const slug = r.slug;
        if (slug) {
          rolesMap.set(slug, {
            roleName: r.name || rolesMap.get(slug)?.roleName || slug,
            roleSlug: slug,
            description: r.description || rolesMap.get(slug)?.description || 'Nike Organizational Role',
            isSystemRole: r.isSystemRole ?? (slug in standardRoleOrder),
          });
        }
      }

      const COMMON_DEFAULT_PASSWORD = process.env.DEFAULT_USER_PASSWORD || 'Password123!';

      // Check assignment for each role in Nike
      const roleCards: any[] = [];

      for (const [slug, roleInfo] of rolesMap.entries()) {
        let assignedUserDoc: any = null;

        if (slug === 'super-admin') {
          assignedUserDoc = nikeUsers.find(
            (u) =>
              u.isSuperAdmin ||
              (Array.isArray(u.roles) && u.roles.some((r: any) => r.slug === 'super-admin'))
          );
        } else {
          assignedUserDoc = nikeUsers.find(
            (u) => Array.isArray(u.roles) && u.roles.some((r: any) => r.slug === slug)
          );
        }

        if (assignedUserDoc) {
          roleCards.push({
            userId: assignedUserDoc._id,
            roleSlug: slug,
            roleName: roleInfo.roleName,
            description: roleInfo.description,
            isSystemRole: roleInfo.isSystemRole,
            status: 'Assigned',
            isAssigned: true,
            assignedUser: {
              id: assignedUserDoc._id,
              name: assignedUserDoc.name,
              email: assignedUserDoc.email,
              tenantSlug: tenantSlug,
              tenantName: tenantName,
              department: assignedUserDoc.accessScope?.department,
            },
            defaultPassword: COMMON_DEFAULT_PASSWORD,
            credentials: {
              email: assignedUserDoc.email,
              password: COMMON_DEFAULT_PASSWORD,
              tenantSlug: tenantSlug,
            },
            priority: standardRoleOrder[slug] ?? 50,
          });
        } else {
          // Unassigned role in Nike
          roleCards.push({
            userId: null,
            roleSlug: slug,
            roleName: roleInfo.roleName,
            description: roleInfo.description,
            isSystemRole: roleInfo.isSystemRole,
            status: 'Unassigned',
            isAssigned: false,
            assignedUser: null,
            defaultPassword: '',
            credentials: null,
            priority: standardRoleOrder[slug] ?? 50,
          });
        }
      }

      // Sort: assigned roles first (by priority), then unassigned roles (by priority)
      roleCards.sort((a, b) => {
        if (a.isAssigned && !b.isAssigned) return -1;
        if (!a.isAssigned && b.isAssigned) return 1;
        return a.priority - b.priority;
      });

      sendSuccess(res, roleCards, 'Nike roles and assignments retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
