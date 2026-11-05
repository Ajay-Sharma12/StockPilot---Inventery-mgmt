import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { tenantContext } from '../../../middleware/tenantContext.middleware';
import { requireFeature } from '../../../middleware/entitlement.middleware';
import { requirePermissions } from '../../../middleware/rbac.middleware';
import { PERMISSIONS } from '../../../config/permissions.config';
import { reportController } from '../controllers/report.controller';

const router = Router();

router.use(authenticate, tenantContext, requireFeature('reports'));

router.get(
  '/types',
  requirePermissions([PERMISSIONS.REPORTS_READ], false),
  reportController.getReportTypes
);

router.get(
  ['/', '/query'],
  requirePermissions([PERMISSIONS.REPORTS_READ], false),
  reportController.runReport
);

router.post(
  '/query',
  requirePermissions([PERMISSIONS.REPORTS_READ], false),
  reportController.runReport
);

router.get(
  '/export',
  requirePermissions([PERMISSIONS.REPORTS_EXPORT, PERMISSIONS.REPORTS_READ], false),
  reportController.exportReport
);

router.post(
  '/export',
  requirePermissions([PERMISSIONS.REPORTS_EXPORT, PERMISSIONS.REPORTS_READ], false),
  reportController.exportReport
);

router.get(
  '/snapshots',
  requirePermissions([PERMISSIONS.REPORTS_READ], false),
  reportController.getSnapshots
);

router.get(
  '/snapshots/:id',
  requirePermissions([PERMISSIONS.REPORTS_READ], false),
  reportController.getSnapshotById
);

export { router as reportRoutes };
