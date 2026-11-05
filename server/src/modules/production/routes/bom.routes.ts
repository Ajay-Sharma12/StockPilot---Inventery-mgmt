import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { tenantContext } from '../../../middleware/tenantContext.middleware';
import { requireFeature } from '../../../middleware/entitlement.middleware';
import { requirePermissions } from '../../../middleware/rbac.middleware';
import { validateRequest } from '../../../middleware/validate.middleware';
import { PERMISSIONS } from '../../../config/permissions.config';
import { bomController } from '../controllers/bom.controller';
import { createBOMSchema, updateBOMSchema } from '../validators/production.validator';

const router = Router();

router.use(authenticate, tenantContext, requireFeature('production'));

router.get(
  '/',
  requirePermissions([PERMISSIONS.BOM_READ, PERMISSIONS.PRODUCTION_READ, PERMISSIONS.BOM_VIEW], false),
  bomController.getBOMs
);

router.get(
  '/:id',
  requirePermissions([PERMISSIONS.BOM_READ, PERMISSIONS.PRODUCTION_READ, PERMISSIONS.BOM_VIEW], false),
  bomController.getBOMById
);

router.post(
  '/',
  requirePermissions([PERMISSIONS.BOM_MANAGE, PERMISSIONS.PRODUCTION_CREATE, PERMISSIONS.BOM_CREATE], false),
  validateRequest({ body: createBOMSchema }),
  bomController.createBOM
);

router.patch(
  '/:id',
  requirePermissions([PERMISSIONS.BOM_MANAGE, PERMISSIONS.PRODUCTION_UPDATE, PERMISSIONS.BOM_EDIT], false),
  validateRequest({ body: updateBOMSchema }),
  bomController.updateBOM
);

router.put(
  '/:id',
  requirePermissions([PERMISSIONS.BOM_MANAGE, PERMISSIONS.PRODUCTION_UPDATE, PERMISSIONS.BOM_EDIT], false),
  validateRequest({ body: updateBOMSchema }),
  bomController.updateBOM
);

router.post(
  '/:id/submit',
  requirePermissions([PERMISSIONS.BOM_MANAGE, PERMISSIONS.PRODUCTION_UPDATE, PERMISSIONS.BOM_EDIT], false),
  bomController.submitBOM
);

router.post(
  '/:id/approve',
  requirePermissions([PERMISSIONS.BOM_MANAGE, PERMISSIONS.PRODUCTION_UPDATE, PERMISSIONS.BOM_APPROVE], false),
  bomController.approveBOM
);

router.post(
  '/:id/activate',
  requirePermissions([PERMISSIONS.BOM_MANAGE, PERMISSIONS.PRODUCTION_UPDATE, PERMISSIONS.BOM_ACTIVATE], false),
  bomController.activateBOM
);

router.post(
  '/:id/archive',
  requirePermissions([PERMISSIONS.BOM_MANAGE, PERMISSIONS.PRODUCTION_UPDATE, PERMISSIONS.BOM_ARCHIVE], false),
  bomController.archiveBOM
);

router.post(
  '/:id/clone',
  requirePermissions([PERMISSIONS.BOM_MANAGE, PERMISSIONS.PRODUCTION_CREATE, PERMISSIONS.BOM_CREATE], false),
  bomController.cloneNewVersion
);

export { router as bomRoutes };
