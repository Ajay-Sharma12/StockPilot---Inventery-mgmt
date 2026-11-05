import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../core/types';
import { quotationService } from '../services/quotation.service';

export class QuotationController {
  async getQuotations(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 50;
      const result = await quotationService.getQuotations(req.tenant!._id, req.query, page, limit);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getQuotationById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const quotation = await quotationService.getQuotationById(req.tenant!._id, req.params.id);
      res.status(200).json({ success: true, data: quotation });
    } catch (err) {
      next(err);
    }
  }

  async createQuotation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const quotation = await quotationService.createQuotation(
        req.tenant!._id,
        req.user!._id,
        req.body
      );
      res.status(201).json({ success: true, data: quotation });
    } catch (err) {
      next(err);
    }
  }

  async sendQuotation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const customBaseUrl =
        (req.body?.portalBaseUrl as string) ||
        (req.headers.origin as string) ||
        undefined;
      const quotation = await quotationService.sendQuotation(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        customBaseUrl
      );
      res.status(200).json({ success: true, data: quotation });
    } catch (err) {
      next(err);
    }
  }

  async acceptQuotation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const quotation = await quotationService.acceptQuotation(
        req.tenant!._id,
        req.user!._id,
        req.params.id
      );
      res.status(200).json({ success: true, data: quotation });
    } catch (err) {
      next(err);
    }
  }

  async rejectQuotation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const quotation = await quotationService.rejectQuotation(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body.reason
      );
      res.status(200).json({ success: true, data: quotation });
    } catch (err) {
      next(err);
    }
  }

  async convertToSalesOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await quotationService.convertToSalesOrder(
        req.tenant!._id,
        req.user!._id,
        req.params.id
      );
      res.status(200).json({
        success: true,
        message: 'Quotation successfully converted to Sales Order',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async getPublicQuotation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const quotation = await quotationService.getPublicQuotation(
        req.params.id,
        req.query.token as string | undefined
      );
      res.status(200).json({ success: true, data: quotation });
    } catch (err) {
      next(err);
    }
  }

  async publicAcceptQuotation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, feedback } = req.body;
      const quotation = await quotationService.publicAcceptQuotation(
        req.params.id,
        token || (req.query.token as string | undefined),
        feedback
      );
      res.status(200).json({
        success: true,
        message: 'Sales Quotation successfully accepted',
        data: quotation,
      });
    } catch (err) {
      next(err);
    }
  }

  async publicRejectQuotation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, reason } = req.body;
      const quotation = await quotationService.publicRejectQuotation(
        req.params.id,
        token || (req.query.token as string | undefined),
        reason
      );
      res.status(200).json({
        success: true,
        message: 'Sales Quotation marked as declined',
        data: quotation,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const quotationController = new QuotationController();
