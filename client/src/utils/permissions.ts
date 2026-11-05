import { UserProfile } from '../types';

export function hasPermission(user: UserProfile | null, permission: string): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;

  const perms = user.permissions || [];
  if (perms.includes('*')) return true;

  // Direct check
  if (perms.includes(permission)) return true;

  // Normalize: colon <-> dot interchangeable (e.g. production.create <-> production:create)
  const colonPerm = permission.replace('.', ':');
  const dotPerm = permission.replace(':', '.');
  if (perms.includes(colonPerm) || perms.includes(dotPerm)) return true;

  // Domain wildcard (e.g. "inventory:*" or "inventory.*" matches "inventory:read" or "inventory.create")
  const domain = permission.split(/[:.]/)[0];
  if (perms.includes(`${domain}:*`) || perms.includes(`${domain}.*`)) return true;

  return false;
}

export function hasAnyPermission(user: UserProfile | null, permissions: string[]): boolean {
  if (!user) return false;
  if (permissions.length === 0) return true;
  return permissions.some((p) => hasPermission(user, p));
}

export function hasAllPermissions(user: UserProfile | null, permissions: string[]): boolean {
  if (!user) return false;
  if (permissions.length === 0) return true;
  return permissions.every((p) => hasPermission(user, p));
}

export function hasRole(user: UserProfile | null, roleSlug: string): boolean {
  if (!user || !user.roles) return false;
  return user.roles.some((r: any) => {
    if (typeof r === 'string') return r === roleSlug;
    return r.slug === roleSlug || r.id === roleSlug || r.name === roleSlug;
  });
}

export function hasAnyRole(user: UserProfile | null, roleSlugs: string[]): boolean {
  if (!user || !user.roles) return false;
  return user.roles.some((r: any) => {
    if (typeof r === 'string') return roleSlugs.includes(r);
    return roleSlugs.includes(r.slug) || roleSlugs.includes(r.id);
  });
}

