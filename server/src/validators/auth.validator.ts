import { z } from 'zod';
import { TenantPlan } from '../config/constants';

export const passwordComplexitySchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const loginSchema = {
  body: z.object({
    email: z
      .string()
      .min(1, 'Email address is required')
      .email('Please enter a valid email address')
      .transform((val) => val.trim().toLowerCase()),
    password: z.string().min(1, 'Password is required'),
    tenantSlug: z
      .string()
      .optional()
      .transform((val) => (val ? val.trim().toLowerCase() : undefined)),
    rememberMe: z.boolean().optional(),
  }),
};

export const registerTenantSchema = {
  body: z.object({
    tenantName: z
      .string()
      .min(2, 'Company / Organization Name must be at least 2 characters')
      .max(100, 'Company name must not exceed 100 characters')
      .transform((val) => val.trim()),
    tenantSlug: z
      .string()
      .min(2, 'Identifier must be at least 2 characters')
      .max(50, 'Identifier must not exceed 50 characters')
      .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase alphanumeric characters and hyphens')
      .transform((val) => val.trim().toLowerCase()),
    organizationType: z.string().optional().default('Other'),
    country: z.string().optional().default(''),
    businessAddress: z.string().optional().default(''),
    plan: z.nativeEnum(TenantPlan).optional().default(TenantPlan.FREE),
    adminName: z
      .string()
      .min(2, 'Full name is required')
      .max(100, 'Name must not exceed 100 characters')
      .transform((val) => val.trim()),
    adminEmail: z
      .string()
      .min(1, 'Email address is required')
      .email('Please enter a valid email address')
      .transform((val) => val.trim().toLowerCase()),
    adminPassword: passwordComplexitySchema,
    phone: z.string().optional().default(''),
    termsAccepted: z
      .boolean({
        required_error: 'Please accept the terms and conditions',
      })
      .refine((val) => val === true, {
        message: 'Please accept the terms and conditions',
      }),
  }),
};

export const refreshTokenSchema = {
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
};

export const forgotPasswordSchema = {
  body: z.object({
    email: z
      .string()
      .min(1, 'Email address is required')
      .email('Please enter a valid email address')
      .transform((val) => val.trim().toLowerCase()),
    tenantSlug: z
      .string()
      .optional()
      .transform((val) => (val ? val.trim().toLowerCase() : undefined)),
  }),
};

export const resetPasswordSchema = {
  body: z.object({
    token: z.string().min(1, 'Reset token is required'),
    password: passwordComplexitySchema,
  }),
};

export const changePasswordSchema = {
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordComplexitySchema,
  }),
};

