import { Router } from 'express';
import { roleController } from '../controllers/role.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantContext } from '../middleware/tenantContext.middleware';
import { requirePermissions } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { PERMISSIONS } from '../config/permissions.config';
import { createRoleSchema, updateRoleSchema } from '../validators/role.validator';

const router = Router();

router.use(authenticate, tenantContext);

router.get(
  '/',
  requirePermissions([PERMISSIONS.ROLES_READ]),
  (req, res, next) => roleController.listRoles(req, res, next)
);

router.get(
  '/permissions-catalog',
  requirePermissions([PERMISSIONS.ROLES_READ]),
  (req, res, next) => roleController.getPermissionsCatalog(req, res, next)
);

router.post(
  '/',
  requirePermissions([PERMISSIONS.ROLES_CREATE]),
  validateRequest(createRoleSchema),
  (req, res, next) => roleController.createRole(req, res, next)
);

router.patch(
  '/:id',
  requirePermissions([PERMISSIONS.ROLES_UPDATE]),
  validateRequest(updateRoleSchema),
  (req, res, next) => roleController.updateRole(req, res, next)
);

router.delete(
  '/:id',
  requirePermissions([PERMISSIONS.ROLES_DELETE]),
  (req, res, next) => roleController.deleteRole(req, res, next)
);

export const roleRoutes = router;
