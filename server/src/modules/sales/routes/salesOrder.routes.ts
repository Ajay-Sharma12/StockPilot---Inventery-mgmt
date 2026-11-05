import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { tenantContext } from '../../../middleware/tenantContext.middleware';
import { requireFeature } from '../../../middleware/entitlement.middleware';
import { requirePermissions } from '../../../middleware/rbac.middleware';
import { validateRequest } from '../../../middleware/validate.middleware';
import { validateWarehouseScope } from '../../../middleware/abac.middleware';
import { PERMISSIONS } from '../../../config/permissions.config';
import { salesOrderController } from '../controllers/salesOrder.controller';
import {
  createSalesOrderSchema,
  updateSalesOrderSchema,
  rejectSalesOrderSchema,
  cancelSalesOrderSchema,
} from '../validators/sales.validator';

const router = Router();

router.use(authenticate, tenantContext, requireFeature('sales'));

router.get(
  '/',
  requirePermissions([PERMISSIONS.SO_VIEW, PERMISSIONS.SALES_READ], false),
  salesOrderController.getSalesOrders
);

router.get(
  '/:id',
  requirePermissions([PERMISSIONS.SO_VIEW, PERMISSIONS.SALES_READ], false),
  salesOrderController.getSalesOrderById
);

router.post(
  '/',
  requirePermissions([PERMISSIONS.SO_CREATE, PERMISSIONS.SALES_CREATE], false),
  validateRequest({ body: createSalesOrderSchema }),
  validateWarehouseScope('warehouseId', 'body'),
  salesOrderController.createSalesOrder
);

router.patch(
  '/:id',
  requirePermissions([PERMISSIONS.SO_EDIT, PERMISSIONS.SALES_UPDATE], false),
  validateRequest({ body: updateSalesOrderSchema }),
  salesOrderController.updateSalesOrder
);

router.post(
  '/:id/submit',
  requirePermissions([PERMISSIONS.SO_SUBMIT, PERMISSIONS.SALES_CREATE], false),
  salesOrderController.submitSalesOrder
);

router.post(
  '/:id/approve',
  requirePermissions([PERMISSIONS.SO_APPROVE, PERMISSIONS.SALES_APPROVE], false),
  salesOrderController.approveSalesOrder
);

router.post(
  '/:id/reject',
  requirePermissions([PERMISSIONS.SO_REJECT, PERMISSIONS.SALES_APPROVE], false),
  validateRequest({ body: rejectSalesOrderSchema }),
  salesOrderController.rejectSalesOrder
);

router.get(
  '/:id/availability',
  requirePermissions([PERMISSIONS.SO_VIEW, PERMISSIONS.SALES_READ], false),
  salesOrderController.checkAvailability
);

router.post(
  '/:id/confirm',
  requirePermissions([PERMISSIONS.SO_CONFIRM, PERMISSIONS.SO_ALLOCATE, PERMISSIONS.SALES_UPDATE], false),
  salesOrderController.confirmSalesOrder
);

router.post(
  '/:id/cancel',
  requirePermissions([PERMISSIONS.SO_CANCEL, PERMISSIONS.SALES_UPDATE], false),
  validateRequest({ body: cancelSalesOrderSchema }),
  salesOrderController.cancelSalesOrder
);

router.get(
  '/:id/pick-list',
  requirePermissions([PERMISSIONS.SO_VIEW, PERMISSIONS.SALES_READ], false),
  salesOrderController.getPickList
);

export const salesOrderRoutes = router;
