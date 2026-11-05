import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../core/types';
import { stockCountService } from '../services/stockCount.service';
import { sendSuccess, sendCreated, sendPaginated } from '../core/responseHandler';
import { ForbiddenError } from '../core/errors';

export class StockCountController {
  async getCounts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const warehouseScope = req.user?.accessScope?.warehouses || [];
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const filter = {
        status: req.query.status as string,
        warehouseId: req.query.warehouseId as string,
      };

      const result = await stockCountService.getCounts(req.tenant._id, filter, warehouseScope, page, limit);
      sendPaginated(res, result.items, result.total, result.page, result.limit, 'Stock counts retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getCountById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const count = await stockCountService.getCountById(req.tenant._id, req.params.id);
      sendSuccess(res, count, 'Stock count retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createCount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant || !req.user) throw new ForbiddenError('User and Tenant context required');
      const warehouseScope = req.user?.accessScope?.warehouses || [];
      const count = await stockCountService.createCount(req.tenant._id, req.user._id, req.body, warehouseScope);
      sendCreated(res, count, 'Physical stock count planned');
    } catch (err) {
      next(err);
    }
  }

  async recordCounts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const count = await stockCountService.recordCounts(req.tenant._id, req.params.id, req.body.items, req.user?._id);
      sendSuccess(res, count, 'Physical counts recorded and submitted for audit approval');
    } catch (err) {
      next(err);
    }
  }

  async approveCount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant || !req.user) throw new ForbiddenError('User and Tenant context required');
      const warehouseScope = req.user?.accessScope?.warehouses || [];
      const count = await stockCountService.approveCount(
        req.tenant._id,
        req.params.id,
        req.user._id,
        warehouseScope
      );
      sendSuccess(res, count, 'Stock count approved and variance adjustments posted to ledger');
    } catch (err) {
      next(err);
    }
  }
}

export const stockCountController = new StockCountController();
