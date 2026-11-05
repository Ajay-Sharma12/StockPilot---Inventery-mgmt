import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantContext } from '../middleware/tenantContext.middleware';
import { requirePermissions } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { PERMISSIONS } from '../config/permissions.config';
import { createUserSchema, updateUserSchema, toggleUserStatusSchema } from '../validators/user.validator';

const router = Router();

router.use(authenticate, tenantContext);

router.get(
  '/',
  requirePermissions([PERMISSIONS.USERS_READ]),
  (req, res, next) => userController.listUsers(req, res, next)
);

router.get(
  '/:id',
  requirePermissions([PERMISSIONS.USERS_READ]),
  (req, res, next) => userController.getUser(req, res, next)
);

router.post(
  '/',
  requirePermissions([PERMISSIONS.USERS_CREATE]),
  validateRequest(createUserSchema),
  (req, res, next) => userController.createUser(req, res, next)
);

router.post(
  '/invite',
  requirePermissions([PERMISSIONS.USERS_CREATE]),
  (req, res, next) => userController.inviteUser(req, res, next)
);

router.patch(
  '/:id',
  requirePermissions([PERMISSIONS.USERS_UPDATE]),
  validateRequest(updateUserSchema),
  (req, res, next) => userController.updateUser(req, res, next)
);

router.patch(
  '/:id/status',
  requirePermissions([PERMISSIONS.USERS_DELETE]),
  validateRequest(toggleUserStatusSchema),
  (req, res, next) => userController.toggleStatus(req, res, next)
);

export const userRoutes = router;
