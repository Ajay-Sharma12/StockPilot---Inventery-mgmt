import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { tenantContext } from '../../../middleware/tenantContext.middleware';
import { requireFeature } from '../../../middleware/entitlement.middleware';
import { requirePermissions } from '../../../middleware/rbac.middleware';
import { validateRequest } from '../../../middleware/validate.middleware';
import { PERMISSIONS } from '../../../config/permissions.config';
import { productionQcController } from '../controllers/productionQc.controller';
import {
  inspectProductionQCSchema,
  dispositionProductionQCSchema,
} from '../validators/production.validator';

const router = Router();

router.use(authenticate, tenantContext, requireFeature('production'));

router.get(
  '/',
  requirePermissions([PERMISSIONS.QC_READ, PERMISSIONS.PROD_QC_VIEW], false),
  productionQcController.getQCInspections
);

router.get(
  '/:id',
  requirePermissions([PERMISSIONS.QC_READ, PERMISSIONS.PROD_QC_VIEW], false),
  productionQcController.getQCInspectionById
);

router.post(
  '/:id/inspect',
  requirePermissions([PERMISSIONS.QC_INSPECT, PERMISSIONS.PROD_QC_INSPECT], false),
  validateRequest({ body: inspectProductionQCSchema }),
  productionQcController.inspectProductionQC
);

router.post(
  '/:id/disposition',
  requirePermissions([PERMISSIONS.QC_APPROVE, PERMISSIONS.PROD_QC_APPROVE], false),
  validateRequest({ body: dispositionProductionQCSchema }),
  productionQcController.dispositionProductionQC
);

router.patch(
  '/:id/verdict',
  requirePermissions([PERMISSIONS.QC_APPROVE, PERMISSIONS.PROD_QC_APPROVE], false),
  productionQcController.overrideVerdict
);

export { router as productionQcRoutes };
