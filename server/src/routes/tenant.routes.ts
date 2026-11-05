import { Router } from 'express';
import { tenantController } from '../controllers/tenant.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantContext } from '../middleware/tenantContext.middleware';
import { requirePermissions, requireSuperAdmin } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { PERMISSIONS } from '../config/permissions.config';
import {
  updateTenantSettingsSchema,
  updateTenantProfileSchema,
  updateTenantStatusSchema,
} from '../validators/tenant.validator';

const router = Router();

// Current tenant routes
router.get('/current', authenticate, tenantContext, (req, res, next) =>
  tenantController.getCurrentTenant(req, res, next)
);

router.patch(
  '/settings',
  authenticate,
  tenantContext,
  requirePermissions([PERMISSIONS.TENANT_UPDATE]),
  validateRequest(updateTenantSettingsSchema),
  (req, res, next) => tenantController.updateSettings(req, res, next)
);

router.patch(
  '/profile',
  authenticate,
  tenantContext,
  requirePermissions([PERMISSIONS.TENANT_UPDATE]),
  validateRequest(updateTenantProfileSchema),
  (req, res, next) => tenantController.updateProfile(req, res, next)
);

// Super admin platform-wide routes
router.get(
  '/all',
  authenticate,
  requireSuperAdmin(),
  (req, res, next) => tenantController.listAllTenants(req, res, next)
);

router.patch(
  '/:id/status',
  authenticate,
  requireSuperAdmin(),
  validateRequest(updateTenantStatusSchema),
  (req, res, next) => tenantController.updateTenantStatus(req, res, next)
);

export const tenantRoutes = router;
