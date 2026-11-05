import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { tenantContext } from '../../../middleware/tenantContext.middleware';
import { requireFeature } from '../../../middleware/entitlement.middleware';
import { requirePermissions } from '../../../middleware/rbac.middleware';
import { validateRequest } from '../../../middleware/validate.middleware';
import { PERMISSIONS } from '../../../config/permissions.config';
import { productionMaterialController } from '../controllers/productionMaterial.controller';
import { consumeMaterialSchema, returnMaterialSchema } from '../validators/production.validator';

const router = Router();

router.use(authenticate, tenantContext, requireFeature('production'));

router.post(
  '/:id/consume',
  requirePermissions([PERMISSIONS.PRODUCTION_UPDATE, PERMISSIONS.PROD_CONSUME], false),
  validateRequest({ body: consumeMaterialSchema }),
  productionMaterialController.consumeMaterial
);

router.post(
  '/:id/return',
  requirePermissions([PERMISSIONS.PRODUCTION_UPDATE, PERMISSIONS.PROD_CONSUME], false),
  validateRequest({ body: returnMaterialSchema }),
  productionMaterialController.returnMaterial
);

export { router as productionMaterialRoutes };
