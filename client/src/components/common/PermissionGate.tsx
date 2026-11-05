import React from 'react';
import { usePermissions } from '../../hooks/usePermissions';

export interface PermissionGateProps {
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  role?: string;
  roles?: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  permission,
  permissions = [],
  requireAll = false,
  role,
  roles = [],
  fallback = null,
  children,
}) => {
  const { can, canAny, canAll, hasRole, hasAnyRole, isSuperAdmin } = usePermissions();

  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // Check role requirement if specified
  if (role && !hasRole(role)) {
    return <>{fallback}</>;
  }

  if (roles.length > 0 && !hasAnyRole(roles)) {
    return <>{fallback}</>;
  }

  // Check single permission
  if (permission && !can(permission)) {
    return <>{fallback}</>;
  }

  // Check multiple permissions
  if (permissions.length > 0) {
    const hasPerms = requireAll ? canAll(permissions) : canAny(permissions);
    if (!hasPerms) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
};
