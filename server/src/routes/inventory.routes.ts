import { Router } from 'express';
import { inventoryController } from '../controllers/inventory.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantContext } from '../middleware/tenantContext.middleware';
import { requirePermissions } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { validateWarehouseScope } from '../middleware/abac.middleware';
import { PERMISSIONS } from '../config/permissions.config';
import { receiveStockSchema, issueStockSchema } from '../validators/inventory.validator';

const router = Router();
router.use(authenticate, tenantContext);

// Stock balances (current inventory positions)
router.get('/balances', requirePermissions([PERMISSIONS.INVENTORY_READ]), (req, res, next) =>
  inventoryController.getBalances(req, res, next)
);

// ─── Transaction Ledger ───────────────────────────────────────────────────────
// GET /inventory/transactions  — full paginated ledger with filters
router.get('/transactions', requirePermissions([PERMISSIONS.INVENTORY_READ]), (req, res, next) =>
  inventoryController.getLedger(req, res, next)
);

// GET /inventory/transactions/:id  — single transaction detail
router.get('/transactions/:id', requirePermissions([PERMISSIONS.INVENTORY_READ]), (req, res, next) =>
  inventoryController.getTransactionById(req, res, next)
);

// GET /inventory/items/:itemId/transactions  — per-item stock history
router.get('/items/:itemId/transactions', requirePermissions([PERMISSIONS.INVENTORY_READ]), (req, res, next) =>
  inventoryController.getItemTransactions(req, res, next)
);

// Overview stats for dashboard
router.get('/overview', requirePermissions([PERMISSIONS.INVENTORY_READ]), (req, res, next) =>
  inventoryController.getOverview(req, res, next)
);

// Stock receipt (IN) — creates PURCHASE_RECEIPT / GENERIC_RECEIPT ledger entry
router.post(
  '/receive',
  requirePermissions([PERMISSIONS.INVENTORY_ADJUST]),
  validateRequest(receiveStockSchema),
  validateWarehouseScope('warehouseId', 'body'),
  (req, res, next) => inventoryController.receiveStock(req, res, next)
);

// Stock issue (OUT) — creates GENERIC_ISSUE / STOCK_ISSUE ledger entry
router.post(
  '/issue',
  requirePermissions([PERMISSIONS.INVENTORY_ADJUST]),
  validateRequest(issueStockSchema),
  validateWarehouseScope('warehouseId', 'body'),
  (req, res, next) => inventoryController.issueStock(req, res, next)
);

export const inventoryRoutes = router;
