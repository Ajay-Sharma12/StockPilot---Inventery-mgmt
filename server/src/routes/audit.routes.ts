import { Router } from 'express';
import { auditController } from '../controllers/audit.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantContext } from '../middleware/tenantContext.middleware';
import { requirePermissions } from '../middleware/rbac.middleware';
import { PERMISSIONS } from '../config/permissions.config';

const router = Router();

router.use(authenticate, tenantContext);

router.get(
  '/',
  requirePermissions([PERMISSIONS.AUDIT_READ]),
  (req, res, next) => auditController.listLogs(req, res, next)
);

export const auditRoutes = router;
