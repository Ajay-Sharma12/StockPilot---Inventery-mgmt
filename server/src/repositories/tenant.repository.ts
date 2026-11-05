import { BaseRepository } from './base.repository';
import { ITenant, Tenant } from '../models/tenant.model';

export class TenantRepository extends BaseRepository<ITenant> {
  constructor() {
    super(Tenant);
  }

  async findBySlug(slug: string): Promise<ITenant | null> {
    return this.model.findOne({ slug: slug.toLowerCase() }).exec();
  }

  async findByEmail(email: string): Promise<ITenant | null> {
    return this.model.findOne({ contactEmail: email.toLowerCase() }).exec();
  }
}

export const tenantRepository = new TenantRepository();
