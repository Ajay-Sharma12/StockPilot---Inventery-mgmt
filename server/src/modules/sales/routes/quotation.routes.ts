import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { tenantContext } from '../../../middleware/tenantContext.middleware';
import { requireFeature } from '../../../middleware/entitlement.middleware';
import { requirePermissions } from '../../../middleware/rbac.middleware';
import { validateRequest } from '../../../middleware/validate.middleware';
import { PERMISSIONS } from '../../../config/permissions.config';
import { quotationController } from '../controllers/quotation.controller';
import {
  createQuotationSchema,
  rejectQuotationSchema,
} from '../validators/quotation.validator';

const router = Router();

// Public Client Proposal Endpoints (Accessible by clients via email link without ERP login)
router.get('/public/:id', quotationController.getPublicQuotation);
router.post('/public/:id/accept', quotationController.publicAcceptQuotation);
router.post('/public/:id/reject', quotationController.publicRejectQuotation);

router.use(authenticate, tenantContext, requireFeature('sales'));

router.get(
  '/',
  requirePermissions([PERMISSIONS.SALES_READ, PERMISSIONS.SO_VIEW], false),
  quotationController.getQuotations
);

router.post(
  '/',
  requirePermissions([PERMISSIONS.SALES_CREATE, PERMISSIONS.SO_CREATE], false),
  validateRequest({ body: createQuotationSchema }),
  quotationController.createQuotation
);

router.get(
  '/:id',
  requirePermissions([PERMISSIONS.SALES_READ, PERMISSIONS.SO_VIEW], false),
  quotationController.getQuotationById
);

router.post(
  '/:id/send',
  requirePermissions([PERMISSIONS.SALES_UPDATE, PERMISSIONS.SO_EDIT], false),
  quotationController.sendQuotation
);

router.post(
  '/:id/accept',
  requirePermissions([PERMISSIONS.SALES_UPDATE, PERMISSIONS.SO_EDIT], false),
  quotationController.acceptQuotation
);

router.post(
  '/:id/reject',
  requirePermissions([PERMISSIONS.SALES_UPDATE, PERMISSIONS.SO_EDIT], false),
  validateRequest({ body: rejectQuotationSchema }),
  quotationController.rejectQuotation
);

router.post(
  '/:id/convert',
  requirePermissions([PERMISSIONS.SALES_CREATE, PERMISSIONS.SO_CREATE], false),
  quotationController.convertToSalesOrder
);

router.post(
  '/:id/convert-to-so',
  requirePermissions([PERMISSIONS.SALES_CREATE, PERMISSIONS.SO_CREATE], false),
  quotationController.convertToSalesOrder
);

export const quotationRoutes = router;
