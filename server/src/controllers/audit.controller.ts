import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../core/types';
import { auditService } from '../services/audit.service';
import { sendPaginated } from '../core/responseHandler';

export class AuditController {
  async listLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user?.isSuperAdmin ? null : req.tenant?._id;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 25;

      const filters = {
        action: req.query.action as string,
        entity: req.query.entity as string,
        userId: req.query.userId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        search: req.query.search as string,
      };

      const result = await auditService.listLogs(tenantId, filters, page, limit);
      sendPaginated(res, result.items, result.total, result.page, result.limit, 'Audit logs retrieved');
    } catch (error) {
      next(error);
    }
  }
}

export const auditController = new AuditController();
