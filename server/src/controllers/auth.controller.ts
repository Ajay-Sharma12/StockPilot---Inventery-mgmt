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
   * Returns all manually registered user accounts and their assigned roles.
   * Excludes any legacy demo/seeded tenants (Apex Logistics / Nova Dynamics).
   */
  async getAssignedRoles(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');

      // 1. Query active users from MongoDB
      let activeUsers: any[] = [];
      try {
        activeUsers = await User.find({ status: UserStatus.ACTIVE })
          .populate('roles')
          .populate('tenantId', 'name slug')
          .sort({ updatedAt: -1 })
          .lean();
      } catch (dbErr) {
        // Fallback to disk snapshot if DB is currently reconnecting
      }

      // If activeUsers from DB is empty, read directly from persistent disk snapshot
      if (activeUsers.length === 0) {
        const backupPaths = [
          path.resolve(process.cwd(), '.mongo-data/stockpilot-backup.json'),
          path.resolve(process.cwd(), 'server/.mongo-data/stockpilot-backup.json'),
          path.resolve(__dirname, '../../../.mongo-data/stockpilot-backup.json'),
        ];
        for (const bp of backupPaths) {
          if (fs.existsSync(bp)) {
            try {
              const bData = JSON.parse(fs.readFileSync(bp, 'utf-8'));
              if (Array.isArray(bData.users) && bData.users.length > 0) {
                const bRoles = Array.isArray(bData.roles) ? bData.roles : [];
                const bTenants = Array.isArray(bData.tenants) ? bData.tenants : [];
                activeUsers = bData.users.map((u: any) => {
                  const populatedRoles = (u.roles || [])
                    .map((rId: any) =>
                      bRoles.find(
                        (r: any) => r._id === rId || r._id?.toString() === rId?.toString()
                      )
                    )
                    .filter(Boolean);
                  const populatedTenant = bTenants.find(
                    (t: any) =>
                      t._id === u.tenantId || t._id?.toString() === u.tenantId?.toString()
                  );
                  return {
                    ...u,
                    roles: populatedRoles,
                    tenantId: populatedTenant,
                  };
                });
                break;
              }
            } catch (_) {}
          }
        }
      }

      // 2. Strictly filter out any legacy Apex Logistics or Nova Dynamics demo accounts
      const cleanUsers = activeUsers.filter((u) => {
        const email = (u.email || '').toLowerCase();
        const slug = ((u.tenantId as any)?.slug || '').toLowerCase();
        if (email.endsWith('@apexlogistics.com') || email.endsWith('@novadynamics.io')) return false;
        if (slug === 'apex-logistics' || slug === 'nova-dynamics') return false;
        return true;
      });

      // 3. Build role cards for all actual user-created assignments
      const roleCards = cleanUsers.map((user) => {
        const tenantSlug = (user.tenantId as any)?.slug || '';
        const tenantName =
          (user.tenantId as any)?.name ||
          (user.isSuperAdmin ? 'Platform Super Admin' : 'Organization Workspace');
        const roles = Array.isArray(user.roles) ? user.roles : [];
        const primaryRole = roles[0];

        let roleName = 'Assigned Role';
        let roleSlug = 'user';
        let isSystemRole = false;

        if (user.isSuperAdmin) {
          roleName = 'Platform Super Administrator';
          roleSlug = 'super-admin';
          isSystemRole = true;
        } else if (primaryRole) {
          roleName = primaryRole.name || 'Assigned Role';
          roleSlug = primaryRole.slug || 'user';
          isSystemRole = primaryRole.isSystemRole ?? true;
        }

        return {
          userId: user._id,
          roleSlug: roleSlug,
          roleName: roleName,
          description: primaryRole?.description || `${roleName} - ${tenantName}`,
          isSystemRole: isSystemRole,
          assignedUser: {
            id: user._id,
            name: user.name,
            email: user.email,
            tenantSlug: tenantSlug,
            tenantName: tenantName,
            department: user.accessScope?.department,
          },
          defaultPassword: 'Password123!',
        };
      });

      // Sort by tenantName and roleName
      roleCards.sort((a, b) => {
        if (a.isSystemRole && !b.isSystemRole) return -1;
        if (!a.isSystemRole && b.isSystemRole) return 1;
        return (a.assignedUser.tenantName || '').localeCompare(b.assignedUser.tenantName || '');
      });

      sendSuccess(res, roleCards, 'Assigned roles retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
