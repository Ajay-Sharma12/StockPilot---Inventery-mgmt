import { Router } from 'express';
import { stockTransferController } from '../controllers/stockTransfer.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantContext } from '../middleware/tenantContext.middleware';
import { requirePermissions } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { validateWarehouseScope } from '../middleware/abac.middleware';
import { PERMISSIONS } from '../config/permissions.config';
import {
  createStockTransferSchema,
  receiveStockTransferSchema,
} from '../validators/inventory.validator';

const router = Router();
router.use(authenticate, tenantContext);

router.get('/', requirePermissions([PERMISSIONS.INVENTORY_TRANSFER]), (req, res, next) =>
  stockTransferController.getTransfers(req, res, next)
);

router.get('/:id', requirePermissions([PERMISSIONS.INVENTORY_TRANSFER]), (req, res, next) =>
  stockTransferController.getTransferById(req, res, next)
);

router.post(
  '/',
  requirePermissions([PERMISSIONS.INVENTORY_TRANSFER]),
  validateRequest(createStockTransferSchema),
  validateWarehouseScope('fromWarehouseId', 'body'),
  (req, res, next) => stockTransferController.createTransfer(req, res, next)
);

router.post('/:id/submit', requirePermissions([PERMISSIONS.INVENTORY_TRANSFER]), (req, res, next) =>
  stockTransferController.submitTransfer(req, res, next)
);

router.post('/:id/approve', requirePermissions([PERMISSIONS.INVENTORY_TRANSFER]), (req, res, next) =>
  stockTransferController.approveTransfer(req, res, next)
);

router.post('/:id/dispatch', requirePermissions([PERMISSIONS.INVENTORY_TRANSFER]), (req, res, next) =>
  stockTransferController.dispatchTransfer(req, res, next)
);

router.post(
  '/:id/receive',
  requirePermissions([PERMISSIONS.INVENTORY_TRANSFER]),
  validateRequest(receiveStockTransferSchema),
  (req, res, next) => stockTransferController.receiveTransfer(req, res, next)
);

export const stockTransferRoutes = router;
