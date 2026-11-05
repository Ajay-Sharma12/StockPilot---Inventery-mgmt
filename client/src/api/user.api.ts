import { apiClient } from './client';

export const userApi = {
  listUsers: async (params?: { page?: number; limit?: number; search?: string; roleId?: string; status?: string }) => {
    const response = await apiClient.get('/users', { params });
    return response.data;
  },

  getUser: async (id: string) => {
    const response = await apiClient.get(`/users/${id}`);
    return response.data;
  },

  createUser: async (userData: any) => {
    const response = await apiClient.post('/users', userData);
    return response.data;
  },

  updateUser: async (id: string, userData: any) => {
    const response = await apiClient.patch(`/users/${id}`, userData);
    return response.data;
  },

  toggleStatus: async (id: string, status: string) => {
    const response = await apiClient.patch(`/users/${id}/status`, { status });
    return response.data;
  },
};
