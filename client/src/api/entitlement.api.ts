import { apiClient } from './client';

export const entitlementApi = {
  getEntitlements: async () => {
    const response = await apiClient.get('/entitlements');
    return response.data;
  },

  upgradePlan: async (plan: string) => {
    const response = await apiClient.post('/entitlements/upgrade', { plan });
    return response.data;
  },
};

export const auditApi = {
  listLogs: async (params?: {
    page?: number;
    limit?: number;
    action?: string;
    entity?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }) => {
    const response = await apiClient.get('/audit', { params });
    return response.data;
  },
};

export const systemApi = {
  getHealth: async () => {
    const response = await apiClient.get('/system/health');
    return response.data;
  },

  getStats: async () => {
    const response = await apiClient.get('/system/stats');
    return response.data;
  },

  getDemoPersonas: async () => {
    const response = await apiClient.get('/system/demo-personas');
    return response.data;
  },

  demoLogin: async (email: string) => {
    const response = await apiClient.post('/system/demo-login', { email });
    return response.data;
  },
};
