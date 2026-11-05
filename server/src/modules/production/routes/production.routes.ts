import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { tenantContext } from '../../../middleware/tenantContext.middleware';
import { requireFeature } from '../../../middleware/entitlement.middleware';
import { requirePermissions } from '../../../middleware/rbac.middleware';
import { PERMISSIONS } from '../../../config/permissions.config';
import { productionController } from '../controllers/production.controller';

const router = Router();

router.use(authenticate, tenantContext, requireFeature('production'));

router.get(
  '/overview',
  requirePermissions([PERMISSIONS.PRODUCTION_READ, PERMISSIONS.PROD_VIEW], false),
  productionController.getOverview
);

export { router as productionRoutes };
