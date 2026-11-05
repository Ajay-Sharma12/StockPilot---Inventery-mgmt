import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../core/types';
import { stockTransferService } from '../services/stockTransfer.service';
import { sendSuccess, sendCreated, sendPaginated } from '../core/responseHandler';
import { ForbiddenError } from '../core/errors';

export class StockTransferController {
  async getTransfers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const warehouseScope = req.user?.accessScope?.warehouses || [];
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const filter = {
        status: req.query.status as string,
      };

      const result = await stockTransferService.getTransfers(req.tenant._id, filter, warehouseScope, page, limit);
      sendPaginated(res, result.items, result.total, result.page, result.limit, 'Stock transfers retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getTransferById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const transfer = await stockTransferService.getTransferById(req.tenant._id, req.params.id);
      sendSuccess(res, transfer, 'Stock transfer retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createTransfer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant || !req.user) throw new ForbiddenError('User and Tenant context required');
      const warehouseScope = req.user?.accessScope?.warehouses || [];
      const transfer = await stockTransferService.createTransfer(req.tenant._id, req.user._id, req.body, warehouseScope);
      sendCreated(res, transfer, 'Stock transfer created');
    } catch (err) {
      next(err);
    }
  }

  async submitTransfer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const transfer = await stockTransferService.submitTransfer(req.tenant._id, req.params.id);
      sendSuccess(res, transfer, 'Stock transfer submitted for approval');
    } catch (err) {
      next(err);
    }
  }

  async approveTransfer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant || !req.user) throw new ForbiddenError('User and Tenant context required');
      const transfer = await stockTransferService.approveTransfer(req.tenant._id, req.params.id, req.user._id);
      sendSuccess(res, transfer, 'Stock transfer approved');
    } catch (err) {
      next(err);
    }
  }

  async dispatchTransfer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant || !req.user) throw new ForbiddenError('User and Tenant context required');
      const warehouseScope = req.user?.accessScope?.warehouses || [];
      const transfer = await stockTransferService.dispatchTransfer(
        req.tenant._id,
        req.params.id,
        req.user._id,
        warehouseScope
      );
      sendSuccess(res, transfer, 'Stock transfer dispatched and stock deducted from origin warehouse');
    } catch (err) {
      next(err);
    }
  }

  async receiveTransfer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant || !req.user) throw new ForbiddenError('User and Tenant context required');
      const warehouseScope = req.user?.accessScope?.warehouses || [];
      const transfer = await stockTransferService.receiveTransfer(
        req.tenant._id,
        req.params.id,
        req.user._id,
        req.body?.receivedQuantities,
        warehouseScope
      );
      sendSuccess(res, transfer, 'Stock transfer received and added to destination warehouse');
    } catch (err) {
      next(err);
    }
  }
}

export const stockTransferController = new StockTransferController();
