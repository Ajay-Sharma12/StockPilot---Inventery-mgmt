import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../core/types';
import { paymentService } from '../services/payment.service';

export class PaymentController {
  async getPayments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await paymentService.getPayments(req.tenant!._id, req.query as any);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getPaymentById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pay = await paymentService.getPaymentById(req.tenant!._id, req.params.id);
      res.status(200).json({ success: true, data: pay });
    } catch (err) {
      next(err);
    }
  }

  async recordPayment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pay = await paymentService.recordPayment(
        req.tenant!._id,
        req.user!._id,
        req.body
      );
      res.status(201).json({ success: true, data: pay });
    } catch (err) {
      next(err);
    }
  }

  async reversePayment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pay = await paymentService.reversePayment(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body.reason
      );
      res.status(200).json({ success: true, data: pay });
    } catch (err) {
      next(err);
    }
  }

  async getReceivables(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await paymentService.getReceivablesSummary(req.tenant!._id);
      res.status(200).json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  }
}

export const paymentController = new PaymentController();
