import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../core/types';
import { productionTraceabilityService } from '../services/productionTraceability.service';

export class ProductionTraceabilityController {
  async getLineage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const docType = (req.params.type || req.query.type || req.query.docType || 'ORDER') as
        | 'BOM'
        | 'ORDER'
        | 'BATCH'
        | 'QC';
      const identifier = (req.params.identifier || req.query.identifier) as string;

      const lineage = await productionTraceabilityService.getLineage(
        req.tenant!._id,
        docType,
        identifier
      );
      res.status(200).json({ success: true, data: lineage });
    } catch (err) {
      next(err);
    }
  }

  async traceRawMaterial(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawItemId = (req.params.itemId || req.query.rawItemId || req.query.itemId) as string;
      const batchNumber = (req.query.batchNumber || (req.body && req.body.batchNumber)) as string | undefined;

      const result = await productionTraceabilityService.traceRawMaterialBatch(
        req.tenant!._id,
        rawItemId,
        batchNumber
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const productionTraceabilityController = new ProductionTraceabilityController();
