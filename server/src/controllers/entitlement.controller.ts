import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../core/types';
import { entitlementService } from '../services/entitlement.service';
import { sendSuccess } from '../core/responseHandler';
import { ForbiddenError } from '../core/errors';

export class EntitlementController {
  async getEntitlements(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.tenant) {
        throw new ForbiddenError('Tenant context required');
      }

      const entitlements = await entitlementService.getTenantEntitlements(req.tenant._id);
      sendSuccess(res, entitlements, 'Subscription entitlements retrieved');
    } catch (error) {
      next(error);
    }
  }

  async upgradePlan(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.tenant || !req.user) {
        throw new ForbiddenError('Tenant or user context missing');
      }

      const { plan } = req.body;
      const updated = await entitlementService.upgradePlan(
        req.tenant._id,
        plan,
        req.user._id,
        req.user.name
      );

      sendSuccess(res, updated, 'Subscription plan upgraded successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const entitlementController = new EntitlementController();
