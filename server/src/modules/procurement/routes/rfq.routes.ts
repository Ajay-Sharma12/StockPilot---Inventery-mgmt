import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { tenantContext } from '../../../middleware/tenantContext.middleware';
import { requireFeature } from '../../../middleware/entitlement.middleware';
import { requirePermissions } from '../../../middleware/rbac.middleware';
import { validateRequest } from '../../../middleware/validate.middleware';
import { PERMISSIONS } from '../../../config/permissions.config';
import { rfqController } from '../controllers/rfq.controller';
import { createRFQSchema, updateRFQSchema } from '../validators/procurement.validator';

const router = Router();

router.use(authenticate, tenantContext, requireFeature('procurement'));

router.get(
  '/',
  requirePermissions([PERMISSIONS.RFQ_VIEW, PERMISSIONS.PURCHASE_READ], false),
  rfqController.getRFQs
);

router.get(
  '/:id',
  requirePermissions([PERMISSIONS.RFQ_VIEW, PERMISSIONS.PURCHASE_READ], false),
  rfqController.getRFQById
);

router.get(
  '/:id/quote-comparison',
  requirePermissions([PERMISSIONS.QUOTE_VIEW, PERMISSIONS.PURCHASE_READ], false),
  rfqController.getQuoteComparison
);

router.post(
  '/',
  requirePermissions([PERMISSIONS.RFQ_CREATE, PERMISSIONS.PURCHASE_CREATE], false),
  validateRequest({ body: createRFQSchema }),
  rfqController.createRFQ
);

router.patch(
  '/:id',
  requirePermissions([PERMISSIONS.RFQ_EDIT, PERMISSIONS.PURCHASE_UPDATE], false),
  validateRequest({ body: updateRFQSchema }),
  rfqController.updateRFQ
);

router.post(
  '/:id/issue',
  requirePermissions([PERMISSIONS.RFQ_ISSUE, PERMISSIONS.PURCHASE_UPDATE], false),
  rfqController.issueRFQ
);

router.post(
  '/:id/suppliers/:supplierId/resend',
  requirePermissions([PERMISSIONS.RFQ_ISSUE, PERMISSIONS.PURCHASE_UPDATE], false),
  rfqController.resendRFQInvite
);

router.post(
  '/:id/close',
  requirePermissions([PERMISSIONS.RFQ_CLOSE, PERMISSIONS.PURCHASE_UPDATE], false),
  rfqController.closeRFQ
);

export const rfqRoutes = router;
