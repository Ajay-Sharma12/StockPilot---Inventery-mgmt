import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../core/types';
import { purchaseRequisitionService } from '../services/purchaseRequisition.service';

export class PurchaseRequisitionController {
  async getPRs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await purchaseRequisitionService.getPurchaseRequisitions(
        req.tenant!._id,
        req.query as any
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getPRById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pr = await purchaseRequisitionService.getPRById(req.tenant!._id, req.params.id);
      res.status(200).json({ success: true, data: pr });
    } catch (err) {
      next(err);
    }
  }

  async createPR(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pr = await purchaseRequisitionService.createPR(
        req.tenant!._id,
        req.user!._id,
        req.body
      );
      res.status(201).json({ success: true, data: pr });
    } catch (err) {
      next(err);
    }
  }

  async updatePR(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pr = await purchaseRequisitionService.updatePR(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body
      );
      res.status(200).json({ success: true, data: pr });
    } catch (err) {
      next(err);
    }
  }

  async submitPR(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pr = await purchaseRequisitionService.submitPR(
        req.tenant!._id,
        req.user!._id,
        req.params.id
      );
      res.status(200).json({ success: true, data: pr });
    } catch (err) {
      next(err);
    }
  }

  async approvePR(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pr = await purchaseRequisitionService.approvePR(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body
      );
      res.status(200).json({ success: true, data: pr });
    } catch (err) {
      next(err);
    }
  }

  async rejectPR(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pr = await purchaseRequisitionService.rejectPR(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body.reason
      );
      res.status(200).json({ success: true, data: pr });
    } catch (err) {
      next(err);
    }
  }

  async cancelPR(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pr = await purchaseRequisitionService.cancelPR(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body.reason
      );
      res.status(200).json({ success: true, data: pr });
    } catch (err) {
      next(err);
    }
  }

  async checkStockAvailability(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await purchaseRequisitionService.checkStockAvailability(
        req.tenant!._id,
        req.params.id
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async issueStock(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pr = await purchaseRequisitionService.issueStockForRequisition(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body
      );
      res.status(200).json({ success: true, data: pr });
    } catch (err) {
      next(err);
    }
  }

  async deletePR(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await purchaseRequisitionService.deletePR(
        req.tenant!._id,
        req.user!._id,
        req.params.id
      );
      res.status(200).json({ success: true, message: 'Requisition deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
}

export const purchaseRequisitionController = new PurchaseRequisitionController();
