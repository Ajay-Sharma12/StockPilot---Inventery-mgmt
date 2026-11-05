import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../core/types';
import { SubscriptionEntitlementError, ForbiddenError } from '../core/errors';

export const requireFeature = (featureName: string | string[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    // Super Admins bypass tenant feature restrictions
    if (req.user?.isSuperAdmin) {
      return next();
    }

    if (!req.tenant) {
      return next(new ForbiddenError('Tenant context required to evaluate feature entitlement'));
    }

    const features = Array.isArray(featureName) ? featureName : [featureName];
    const hasFeature = features.some((f) => Boolean(req.tenant?.features?.[f]));

    if (!hasFeature) {
      return next(new SubscriptionEntitlementError(features.join(' or ')));
    }

    next();
  };
};

export const requireQuota = (quotaName: string, currentUsageResolver: (req: AuthenticatedRequest) => Promise<number>) => {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.user?.isSuperAdmin) {
        return next();
      }

      if (!req.tenant) {
        return next(new ForbiddenError('Tenant context required to evaluate quota'));
      }

      const maxAllowed = req.tenant.quotas?.[quotaName];
      if (maxAllowed === undefined) {
        return next();
      }

      const currentCount = await currentUsageResolver(req);
      if (currentCount >= maxAllowed) {
        return next(
          new ForbiddenError(
            `Quota exceeded for '${quotaName}'. Max allowed: ${maxAllowed}, Current: ${currentCount}. Please upgrade your subscription plan.`,
            { quotaName, maxAllowed, currentCount, requiresUpgrade: true }
          )
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};
