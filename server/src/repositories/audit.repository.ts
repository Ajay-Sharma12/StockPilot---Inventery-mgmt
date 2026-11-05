import { Types } from 'mongoose';
import { BaseRepository } from './base.repository';
import { IAuditLog, AuditLog } from '../models/auditLog.model';

export class AuditRepository extends BaseRepository<IAuditLog> {
  constructor() {
    super(AuditLog);
  }

  async findFiltered(
    tenantId?: string | Types.ObjectId | null,
    filter: any = {},
    page = 1,
    limit = 20
  ): Promise<{ items: IAuditLog[]; total: number; page: number; limit: number }> {
    const queryFilter: any = { ...filter };
    if (tenantId) {
      queryFilter.tenantId = tenantId;
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.model.find(queryFilter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(queryFilter).exec(),
    ]);

    return { items, total, page, limit };
  }
}

export const auditRepository = new AuditRepository();
