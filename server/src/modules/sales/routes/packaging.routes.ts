import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { tenantContext } from '../../../middleware/tenantContext.middleware';
import { requireFeature } from '../../../middleware/entitlement.middleware';
import { requirePermissions } from '../../../middleware/rbac.middleware';
import { validateRequest } from '../../../middleware/validate.middleware';
import { PERMISSIONS } from '../../../config/permissions.config';
import { packagingController } from '../controllers/packaging.controller';
import { createPackageSchema } from '../validators/sales.validator';

const router = Router();

router.use(authenticate, tenantContext, requireFeature('sales'));

router.get(
  '/',
  requirePermissions([PERMISSIONS.PKG_VIEW, PERMISSIONS.SALES_READ], false),
  packagingController.getPackages
);

router.get(
  '/:id',
  requirePermissions([PERMISSIONS.PKG_VIEW, PERMISSIONS.SALES_READ], false),
  packagingController.getPackageById
);

router.post(
  '/',
  requirePermissions([PERMISSIONS.PKG_CREATE, PERMISSIONS.SALES_UPDATE], false),
  validateRequest({ body: createPackageSchema }),
  packagingController.createPackage
);

router.post(
  '/:id/pack',
  requirePermissions([PERMISSIONS.PKG_PACK, PERMISSIONS.SALES_UPDATE], false),
  packagingController.packOrder
);

router.post(
  '/:id/cancel',
  requirePermissions([PERMISSIONS.PKG_CANCEL, PERMISSIONS.SALES_UPDATE], false),
  packagingController.cancelPackage
);

export const packagingRoutes = router;
