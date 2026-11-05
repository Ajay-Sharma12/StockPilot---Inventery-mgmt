import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../core/types';
import { rfqService } from '../services/rfq.service';
import { quoteComparisonService } from '../services/quoteComparison.service';

export class RFQController {
  async getRFQs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await rfqService.getRFQs(req.tenant!._id, req.query as any);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getRFQById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const rfq = await rfqService.getRFQById(req.tenant!._id, req.params.id);
      res.status(200).json({ success: true, data: rfq });
    } catch (err) {
      next(err);
    }
  }

  async createRFQ(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const rfq = await rfqService.createRFQ(req.tenant!._id, req.user!._id, req.body);
      res.status(201).json({ success: true, data: rfq });
    } catch (err) {
      next(err);
    }
  }

  async updateRFQ(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const rfq = await rfqService.updateRFQ(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body
      );
      res.status(200).json({ success: true, data: rfq });
    } catch (err) {
      next(err);
    }
  }

  async issueRFQ(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const rfq = await rfqService.issueRFQ(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body?.supplierOverrides
      );
      res.status(200).json({ success: true, data: rfq });
    } catch (err) {
      next(err);
    }
  }

  async resendRFQInvite(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const rfq = await rfqService.resendRFQInvite(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.params.supplierId,
        req.body
      );
      res.status(200).json({ success: true, data: rfq });
    } catch (err) {
      next(err);
    }
  }

  async closeRFQ(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const rfq = await rfqService.closeRFQ(req.tenant!._id, req.user!._id, req.params.id);
      res.status(200).json({ success: true, data: rfq });
    } catch (err) {
      next(err);
    }
  }

  async getQuoteComparison(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const matrix = await quoteComparisonService.compareQuotesForRFQ(
        req.tenant!._id,
        req.params.id
      );
      res.status(200).json({ success: true, data: matrix });
    } catch (err) {
      next(err);
    }
  }
}

export const rfqController = new RFQController();
