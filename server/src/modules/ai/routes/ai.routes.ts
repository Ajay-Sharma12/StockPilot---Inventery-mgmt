import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { tenantContext } from '../../../middleware/tenantContext.middleware';
import { requireFeature } from '../../../middleware/entitlement.middleware';
import { requirePermissions } from '../../../middleware/rbac.middleware';
import { PERMISSIONS } from '../../../config/permissions.config';
import { aiController } from '../controllers/ai.controller';

const router = Router();

router.use(authenticate, tenantContext, requireFeature('ai'));

router.get(
  '/insights',
  requirePermissions([PERMISSIONS.AI_ACCESS, PERMISSIONS.AI_INSIGHTS, PERMISSIONS.REPORTS_READ], false),
  aiController.getInsights
);

router.post(
  '/query',
  requirePermissions([PERMISSIONS.AI_ACCESS, PERMISSIONS.AI_INSIGHTS], false),
  aiController.askAssistant
);

router.post(
  '/actions/execute',
  requirePermissions([PERMISSIONS.AI_ACCESS, PERMISSIONS.AI_INSIGHTS, PERMISSIONS.PURCHASE_CREATE], false),
  aiController.executeAction
);

router.post(
  '/simulate',
  requirePermissions([PERMISSIONS.AI_ACCESS, PERMISSIONS.AI_INSIGHTS, PERMISSIONS.PRODUCTION_READ], false),
  aiController.simulateDemand
);

router.get(
  '/audits',
  requirePermissions([PERMISSIONS.AI_ACCESS, PERMISSIONS.AI_INSIGHTS, PERMISSIONS.REPORTS_READ], false),
  aiController.getAuditLogs
);

export { router as aiRoutes };
