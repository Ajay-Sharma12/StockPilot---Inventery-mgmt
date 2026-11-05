import { apiClient } from './client';

export interface Warehouse {
  _id: string;
  code: string;
  name: string;
  type?: string;
  address?: any;
  isActive?: boolean;
}

export const warehouseApi = {
  getWarehouses: async () => {
    const { data } = await apiClient.get('/warehouses');
    return data.data;
  },
  getWarehouseById: async (id: string) => {
    const { data } = await apiClient.get(`/warehouses/${id}`);
    return data.data;
  },
  createWarehouse: async (payload: { code: string; name: string; type?: string; address?: any }) => {
    const { data } = await apiClient.post('/warehouses', payload);
    return data.data;
  },
  updateWarehouse: async (id: string, payload: any) => {
    const { data } = await apiClient.patch(`/warehouses/${id}`, payload);
    return data.data;
  },
  getWarehouseHierarchyTree: async (warehouseId: string) => {
    const { data } = await apiClient.get(`/warehouses/${warehouseId}/tree`);
    return data.data;
  },
  getZones: async (warehouseId: string) => {
    const { data } = await apiClient.get(`/warehouses/${warehouseId}/zones`);
    return data.data;
  },
  createZone: async (payload: { warehouseId: string; code: string; name: string }) => {
    const { data } = await apiClient.post('/warehouses/zones', payload);
    return data.data;
  },
  getRacks: async (zoneId: string) => {
    const { data } = await apiClient.get(`/warehouses/zones/${zoneId}/racks`);
    return data.data;
  },
  createRack: async (payload: { warehouseId: string; zoneId: string; code: string; name: string }) => {
    const { data } = await apiClient.post('/warehouses/racks', payload);
    return data.data;
  },
  getBins: async (params: { warehouseId?: string; zoneId?: string; rackId?: string } = {}) => {
    const { data } = await apiClient.get('/warehouses/bins', { params });
    return data.data;
  },
  createBin: async (payload: { warehouseId: string; zoneId: string; rackId: string; code: string; name: string; capacity?: number }) => {
    const { data } = await apiClient.post('/warehouses/bins', payload);
    return data.data;
  },
};
