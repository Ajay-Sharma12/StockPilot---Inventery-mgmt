import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { tenantContext } from '../../../middleware/tenantContext.middleware';
import { requireFeature } from '../../../middleware/entitlement.middleware';
import { requirePermissions } from '../../../middleware/rbac.middleware';
import { validateRequest } from '../../../middleware/validate.middleware';
import { PERMISSIONS } from '../../../config/permissions.config';
import { supplierQuoteController } from '../controllers/supplierQuote.controller';
import {
  createSupplierQuoteSchema,
  finalizeQuoteSchema,
} from '../validators/procurement.validator';

const router = Router();

router.use(authenticate, tenantContext, requireFeature('procurement'));

router.get(
  '/',
  requirePermissions([PERMISSIONS.QUOTE_VIEW, PERMISSIONS.PURCHASE_READ], false),
  supplierQuoteController.getQuotes
);

router.get(
  '/:id',
  requirePermissions([PERMISSIONS.QUOTE_VIEW, PERMISSIONS.PURCHASE_READ], false),
  supplierQuoteController.getQuoteById
);

router.post(
  '/',
  requirePermissions([PERMISSIONS.QUOTE_CREATE, PERMISSIONS.PURCHASE_CREATE], false),
  validateRequest({ body: createSupplierQuoteSchema }),
  supplierQuoteController.createQuote
);

router.post(
  '/:id/finalize',
  requirePermissions([PERMISSIONS.QUOTE_FINALIZE, PERMISSIONS.PURCHASE_APPROVE], false),
  validateRequest({ body: finalizeQuoteSchema }),
  supplierQuoteController.finalizeQuote
);

router.post(
  '/:id/reject',
  requirePermissions([PERMISSIONS.QUOTE_REJECT, PERMISSIONS.PURCHASE_UPDATE], false),
  supplierQuoteController.rejectQuote
);

export const supplierQuoteRoutes = router;
