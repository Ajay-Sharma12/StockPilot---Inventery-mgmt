import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AuthenticatedRequest } from '../../../core/types';
import { ProductionOrder } from '../models/productionOrder.model';
import { ProductionQC } from '../models/productionQc.model';
import { BOM } from '../models/bom.model';
import { ProductionBatch } from '../models/productionBatch.model';
import { resolveWarehouseScope } from '../../../core/warehouseScope';

export class ProductionController {
  async getOverview(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tId = new Types.ObjectId(req.tenant!._id);
      const whScope = req.user?.accessScope?.warehouses;

      const orderFilter: any = { tenantId: tId };
      if (whScope && whScope.length > 0) {
        const resolvedScope = await resolveWarehouseScope(tId, whScope);
        if (resolvedScope.isRestricted && resolvedScope.objectIds.length > 0) {
          orderFilter.warehouseId = { $in: resolvedScope.objectIds };
        }
      }

      const [
        totalOrders,
        inProgressOrders,
        plannedOrders,
        completedOrders,
        totalBOMs,
        activeBOMs,
        totalBatches,
        qcInspections,
      ] = await Promise.all([
        ProductionOrder.countDocuments(orderFilter).exec(),
        ProductionOrder.countDocuments({ ...orderFilter, status: 'IN_PROGRESS' }).exec(),
        ProductionOrder.countDocuments({ ...orderFilter, status: { $in: ['PLANNED', 'APPROVED', 'RELEASED'] } }).exec(),
        ProductionOrder.countDocuments({ ...orderFilter, status: 'COMPLETED' }).exec(),
        BOM.countDocuments({ tenantId: tId }).exec(),
        BOM.countDocuments({ tenantId: tId, status: 'ACTIVE' }).exec(),
        ProductionBatch.countDocuments({ tenantId: tId }).exec(),
        ProductionQC.find({ tenantId: tId }).exec(),
      ]);

      // Calculate yield and pass rates
      const passedQC = qcInspections.filter((q) => q.overallResult === 'PASS' || q.acceptedQuantity > 0).length;
      const pendingQCInspections = qcInspections.filter((q) => q.status === 'PENDING').length;
      const totalQC = qcInspections.length;
      const qcPassRate = totalQC > 0 ? Math.round((passedQC / totalQC) * 1000) / 10 : 100;

      // Recent work orders
      const recentOrders = await ProductionOrder.find(orderFilter)
        .populate('productionItemId', 'sku name itemCode')
        .populate('uomId', 'code name symbol')
        .populate('warehouseId', 'name code')
        .sort({ createdAt: -1 })
        .limit(5)
        .exec();

      res.status(200).json({
        success: true,
        data: {
          totalOrders,
          activeOrders: inProgressOrders,
          inProgressOrders,
          plannedOrders,
          completedOrders,
          totalBOMs,
          activeBOMs,
          activeBOMCount: activeBOMs,
          totalBatches,
          pendingQCInspections,
          qcPassRate,
          metrics: {
            totalOrders,
            activeOrders: inProgressOrders,
            inProgressOrders,
            plannedOrders,
            completedOrders,
            totalBOMs,
            activeBOMs,
            activeBOMCount: activeBOMs,
            totalBatches,
            pendingQCInspections,
            qcPassRate,
          },
          recentOrders,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

export const productionController = new ProductionController();
