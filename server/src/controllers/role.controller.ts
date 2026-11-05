import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../core/types';
import { roleService } from '../services/role.service';
import { sendSuccess, sendCreated } from '../core/responseHandler';

export class RoleController {
  async listRoles(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user?.isSuperAdmin ? null : req.tenant?._id;
      const roles = await roleService.listRoles(tenantId);
      sendSuccess(res, roles, 'Roles retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getPermissionsCatalog(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const catalog = roleService.getPermissionsCatalog();
      sendSuccess(res, catalog, 'Permissions catalog retrieved');
    } catch (error) {
      next(error);
    }
  }

  async createRole(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.tenant || !req.user) {
        return next(new Error('Tenant or user context missing'));
      }

      const role = await roleService.createCustomRole(
        req.tenant._id,
        req.user._id,
        req.user.name,
        req.user.email,
        req.body
      );

      sendCreated(res, role, 'Custom role created');
    } catch (error) {
      next(error);
    }
  }

  async updateRole(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.tenant || !req.user) {
        return next(new Error('Tenant or user context missing'));
      }

      const { id } = req.params;
      const updated = await roleService.updateRole(
        id,
        req.tenant._id,
        req.user._id,
        req.user.name,
        req.user.email,
        req.body
      );

      sendSuccess(res, updated, 'Role updated');
    } catch (error) {
      next(error);
    }
  }

  async deleteRole(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.tenant || !req.user) {
        return next(new Error('Tenant or user context missing'));
      }

      const { id } = req.params;
      await roleService.deleteRole(id, req.tenant._id, req.user._id, req.user.name);
      sendSuccess(res, null, 'Role deleted');
    } catch (error) {
      next(error);
    }
  }
}

export const roleController = new RoleController();
