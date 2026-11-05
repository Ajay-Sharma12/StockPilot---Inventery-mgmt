import { z } from 'zod';
import { UserStatus } from '../config/constants';

export const createUserSchema = {
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Valid email is required'),
    password: z.string().min(8, 'Password must be at least 8 characters').optional(),
    phone: z.string().optional(),
    roleIds: z.array(z.string()).min(1, 'At least one role must be assigned'),
    directPermissions: z.array(z.string()).optional(),
    accessScope: z
      .object({
        warehouses: z.array(z.string()).optional(),
        department: z.string().optional(),
        businessUnit: z.string().optional(),
        store: z.string().optional(),
        maxApprovalLimit: z.number().min(0).optional(),
        restrictToOwnedDocuments: z.boolean().optional(),
      })
      .optional(),
  }),
};

export const updateUserSchema = {
  body: z.object({
    name: z.string().min(2).optional(),
    password: z.string().min(6, 'Password must be at least 6 characters').optional(),
    phone: z.string().optional(),
    roleIds: z.array(z.string()).optional(),
    directPermissions: z.array(z.string()).optional(),
    accessScope: z
      .object({
        warehouses: z.array(z.string()).optional(),
        department: z.string().optional(),
        businessUnit: z.string().optional(),
        store: z.string().optional(),
        maxApprovalLimit: z.number().min(0).optional(),
        restrictToOwnedDocuments: z.boolean().optional(),
      })
      .optional(),
    status: z.nativeEnum(UserStatus).optional(),
  }),
};

export const toggleUserStatusSchema = {
  body: z.object({
    status: z.nativeEnum(UserStatus),
  }),
};
