import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../core/types';
import { supplierQuoteService } from '../services/supplierQuote.service';

export class SupplierQuoteController {
  async getQuotes(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await supplierQuoteService.getQuotes(req.tenant!._id, req.query as any);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getQuoteById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const quote = await supplierQuoteService.getQuoteById(req.tenant!._id, req.params.id);
      res.status(200).json({ success: true, data: quote });
    } catch (err) {
      next(err);
    }
  }

  async createQuote(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const quote = await supplierQuoteService.createQuote(
        req.tenant!._id,
        req.user!._id,
        req.body
      );
      res.status(201).json({ success: true, data: quote });
    } catch (err) {
      next(err);
    }
  }

  async finalizeQuote(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const quote = await supplierQuoteService.finalizeQuote(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body.selectionReason
      );
      res.status(200).json({ success: true, data: quote });
    } catch (err) {
      next(err);
    }
  }

  async rejectQuote(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const quote = await supplierQuoteService.rejectQuote(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body.reason
      );
      res.status(200).json({ success: true, data: quote });
    } catch (err) {
      next(err);
    }
  }
}

export const supplierQuoteController = new SupplierQuoteController();
