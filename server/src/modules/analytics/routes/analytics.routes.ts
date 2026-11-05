import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { tenantContext } from '../../../middleware/tenantContext.middleware';
import { requireFeature } from '../../../middleware/entitlement.middleware';
import { requirePermissions } from '../../../middleware/rbac.middleware';
import { PERMISSIONS } from '../../../config/permissions.config';
import { analyticsController } from '../controllers/analytics.controller';

const router = Router();

router.use(authenticate, tenantContext, requireFeature(['advancedAnalytics', 'reports']));

router.get(
  ['/overview', '/executive'],
  requirePermissions([PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.REPORTS_READ], false),
  analyticsController.getExecutiveOverview
);

router.get(
  '/inventory',
  requirePermissions([PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.INVENTORY_READ], false),
  analyticsController.getInventoryAnalytics
);

router.get(
  '/production',
  requirePermissions([PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.PRODUCTION_READ], false),
  analyticsController.getProductionAnalytics
);

router.get(
  '/sales',
  requirePermissions([PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.SALES_READ], false),
  analyticsController.getSalesAnalytics
);

router.get(
  '/procurement',
  requirePermissions([PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.PURCHASE_READ], false),
  analyticsController.getProcurementAnalytics
);

router.get(
  '/qc',
  requirePermissions([PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.QC_READ], false),
  analyticsController.getQCAnalytics
);

export { router as analyticsRoutes };
