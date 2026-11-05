import { Router } from 'express';
import { entitlementController } from '../controllers/entitlement.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantContext } from '../middleware/tenantContext.middleware';
import { requirePermissions } from '../middleware/rbac.middleware';
import { PERMISSIONS } from '../config/permissions.config';

const router = Router();

router.use(authenticate, tenantContext);

router.get('/', (req, res, next) => entitlementController.getEntitlements(req, res, next));

router.post(
  '/upgrade',
  requirePermissions([PERMISSIONS.SUBSCRIPTION_MANAGE]),
  (req, res, next) => entitlementController.upgradePlan(req, res, next)
);

export const entitlementRoutes = router;
