import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../core/types';
import { ForbiddenError } from '../core/errors';
import { resolveWarehouseScope } from '../core/warehouseScope';

export const validateWarehouseScope = (
  warehouseKey = 'warehouseId',
  locationSource: 'params' | 'body' | 'query' = 'params'
) => {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(new ForbiddenError('User context missing'));
      }

      // Super Admin or Tenant Admin has organization-wide scope
      if (req.user.isSuperAdmin || req.user.roles.includes('tenant-admin') || req.user.permissions.includes('*')) {
        return next();
      }

      const assignedWarehouses = req.user.accessScope?.warehouses || [];

      // Check if user has a warehouse-specific role
      const isWarehouseStaff = req.user.roles.some((r) =>
        ['warehouse-clerk', 'store-keeper', 'warehouse-operator'].includes(r)
      );

      // If warehouse staff has no assigned warehouses, prevent unauthorized cross-tenant operations
      if (isWarehouseStaff && assignedWarehouses.length === 0) {
        return next(
          new ForbiddenError(
            'Access denied: No warehouses assigned to your account. Please contact your organization administrator.'
          )
        );
      }

      // If no specific warehouses assigned for other roles, allow
      if (assignedWarehouses.length === 0) {
        return next();
      }

      const requestedWarehouse = req[locationSource]?.[warehouseKey];

      if (!requestedWarehouse) {
        return next();
      }

      const tenantId = req.tenant?._id || req.user.tenantId;
      if (!tenantId) {
        return next(new ForbiddenError('Tenant context required'));
      }

      const resolved = await resolveWarehouseScope(tenantId, assignedWarehouses);

      if (!resolved.isAuthorized(requestedWarehouse)) {
        return next(
          new ForbiddenError(
            `Access denied: You do not have authorization to view or operate on warehouse '${requestedWarehouse}'. Your assigned locations: [${assignedWarehouses.join(', ')}]`,
            { assignedWarehouses, requestedWarehouse }
          )
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

export const validateApprovalLimit = (amountField = 'totalAmount', source: 'body' | 'query' = 'body') => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new ForbiddenError('User context missing'));
    }

    if (req.user.isSuperAdmin || req.user.roles.includes('tenant-admin') || req.user.permissions.includes('*')) {
      return next();
    }

    const maxLimit = req.user.accessScope?.maxApprovalLimit ?? 0;
    const requestedAmount = Number(req[source]?.[amountField]);

    if (isNaN(requestedAmount)) {
      return next();
    }

    if (requestedAmount > maxLimit) {
      return next(
        new ForbiddenError(
          `Approval limit exceeded: Operation requires approving $${requestedAmount.toLocaleString()}, but your authorized threshold is $${maxLimit.toLocaleString()}`,
          { maxLimit, requestedAmount }
        )
      );
    }

    next();
  };
};
