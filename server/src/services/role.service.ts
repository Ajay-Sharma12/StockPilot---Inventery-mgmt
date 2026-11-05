import { Types } from 'mongoose';
import { Role, IRole } from '../models/role.model';
import { SYSTEM_PERMISSIONS_CATALOG } from '../config/permissions.config';
import { BadRequestError, NotFoundError, ForbiddenError } from '../core/errors';
import { roleRepository } from '../repositories/role.repository';
import { auditRepository } from '../repositories/audit.repository';
import { entitlementService } from './entitlement.service';
import { AuditAction, AuditEntity } from '../config/constants';

export class RoleService {
  async listRoles(tenantId?: string | Types.ObjectId | null): Promise<IRole[]> {
    return roleRepository.findAvailableRoles(tenantId);
  }

  getPermissionsCatalog() {
    return SYSTEM_PERMISSIONS_CATALOG;
  }

  async getRoleById(roleId: string | Types.ObjectId, tenantId?: string | Types.ObjectId | null): Promise<IRole> {
    const role = await roleRepository.findById(roleId);
    if (!role) {
      throw new NotFoundError('Role not found');
    }
    return role;
  }

  async createCustomRole(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    userName: string,
    userEmail: string,
    input: { name: string; description?: string; permissions: string[] }
  ): Promise<IRole> {
    // 1. Check feature entitlement
    const hasCustomRoles = await entitlementService.hasFeature(tenantId, 'customRoles');
    if (!hasCustomRoles) {
      throw new ForbiddenError('Custom role creation is not permitted on your plan. Please upgrade to Starter, Growth, or Enterprise.');
    }

    const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const existing = await Role.findOne({ tenantId, slug }).exec();
    if (existing) {
      throw new BadRequestError(`A role with name '${input.name}' already exists in your organization`);
    }

    const newRole = await Role.create({
      tenantId: new Types.ObjectId(tenantId),
      name: input.name.trim(),
      slug,
      description: input.description,
      permissions: input.permissions,
      isSystemRole: false,
    });

    await auditRepository.create({
      tenantId: new Types.ObjectId(tenantId),
      userId: new Types.ObjectId(userId),
      userName,
      userEmail,
      action: AuditAction.CREATE,
      entity: AuditEntity.ROLE,
      entityId: newRole._id.toString(),
      details: `Created custom role '${newRole.name}' with ${newRole.permissions.length} permissions`,
      newState: { name: newRole.name, slug: newRole.slug, permissions: newRole.permissions },
    });

    return newRole;
  }

  async updateRole(
    roleId: string | Types.ObjectId,
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    userName: string,
    userEmail: string,
    input: { name?: string; description?: string; permissions?: string[] }
  ): Promise<IRole> {
    const role = await Role.findOne({ _id: roleId, tenantId }).exec();
    if (!role) {
      throw new NotFoundError('Custom role not found or cannot be modified');
    }

    if (role.isSystemRole) {
      throw new ForbiddenError('System-defined default roles cannot be modified');
    }

    const previousState = { name: role.name, permissions: role.permissions };

    if (input.name) role.name = input.name.trim();
    if (input.description !== undefined) role.description = input.description;
    if (input.permissions) role.permissions = input.permissions;

    await role.save();

    await auditRepository.create({
      tenantId: new Types.ObjectId(tenantId),
      userId: new Types.ObjectId(userId),
      userName,
      userEmail,
      action: AuditAction.UPDATE,
      entity: AuditEntity.ROLE,
      entityId: role._id.toString(),
      details: `Updated custom role '${role.name}'`,
      previousState,
      newState: { name: role.name, permissions: role.permissions },
    });

    return role;
  }

  async deleteRole(
    roleId: string | Types.ObjectId,
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    userName: string
  ): Promise<void> {
    const role = await Role.findOne({ _id: roleId, tenantId }).exec();
    if (!role) {
      throw new NotFoundError('Custom role not found');
    }

    if (role.isSystemRole) {
      throw new ForbiddenError('System roles cannot be deleted');
    }

    await Role.deleteOne({ _id: role._id }).exec();

    await auditRepository.create({
      tenantId: new Types.ObjectId(tenantId),
      userId: new Types.ObjectId(userId),
      userName,
      action: AuditAction.DELETE,
      entity: AuditEntity.ROLE,
      entityId: role._id.toString(),
      details: `Deleted custom role '${role.name}'`,
    });
  }
}

export const roleService = new RoleService();
