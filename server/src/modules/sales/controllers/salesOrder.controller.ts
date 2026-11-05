import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../core/types';
import { salesOrderService } from '../services/salesOrder.service';

export class SalesOrderController {
  async getSalesOrders(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await salesOrderService.getSalesOrders(req.tenant!._id, req.query as any);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getSalesOrderById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const so = await salesOrderService.getSalesOrderById(req.tenant!._id, req.params.id);
      res.status(200).json({ success: true, data: so });
    } catch (err) {
      next(err);
    }
  }

  async createSalesOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const so = await salesOrderService.createSalesOrder(
        req.tenant!._id,
        req.user!._id,
        req.body
      );
      res.status(201).json({ success: true, data: so });
    } catch (err) {
      next(err);
    }
  }

  async updateSalesOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const so = await salesOrderService.updateSalesOrder(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body
      );
      res.status(200).json({ success: true, data: so });
    } catch (err) {
      next(err);
    }
  }

  async submitSalesOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const so = await salesOrderService.submitSalesOrder(
        req.tenant!._id,
        req.user!._id,
        req.params.id
      );
      res.status(200).json({ success: true, data: so });
    } catch (err) {
      next(err);
    }
  }

  async approveSalesOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const so = await salesOrderService.approveSalesOrder(
        req.tenant!._id,
        req.user!._id,
        req.params.id
      );
      res.status(200).json({ success: true, data: so });
    } catch (err) {
      next(err);
    }
  }

  async rejectSalesOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const so = await salesOrderService.rejectSalesOrder(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body.reason
      );
      res.status(200).json({ success: true, data: so });
    } catch (err) {
      next(err);
    }
  }

  async checkAvailability(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await salesOrderService.checkAvailability(req.tenant!._id, req.params.id);
      res.status(200).json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  }

  async confirmSalesOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const so = await salesOrderService.confirmSalesOrder(
        req.tenant!._id,
        req.user!._id,
        req.params.id
      );
      res.status(200).json({ success: true, data: so });
    } catch (err) {
      next(err);
    }
  }

  async cancelSalesOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const so = await salesOrderService.cancelSalesOrder(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body.reason
      );
      res.status(200).json({ success: true, data: so });
    } catch (err) {
      next(err);
    }
  }

  async getPickList(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pickList = await salesOrderService.getPickList(req.tenant!._id, req.params.id);
      res.status(200).json({ success: true, data: pickList });
    } catch (err) {
      next(err);
    }
  }
}

export const salesOrderController = new SalesOrderController();
