import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../core/types';
import { userService } from '../services/user.service';
import { sendSuccess, sendCreated, sendPaginated } from '../core/responseHandler';
import { ForbiddenError } from '../core/errors';

export class UserController {
  async listUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.tenant) {
        throw new ForbiddenError('Tenant context required');
      }

      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const search = req.query.search as string;
      const roleId = req.query.roleId as string;
      const status = req.query.status as string;

      const result = await userService.listUsers(req.tenant._id, page, limit, search, roleId, status);
      sendPaginated(res, result.items, result.total, result.page, result.limit, 'Users retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.user?.isSuperAdmin ? null : req.tenant?._id;

      const user = await userService.getUserById(id, tenantId);
      sendSuccess(res, user, 'User retrieved');
    } catch (error) {
      next(error);
    }
  }

  async createUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.tenant || !req.user) {
        throw new ForbiddenError('Tenant or user context missing');
      }

      const user = await userService.createUser(
        req.tenant._id,
        req.user._id,
        req.user.name,
        req.user.email,
        req.body
      );

      sendCreated(res, user, 'User created successfully');
    } catch (error) {
      next(error);
    }
  }

  async inviteUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.tenant || !req.user) {
        throw new ForbiddenError('Tenant or user context missing');
      }

      const user = await userService.inviteUser(
        req.tenant._id,
        req.user._id,
        req.user.name,
        req.user.email,
        req.body
      );

      sendCreated(res, user, 'User invitation dispatched successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.tenant || !req.user) {
        throw new ForbiddenError('Tenant or user context missing');
      }

      const { id } = req.params;
      const updated = await userService.updateUser(
        id,
        req.tenant._id,
        req.user._id,
        req.user.name,
        req.user.email,
        req.body
      );

      sendSuccess(res, updated, 'User updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async toggleStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.tenant || !req.user) {
        throw new ForbiddenError('Tenant or user context missing');
      }

      const { id } = req.params;
      const { status } = req.body;

      const result = await userService.toggleStatus(id, req.tenant._id, status, req.user._id, req.user.name);
      sendSuccess(res, result, 'User status updated');
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
