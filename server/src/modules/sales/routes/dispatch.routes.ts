import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { tenantContext } from '../../../middleware/tenantContext.middleware';
import { requireFeature } from '../../../middleware/entitlement.middleware';
import { requirePermissions } from '../../../middleware/rbac.middleware';
import { validateRequest } from '../../../middleware/validate.middleware';
import { PERMISSIONS } from '../../../config/permissions.config';
import { dispatchController } from '../controllers/dispatch.controller';
import { createDispatchSchema } from '../validators/sales.validator';

const router = Router();

router.use(authenticate, tenantContext, requireFeature('sales'));

router.get(
  '/',
  requirePermissions([PERMISSIONS.DISPATCH_VIEW, PERMISSIONS.SALES_READ], false),
  dispatchController.getDispatches
);

router.get(
  '/:id',
  requirePermissions([PERMISSIONS.DISPATCH_VIEW, PERMISSIONS.SALES_READ], false),
  dispatchController.getDispatchById
);

router.post(
  '/',
  requirePermissions([PERMISSIONS.DISPATCH_CREATE, PERMISSIONS.SALES_UPDATE], false),
  validateRequest({ body: createDispatchSchema }),
  dispatchController.createDispatch
);

router.post(
  '/:id/dispatch',
  requirePermissions([PERMISSIONS.DISPATCH_DISPATCH, PERMISSIONS.SALES_UPDATE], false),
  dispatchController.dispatchOrder
);

router.post(
  '/:id/cancel',
  requirePermissions([PERMISSIONS.DISPATCH_CANCEL, PERMISSIONS.SALES_UPDATE], false),
  dispatchController.cancelDispatch
);

export const dispatchRoutes = router;
