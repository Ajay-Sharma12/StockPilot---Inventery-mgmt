import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../core/types';
import { inventoryService } from '../services/inventory.service';
import { sendSuccess, sendCreated, sendPaginated } from '../core/responseHandler';
import { BadRequestError, ForbiddenError } from '../core/errors';
import { getUserWarehouseScope, resolveWarehouseScope } from '../core/warehouseScope';

export class InventoryController {
  async getBalances(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const warehouseScope = getUserWarehouseScope(req.user);
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const filter = {
        itemId: req.query.itemId as string,
        warehouseId: req.query.warehouseId as string,
        lowStockOnly: req.query.lowStockOnly === 'true',
      };

      const result = await inventoryService.getBalances(req.tenant._id, filter, warehouseScope, page, limit);
      sendPaginated(res, result.items, result.total, result.page, result.limit, 'Inventory balances retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getLedger(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const warehouseScope = getUserWarehouseScope(req.user);
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 25;

      const filter = {
        itemId: req.query.itemId as string,
        warehouseId: req.query.warehouseId as string,
        transactionType: req.query.transactionType as string,
        referenceId: req.query.referenceId as string,
        userId: req.query.userId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        search: (req.query.search || req.query.q) as string,
      };

      const result = await inventoryService.getLedger(req.tenant._id, filter, warehouseScope, page, limit);
      sendPaginated(res, result.items, result.total, result.page, result.limit, 'Inventory ledger retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getTransactionById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const { id } = req.params;
      if (!id) throw new BadRequestError('Transaction ID is required');

      const txn = await inventoryService.getTransactionById(req.tenant._id, id);
      sendSuccess(res, txn, 'Transaction detail retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getItemTransactions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const { itemId } = req.params;
      if (!itemId) throw new BadRequestError('Item ID is required');

      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 25;

      const filter = {
        warehouseId: req.query.warehouseId as string,
        transactionType: req.query.transactionType as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      };

      const result = await inventoryService.getItemTransactions(req.tenant._id, itemId, filter, page, limit);
      sendSuccess(res, result, 'Item transaction history retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getOverview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const warehouseScope = getUserWarehouseScope(req.user);
      const stats = await inventoryService.getOverviewStats(req.tenant._id, warehouseScope);
      sendSuccess(res, stats, 'Inventory overview retrieved');
    } catch (err) {
      next(err);
    }
  }

  async receiveStock(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant || !req.user) throw new ForbiddenError('User and Tenant context required');
      const warehouseScope = getUserWarehouseScope(req.user);

      if (warehouseScope.length > 0) {
        const resolvedScope = await resolveWarehouseScope(req.tenant._id, warehouseScope);
        if (resolvedScope.isRestricted && !resolvedScope.isAuthorized(req.body.warehouseId)) {
          throw new ForbiddenError('You do not have permission to receive stock into this warehouse');
        }
      }

      const result = await inventoryService.receiveStock(req.tenant._id, req.user._id, {
        ...req.body,
        transactionType: req.body.transactionType || 'GENERIC_RECEIPT',
      });

      sendCreated(res, result, 'Stock received successfully');
    } catch (err) {
      next(err);
    }
  }

  async issueStock(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant || !req.user) throw new ForbiddenError('User and Tenant context required');
      const warehouseScope = getUserWarehouseScope(req.user);

      if (warehouseScope.length > 0) {
        const resolvedScope = await resolveWarehouseScope(req.tenant._id, warehouseScope);
        if (resolvedScope.isRestricted && !resolvedScope.isAuthorized(req.body.warehouseId)) {
          throw new ForbiddenError('You do not have permission to issue stock from this warehouse');
        }
      }

      const result = await inventoryService.issueStock(req.tenant._id, req.user._id, {
        ...req.body,
        transactionType: req.body.transactionType || 'GENERIC_ISSUE',
      });

      sendSuccess(res, result, 'Stock issued successfully');
    } catch (err) {
      next(err);
    }
  }
}

export const inventoryController = new InventoryController();
