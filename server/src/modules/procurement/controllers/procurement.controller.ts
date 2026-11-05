import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../core/types';
import { procurementTraceabilityService } from '../services/procurementTraceability.service';

export class ProcurementController {
  async getTraceability(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { type, id } = req.params;
      const chain = await procurementTraceabilityService.getTraceability(
        req.tenant!._id,
        type,
        id
      );
      res.status(200).json({ success: true, data: chain });
    } catch (err) {
      next(err);
    }
  }

  async getDashboardStats(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const stats = await procurementTraceabilityService.getDashboardStats(req.tenant!._id);
      res.status(200).json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  }
}

export const procurementController = new ProcurementController();
