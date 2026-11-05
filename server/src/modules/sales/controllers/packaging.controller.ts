import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../core/types';
import { packagingService } from '../services/packaging.service';

export class PackagingController {
  async getPackages(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await packagingService.getPackages(req.tenant!._id, req.query as any);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getPackageById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pkg = await packagingService.getPackageById(req.tenant!._id, req.params.id);
      res.status(200).json({ success: true, data: pkg });
    } catch (err) {
      next(err);
    }
  }

  async createPackage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pkg = await packagingService.createPackage(
        req.tenant!._id,
        req.user!._id,
        req.body
      );
      res.status(201).json({ success: true, data: pkg });
    } catch (err) {
      next(err);
    }
  }

  async packOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pkg = await packagingService.packOrder(
        req.tenant!._id,
        req.user!._id,
        req.params.id
      );
      res.status(200).json({ success: true, data: pkg });
    } catch (err) {
      next(err);
    }
  }

  async cancelPackage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pkg = await packagingService.cancelPackage(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body?.reason
      );
      res.status(200).json({ success: true, data: pkg });
    } catch (err) {
      next(err);
    }
  }
}

export const packagingController = new PackagingController();
