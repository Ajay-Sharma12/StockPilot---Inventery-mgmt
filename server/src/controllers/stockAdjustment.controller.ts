import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../core/types';
import { stockAdjustmentService } from '../services/stockAdjustment.service';
import { sendSuccess, sendCreated, sendPaginated } from '../core/responseHandler';
import { ForbiddenError } from '../core/errors';

export class StockAdjustmentController {
  async getAdjustments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const warehouseScope = req.user?.accessScope?.warehouses || [];
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const filter = {
        status: req.query.status as string,
        warehouseId: req.query.warehouseId as string,
      };

      const result = await stockAdjustmentService.getAdjustments(req.tenant._id, filter, warehouseScope, page, limit);
      sendPaginated(res, result.items, result.total, result.page, result.limit, 'Stock adjustments retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getAdjustmentById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const adj = await stockAdjustmentService.getAdjustmentById(req.tenant._id, req.params.id);
      sendSuccess(res, adj, 'Stock adjustment retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createAdjustment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant || !req.user) throw new ForbiddenError('User and Tenant context required');
      const warehouseScope = req.user?.accessScope?.warehouses || [];
      const adj = await stockAdjustmentService.createAdjustment(req.tenant._id, req.user._id, req.body, warehouseScope);
      sendCreated(res, adj, 'Stock adjustment created');
    } catch (err) {
      next(err);
    }
  }

  async approveAdjustment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant || !req.user) throw new ForbiddenError('User and Tenant context required');
      const warehouseScope = req.user?.accessScope?.warehouses || [];
      const adj = await stockAdjustmentService.approveAdjustment(
        req.tenant._id,
        req.params.id,
        req.user._id,
        warehouseScope
      );
      sendSuccess(res, adj, 'Stock adjustment approved and posted to inventory ledger');
    } catch (err) {
      next(err);
    }
  }
}

export const stockAdjustmentController = new StockAdjustmentController();
