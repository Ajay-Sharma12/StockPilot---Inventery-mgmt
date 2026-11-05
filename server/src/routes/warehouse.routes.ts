import { Router } from 'express';
import { warehouseController } from '../controllers/warehouse.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantContext } from '../middleware/tenantContext.middleware';
import { requirePermissions } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { PERMISSIONS } from '../config/permissions.config';
import {
  createWarehouseSchema,
  createZoneSchema,
  createRackSchema,
  createBinSchema,
} from '../validators/inventory.validator';

const router = Router();
router.use(authenticate, tenantContext);

// Warehouses
router.get('/', requirePermissions([PERMISSIONS.WAREHOUSE_READ]), (req, res, next) =>
  warehouseController.getWarehouses(req, res, next)
);
router.get('/:id', requirePermissions([PERMISSIONS.WAREHOUSE_READ]), (req, res, next) =>
  warehouseController.getWarehouseById(req, res, next)
);
router.post(
  '/',
  requirePermissions([PERMISSIONS.WAREHOUSE_MANAGE]),
  validateRequest(createWarehouseSchema),
  (req, res, next) => warehouseController.createWarehouse(req, res, next)
);
router.patch('/:id', requirePermissions([PERMISSIONS.WAREHOUSE_MANAGE]), (req, res, next) =>
  warehouseController.updateWarehouse(req, res, next)
);

// Hierarchy tree
router.get('/:warehouseId/tree', requirePermissions([PERMISSIONS.WAREHOUSE_READ]), (req, res, next) =>
  warehouseController.getWarehouseHierarchyTree(req, res, next)
);

// Zones
router.get('/:warehouseId/zones', requirePermissions([PERMISSIONS.WAREHOUSE_READ]), (req, res, next) =>
  warehouseController.getZones(req, res, next)
);
router.post(
  '/zones',
  requirePermissions([PERMISSIONS.WAREHOUSE_MANAGE]),
  validateRequest(createZoneSchema),
  (req, res, next) => warehouseController.createZone(req, res, next)
);

// Racks
router.get('/zones/:zoneId/racks', requirePermissions([PERMISSIONS.WAREHOUSE_READ]), (req, res, next) =>
  warehouseController.getRacks(req, res, next)
);
router.post(
  '/racks',
  requirePermissions([PERMISSIONS.WAREHOUSE_MANAGE]),
  validateRequest(createRackSchema),
  (req, res, next) => warehouseController.createRack(req, res, next)
);

// Bins
router.get('/bins', requirePermissions([PERMISSIONS.WAREHOUSE_READ]), (req, res, next) =>
  warehouseController.getBins(req, res, next)
);
router.post(
  '/bins',
  requirePermissions([PERMISSIONS.WAREHOUSE_MANAGE]),
  validateRequest(createBinSchema),
  (req, res, next) => warehouseController.createBin(req, res, next)
);

export const warehouseRoutes = router;
