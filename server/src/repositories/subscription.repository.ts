import { Types } from 'mongoose';
import { BaseRepository } from './base.repository';
import { ITenantSubscription, TenantSubscription } from '../models/subscription.model';

export class SubscriptionRepository extends BaseRepository<ITenantSubscription> {
  constructor() {
    super(TenantSubscription);
  }

  async findByTenantId(tenantId: string | Types.ObjectId): Promise<ITenantSubscription | null> {
    return this.model.findOne({ tenantId }).exec();
  }
}

export const subscriptionRepository = new SubscriptionRepository();
