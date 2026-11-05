import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { tenantContext } from '../../../middleware/tenantContext.middleware';
import { requireFeature } from '../../../middleware/entitlement.middleware';
import { requirePermissions } from '../../../middleware/rbac.middleware';
import { validateRequest } from '../../../middleware/validate.middleware';
import { validateWarehouseScope } from '../../../middleware/abac.middleware';
import { PERMISSIONS } from '../../../config/permissions.config';
import { purchaseOrderController } from '../controllers/purchaseOrder.controller';
import {
  createPOSchema,
  updatePOSchema,
  rejectPOSchema,
} from '../validators/procurement.validator';

const router = Router();

router.use(authenticate, tenantContext, requireFeature('procurement'));

router.get(
  '/',
  requirePermissions([PERMISSIONS.PO_VIEW, PERMISSIONS.PURCHASE_READ], false),
  purchaseOrderController.getPOs
);

router.get(
  '/incoming/pipeline',
  requirePermissions([PERMISSIONS.PO_VIEW, PERMISSIONS.PURCHASE_READ, PERMISSIONS.GRN_READ], false),
  purchaseOrderController.getIncomingPurchases
);

router.get(
  '/:id',
  requirePermissions([PERMISSIONS.PO_VIEW, PERMISSIONS.PURCHASE_READ], false),
  purchaseOrderController.getPOById
);

router.get(
  '/:id/print',
  requirePermissions([PERMISSIONS.PO_VIEW, PERMISSIONS.PURCHASE_READ], false),
  purchaseOrderController.printPO
);

router.post(
  '/:id/delivery-followup',
  requirePermissions([PERMISSIONS.PO_VIEW, PERMISSIONS.PURCHASE_READ], false),
  purchaseOrderController.sendDeliveryFollowUp
);

router.post(
  '/',
  requirePermissions([PERMISSIONS.PO_CREATE, PERMISSIONS.PURCHASE_CREATE], false),
  validateRequest({ body: createPOSchema }),
  validateWarehouseScope('warehouseId', 'body'),
  purchaseOrderController.createPO
);

router.patch(
  '/:id',
  requirePermissions([PERMISSIONS.PO_EDIT, PERMISSIONS.PURCHASE_UPDATE], false),
  validateRequest({ body: updatePOSchema }),
  purchaseOrderController.updatePO
);

router.post(
  '/:id/submit',
  requirePermissions([PERMISSIONS.PO_SUBMIT, PERMISSIONS.PURCHASE_CREATE], false),
  purchaseOrderController.submitPO
);

router.post(
  '/:id/approve',
  requirePermissions([PERMISSIONS.PO_APPROVE, PERMISSIONS.PURCHASE_APPROVE], false),
  purchaseOrderController.approvePO
);

router.post(
  '/:id/reject',
  requirePermissions([PERMISSIONS.PO_REJECT, PERMISSIONS.PURCHASE_APPROVE], false),
  validateRequest({ body: rejectPOSchema }),
  purchaseOrderController.rejectPO
);

router.post(
  '/:id/send',
  requirePermissions([PERMISSIONS.PO_SEND, PERMISSIONS.PURCHASE_UPDATE], false),
  purchaseOrderController.sendPO
);

router.post(
  '/:id/resend-notification',
  requirePermissions([PERMISSIONS.PO_SEND, PERMISSIONS.PURCHASE_UPDATE], false),
  purchaseOrderController.resendNotification
);

router.post(
  '/:id/cancel',
  requirePermissions([PERMISSIONS.PO_CANCEL, PERMISSIONS.PURCHASE_UPDATE], false),
  purchaseOrderController.cancelPO
);

export const purchaseOrderRoutes = router;
