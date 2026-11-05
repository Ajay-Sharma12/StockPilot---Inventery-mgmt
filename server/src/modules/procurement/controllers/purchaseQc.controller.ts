import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../core/types';
import { purchaseQCService } from '../services/purchaseQc.service';

export class PurchaseQCController {
  async getQCQueue(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await purchaseQCService.getQCQueue(req.tenant!._id, req.query as any);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getQCById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const qc = await purchaseQCService.getQCById(req.tenant!._id, req.params.id);
      res.status(200).json({ success: true, data: qc });
    } catch (err) {
      next(err);
    }
  }

  async inspectQC(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const qc = await purchaseQCService.inspectQC(
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

  async dispositionQC(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const qc = await purchaseQCService.dispositionQC(
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

export const purchaseQCController = new PurchaseQCController();
