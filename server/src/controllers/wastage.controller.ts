import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../core/types';
import { wastageService } from '../services/wastage.service';
import { sendSuccess, sendCreated, sendPaginated } from '../core/responseHandler';
import { ForbiddenError } from '../core/errors';

export class WastageController {
  async getWastages(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const warehouseScope = req.user?.accessScope?.warehouses || [];
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const filter = {
        status: req.query.status as string,
        warehouseId: req.query.warehouseId as string,
      };

      const result = await wastageService.getWastages(req.tenant._id, filter, warehouseScope, page, limit);
      sendPaginated(res, result.items, result.total, result.page, result.limit, 'Wastage records retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getWastageById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const wastage = await wastageService.getWastageById(req.tenant._id, req.params.id);
      sendSuccess(res, wastage, 'Wastage record retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createWastage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant || !req.user) throw new ForbiddenError('User and Tenant context required');
      const warehouseScope = req.user?.accessScope?.warehouses || [];
      const wastage = await wastageService.createWastage(req.tenant._id, req.user._id, req.body, warehouseScope);
      sendCreated(res, wastage, 'Wastage report created');
    } catch (err) {
      next(err);
    }
  }

  async approveWastage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant || !req.user) throw new ForbiddenError('User and Tenant context required');
      const warehouseScope = req.user?.accessScope?.warehouses || [];
      const wastage = await wastageService.approveWastage(
        req.tenant._id,
        req.params.id,
        req.user._id,
        warehouseScope
      );
      sendSuccess(res, wastage, 'Wastage report approved and stock scrapped');
    } catch (err) {
      next(err);
    }
  }

  async rejectWastage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant || !req.user) throw new ForbiddenError('User and Tenant context required');
      const warehouseScope = req.user?.accessScope?.warehouses || [];
      const wastage = await wastageService.rejectWastage(
        req.tenant._id,
        req.params.id,
        req.user._id,
        req.body?.remarks,
        warehouseScope
      );
      sendSuccess(res, wastage, 'Wastage report rejected');
    } catch (err) {
      next(err);
    }
  }
}

export const wastageController = new WastageController();
