import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { tenantContext } from '../../../middleware/tenantContext.middleware';
import { requireFeature } from '../../../middleware/entitlement.middleware';
import { requirePermissions } from '../../../middleware/rbac.middleware';
import { PERMISSIONS } from '../../../config/permissions.config';
import { salesController } from '../controllers/sales.controller';

const router = Router();

router.use(authenticate, tenantContext, requireFeature('sales'));

router.get(
  '/overview',
  requirePermissions([PERMISSIONS.SALES_READ, PERMISSIONS.SO_VIEW], false),
  salesController.getDashboardStats
);

router.get(
  '/traceability/:type/:id',
  requirePermissions([PERMISSIONS.SALES_READ, PERMISSIONS.SO_VIEW], false),
  salesController.getTraceability
);

export const salesRoutes = router;
