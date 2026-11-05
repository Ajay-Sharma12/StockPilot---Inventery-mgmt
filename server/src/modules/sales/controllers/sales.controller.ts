import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../core/types';
import { salesDashboardService } from '../services/salesDashboard.service';
import { salesTraceabilityService } from '../services/salesTraceability.service';

export class SalesController {
  async getDashboardStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await salesDashboardService.getDashboardStats(req.tenant!._id);
      res.status(200).json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  }

  async getTraceability(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type, id } = req.params;
      const lineage = await salesTraceabilityService.getLineage(
        req.tenant!._id,
        type as any,
        id
      );
      res.status(200).json({ success: true, data: lineage });
    } catch (err) {
      next(err);
    }
  }
}

export const salesController = new SalesController();
