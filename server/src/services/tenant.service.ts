import { Types } from 'mongoose';
import { ITenant, Tenant } from '../models/tenant.model';
import { TenantPlan, TenantStatus, AuditAction, AuditEntity } from '../config/constants';
import { NotFoundError, ConflictError } from '../core/errors';
import { tenantRepository } from '../repositories/tenant.repository';
import { auditRepository } from '../repositories/audit.repository';
import { User } from '../models/user.model';
import { TenantSubscription } from '../models/subscription.model';
import { DEFAULT_PLAN_ENTITLEMENTS } from '../config/constants';

export class TenantService {
  async getTenantById(tenantId: string | Types.ObjectId): Promise<ITenant> {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Organization not found');
    }
    return tenant;
  }

  async updateSettings(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    userName: string,
    userEmail: string,
    settingsUpdate: Partial<ITenant['settings']>
  ): Promise<ITenant> {
    const tenant = await this.getTenantById(tenantId);
    const previousState = { ...tenant.settings };

    const updatedSettings = {
      ...tenant.settings,
      ...settingsUpdate,
    };

    const updated = await Tenant.findByIdAndUpdate(
      tenant._id,
      { $set: { settings: updatedSettings } },
      { new: true }
    );
    if (!updated) {
      throw new NotFoundError('Organization not found');
    }

    await auditRepository.create({
      tenantId: tenant._id,
      userId: new Types.ObjectId(userId),
      userName,
      userEmail,
      action: AuditAction.UPDATE,
      entity: AuditEntity.SETTINGS,
      entityId: tenant._id.toString(),
      details: 'Updated organization settings',
      previousState,
      newState: updatedSettings,
    });

    return updated;
  }

  async updateTenantProfile(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    userName: string,
    userEmail: string,
    data: { name?: string; contactEmail?: string; phone?: string; address?: any }
  ): Promise<ITenant> {
    const tenant = await this.getTenantById(tenantId);
    const previousState = { name: tenant.name, contactEmail: tenant.contactEmail, phone: tenant.phone };

    const updateFields: any = {};
    if (data.name !== undefined) updateFields.name = data.name;
    if (data.contactEmail !== undefined) updateFields.contactEmail = data.contactEmail;
    if (data.phone !== undefined) updateFields.phone = data.phone;
    if (data.address !== undefined) updateFields.address = data.address;

    if (tenant.status === TenantStatus.ARCHIVED_DEMO) {
      updateFields.status = TenantStatus.ACTIVE;
    }

    const updated = await Tenant.findByIdAndUpdate(
      tenant._id,
      { $set: updateFields },
      { new: true }
    );
    if (!updated) {
      throw new NotFoundError('Organization not found');
    }

    await auditRepository.create({
      tenantId: tenant._id,
      userId: new Types.ObjectId(userId),
      userName,
      userEmail,
      action: AuditAction.UPDATE,
      entity: AuditEntity.TENANT,
      entityId: tenant._id.toString(),
      details: 'Updated organization profile',
      previousState,
      newState: { name: updated.name, contactEmail: updated.contactEmail, phone: updated.phone },
    });

    return updated;
  }

  async listTenantsForSuperAdmin(
    page = 1,
    limit = 20,
    search?: string
  ): Promise<{ items: any[]; total: number; page: number; limit: number }> {
    const filter: any = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
        { contactEmail: { $regex: search, $options: 'i' } },
      ];
    }

    const { items, total } = await tenantRepository.findPaginated(filter, null, page, limit);

    // Enrich with user count and subscription for platform dashboard
    const enriched = await Promise.all(
      items.map(async (t) => {
        const userCount = await User.countDocuments({ tenantId: t._id });
        const sub = await TenantSubscription.findOne({ tenantId: t._id }).exec();
        return {
          id: t._id,
          name: t.name,
          slug: t.slug,
          status: t.status,
          plan: t.plan,
          contactEmail: t.contactEmail,
          phone: t.phone,
          userCount,
          createdAt: t.createdAt,
          subscriptionStatus: sub?.status || 'ACTIVE',
        };
      })
    );

    return { items: enriched, total, page, limit };
  }

  async updateTenantStatus(
    tenantId: string | Types.ObjectId,
    status: TenantStatus,
    plan?: TenantPlan,
    adminUserId?: string
  ): Promise<ITenant> {
    const tenant = await this.getTenantById(tenantId);
    const prev = { status: tenant.status, plan: tenant.plan };

    tenant.status = status;
    if (plan) {
      tenant.plan = plan;
      // Sync subscription
      const planDefaults = DEFAULT_PLAN_ENTITLEMENTS[plan];
      await TenantSubscription.findOneAndUpdate(
        { tenantId: tenant._id },
        {
          planId: plan,
          features: new Map(Object.entries(planDefaults.features)),
          quotas: new Map(Object.entries(planDefaults.quotas)),
        },
        { upsert: true }
      );
    }
    await tenant.save();

    await auditRepository.create({
      tenantId: tenant._id,
      userId: adminUserId ? new Types.ObjectId(adminUserId) : null,
      userName: 'Super Admin',
      action: AuditAction.STATUS_CHANGE,
      entity: AuditEntity.TENANT,
      entityId: tenant._id.toString(),
      details: `Changed tenant status to ${status}${plan ? `, plan to ${plan}` : ''}`,
      previousState: prev,
      newState: { status: tenant.status, plan: tenant.plan },
    });

    return tenant;
  }
}

export const tenantService = new TenantService();
