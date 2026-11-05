import { apiClient } from './client';

export interface Item {
  _id: string;
  code?: string;
  sku?: string;
  name: string;
  description?: string;
  categoryId?: any;
  subCategoryId?: any;
  uomId?: any;
  baseUomId?: any;
  purchasePrice?: number;
  standardCost?: number;
  sellingPrice?: number;
  qcRequired?: boolean;
  trackingType?: 'NONE' | 'BATCH' | 'SERIAL';
  minStockLevel?: number;
  maxStockLevel?: number;
  reorderPoint?: number;
  isActive?: boolean;
}

export const itemApi = {
  getItems: async (params: { page?: number; limit?: number; search?: string; categoryId?: string; itemType?: string; status?: string } = {}) => {
    const { data } = await apiClient.get('/items', { params });
    return data;
  },
  getItemById: async (id: string) => {
    const { data } = await apiClient.get(`/items/${id}`);
    return data.data;
  },
  createItem: async (payload: any) => {
    const { data } = await apiClient.post('/items', payload);
    return data.data;
  },
  updateItem: async (id: string, payload: any) => {
    const { data } = await apiClient.patch(`/items/${id}`, payload);
    return data.data;
  },
  addStock: async (
    id: string,
    payload: {
      quantity: number;
      warehouseId?: string;
      unitCost?: number;
      batchNumber?: string;
      notes?: string;
    }
  ) => {
    const { data } = await apiClient.post(`/items/${id}/stock`, payload);
    return data.data;
  },
  deleteItem: async (id: string) => {
    const { data } = await apiClient.delete(`/items/${id}`);
    return data;
  },
};
