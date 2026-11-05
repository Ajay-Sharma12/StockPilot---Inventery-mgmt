import { Types } from 'mongoose';
import { IAuditLog, AuditLog } from '../models/auditLog.model';
import { AuditAction, AuditEntity } from '../config/constants';
import { auditRepository } from '../repositories/audit.repository';

export class AuditService {
  async log(entry: {
    tenantId?: string | Types.ObjectId | null;
    userId?: string | Types.ObjectId | null;
    userName?: string;
    userEmail?: string;
    action: AuditAction;
    entity: AuditEntity;
    entityId?: string;
    details?: string;
    previousState?: any;
    newState?: any;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<IAuditLog> {
    return auditRepository.create({
      ...entry,
      tenantId: entry.tenantId ? new Types.ObjectId(entry.tenantId) : null,
      userId: entry.userId ? new Types.ObjectId(entry.userId) : null,
    });
  }

  async listLogs(
    tenantId?: string | Types.ObjectId | null,
    filters: {
      action?: string;
      entity?: string;
      userId?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    } = {},
    page = 1,
    limit = 25
  ): Promise<{ items: IAuditLog[]; total: number; page: number; limit: number }> {
    const queryFilter: any = {};

    if (filters.action) queryFilter.action = filters.action;
    if (filters.entity) queryFilter.entity = filters.entity;
    if (filters.userId) queryFilter.userId = new Types.ObjectId(filters.userId);

    if (filters.startDate || filters.endDate) {
      queryFilter.createdAt = {};
      if (filters.startDate) queryFilter.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) queryFilter.createdAt.$lte = new Date(filters.endDate);
    }

    if (filters.search) {
      queryFilter.$or = [
        { details: { $regex: filters.search, $options: 'i' } },
        { userName: { $regex: filters.search, $options: 'i' } },
        { userEmail: { $regex: filters.search, $options: 'i' } },
      ];
    }

    return auditRepository.findFiltered(tenantId, queryFilter, page, limit);
  }
}

export const auditService = new AuditService();
