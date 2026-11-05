import { Types } from 'mongoose';
import { TenantPlan, DEFAULT_PLAN_ENTITLEMENTS } from '../config/constants';
import { TenantSubscription, ITenantSubscription } from '../models/subscription.model';
import { Tenant } from '../models/tenant.model';
import { User } from '../models/user.model';
import { subscriptionRepository } from '../repositories/subscription.repository';
import { auditRepository } from '../repositories/audit.repository';
import { AuditAction, AuditEntity } from '../config/constants';
import { NotFoundError } from '../core/errors';

export class EntitlementService {
  async getTenantEntitlements(tenantId: string | Types.ObjectId): Promise<{
    plan: TenantPlan;
    features: Record<string, boolean>;
    quotas: Record<string, number>;
    usage: {
      userCount: number;
    };
  }> {
    const tenant = await Tenant.findById(tenantId).exec();
    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    const sub = await subscriptionRepository.findByTenantId(tenantId);
    const planConfig = DEFAULT_PLAN_ENTITLEMENTS[tenant.plan] || DEFAULT_PLAN_ENTITLEMENTS[TenantPlan.FREE];

    const extractMapOrObject = (val: any, fallback: any) => {
      if (!val) return fallback;
      if (typeof val.entries === 'function') {
        try {
          return Object.fromEntries(val.entries());
        } catch {
          return val;
        }
      }
      if (typeof val === 'object') return val;
      return fallback;
    };

    const features = extractMapOrObject(sub?.features, planConfig.features);
    const quotas = extractMapOrObject(sub?.quotas, planConfig.quotas);

    const userCount = await User.countDocuments({ tenantId });

    return {
      plan: tenant.plan,
      features,
      quotas,
      usage: {
        userCount,
      },
    };
  }

  async hasFeature(tenantId: string | Types.ObjectId, featureKey: string): Promise<boolean> {
    const entitlements = await this.getTenantEntitlements(tenantId);
    return Boolean(entitlements.features[featureKey]);
  }

  async canAddUser(tenantId: string | Types.ObjectId): Promise<boolean> {
    const entitlements = await this.getTenantEntitlements(tenantId);
    const maxUsers = entitlements.quotas.maxUsers ?? 3;
    return entitlements.usage.userCount < maxUsers;
  }

  async upgradePlan(
    tenantId: string | Types.ObjectId,
    newPlan: TenantPlan,
    adminId?: string | Types.ObjectId,
    adminName?: string
  ): Promise<any> {
    const tenant = await Tenant.findById(tenantId).exec();
    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    const prevPlan = tenant.plan;
    tenant.plan = newPlan;
    await tenant.save();

    const planDefaults = DEFAULT_PLAN_ENTITLEMENTS[newPlan];
    const sub = await TenantSubscription.findOneAndUpdate(
      { tenantId: tenant._id },
      {
        planId: newPlan,
        features: new Map(Object.entries(planDefaults.features)),
        quotas: new Map(Object.entries(planDefaults.quotas)),
      },
      { new: true, upsert: true }
    );

    await auditRepository.create({
      tenantId: tenant._id,
      userId: adminId ? new Types.ObjectId(adminId) : null,
      userName: adminName || 'Admin',
      action: AuditAction.UPDATE,
      entity: AuditEntity.SUBSCRIPTION,
      entityId: sub._id.toString(),
      details: `Upgraded subscription plan from ${prevPlan} to ${newPlan}`,
      previousState: { plan: prevPlan },
      newState: { plan: newPlan, features: planDefaults.features, quotas: planDefaults.quotas },
    });

    return this.getTenantEntitlements(tenant._id);
  }
}

export const entitlementService = new EntitlementService();
