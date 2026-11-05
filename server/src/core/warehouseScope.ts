import { Types } from 'mongoose';
import { Warehouse } from '../models/warehouse.model';

export interface ResolvedWarehouseScope {
  isRestricted: boolean;
  objectIds: Types.ObjectId[];
  codes: string[];
  allStrings: string[];
  isAuthorized: (whIdOrCode: string | Types.ObjectId | undefined | null) => boolean;
}

/**
 * Derives the active warehouse restriction scope for a user.
 * Administrators, super-admins, and users with wildcard or facility management permissions
 * are unrestricted (returns empty array), granting visibility and filtering across all facilities.
 */
export const getUserWarehouseScope = (user?: any): string[] => {
  if (!user) return [];
  const roles: string[] = Array.isArray(user.roles) ? user.roles : [];
  const permissions: string[] = Array.isArray(user.permissions) ? user.permissions : [];

  const isAdminOrUnrestricted =
    Boolean(user.isSuperAdmin) ||
    roles.some((r) =>
      ['tenant-admin', 'super-admin', 'admin', 'Tenant Administrator', 'Super Administrator'].includes(r)
    ) ||
    permissions.includes('*') ||
    permissions.includes('warehouses:manage') ||
    permissions.includes('inventory:manage');

  if (isAdminOrUnrestricted) {
    return [];
  }

  return user.accessScope?.warehouses || [];
};

/**
 * Normalizes and resolves warehouse scope identifiers (ObjectIds and codes)
 * ensuring safe MongoDB queries without BSON casting crashes.
 */
export const resolveWarehouseScope = async (
  tenantId: string | Types.ObjectId,
  warehouseScope: string[] = []
): Promise<ResolvedWarehouseScope> => {
  if (!warehouseScope || warehouseScope.length === 0) {
    return {
      isRestricted: false,
      objectIds: [],
      codes: [],
      allStrings: [],
      isAuthorized: () => true,
    };
  }

  const rawStrings = warehouseScope.map((s) => String(s).trim()).filter(Boolean);
  const validIds: Types.ObjectId[] = [];
  const codes: string[] = [];

  for (const s of rawStrings) {
    if (Types.ObjectId.isValid(s) && /^[0-9a-fA-F]{24}$/.test(s)) {
      validIds.push(new Types.ObjectId(s));
    } else {
      codes.push(s);
    }
  }

  const tId = new Types.ObjectId(tenantId);

  // Lookup in database to get corresponding ObjectIds for codes
  if (codes.length > 0) {
    const foundByCode = await Warehouse.find({
      tenantId: tId,
      code: { $in: codes },
    })
      .select('_id code')
      .lean()
      .exec();

    for (const wh of foundByCode) {
      if (!validIds.some((id) => id.equals(wh._id as Types.ObjectId))) {
        validIds.push(wh._id as Types.ObjectId);
      }
    }
  }

  // Also lookup warehouses for validIds to populate all authorized codes
  if (validIds.length > 0) {
    const foundById = await Warehouse.find({
      tenantId: tId,
      _id: { $in: validIds },
    })
      .select('code')
      .lean()
      .exec();

    for (const wh of foundById) {
      if (wh.code && !codes.includes(wh.code)) {
        codes.push(wh.code);
      }
    }
  }

  const allStringsSet = new Set<string>([
    ...rawStrings,
    ...validIds.map((id) => id.toString()),
    ...codes,
  ]);

  return {
    isRestricted: true,
    objectIds: validIds,
    codes,
    allStrings: Array.from(allStringsSet),
    isAuthorized: (whIdOrCode: string | Types.ObjectId | undefined | null) => {
      if (!whIdOrCode) return false;
      const str = String(whIdOrCode).trim();
      return allStringsSet.has(str);
    },
  };
};
