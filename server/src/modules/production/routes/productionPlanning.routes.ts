import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { tenantContext } from '../../../middleware/tenantContext.middleware';
import { requireFeature } from '../../../middleware/entitlement.middleware';
import { requirePermissions } from '../../../middleware/rbac.middleware';
import { PERMISSIONS } from '../../../config/permissions.config';
import { productionPlanningController } from '../controllers/productionPlanning.controller';

const router = Router();

router.use(authenticate, tenantContext, requireFeature('production'));

router.post(
  '/calculate',
  requirePermissions([PERMISSIONS.PRODUCTION_READ, PERMISSIONS.PROD_VIEW], false),
  productionPlanningController.calculateMaterialRequirements
);

router.get(
  '/dashboard',
  requirePermissions([PERMISSIONS.PRODUCTION_READ, PERMISSIONS.PROD_VIEW], false),
  productionPlanningController.getPlanningDashboard
);

export { router as productionPlanningRoutes };
