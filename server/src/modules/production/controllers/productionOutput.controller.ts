import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../core/types';
import { productionOutputService } from '../services/productionOutput.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../../core/responseHandler';
import { ForbiddenError } from '../../../core/errors';

export class ProductionOutputController {
  async recordOutput(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const result = await productionOutputService.recordOutput(
        req.tenant._id,
        req.user!._id,
        req.body
      );
      sendCreated(res, result, 'Production output recorded successfully');
    } catch (err) {
      next(err);
    }
  }

  async getProductionOutputs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const result = await productionOutputService.getProductionOutputs(req.tenant._id, {
        page,
        limit,
        productionOrderId: req.query.productionOrderId as string,
        itemId: req.query.itemId as string,
        warehouseId: req.query.warehouseId as string,
        batchNumber: req.query.batchNumber as string,
        qcStatus: req.query.qcStatus as string,
        search: req.query.search as string,
      });
      sendPaginated(res, result.data, result.total, result.page, result.limit, 'Production outputs retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getProductionOutputById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const output = await productionOutputService.getProductionOutputById(req.tenant._id, req.params.id);
      sendSuccess(res, output, 'Production output retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getMaterialConsumptionMatrix(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const matrix = await productionOutputService.getMaterialConsumptionMatrix(req.tenant._id, {
        warehouseId: req.query.warehouseId as string,
        productionOrderId: req.query.productionOrderId as string,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      });
      sendSuccess(res, matrix, 'Material consumption matrix calculated');
    } catch (err) {
      next(err);
    }
  }

  async getProductionOutputMatrix(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const matrix = await productionOutputService.getProductionOutputMatrix(req.tenant._id, {
        warehouseId: req.query.warehouseId as string,
        productionOrderId: req.query.productionOrderId as string,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      });
      sendSuccess(res, matrix, 'Production output matrix calculated');
    } catch (err) {
      next(err);
    }
  }

  async getProductionDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const dashboard = await productionOutputService.getProductionDashboard(req.tenant._id, {
        warehouseId: req.query.warehouseId as string,
      });
      sendSuccess(res, dashboard, 'Production dashboard metrics calculated');
    } catch (err) {
      next(err);
    }
  }
}

export const productionOutputController = new ProductionOutputController();
