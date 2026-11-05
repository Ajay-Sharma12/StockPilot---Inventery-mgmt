import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { tenantContext } from '../../../middleware/tenantContext.middleware';
import { requireFeature } from '../../../middleware/entitlement.middleware';
import { requirePermissions } from '../../../middleware/rbac.middleware';
import { validateRequest } from '../../../middleware/validate.middleware';
import { validateWarehouseScope } from '../../../middleware/abac.middleware';
import { PERMISSIONS } from '../../../config/permissions.config';
import { purchaseRequisitionController } from '../controllers/purchaseRequisition.controller';
import {
  createPRSchema,
  updatePRSchema,
  rejectPRSchema,
  approvePRSchema,
  issuePRStockSchema,
  cancelPRSchema,
} from '../validators/procurement.validator';

const router = Router();

router.use(authenticate, tenantContext, requireFeature('procurement'));

// List & View
router.get(
  '/',
  requirePermissions([PERMISSIONS.PR_VIEW, PERMISSIONS.PURCHASE_READ], false),
  purchaseRequisitionController.getPRs
);

router.get(
  '/:id',
  requirePermissions([PERMISSIONS.PR_VIEW, PERMISSIONS.PURCHASE_READ], false),
  purchaseRequisitionController.getPRById
);

// Create
router.post(
  '/',
  requirePermissions([PERMISSIONS.PR_CREATE, PERMISSIONS.PURCHASE_CREATE], false),
  validateRequest({ body: createPRSchema }),
  validateWarehouseScope('warehouseId', 'body'),
  purchaseRequisitionController.createPR
);

// Edit
router.patch(
  '/:id',
  requirePermissions([PERMISSIONS.PR_EDIT, PERMISSIONS.PURCHASE_UPDATE], false),
  validateRequest({ body: updatePRSchema }),
  validateWarehouseScope('warehouseId', 'body'),
  purchaseRequisitionController.updatePR
);

// Workflow transitions
router.post(
  '/:id/submit',
  requirePermissions([PERMISSIONS.PR_SUBMIT, PERMISSIONS.PURCHASE_CREATE], false),
  purchaseRequisitionController.submitPR
);

router.post(
  '/:id/approve',
  requirePermissions([PERMISSIONS.PR_APPROVE, PERMISSIONS.PURCHASE_APPROVE], false),
  validateRequest({ body: approvePRSchema }),
  purchaseRequisitionController.approvePR
);

router.post(
  '/:id/reject',
  requirePermissions([PERMISSIONS.PR_REJECT, PERMISSIONS.PURCHASE_APPROVE], false),
  validateRequest({ body: rejectPRSchema }),
  purchaseRequisitionController.rejectPR
);

router.post(
  '/:id/cancel',
  requirePermissions([PERMISSIONS.PR_EDIT, PERMISSIONS.PURCHASE_UPDATE, PERMISSIONS.PURCHASE_CREATE], false),
  validateRequest({ body: cancelPRSchema }),
  purchaseRequisitionController.cancelPR
);

// Stock Availability Check (Read-only, no stock deduction)
router.post(
  '/:id/availability',
  requirePermissions([PERMISSIONS.PR_VIEW, PERMISSIONS.PURCHASE_READ, PERMISSIONS.INVENTORY_READ], false),
  purchaseRequisitionController.checkStockAvailability
);

// Stock Issue (Actual physical deduction from warehouse inventory & ledger creation)
router.post(
  '/:id/issue',
  requirePermissions([PERMISSIONS.INVENTORY_ISSUE, PERMISSIONS.PURCHASE_APPROVE, PERMISSIONS.PURCHASE_UPDATE], false),
  validateRequest({ body: issuePRStockSchema }),
  purchaseRequisitionController.issueStock
);

// Delete
router.delete(
  '/:id',
  requirePermissions([PERMISSIONS.PR_DELETE, PERMISSIONS.PURCHASE_UPDATE], false),
  purchaseRequisitionController.deletePR
);

export const purchaseRequisitionRoutes = router;
