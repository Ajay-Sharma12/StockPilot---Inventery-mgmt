import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { tenantContext } from '../../../middleware/tenantContext.middleware';
import { requireFeature } from '../../../middleware/entitlement.middleware';
import { requirePermissions } from '../../../middleware/rbac.middleware';
import { PERMISSIONS } from '../../../config/permissions.config';
import { procurementController } from '../controllers/procurement.controller';

const router = Router();

router.use(authenticate, tenantContext, requireFeature('procurement'));

router.get(
  '/traceability/:type/:id',
  requirePermissions([PERMISSIONS.PURCHASE_READ, PERMISSIONS.INVENTORY_READ], false),
  procurementController.getTraceability
);

router.get(
  '/dashboard-stats',
  requirePermissions([PERMISSIONS.PURCHASE_READ], false),
  procurementController.getDashboardStats
);

export const procurementRoutes = router;
