import { Router } from 'express';
import { stockAdjustmentController } from '../controllers/stockAdjustment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantContext } from '../middleware/tenantContext.middleware';
import { requirePermissions } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { validateWarehouseScope } from '../middleware/abac.middleware';
import { PERMISSIONS } from '../config/permissions.config';
import { createStockAdjustmentSchema } from '../validators/inventory.validator';

const router = Router();
router.use(authenticate, tenantContext);

router.get('/', requirePermissions([PERMISSIONS.INVENTORY_ADJUST]), (req, res, next) =>
  stockAdjustmentController.getAdjustments(req, res, next)
);

router.get('/:id', requirePermissions([PERMISSIONS.INVENTORY_ADJUST]), (req, res, next) =>
  stockAdjustmentController.getAdjustmentById(req, res, next)
);

router.post(
  '/',
  requirePermissions([PERMISSIONS.INVENTORY_ADJUST]),
  validateRequest(createStockAdjustmentSchema),
  validateWarehouseScope('warehouseId', 'body'),
  (req, res, next) => stockAdjustmentController.createAdjustment(req, res, next)
);

router.post('/:id/approve', requirePermissions([PERMISSIONS.INVENTORY_ADJUST]), (req, res, next) =>
  stockAdjustmentController.approveAdjustment(req, res, next)
);

export const stockAdjustmentRoutes = router;

