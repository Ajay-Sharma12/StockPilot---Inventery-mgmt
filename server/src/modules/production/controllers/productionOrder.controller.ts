import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../core/types';
import { productionOrderService } from '../services/productionOrder.service';
import { productionExecutionService } from '../services/productionExecution.service';
import { productionCostingService } from '../services/productionCosting.service';
import { productionOutputService } from '../services/productionOutput.service';

export class ProductionOrderController {
  async getProductionOrders(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await productionOrderService.getProductionOrders(req.tenant!._id, req.query as any);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getProductionOrderById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const po = await productionOrderService.getProductionOrderById(req.tenant!._id, req.params.id);
      res.status(200).json({ success: true, data: po });
    } catch (err) {
      next(err);
    }
  }

  async createProductionOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const po = await productionOrderService.createProductionOrder(req.tenant!._id, req.user!._id, req.body);
      res.status(201).json({ success: true, data: po });
    } catch (err) {
      next(err);
    }
  }

  async updateProductionOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const po = await productionOrderService.updateProductionOrder(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body
      );
      res.status(200).json({ success: true, data: po });
    } catch (err) {
      next(err);
    }
  }

  async submitProductionOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const po = await productionOrderService.submitProductionOrder(req.tenant!._id, req.user!._id, req.params.id);
      res.status(200).json({ success: true, data: po });
    } catch (err) {
      next(err);
    }
  }

  async approveProductionOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const po = await productionOrderService.approveProductionOrder(req.tenant!._id, req.user!._id, req.params.id);
      res.status(200).json({ success: true, data: po });
    } catch (err) {
      next(err);
    }
  }

  async releaseProductionOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const po = await productionOrderService.releaseProductionOrder(req.tenant!._id, req.user!._id, req.params.id);
      res.status(200).json({ success: true, data: po });
    } catch (err) {
      next(err);
    }
  }

  async startProduction(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const po = await productionExecutionService.startProduction(req.tenant!._id, req.user!._id, req.params.id);
      res.status(200).json({ success: true, data: po });
    } catch (err) {
      next(err);
    }
  }

  async pauseProduction(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const po = await productionExecutionService.pauseProduction(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body?.reason
      );
      res.status(200).json({ success: true, data: po });
    } catch (err) {
      next(err);
    }
  }

  async resumeProduction(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const po = await productionExecutionService.resumeProduction(req.tenant!._id, req.user!._id, req.params.id);
      res.status(200).json({ success: true, data: po });
    } catch (err) {
      next(err);
    }
  }

  async recordOutput(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = {
        productionOrderId: req.params.id,
        producedQuantity: Number(req.body.producedQuantity),
        acceptedQuantity: req.body.acceptedQuantity !== undefined ? Number(req.body.acceptedQuantity) : undefined,
        rejectedQuantity: req.body.rejectedQuantity !== undefined ? Number(req.body.rejectedQuantity) : undefined,
        scrapQuantity: req.body.scrapQuantity !== undefined ? Number(req.body.scrapQuantity) : 0,
        scrapReason: req.body.scrapReason,
        wastageQuantity: req.body.wastageQuantity !== undefined ? Number(req.body.wastageQuantity) : 0,
        wastageReason: req.body.wastageReason,
        batchNumber: req.body.batchNumber,
        expiryDate: req.body.expiryDate,
        warehouseId: req.body.warehouseId || undefined,
        qcStatus: req.body.qcStatus,
        remarks: req.body.remarks || req.body.notes,
      };

      const result = await productionOutputService.recordOutput(
        req.tenant!._id,
        req.user!._id,
        payload
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async cancelProductionOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const po = await productionOrderService.cancelProductionOrder(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body.reason
      );
      res.status(200).json({ success: true, data: po });
    } catch (err) {
      next(err);
    }
  }

  async getCosting(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const costing = await productionCostingService.calculateOrderCosting(req.tenant!._id, req.params.id);
      res.status(200).json({ success: true, data: costing });
    } catch (err) {
      next(err);
    }
  }
}

export const productionOrderController = new ProductionOrderController();
