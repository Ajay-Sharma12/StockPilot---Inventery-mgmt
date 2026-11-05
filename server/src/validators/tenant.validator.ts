import { z } from 'zod';
import { TenantStatus, TenantPlan } from '../config/constants';

export const updateTenantSettingsSchema = {
  body: z.object({
    currency: z.string().min(1).max(5).optional(),
    timezone: z.string().min(1).optional(),
    dateFormat: z.string().min(1).optional(),
    logoUrl: z.string().url().or(z.literal('')).optional(),
    fiscalYearStartMonth: z.number().min(1).max(12).optional(),
  }),
};

export const updateTenantProfileSchema = {
  body: z.object({
    name: z.string().min(2).optional(),
    contactEmail: z.string().email().optional(),
    phone: z.string().optional(),
    address: z
      .object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        postalCode: z.string().optional(),
      })
      .optional(),
  }),
};

export const updateTenantStatusSchema = {
  body: z.object({
    status: z.nativeEnum(TenantStatus),
    plan: z.nativeEnum(TenantPlan).optional(),
  }),
};
