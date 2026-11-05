import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { User, IUser, IUserAccessScope } from '../models/user.model';
import { Role } from '../models/role.model';
import { UserStatus, AuditAction, AuditEntity, SYSTEM_ROLE_SLUGS } from '../config/constants';
import { BadRequestError, NotFoundError, ConflictError, ForbiddenError } from '../core/errors';
import { userRepository } from '../repositories/user.repository';
import { auditRepository } from '../repositories/audit.repository';
import { entitlementService } from './entitlement.service';

export interface CreateUserInput {
  name: string;
  email: string;
  password?: string;
  phone?: string;
  roleIds: string[];
  directPermissions?: string[];
  accessScope?: Partial<IUserAccessScope>;
}

export interface UpdateUserInput {
  name?: string;
  password?: string;
  phone?: string;
  roleIds?: string[];
  directPermissions?: string[];
  accessScope?: Partial<IUserAccessScope>;
  status?: UserStatus;
}

export class UserService {
  async listUsers(
    tenantId: string | Types.ObjectId,
    page = 1,
    limit = 20,
    search?: string,
    roleId?: string,
    status?: string
  ): Promise<{ items: any[]; total: number; page: number; limit: number }> {
    const filter: any = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    if (roleId) {
      filter.roles = new Types.ObjectId(roleId);
    }
    if (status) {
      filter.status = status;
    }

    const result = await userRepository.findUsersWithRoles(tenantId, filter, page, limit);

    const formattedItems = result.items.map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      status: u.status,
      roles: (u.roles as any[]).map((r) => ({ id: r._id, name: r.name, slug: r.slug })),
      directPermissions: u.directPermissions,
      accessScope: u.accessScope,
      isSuperAdmin: Boolean(u.isSuperAdmin),
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    }));

    return {
      items: formattedItems,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  async getUserById(
    userId: string | Types.ObjectId,
    tenantId?: string | Types.ObjectId | null
  ): Promise<any> {
    const user = await userRepository.findByIdPopulated(userId, tenantId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      roles: (user.roles as any[]).map((r) => ({ id: r._id, name: r.name, slug: r.slug })),
      directPermissions: user.directPermissions,
      accessScope: user.accessScope,
      isSuperAdmin: Boolean(user.isSuperAdmin),
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  async createUser(
    tenantId: string | Types.ObjectId,
    creatorId: string | Types.ObjectId,
    creatorName: string,
    creatorEmail: string,
    input: CreateUserInput
  ): Promise<any> {
    // 1. Check user quota for tenant
    const canAddUser = await entitlementService.canAddUser(tenantId);
    if (!canAddUser) {
      throw new ForbiddenError('Tenant user quota reached. Please upgrade your subscription plan to add more team members.');
    }

    // 2. Check for email collision within this tenant
    const existing = await User.findOne({
      tenantId,
      email: input.email.toLowerCase().trim(),
    }).exec();

    if (existing) {
      throw new ConflictError(`User with email '${input.email}' already exists in this organization`);
    }

    // 3. Verify roles exist and belong to system or this tenant
    const roleObjectIds = input.roleIds.map((id) => new Types.ObjectId(id));
    const validRoles = await Role.find({
      _id: { $in: roleObjectIds },
      $or: [{ tenantId }, { tenantId: null, isSystemRole: true }],
    }).exec();

    if (validRoles.length !== roleObjectIds.length) {
      throw new BadRequestError('One or more selected roles are invalid or inaccessible');
    }

    // 4. Default password if not provided
    const rawPassword = input.password || 'TemporaryPass123!';
    const passwordHash = await bcrypt.hash(rawPassword, 12);

    const newUser = await userRepository.create({
      tenantId: new Types.ObjectId(tenantId),
      name: input.name.trim(),
      email: input.email.toLowerCase().trim(),
      passwordHash,
      phone: input.phone,
      status: UserStatus.ACTIVE,
      roles: roleObjectIds,
      directPermissions: input.directPermissions || [],
      accessScope: {
        warehouses: input.accessScope?.warehouses || [],
        department: input.accessScope?.department || '',
        businessUnit: input.accessScope?.businessUnit || '',
        store: input.accessScope?.store || '',
        maxApprovalLimit: input.accessScope?.maxApprovalLimit || 0,
        restrictToOwnedDocuments: input.accessScope?.restrictToOwnedDocuments || false,
      },
      isSuperAdmin: false,
    });

    // 5. Audit Log
    await auditRepository.create({
      tenantId: new Types.ObjectId(tenantId),
      userId: new Types.ObjectId(creatorId),
      userName: creatorName,
      userEmail: creatorEmail,
      action: AuditAction.CREATE,
      entity: AuditEntity.USER,
      entityId: newUser._id.toString(),
      details: `Created new user ${newUser.name} (${newUser.email}) with roles: ${validRoles.map((r) => r.name).join(', ')}`,
      newState: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        roles: validRoles.map((r) => r.name),
        accessScope: newUser.accessScope,
      },
    });

    return this.getUserById(newUser._id, tenantId);
  }

  async inviteUser(
    tenantId: string | Types.ObjectId,
    creatorId: string | Types.ObjectId,
    creatorName: string,
    creatorEmail: string,
    input: {
      name: string;
      email: string;
      roleIds: string[];
      accessScope?: Partial<IUserAccessScope>;
    }
  ): Promise<any> {
    const canAddUser = await entitlementService.canAddUser(tenantId);
    if (!canAddUser) {
      throw new ForbiddenError('Tenant user quota reached. Please upgrade your subscription plan to add more team members.');
    }

    const cleanEmail = input.email.toLowerCase().trim();
    const existing = await User.findOne({ tenantId, email: cleanEmail }).exec();
    if (existing) {
      throw new ConflictError(`User with email '${cleanEmail}' already exists in this organization`);
    }

    const roleObjectIds = input.roleIds.map((id) => new Types.ObjectId(id));
    const validRoles = await Role.find({
      _id: { $in: roleObjectIds },
      $or: [{ tenantId }, { tenantId: null, isSystemRole: true }],
    }).exec();

    if (validRoles.length !== roleObjectIds.length) {
      throw new BadRequestError('One or more selected roles are invalid or inaccessible');
    }

    // Temporary random password
    const crypto = await import('crypto');
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const tempPassword = `Invite-${crypto.randomBytes(8).toString('hex')}!`;
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const newUser = await userRepository.create({
      tenantId: new Types.ObjectId(tenantId),
      name: input.name.trim(),
      email: cleanEmail,
      passwordHash,
      status: UserStatus.INVITED,
      roles: roleObjectIds,
      directPermissions: [],
      accessScope: {
        warehouses: input.accessScope?.warehouses || [],
        department: input.accessScope?.department || '',
        businessUnit: input.accessScope?.businessUnit || '',
        store: input.accessScope?.store || '',
        maxApprovalLimit: input.accessScope?.maxApprovalLimit || 0,
        restrictToOwnedDocuments: input.accessScope?.restrictToOwnedDocuments || false,
      },
      isSuperAdmin: false,
    });

    // Audit Log
    await auditRepository.create({
      tenantId: new Types.ObjectId(tenantId),
      userId: new Types.ObjectId(creatorId),
      userName: creatorName,
      userEmail: creatorEmail,
      action: AuditAction.INVITE,
      entity: AuditEntity.USER,
      entityId: newUser._id.toString(),
      details: `Invited new user ${newUser.name} (${newUser.email}) with roles: ${validRoles.map((r) => r.name).join(', ')}`,
    });

    // Send invitation email
    const { Tenant } = await import('../models/tenant.model');
    const tenant = await Tenant.findById(tenantId).exec();
    const tenantName = tenant?.name || 'StockPilot Workspace';
    const primaryRole = validRoles[0]?.name || 'Member';

    const { env } = await import('../config/env.config');
    const inviteUrl = `${env.CLIENT_URL}/accept-invitation?token=${inviteToken}&email=${encodeURIComponent(cleanEmail)}`;

    const { emailService } = await import('./email.service');
    const emailSent = await emailService.sendUserInvitation(cleanEmail, inviteUrl, tenantName, primaryRole);

    const userObj = await this.getUserById(newUser._id, tenantId);
    return {
      ...userObj,
      inviteUrl,
      emailSent,
    };
  }

  async updateUser(
    userId: string | Types.ObjectId,
    tenantId: string | Types.ObjectId,
    updaterId: string | Types.ObjectId,
    updaterName: string,
    updaterEmail: string,
    input: UpdateUserInput
  ): Promise<any> {
    const user = await userRepository.findById(userId, tenantId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const previousState = {
      name: user.name,
      status: user.status,
      roles: user.roles,
      accessScope: user.accessScope,
    };

    if (input.name) user.name = input.name.trim();
    if (input.phone !== undefined) user.phone = input.phone;
    if (input.password && input.password.trim()) {
      user.passwordHash = await bcrypt.hash(input.password.trim(), 12);
    }
    if (input.status) {
      if (input.status === UserStatus.SUSPENDED) {
        const populated = await userRepository.findByIdPopulated(userId, tenantId);
        if (populated) {
          const isSuperAdmin =
            populated.isSuperAdmin ||
            (populated.roles as any[]).some(
              (r) => r.slug === SYSTEM_ROLE_SLUGS.SUPER_ADMIN || r.name?.toLowerCase().includes('super admin')
            );
          const isTenantAdmin = (populated.roles as any[]).some(
            (r) => r.slug === SYSTEM_ROLE_SLUGS.TENANT_ADMIN || r.name?.toLowerCase().includes('tenant admin')
          );

          if (isSuperAdmin || isTenantAdmin) {
            throw new ForbiddenError(
              isSuperAdmin
                ? 'Platform Super Administrator accounts cannot be suspended.'
                : 'Tenant Administrator accounts cannot be suspended.'
            );
          }
        }
      }
      user.status = input.status;
    }

    if (input.roleIds) {
      const roleObjectIds = input.roleIds.map((id) => new Types.ObjectId(id));
      const validRoles = await Role.find({
        _id: { $in: roleObjectIds },
        $or: [{ tenantId }, { tenantId: null, isSystemRole: true }],
      }).exec();

      if (validRoles.length !== roleObjectIds.length) {
        throw new BadRequestError('One or more selected roles are invalid or inaccessible');
      }
      user.roles = roleObjectIds;
    }

    if (input.directPermissions) {
      user.directPermissions = input.directPermissions;
    }

    if (input.accessScope) {
      user.accessScope = {
        warehouses: input.accessScope.warehouses ?? user.accessScope.warehouses,
        department: input.accessScope.department ?? user.accessScope.department,
        businessUnit: input.accessScope.businessUnit ?? user.accessScope.businessUnit,
        store: input.accessScope.store ?? user.accessScope.store,
        maxApprovalLimit: input.accessScope.maxApprovalLimit ?? user.accessScope.maxApprovalLimit,
        restrictToOwnedDocuments: input.accessScope.restrictToOwnedDocuments ?? user.accessScope.restrictToOwnedDocuments,
      };
    }

    await user.save();

    await auditRepository.create({
      tenantId: new Types.ObjectId(tenantId),
      userId: new Types.ObjectId(updaterId),
      userName: updaterName,
      userEmail: updaterEmail,
      action: AuditAction.UPDATE,
      entity: AuditEntity.USER,
      entityId: user._id.toString(),
      details: `Updated user profile and permissions for ${user.email}`,
      previousState,
      newState: {
        name: user.name,
        status: user.status,
        roles: user.roles,
        accessScope: user.accessScope,
      },
    });

    return this.getUserById(user._id, tenantId);
  }

  async toggleStatus(
    userId: string | Types.ObjectId,
    tenantId: string | Types.ObjectId,
    status: UserStatus,
    adminId: string | Types.ObjectId,
    adminName: string
  ): Promise<any> {
    const user = await userRepository.findByIdPopulated(userId, tenantId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (status === UserStatus.SUSPENDED) {
      const isSuperAdmin =
        user.isSuperAdmin ||
        (user.roles as any[]).some(
          (r) => r.slug === SYSTEM_ROLE_SLUGS.SUPER_ADMIN || r.name?.toLowerCase().includes('super admin')
        );
      const isTenantAdmin = (user.roles as any[]).some(
        (r) => r.slug === SYSTEM_ROLE_SLUGS.TENANT_ADMIN || r.name?.toLowerCase().includes('tenant admin')
      );

      if (isSuperAdmin || isTenantAdmin) {
        throw new ForbiddenError(
          isSuperAdmin
            ? 'Platform Super Administrator accounts cannot be suspended.'
            : 'Tenant Administrator accounts cannot be suspended.'
        );
      }
    }

    const prevStatus = user.status;
    user.status = status;
    await user.save();

    await auditRepository.create({
      tenantId: new Types.ObjectId(tenantId),
      userId: new Types.ObjectId(adminId),
      userName: adminName,
      action: AuditAction.STATUS_CHANGE,
      entity: AuditEntity.USER,
      entityId: user._id.toString(),
      details: `Changed status for ${user.email} from ${prevStatus} to ${status}`,
    });

    return { id: user._id, status: user.status };
  }
}

export const userService = new UserService();
