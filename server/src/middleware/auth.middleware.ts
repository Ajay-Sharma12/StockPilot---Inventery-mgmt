import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { env } from '../config/env.config';
import { UnauthorizedError, ForbiddenError } from '../core/errors';
import { AuthenticatedRequest, TokenPayload, AuthenticatedUser } from '../core/types';
import { User } from '../models/user.model';
import { Role } from '../models/role.model';
import { UserStatus } from '../config/constants';

export const authenticate = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication token missing or malformed');
    }

    const token = authHeader.split(' ')[1];
    let payload: TokenPayload;

    try {
      payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Access token expired', { expired: true });
      }
      throw new UnauthorizedError('Invalid access token');
    }

    // Verify user exists and is active
    const user = await User.findById(payload.userId).populate('roles').exec();
    if (!user) {
      throw new UnauthorizedError('User account not found');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError(`User account is ${user.status.toLowerCase()}`);
    }

    // Safely resolve roles
    const rawRoles = Array.isArray(user.roles) ? user.roles : [];
    const validRoles: any[] = rawRoles.filter(
      (r: any) => r !== null && r !== undefined && typeof r === 'object' && (r.slug || r.name)
    );
    let roles = validRoles.map((r: any) => r.slug || r.name).filter(Boolean);

    // If populated roles array was empty or contained unpopulated ObjectIds, attempt fallback query
    if (roles.length === 0 && rawRoles.length > 0) {
      const rawIds = rawRoles
        .map((r: any) => (r?._id || r))
        .filter((id: any) => id && Types.ObjectId.isValid(id));
      if (rawIds.length > 0) {
        const foundRoles = await Role.find({ _id: { $in: rawIds } }).lean();
        if (foundRoles.length > 0) {
          validRoles.push(...foundRoles);
          roles = foundRoles.map((r: any) => r.slug || r.name).filter(Boolean);
        }
      }
    }

    // Compute permissions dynamically
    const permSet = new Set<string>(user.directPermissions || []);
    for (const r of validRoles) {
      if (r && Array.isArray(r.permissions)) {
        r.permissions.forEach((p: string) => permSet.add(p));
      }
    }

    // Super admins and tenant administrators retain full system capabilities
    if (user.isSuperAdmin || roles.includes('tenant-admin') || roles.includes('super-admin')) {
      permSet.add('*');
    }

    const permissions = user.isSuperAdmin || permSet.has('*') ? ['*'] : Array.from(permSet);

    const authenticatedUser: AuthenticatedUser = {
      _id: user._id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      status: user.status,
      roles,
      permissions,
      accessScope: user.accessScope || {},
      isSuperAdmin: user.isSuperAdmin,
    };

    req.user = authenticatedUser;
    next();
  } catch (error) {
    next(error);
  }
};
