import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../core/types';
import { dispatchService } from '../services/dispatch.service';

export class DispatchController {
  async getDispatches(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await dispatchService.getDispatches(req.tenant!._id, req.query as any);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getDispatchById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const dsp = await dispatchService.getDispatchById(req.tenant!._id, req.params.id);
      res.status(200).json({ success: true, data: dsp });
    } catch (err) {
      next(err);
    }
  }

  async createDispatch(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const dsp = await dispatchService.createDispatch(
        req.tenant!._id,
        req.user!._id,
        req.body
      );
      res.status(201).json({ success: true, data: dsp });
    } catch (err) {
      next(err);
    }
  }

  async dispatchOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const dsp = await dispatchService.dispatchOrder(
        req.tenant!._id,
        req.user!._id,
        req.params.id
      );
      res.status(200).json({ success: true, data: dsp });
    } catch (err) {
      next(err);
    }
  }

  async cancelDispatch(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const dsp = await dispatchService.cancelDispatch(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body?.reason
      );
      res.status(200).json({ success: true, data: dsp });
    } catch (err) {
      next(err);
    }
  }
}

export const dispatchController = new DispatchController();
