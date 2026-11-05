import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../core/types';
import { productionPlanningService } from '../services/productionPlanning.service';

export class ProductionPlanningController {
  async calculateMaterialRequirements(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { bomId, plannedQuantity, warehouseId } = req.body;
      const plan = await productionPlanningService.calculateMaterialRequirements(
        req.tenant!._id,
        bomId,
        Number(plannedQuantity),
        warehouseId
      );
      res.status(200).json({ success: true, data: plan });
    } catch (err) {
      next(err);
    }
  }

  async getPlanningDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const warehouseId = req.query.warehouseId as string | undefined;
      const data = await productionPlanningService.getPlanningDashboard(req.tenant!._id, warehouseId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const productionPlanningController = new ProductionPlanningController();
