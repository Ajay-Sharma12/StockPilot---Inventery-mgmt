import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { tenantContext } from '../../../middleware/tenantContext.middleware';
import { requireFeature } from '../../../middleware/entitlement.middleware';
import { requirePermissions } from '../../../middleware/rbac.middleware';
import { validateRequest } from '../../../middleware/validate.middleware';
import { PERMISSIONS } from '../../../config/permissions.config';
import { purchaseQCController } from '../controllers/purchaseQc.controller';
import {
  createQCSchema,
  dispositionQCSchema,
} from '../validators/procurement.validator';

const router = Router();

router.use(authenticate, tenantContext, requireFeature('procurement'));

router.get(
  '/',
  requirePermissions([PERMISSIONS.PURCHASE_QC_VIEW, PERMISSIONS.QC_READ], false),
  purchaseQCController.getQCQueue
);

router.get(
  '/:id',
  requirePermissions([PERMISSIONS.PURCHASE_QC_VIEW, PERMISSIONS.QC_READ], false),
  purchaseQCController.getQCById
);

router.post(
  '/:id/inspect',
  requirePermissions([PERMISSIONS.PURCHASE_QC_INSPECT, PERMISSIONS.QC_INSPECT], false),
  validateRequest({ body: createQCSchema.partial() }),
  purchaseQCController.inspectQC
);

router.post(
  '/:id/disposition',
  requirePermissions([PERMISSIONS.PURCHASE_QC_DISPOSITION, PERMISSIONS.QC_APPROVE], false),
  validateRequest({ body: dispositionQCSchema }),
  purchaseQCController.dispositionQC
);

export const purchaseQCRoutes = router;
