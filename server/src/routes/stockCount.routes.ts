import { Router } from 'express';
import { stockCountController } from '../controllers/stockCount.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantContext } from '../middleware/tenantContext.middleware';
import { requirePermissions } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { validateWarehouseScope } from '../middleware/abac.middleware';
import { PERMISSIONS } from '../config/permissions.config';
import { createStockCountSchema, recordStockCountSchema } from '../validators/inventory.validator';

const router = Router();
router.use(authenticate, tenantContext);

router.get('/', requirePermissions([PERMISSIONS.INVENTORY_COUNT]), (req, res, next) =>
  stockCountController.getCounts(req, res, next)
);

router.get('/:id', requirePermissions([PERMISSIONS.INVENTORY_COUNT]), (req, res, next) =>
  stockCountController.getCountById(req, res, next)
);

router.post(
  '/',
  requirePermissions([PERMISSIONS.INVENTORY_COUNT]),
  validateRequest(createStockCountSchema),
  validateWarehouseScope('warehouseId', 'body'),
  (req, res, next) => stockCountController.createCount(req, res, next)
);

router.post(
  '/:id/record',
  requirePermissions([PERMISSIONS.INVENTORY_COUNT]),
  validateRequest(recordStockCountSchema),
  (req, res, next) => stockCountController.recordCounts(req, res, next)
);

router.post('/:id/approve', requirePermissions([PERMISSIONS.INVENTORY_COUNT]), (req, res, next) =>
  stockCountController.approveCount(req, res, next)
);

export const stockCountRoutes = router;
