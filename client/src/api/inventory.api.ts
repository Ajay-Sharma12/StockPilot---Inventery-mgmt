import { apiClient } from './client';

export interface InventoryOverviewStats {
  totalSkus: number;
  totalStockUnits: number;
  totalValuation: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalTransactions: number;
}

export const inventoryApi = {
  getOverview: async (): Promise<InventoryOverviewStats> => {
    const { data } = await apiClient.get('/inventory/overview');
    return data.data;
  },

  getBalances: async (params: { itemId?: string; warehouseId?: string; lowStockOnly?: boolean; page?: number; limit?: number } = {}) => {
    const { data } = await apiClient.get('/inventory/balances', { params });
    return data;
  },

  getLedger: async (params: { itemId?: string; warehouseId?: string; transactionType?: string; referenceId?: string; userId?: string; startDate?: string; endDate?: string; search?: string; page?: number; limit?: number } = {}) => {
    const { data } = await apiClient.get('/inventory/transactions', { params });
    return data;
  },

  getTransactionById: async (id: string) => {
    const { data } = await apiClient.get(`/inventory/transactions/${id}`);
    return data.data;
  },

  getItemTransactions: async (itemId: string, params: { warehouseId?: string; transactionType?: string; startDate?: string; endDate?: string; page?: number; limit?: number } = {}) => {
    const { data } = await apiClient.get(`/inventory/items/${itemId}/transactions`, { params });
    return data.data;
  },

  receiveStock: async (payload: {
    itemId: string;
    warehouseId: string;
    locationId?: string;
    batchNumber?: string;
    serialNumber?: string;
    quantity: number;
    unitCost?: number;
    reason?: string;
  }) => {
    const { data } = await apiClient.post('/inventory/receive', payload);
    return data.data;
  },

  issueStock: async (payload: {
    itemId: string;
    warehouseId: string;
    locationId?: string;
    batchNumber?: string;
    serialNumber?: string;
    quantity: number;
    reason?: string;
  }) => {
    const { data } = await apiClient.post('/inventory/issue', payload);
    return data.data;
  },

  // Stock Transfers
  getTransfers: async (params: { status?: string; page?: number; limit?: number } = {}) => {
    const { data } = await apiClient.get('/stock-transfers', { params });
    return data;
  },

  getTransferById: async (id: string) => {
    const { data } = await apiClient.get(`/stock-transfers/${id}`);
    return data.data;
  },

  createTransfer: async (payload: {
    fromWarehouseId: string;
    toWarehouseId: string;
    fromLocationId?: string;
    toLocationId?: string;
    items: Array<{ itemId: string; requestedQuantity: number; batchNumber?: string }>;
    remarks?: string;
  }) => {
    const { data } = await apiClient.post('/stock-transfers', payload);
    return data.data;
  },

  submitTransfer: async (id: string) => {
    const { data } = await apiClient.post(`/stock-transfers/${id}/submit`);
    return data.data;
  },

  approveTransfer: async (id: string) => {
    const { data } = await apiClient.post(`/stock-transfers/${id}/approve`);
    return data.data;
  },

  dispatchTransfer: async (id: string) => {
    const { data } = await apiClient.post(`/stock-transfers/${id}/dispatch`);
    return data.data;
  },

  receiveTransfer: async (id: string, receivedQuantities?: Record<string, number>) => {
    const { data } = await apiClient.post(`/stock-transfers/${id}/receive`, { receivedQuantities });
    return data.data;
  },

  // Stock Adjustments
  getAdjustments: async (params: { status?: string; warehouseId?: string; page?: number; limit?: number } = {}) => {
    const { data } = await apiClient.get('/stock-adjustments', { params });
    return data;
  },

  getAdjustmentById: async (id: string) => {
    const { data } = await apiClient.get(`/stock-adjustments/${id}`);
    return data.data;
  },

  createAdjustment: async (payload: {
    warehouseId: string;
    locationId?: string;
    items: Array<{ itemId: string; batchNumber?: string; adjustedQuantity: number; reasonId?: string; remarks?: string }>;
    reason?: string;
    remarks?: string;
  }) => {
    const { data } = await apiClient.post('/stock-adjustments', payload);
    return data.data;
  },

  approveAdjustment: async (id: string) => {
    const { data } = await apiClient.post(`/stock-adjustments/${id}/approve`);
    return data.data;
  },

  // Wastage
  getWastages: async (params: { status?: string; warehouseId?: string; page?: number; limit?: number } = {}) => {
    const { data } = await apiClient.get('/wastage', { params });
    return data;
  },

  getWastageById: async (id: string) => {
    const { data } = await apiClient.get(`/wastage/${id}`);
    return data.data;
  },

  createWastage: async (payload: {
    warehouseId: string;
    locationId?: string;
    items: Array<{ itemId: string; batchNumber?: string; quantity: number; reasonId?: string; remarks?: string }>;
    remarks?: string;
  }) => {
    const { data } = await apiClient.post('/wastage', payload);
    return data.data;
  },

  approveWastage: async (id: string) => {
    const { data } = await apiClient.post(`/wastage/${id}/approve`);
    return data.data;
  },

  rejectWastage: async (id: string, remarks?: string) => {
    const { data } = await apiClient.post(`/wastage/${id}/reject`, { remarks });
    return data.data;
  },

  // Stock Counts / Cycle Counts
  getCounts: async (params: { status?: string; warehouseId?: string; page?: number; limit?: number } = {}) => {
    const { data } = await apiClient.get('/stock-counts', { params });
    return data;
  },

  getCountById: async (id: string) => {
    const { data } = await apiClient.get(`/stock-counts/${id}`);
    return data.data;
  },

  createCount: async (payload: {
    warehouseId: string;
    countDate?: string;
    assignedUsers?: string[];
    itemIds?: string[];
    remarks?: string;
  }) => {
    const { data } = await apiClient.post('/stock-counts', payload);
    return data.data;
  },

  recordCounts: async (id: string, items: Array<{ itemId: string; batchNumber?: string; countedQuantity: number; reasonId?: string; remarks?: string }>) => {
    const { data } = await apiClient.post(`/stock-counts/${id}/record`, { items });
    return data.data;
  },

  approveCount: async (id: string) => {
    const { data } = await apiClient.post(`/stock-counts/${id}/approve`);
    return data.data;
  },
};
