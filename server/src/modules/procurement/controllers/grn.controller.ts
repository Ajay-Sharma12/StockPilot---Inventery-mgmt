import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../core/types';
import { grnService } from '../services/grn.service';

export class GRNController {
  async getGRNs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await grnService.getGRNs(req.tenant!._id, req.query as any);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getGRNById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const grn = await grnService.getGRNById(req.tenant!._id, req.params.id);
      res.status(200).json({ success: true, data: grn });
    } catch (err) {
      next(err);
    }
  }

  async createGRN(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const grn = await grnService.createGRN(
        req.tenant!._id,
        req.user!._id,
        req.body
      );
      res.status(201).json({ success: true, data: grn });
    } catch (err) {
      next(err);
    }
  }

  async cancelGRN(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const grn = await grnService.cancelGRN(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body.reason
      );
      res.status(200).json({ success: true, data: grn });
    } catch (err) {
      next(err);
    }
  }

  async resendNotification(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const grn = await grnService.resendNotification(
        req.tenant!._id,
        req.params.id,
        req.body
      );
      res.status(200).json({ success: true, message: 'Supplier acknowledgment notification resent successfully!', data: grn });
    } catch (err) {
      next(err);
    }
  }

  async sendToQC(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const grn = await grnService.sendToQC(
        req.tenant!._id,
        req.user!._id,
        req.params.id
      );
      res.status(200).json({ success: true, message: 'GRN successfully dispatched to QC Inspection queue', data: grn });
    } catch (err) {
      next(err);
    }
  }
}

export const grnController = new GRNController();
