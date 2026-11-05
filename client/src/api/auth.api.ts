import { apiClient } from './client';

export const authApi = {
  login: async (credentials: {
    email: string;
    password: string;
    tenantSlug?: string;
    rememberMe?: boolean;
  }) => {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data;
  },

  registerTenant: async (data: {
    tenantName: string;
    tenantSlug: string;
    organizationType?: string;
    country?: string;
    businessAddress?: string;
    plan?: string;
    adminName: string;
    adminEmail: string;
    adminPassword: string;
    phone?: string;
    termsAccepted: boolean;
  }) => {
    const response = await apiClient.post('/auth/register-tenant', data);
    return response.data;
  },

  forgotPassword: async (data: { email: string; tenantSlug?: string }) => {
    const response = await apiClient.post('/auth/forgot-password', data);
    return response.data;
  },

  resetPassword: async (data: { token: string; password: string }) => {
    const response = await apiClient.post('/auth/reset-password', data);
    return response.data;
  },

  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    const response = await apiClient.post('/auth/change-password', data);
    return response.data;
  },

  logout: async (refreshToken?: string) => {
    const response = await apiClient.post('/auth/logout', { refreshToken });
    return response.data;
  },

  getMe: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  getAssignedRoles: async () => {
    const response = await apiClient.get('/auth/assigned-roles');
    return response.data;
  },
};

