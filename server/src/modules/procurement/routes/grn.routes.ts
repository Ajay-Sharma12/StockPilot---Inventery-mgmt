import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { tenantContext } from '../../../middleware/tenantContext.middleware';
import { requireFeature } from '../../../middleware/entitlement.middleware';
import { requirePermissions } from '../../../middleware/rbac.middleware';
import { validateRequest } from '../../../middleware/validate.middleware';
import { validateWarehouseScope } from '../../../middleware/abac.middleware';
import { PERMISSIONS } from '../../../config/permissions.config';
import { grnController } from '../controllers/grn.controller';
import { createGRNSchema, cancelGRNSchema } from '../validators/procurement.validator';

const router = Router();

router.use(authenticate, tenantContext, requireFeature('procurement'));

router.get(
  '/',
  requirePermissions([PERMISSIONS.GRN_VIEW, PERMISSIONS.GRN_READ], false),
  grnController.getGRNs
);

router.get(
  '/:id',
  requirePermissions([PERMISSIONS.GRN_VIEW, PERMISSIONS.GRN_READ], false),
  grnController.getGRNById
);

router.post(
  '/',
  requirePermissions([PERMISSIONS.GRN_RECEIVE, PERMISSIONS.GRN_CREATE], false),
  validateRequest({ body: createGRNSchema }),
  validateWarehouseScope('warehouseId', 'body'),
  grnController.createGRN
);

router.post(
  '/:id/cancel',
  requirePermissions([PERMISSIONS.GRN_CANCEL, PERMISSIONS.GRN_RECEIVE, PERMISSIONS.GRN_CREATE], false),
  validateRequest({ body: cancelGRNSchema }),
  grnController.cancelGRN
);

router.post(
  '/:id/resend-notification',
  requirePermissions([PERMISSIONS.GRN_VIEW, PERMISSIONS.GRN_READ, PERMISSIONS.GRN_RECEIVE], false),
  grnController.resendNotification
);

router.post(
  '/:id/send-to-qc',
  requirePermissions([PERMISSIONS.GRN_RECEIVE, PERMISSIONS.GRN_CREATE, PERMISSIONS.QC_CREATE], false),
  grnController.sendToQC
);

export const grnRoutes = router;
