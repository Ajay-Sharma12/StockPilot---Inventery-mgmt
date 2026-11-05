import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../core/types';
import { tenantService } from '../services/tenant.service';
import { sendSuccess, sendPaginated } from '../core/responseHandler';
import { ForbiddenError } from '../core/errors';

export class TenantController {
  async getCurrentTenant(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.tenant) {
        throw new ForbiddenError('Tenant context not resolved');
      }
      sendSuccess(res, req.tenant, 'Current organization profile retrieved');
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.tenant || !req.user) {
        throw new ForbiddenError('Tenant or user context missing');
      }

      const updated = await tenantService.updateSettings(
        req.tenant._id,
        req.user._id,
        req.user.name,
        req.user.email,
        req.body
      );

      sendSuccess(res, updated.settings, 'Settings updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.tenant || !req.user) {
        throw new ForbiddenError('Tenant or user context missing');
      }

      const updated = await tenantService.updateTenantProfile(
        req.tenant._id,
        req.user._id,
        req.user.name,
        req.user.email,
        req.body
      );

      sendSuccess(res, updated, 'Organization profile updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async listAllTenants(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const search = req.query.search as string;

      const result = await tenantService.listTenantsForSuperAdmin(page, limit, search);
      sendPaginated(res, result.items, result.total, result.page, result.limit, 'Tenants listed');
    } catch (error) {
      next(error);
    }
  }

  async updateTenantStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status, plan } = req.body;

      const updated = await tenantService.updateTenantStatus(id, status, plan, req.user?._id?.toString());
      sendSuccess(res, updated, 'Tenant status updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const tenantController = new TenantController();
