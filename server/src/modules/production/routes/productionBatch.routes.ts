import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { tenantContext } from '../../../middleware/tenantContext.middleware';
import { requireFeature } from '../../../middleware/entitlement.middleware';
import { requirePermissions } from '../../../middleware/rbac.middleware';
import { PERMISSIONS } from '../../../config/permissions.config';
import { productionBatchController } from '../controllers/productionBatch.controller';

const router = Router();

router.use(authenticate, tenantContext, requireFeature('production'));

router.get(
  '/',
  requirePermissions([PERMISSIONS.BATCH_MANAGE, PERMISSIONS.PRODUCTION_READ], false),
  productionBatchController.getBatches
);

router.get(
  '/:id',
  requirePermissions([PERMISSIONS.BATCH_MANAGE, PERMISSIONS.PRODUCTION_READ], false),
  productionBatchController.getBatchById
);

export { router as productionBatchRoutes };
