import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { tenantContext } from '../../../middleware/tenantContext.middleware';
import { requireFeature } from '../../../middleware/entitlement.middleware';
import { requirePermissions } from '../../../middleware/rbac.middleware';
import { PERMISSIONS } from '../../../config/permissions.config';
import { productionTraceabilityController } from '../controllers/productionTraceability.controller';

const router = Router();

router.use(authenticate, tenantContext, requireFeature('production'));

router.get(
  ['/raw-material', '/raw-material/:itemId'],
  requirePermissions([PERMISSIONS.PRODUCTION_READ, PERMISSIONS.PROD_VIEW], false),
  productionTraceabilityController.traceRawMaterial
);

router.get(
  ['/lineage', '/lineage/:type/:identifier', '/:type/:identifier'],
  requirePermissions([PERMISSIONS.PRODUCTION_READ, PERMISSIONS.PROD_VIEW], false),
  productionTraceabilityController.getLineage
);

export { router as productionTraceabilityRoutes };
