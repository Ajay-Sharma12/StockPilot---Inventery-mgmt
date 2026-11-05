import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { tenantContext } from '../../../middleware/tenantContext.middleware';
import { requireFeature } from '../../../middleware/entitlement.middleware';
import { requirePermissions } from '../../../middleware/rbac.middleware';
import { validateRequest } from '../../../middleware/validate.middleware';
import { PERMISSIONS } from '../../../config/permissions.config';
import { gatePassController } from '../controllers/gatePass.controller';
import { createGatePassSchema, gateOutSchema } from '../validators/sales.validator';

const router = Router();

router.use(authenticate, tenantContext, requireFeature('sales'));

router.get(
  '/',
  requirePermissions([PERMISSIONS.GATEPASS_VIEW, PERMISSIONS.SALES_READ], false),
  gatePassController.getGatePasses
);

router.get(
  '/:id',
  requirePermissions([PERMISSIONS.GATEPASS_VIEW, PERMISSIONS.SALES_READ], false),
  gatePassController.getGatePassById
);

router.get(
  '/:id/print',
  requirePermissions([PERMISSIONS.GATEPASS_VIEW, PERMISSIONS.SALES_READ], false),
  gatePassController.printGatePass
);

router.post(
  '/',
  requirePermissions([PERMISSIONS.GATEPASS_CREATE, PERMISSIONS.SALES_UPDATE], false),
  validateRequest({ body: createGatePassSchema }),
  gatePassController.createGatePass
);

router.post(
  '/:id/approve',
  requirePermissions([PERMISSIONS.GATEPASS_APPROVE, PERMISSIONS.SALES_UPDATE], false),
  gatePassController.approveGatePass
);

router.post(
  '/:id/gate-out',
  requirePermissions([PERMISSIONS.GATEPASS_GATEOUT, PERMISSIONS.SALES_UPDATE], false),
  validateRequest({ body: gateOutSchema }),
  gatePassController.recordGateOut
);

export const gatePassRoutes = router;
