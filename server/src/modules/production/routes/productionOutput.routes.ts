import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { tenantContext } from '../../../middleware/tenantContext.middleware';
import { requireFeature } from '../../../middleware/entitlement.middleware';
import { requirePermissions } from '../../../middleware/rbac.middleware';
import { validateRequest } from '../../../middleware/validate.middleware';
import { PERMISSIONS } from '../../../config/permissions.config';
import { productionOutputController } from '../controllers/productionOutput.controller';
import { createProductionOutputSchema } from '../validators/production.validator';

const router = Router();

router.use(authenticate, tenantContext, requireFeature('production'));

router.get(
  '/dashboard',
  requirePermissions([PERMISSIONS.PRODUCTION_READ, PERMISSIONS.PROD_VIEW, 'production:view'], false),
  productionOutputController.getProductionDashboard
);

router.get(
  '/matrices/consumption',
  requirePermissions([PERMISSIONS.PRODUCTION_READ, PERMISSIONS.PROD_VIEW, 'production:view'], false),
  productionOutputController.getMaterialConsumptionMatrix
);

router.get(
  '/matrices/output',
  requirePermissions([PERMISSIONS.PRODUCTION_READ, PERMISSIONS.PROD_VIEW, 'production:view'], false),
  productionOutputController.getProductionOutputMatrix
);

router.get(
  '/',
  requirePermissions([PERMISSIONS.PRODUCTION_READ, PERMISSIONS.PROD_VIEW, 'production:view'], false),
  productionOutputController.getProductionOutputs
);

router.get(
  '/:id',
  requirePermissions([PERMISSIONS.PRODUCTION_READ, PERMISSIONS.PROD_VIEW, 'production:view'], false),
  productionOutputController.getProductionOutputById
);

router.post(
  '/',
  requirePermissions(
    [PERMISSIONS.PRODUCTION_UPDATE, PERMISSIONS.PRODUCTION_CREATE, PERMISSIONS.PROD_COMPLETE, 'production:output'],
    false
  ),
  validateRequest({ body: createProductionOutputSchema }),
  productionOutputController.recordOutput
);

export { router as productionOutputRoutes };
