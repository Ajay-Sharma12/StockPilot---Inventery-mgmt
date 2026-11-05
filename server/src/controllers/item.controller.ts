import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../core/types';
import { itemService } from '../services/item.service';
import { sendSuccess, sendCreated, sendPaginated } from '../core/responseHandler';
import { ForbiddenError } from '../core/errors';

export class ItemController {
  async getItems(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const filter = {
        search: req.query.search as string,
        categoryId: req.query.categoryId as string,
        itemType: req.query.itemType as string,
        status: req.query.status as string,
      };

      const result = await itemService.getItems(req.tenant._id, filter, page, limit);
      sendPaginated(res, result.items, result.total, result.page, result.limit, 'Items retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getItemById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const item = await itemService.getItemById(req.tenant._id, req.params.id);
      sendSuccess(res, item, 'Item retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant || !req.user) throw new ForbiddenError('User and Tenant context required');
      const item = await itemService.createItem(req.tenant._id, req.user._id, req.body);
      sendCreated(res, item, 'Item created successfully');
    } catch (err) {
      next(err);
    }
  }

  async updateItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant || !req.user) throw new ForbiddenError('User and Tenant context required');
      const item = await itemService.updateItem(req.tenant._id, req.user._id, req.params.id, req.body);
      sendSuccess(res, item, 'Item updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async addStock(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant || !req.user) throw new ForbiddenError('User and Tenant context required');
      const item = await itemService.addStock(req.tenant._id, req.user._id, req.params.id, req.body);
      sendSuccess(res, item, 'Stock updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async bulkImport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant || !req.user) throw new ForbiddenError('User and Tenant context required');
      const items = Array.isArray(req.body) ? req.body : req.body.items;
      const result = await itemService.bulkImportItems(req.tenant._id, req.user._id, items);
      sendSuccess(res, result, `Processed ${items?.length || 0} items: ${result.imported} imported, ${result.failed} failed`);
    } catch (err) {
      next(err);
    }
  }

  async deleteItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant || !req.user) throw new ForbiddenError('User and Tenant context required');
      const result = await itemService.deleteItem(req.tenant._id, req.user._id, req.params.id);
      sendSuccess(res, result, 'Item deleted successfully');
    } catch (err) {
      next(err);
    }
  }
}

export const itemController = new ItemController();
