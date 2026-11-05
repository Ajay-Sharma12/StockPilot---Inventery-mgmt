import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../core/types';
import { ForbiddenError } from '../core/errors';

export const requirePermissions = (
  requiredPermissions: string[],
  matchAll = true
) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new ForbiddenError('User context missing'));
    }

    // Super admin has global wildcard permission
    if (req.user.isSuperAdmin || req.user.permissions.includes('*')) {
      return next();
    }

    const userPerms = new Set(req.user.permissions);

    const hasPermission = matchAll
      ? requiredPermissions.every((perm) => userPerms.has(perm))
      : requiredPermissions.some((perm) => userPerms.has(perm));

    if (!hasPermission) {
      return next(
        new ForbiddenError(
          `Access denied: Missing required permission(s): [${requiredPermissions.join(', ')}]`,
          { requiredPermissions, matchAll }
        )
      );
    }

    next();
  };
};

export const requireRoles = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new ForbiddenError('User context missing'));
    }

    if (req.user.isSuperAdmin) {
      return next();
    }

    const hasRole = req.user.roles.some((role) => allowedRoles.includes(role));

    if (!hasRole) {
      return next(
        new ForbiddenError(
          `Access denied: Action requires one of the following roles: [${allowedRoles.join(', ')}]`,
          { allowedRoles }
        )
      );
    }

    next();
  };
};

export const requireSuperAdmin = () => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user || !req.user.isSuperAdmin) {
      return next(new ForbiddenError('Access restricted to Platform Super Administrators only'));
    }
    next();
  };
};
