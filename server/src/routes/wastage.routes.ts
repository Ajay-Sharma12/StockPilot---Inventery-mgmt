import { Router } from 'express';
import { wastageController } from '../controllers/wastage.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantContext } from '../middleware/tenantContext.middleware';
import { requirePermissions } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { validateWarehouseScope } from '../middleware/abac.middleware';
import { PERMISSIONS } from '../config/permissions.config';
import { createWastageSchema } from '../validators/inventory.validator';

const router = Router();
router.use(authenticate, tenantContext);

router.get('/', requirePermissions([PERMISSIONS.INVENTORY_READ]), (req, res, next) =>
  wastageController.getWastages(req, res, next)
);

router.get('/:id', requirePermissions([PERMISSIONS.INVENTORY_READ]), (req, res, next) =>
  wastageController.getWastageById(req, res, next)
);

router.post(
  '/',
  requirePermissions([PERMISSIONS.INVENTORY_ADJUST]),
  validateRequest(createWastageSchema),
  validateWarehouseScope('warehouseId', 'body'),
  (req, res, next) => wastageController.createWastage(req, res, next)
);

router.post('/:id/approve', requirePermissions([PERMISSIONS.INVENTORY_ADJUST]), (req, res, next) =>
  wastageController.approveWastage(req, res, next)
);

router.post('/:id/reject', requirePermissions([PERMISSIONS.INVENTORY_ADJUST]), (req, res, next) =>
  wastageController.rejectWastage(req, res, next)
);

export const wastageRoutes = router;

