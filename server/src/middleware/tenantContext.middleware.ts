import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AuthenticatedRequest, AuthenticatedTenant } from '../core/types';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '../core/errors';
import { Tenant } from '../models/tenant.model';
import { TenantStatus } from '../config/constants';
import { entitlementService } from '../services/entitlement.service';

export const tenantContext = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('User authentication required before tenant resolution');
    }

    let targetTenantId: Types.ObjectId | null = null;

    // 1. If super admin, allow context switching via header or query
    if (req.user.isSuperAdmin) {
      const headerTenantId = (req.headers['x-tenant-id'] as string) || (req.query?.tenantId as string);
      if (headerTenantId) {
        if (!Types.ObjectId.isValid(headerTenantId)) {
          throw new NotFoundError('Invalid organization identifier provided in header');
        }
        targetTenantId = new Types.ObjectId(headerTenantId);
      } else {
        const defaultTenant = await Tenant.findOne({ status: TenantStatus.ACTIVE }).exec();
        if (defaultTenant) {
          targetTenantId = defaultTenant._id as Types.ObjectId;
        }
      }
    } else {
      if (!req.user.tenantId) {
        throw new ForbiddenError('User is not associated with any organization tenant');
      }
      targetTenantId = new Types.ObjectId(req.user.tenantId);
    }

    if (targetTenantId) {
      const tenant = await Tenant.findById(targetTenantId).exec();
      if (!tenant) {
        throw new NotFoundError('Organization tenant not found');
      }

      if (tenant.status === TenantStatus.SUSPENDED) {
        throw new ForbiddenError('Organization is currently suspended. Please contact support.');
      }

      const entitlements = await entitlementService.getTenantEntitlements(tenant._id);

      const authenticatedTenant: AuthenticatedTenant = {
        _id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        plan: tenant.plan,
        contactEmail: tenant.contactEmail,
        phone: tenant.phone,
        organizationType: tenant.organizationType,
        country: tenant.country,
        address: tenant.address,
        settings: tenant.settings,
        features: entitlements.features,
        quotas: entitlements.quotas,
      };

      req.tenant = authenticatedTenant;
    }

    next();
  } catch (error) {
    next(error);
  }
};
