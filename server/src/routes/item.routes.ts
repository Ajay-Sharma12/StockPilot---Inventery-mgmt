import { Router } from 'express';
import { itemController } from '../controllers/item.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantContext } from '../middleware/tenantContext.middleware';
import { requirePermissions } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { PERMISSIONS } from '../config/permissions.config';
import { createItemSchema, updateItemSchema, addStockSchema } from '../validators/inventory.validator';

const router = Router();
router.use(authenticate, tenantContext);

router.get('/', requirePermissions([PERMISSIONS.INVENTORY_READ]), (req, res, next) =>
  itemController.getItems(req, res, next)
);

router.get('/:id', requirePermissions([PERMISSIONS.INVENTORY_READ]), (req, res, next) =>
  itemController.getItemById(req, res, next)
);

router.post(
  '/',
  requirePermissions([PERMISSIONS.INVENTORY_CREATE]),
  validateRequest(createItemSchema),
  (req, res, next) => itemController.createItem(req, res, next)
);

router.post(
  '/bulk-import',
  requirePermissions([PERMISSIONS.INVENTORY_CREATE]),
  (req, res, next) => itemController.bulkImport(req, res, next)
);

router.post(
  '/:id/stock',
  requirePermissions([PERMISSIONS.INVENTORY_ADJUST, PERMISSIONS.INVENTORY_CREATE]),
  validateRequest(addStockSchema),
  (req, res, next) => itemController.addStock(req, res, next)
);

router.patch(
  '/:id',
  requirePermissions([PERMISSIONS.INVENTORY_UPDATE]),
  validateRequest(updateItemSchema),
  (req, res, next) => itemController.updateItem(req, res, next)
);

router.delete(
  '/:id',
  requirePermissions([PERMISSIONS.INVENTORY_DELETE, PERMISSIONS.INVENTORY_UPDATE], false),
  (req, res, next) => itemController.deleteItem(req, res, next)
);

export const itemRoutes = router;
