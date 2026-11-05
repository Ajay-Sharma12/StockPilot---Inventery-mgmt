import { Types } from 'mongoose';
import { BaseRepository } from './base.repository';
import { IRole, Role } from '../models/role.model';

export class RoleRepository extends BaseRepository<IRole> {
  constructor() {
    super(Role);
  }

  async findAvailableRoles(tenantId?: string | Types.ObjectId | null): Promise<IRole[]> {
    const filters: any[] = [{ isSystemRole: true, tenantId: null }];
    if (tenantId) {
      filters.push({ tenantId });
    }
    return this.model.find({ $or: filters }).sort({ isSystemRole: -1, name: 1 }).exec();
  }

  async findBySlug(slug: string, tenantId?: string | Types.ObjectId | null): Promise<IRole | null> {
    const filter: any = { slug: slug.toLowerCase() };
    if (tenantId) {
      filter.$or = [{ tenantId }, { tenantId: null, isSystemRole: true }];
    } else {
      filter.tenantId = null;
    }
    return this.model.findOne(filter).exec();
  }
}

export const roleRepository = new RoleRepository();
