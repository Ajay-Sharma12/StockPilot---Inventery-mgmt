import { apiClient } from './client';

export const tenantApi = {
  getCurrentTenant: async () => {
    const response = await apiClient.get('/tenants/current');
    return response.data;
  },

  updateSettings: async (settings: any) => {
    const response = await apiClient.patch('/tenants/settings', settings);
    return response.data;
  },

  updateProfile: async (profile: any) => {
    const response = await apiClient.patch('/tenants/profile', profile);
    return response.data;
  },

  listAllTenants: async (params?: { page?: number; limit?: number; search?: string }) => {
    const response = await apiClient.get('/tenants/all', { params });
    return response.data;
  },

  updateTenantStatus: async (tenantId: string, data: { status: string; plan?: string }) => {
    const response = await apiClient.patch(`/tenants/${tenantId}/status`, data);
    return response.data;
  },
};
