import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserAccessScope } from '../types';
import { hasPermission, hasAnyPermission, hasAllPermissions, hasRole, hasAnyRole } from '../utils/permissions';

export const usePermissions = () => {
  const { user, tenant } = useAuth();

  const can = useCallback((permission: string): boolean => {
    return hasPermission(user, permission);
  }, [user]);

  const canAny = useCallback((permissions: string[]): boolean => {
    return hasAnyPermission(user, permissions);
  }, [user]);

  const canAll = useCallback((permissions: string[]): boolean => {
    return hasAllPermissions(user, permissions);
  }, [user]);

  const checkRole = useCallback((roleSlug: string): boolean => {
    return hasRole(user, roleSlug);
  }, [user]);

  const checkAnyRole = useCallback((roleSlugs: string[]): boolean => {
    return hasAnyRole(user, roleSlugs);
  }, [user]);

  const hasFeature = useCallback((featureKey: string): boolean => {
    if (user?.isSuperAdmin || hasRole(user, 'tenant-admin') || user?.permissions?.includes('*')) return true;
    return Boolean(tenant?.features?.[featureKey]);
  }, [user, tenant]);

  // ABAC: Check financial approval limit
  const canApproveAmount = useCallback((amount: number): boolean => {
    if (!user) return false;
    if (user.isSuperAdmin || hasRole(user, 'tenant-admin') || user.permissions?.includes('*')) {
      return true;
    }
    const maxLimit = user.accessScope?.maxApprovalLimit ?? 0;
    return maxLimit >= amount;
  }, [user]);

  // ABAC: Check warehouse location assignment
  const canAccessWarehouse = useCallback((warehouseCode: string): boolean => {
    if (!user) return false;
    if (user.isSuperAdmin || hasRole(user, 'tenant-admin') || user.permissions?.includes('*')) {
      return true;
    }
    const assigned = user.accessScope?.warehouses;
    if (!assigned || assigned.length === 0) return true; // Unrestricted
    return assigned.includes(warehouseCode);
  }, [user]);


  const accessScope: UserAccessScope = user?.accessScope || { warehouses: [] };

  return {
    can,
    canAny,
    canAll,
    hasRole: checkRole,
    hasAnyRole: checkAnyRole,
    hasFeature,
    canApproveAmount,
    canAccessWarehouse,
    isSuperAdmin: Boolean(user?.isSuperAdmin),
    accessScope,
    roles: user?.roles || [],
    permissions: user?.permissions || [],
  };
};
