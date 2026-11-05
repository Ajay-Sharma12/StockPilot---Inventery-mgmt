import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../core/types';
import { productionQcService } from '../services/productionQc.service';

export class ProductionQCController {
  async getQCInspections(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await productionQcService.getQCInspections(req.tenant!._id, req.query as any);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getQCInspectionById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const qc = await productionQcService.getQCInspectionById(req.tenant!._id, req.params.id);
      res.status(200).json({ success: true, data: qc });
    } catch (err) {
      next(err);
    }
  }

  async inspectProductionQC(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const qc = await productionQcService.inspectProductionQC(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body
      );
      res.status(200).json({ success: true, data: qc });
    } catch (err) {
      next(err);
    }
  }

  async dispositionProductionQC(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const qc = await productionQcService.dispositionProductionQC(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body
      );
      res.status(200).json({ success: true, data: qc });
    } catch (err) {
      next(err);
    }
  }

  async overrideVerdict(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const qc = await productionQcService.overrideVerdict(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body
      );
      res.status(200).json({ success: true, data: qc });
    } catch (err) {
      next(err);
    }
  }
}

export const productionQcController = new ProductionQCController();
