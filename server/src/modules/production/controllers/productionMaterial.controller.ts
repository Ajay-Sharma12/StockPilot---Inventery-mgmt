import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../core/types';
import { productionMaterialService } from '../services/productionMaterial.service';

export class ProductionMaterialController {
  async consumeMaterial(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await productionMaterialService.consumeMaterial(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body
      );
      res.status(200).json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  }

  async returnMaterial(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await productionMaterialService.returnMaterial(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body
      );
      res.status(200).json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  }
}

export const productionMaterialController = new ProductionMaterialController();
