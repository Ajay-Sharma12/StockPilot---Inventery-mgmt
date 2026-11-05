import { Router } from 'express';
import { systemController } from '../controllers/system.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantContext } from '../middleware/tenantContext.middleware';

const router = Router();

router.get('/health', (req, res) => systemController.health(req, res));
router.get('/stats', authenticate, tenantContext, (req, res, next) => systemController.getStats(req, res, next));
router.get('/demo-personas', (req, res, next) => systemController.getDemoPersonas(req, res, next));
router.post('/demo-login', (req, res, next) => systemController.demoLogin(req, res, next));
router.get('/scheduler/status', authenticate, (req, res, next) => systemController.getSchedulerStatus(req, res, next));
router.post('/scheduler/run-now', authenticate, (req, res, next) => systemController.triggerSchedulerRun(req, res, next));

// Notification Gateway Configuration & Testing
router.get('/notifications/gateway', authenticate, (req, res, next) => systemController.getNotificationGatewayConfig(req, res, next));
router.post('/notifications/gateway', authenticate, (req, res, next) => systemController.updateNotificationGatewayConfig(req, res, next));
router.post('/notifications/gateway/test-email', authenticate, (req, res, next) => systemController.testNotificationEmail(req, res, next));
router.post('/notifications/gateway/test-sms', authenticate, (req, res, next) => systemController.testNotificationSMS(req, res, next));

export const systemRoutes = router;
