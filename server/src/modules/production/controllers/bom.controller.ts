import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../core/types';
import { bomService } from '../services/bom.service';

export class BOMController {
  async getBOMs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await bomService.getBOMs(req.tenant!._id, req.query as any);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getBOMById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const bom = await bomService.getBOMById(req.tenant!._id, req.params.id);
      res.status(200).json({ success: true, data: bom });
    } catch (err) {
      next(err);
    }
  }

  async createBOM(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const bom = await bomService.createBOM(req.tenant!._id, req.user!._id, req.body);
      res.status(201).json({ success: true, data: bom });
    } catch (err) {
      next(err);
    }
  }

  async updateBOM(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const bom = await bomService.updateBOM(req.tenant!._id, req.user!._id, req.params.id, req.body);
      res.status(200).json({ success: true, data: bom });
    } catch (err) {
      next(err);
    }
  }

  async submitBOM(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const bom = await bomService.submitBOM(req.tenant!._id, req.user!._id, req.params.id);
      res.status(200).json({ success: true, data: bom });
    } catch (err) {
      next(err);
    }
  }

  async approveBOM(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const bom = await bomService.approveBOM(req.tenant!._id, req.user!._id, req.params.id);
      res.status(200).json({ success: true, data: bom });
    } catch (err) {
      next(err);
    }
  }

  async activateBOM(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const bom = await bomService.activateBOM(req.tenant!._id, req.user!._id, req.params.id);
      res.status(200).json({ success: true, data: bom });
    } catch (err) {
      next(err);
    }
  }

  async archiveBOM(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const bom = await bomService.archiveBOM(req.tenant!._id, req.user!._id, req.params.id);
      res.status(200).json({ success: true, data: bom });
    } catch (err) {
      next(err);
    }
  }

  async cloneNewVersion(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const bom = await bomService.cloneNewVersion(req.tenant!._id, req.user!._id, req.params.id);
      res.status(201).json({ success: true, data: bom });
    } catch (err) {
      next(err);
    }
  }
}

export const bomController = new BOMController();
