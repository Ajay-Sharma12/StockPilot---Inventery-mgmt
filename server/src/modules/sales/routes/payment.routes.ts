import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { tenantContext } from '../../../middleware/tenantContext.middleware';
import { requireFeature } from '../../../middleware/entitlement.middleware';
import { requirePermissions } from '../../../middleware/rbac.middleware';
import { validateRequest } from '../../../middleware/validate.middleware';
import { PERMISSIONS } from '../../../config/permissions.config';
import { paymentController } from '../controllers/payment.controller';
import { recordPaymentSchema, reversePaymentSchema } from '../validators/sales.validator';

const router = Router();

router.use(authenticate, tenantContext, requireFeature('sales'));

router.get(
  '/',
  requirePermissions([PERMISSIONS.PAYMENT_VIEW, PERMISSIONS.SALES_READ], false),
  paymentController.getPayments
);

router.get(
  '/receivables',
  requirePermissions([PERMISSIONS.PAYMENT_VIEW, PERMISSIONS.SALES_READ], false),
  paymentController.getReceivables
);

router.get(
  '/:id',
  requirePermissions([PERMISSIONS.PAYMENT_VIEW, PERMISSIONS.SALES_READ], false),
  paymentController.getPaymentById
);

router.post(
  '/',
  requirePermissions([PERMISSIONS.PAYMENT_CREATE, PERMISSIONS.SALES_UPDATE], false),
  validateRequest({ body: recordPaymentSchema }),
  paymentController.recordPayment
);

router.post(
  '/:id/reverse',
  requirePermissions([PERMISSIONS.PAYMENT_REVERSE, PERMISSIONS.SALES_UPDATE], false),
  validateRequest({ body: reversePaymentSchema }),
  paymentController.reversePayment
);

export const paymentRoutes = router;
