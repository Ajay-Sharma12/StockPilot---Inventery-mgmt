import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../core/types';
import { productionBatchService } from '../services/productionBatch.service';

export class ProductionBatchController {
  async getBatches(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await productionBatchService.getBatches(req.tenant!._id, req.query as any);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getBatchById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const batch = await productionBatchService.getBatchById(req.tenant!._id, req.params.id);
      res.status(200).json({ success: true, data: batch });
    } catch (err) {
      next(err);
    }
  }
}

export const productionBatchController = new ProductionBatchController();
