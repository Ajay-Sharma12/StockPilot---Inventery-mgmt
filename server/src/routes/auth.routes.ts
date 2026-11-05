import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from '../controllers/auth.controller';
import { validateRequest } from '../middleware/validate.middleware';
import {
  loginSchema,
  registerTenantSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../validators/auth.validator';
import { authenticate } from '../middleware/auth.middleware';
import { tenantContext } from '../middleware/tenantContext.middleware';

const router = Router();

// Rate limiting for brute-force attack prevention
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  message: {
    success: false,
    message: 'Too many login attempts. Please check your credentials and try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: {
    success: false,
    message: 'Too many password reset requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for public endpoints
const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    message: 'Too many registration requests from this IP. Please try again after an hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/assigned-roles', (req, res, next) =>
  authController.getAssignedRoles(req, res, next)
);

router.post('/login', authRateLimiter, validateRequest(loginSchema), (req, res, next) =>
  authController.login(req, res, next)
);

router.post(
  '/register-tenant',
  registerRateLimiter,
  validateRequest(registerTenantSchema),
  (req, res, next) => authController.registerTenant(req, res, next)
);

router.post('/refresh-token', validateRequest(refreshTokenSchema), (req, res, next) =>
  authController.refreshToken(req, res, next)
);

router.post('/logout', (req, res, next) => authController.logout(req, res, next));

router.post(
  '/forgot-password',
  passwordResetRateLimiter,
  validateRequest(forgotPasswordSchema),
  (req, res, next) => authController.forgotPassword(req, res, next)
);

router.post(
  '/reset-password',
  passwordResetRateLimiter,
  validateRequest(resetPasswordSchema),
  (req, res, next) => authController.resetPassword(req, res, next)
);

router.post(
  '/change-password',
  authenticate,
  validateRequest(changePasswordSchema),
  (req, res, next) => authController.changePassword(req, res, next)
);

router.get('/me', authenticate, (req, res, next) =>
  authController.me(req, res, next)
);

export const authRoutes = router;

