import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../core/types';
import { warehouseService } from '../services/warehouse.service';
import { sendSuccess, sendCreated } from '../core/responseHandler';
import { ForbiddenError } from '../core/errors';
import { getUserWarehouseScope } from '../core/warehouseScope';

export class WarehouseController {
  async getWarehouses(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const warehouseScope = req.query.all === 'true' ? [] : getUserWarehouseScope(req.user);
      const warehouses = await warehouseService.getWarehouses(req.tenant._id, warehouseScope);
      sendSuccess(res, warehouses, 'Warehouses retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getWarehouseById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const warehouseScope = getUserWarehouseScope(req.user);
      const warehouse = await warehouseService.getWarehouseById(req.tenant._id, req.params.id, warehouseScope);
      sendSuccess(res, warehouse, 'Warehouse retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createWarehouse(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const warehouse = await warehouseService.createWarehouse(req.tenant._id, req.body);
      sendCreated(res, warehouse, 'Warehouse created successfully');
    } catch (err) {
      next(err);
    }
  }

  async updateWarehouse(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const warehouseScope = req.user?.accessScope?.warehouses || [];
      const warehouse = await warehouseService.updateWarehouse(req.tenant._id, req.params.id, req.body, warehouseScope);
      sendSuccess(res, warehouse, 'Warehouse updated');
    } catch (err) {
      next(err);
    }
  }

  async getZones(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const zones = await warehouseService.getZones(req.tenant._id, req.params.warehouseId);
      sendSuccess(res, zones, 'Zones retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createZone(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const zone = await warehouseService.createZone(req.tenant._id, req.body);
      sendCreated(res, zone, 'Zone created');
    } catch (err) {
      next(err);
    }
  }

  async getRacks(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const racks = await warehouseService.getRacks(req.tenant._id, req.params.zoneId);
      sendSuccess(res, racks, 'Racks retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createRack(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const rack = await warehouseService.createRack(req.tenant._id, req.body);
      sendCreated(res, rack, 'Rack created');
    } catch (err) {
      next(err);
    }
  }

  async getBins(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const bins = await warehouseService.getBins(req.tenant._id, {
        warehouseId: req.query.warehouseId as string,
        zoneId: req.query.zoneId as string,
        rackId: req.query.rackId as string,
      });
      sendSuccess(res, bins, 'Bins retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createBin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const bin = await warehouseService.createBin(req.tenant._id, req.body);
      sendCreated(res, bin, 'Bin created');
    } catch (err) {
      next(err);
    }
  }

  async getWarehouseHierarchyTree(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const tree = await warehouseService.getWarehouseHierarchyTree(req.tenant._id, req.params.warehouseId);
      sendSuccess(res, tree, 'Hierarchy tree retrieved');
    } catch (err) {
      next(err);
    }
  }
}

export const warehouseController = new WarehouseController();
