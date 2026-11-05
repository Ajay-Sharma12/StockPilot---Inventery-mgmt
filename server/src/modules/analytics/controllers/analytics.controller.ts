import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../core/types';
import { analyticsService, AnalyticsPeriod } from '../services/analytics.service';

export class AnalyticsController {
  async getExecutiveOverview(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const period = (req.query.period as AnalyticsPeriod) || 'month';
      const warehouseId = req.query.warehouseId as string | undefined;
      const result = await analyticsService.getExecutiveOverview(req.tenant!._id, period, warehouseId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getInventoryAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const warehouseId = req.query.warehouseId as string | undefined;
      const result = await analyticsService.getInventoryAnalytics(req.tenant!._id, warehouseId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getProductionAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const period = (req.query.period as AnalyticsPeriod) || 'month';
      const warehouseId = req.query.warehouseId as string | undefined;
      const result = await analyticsService.getProductionAnalytics(req.tenant!._id, period, warehouseId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getSalesAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const period = (req.query.period as AnalyticsPeriod) || 'month';
      const warehouseId = req.query.warehouseId as string | undefined;
      const result = await analyticsService.getSalesAnalytics(req.tenant!._id, period, warehouseId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getProcurementAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const period = (req.query.period as AnalyticsPeriod) || 'month';
      const warehouseId = req.query.warehouseId as string | undefined;
      const result = await analyticsService.getProcurementAnalytics(req.tenant!._id, period, warehouseId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getQCAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const period = (req.query.period as AnalyticsPeriod) || 'month';
      const result = await analyticsService.getQCAnalytics(req.tenant!._id, period);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const analyticsController = new AnalyticsController();
