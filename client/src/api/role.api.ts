import { apiClient } from './client';

export const roleApi = {
  listRoles: async () => {
    const response = await apiClient.get('/roles');
    return response.data;
  },

  getPermissionsCatalog: async () => {
    const response = await apiClient.get('/roles/permissions-catalog');
    return response.data;
  },

  createRole: async (roleData: { name: string; description?: string; permissions: string[] }) => {
    const response = await apiClient.post('/roles', roleData);
    return response.data;
  },

  updateRole: async (id: string, roleData: { name?: string; description?: string; permissions?: string[] }) => {
    const response = await apiClient.patch(`/roles/${id}`, roleData);
    return response.data;
  },

  deleteRole: async (id: string) => {
    const response = await apiClient.delete(`/roles/${id}`);
    return response.data;
  },
};
