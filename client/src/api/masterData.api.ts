import { apiClient } from './client';

export interface Supplier {
  _id: string;
  code?: string;
  supplierCode?: string;
  name: string;
  contactPerson?: string;
  contactEmail?: string;
  phone?: string;
  currency?: string;
  paymentTermsId?: any;
  isActive?: boolean;
}

export interface PaymentTerm {
  _id: string;
  code: string;
  name: string;
  days: number;
  isActive?: boolean;
}

export interface Department {
  _id: string;
  code?: string;
  name: string;
  isActive?: boolean;
}

export interface UOM {
  _id: string;
  code: string;
  name: string;
  symbol: string;
  type?: string;
  decimalPrecision?: number;
  isActive?: boolean;
}

export const masterDataApi = {
  // Categories & SubCategories
  getCategories: async () => {
    const { data } = await apiClient.get('/master-data/categories');
    return data.data;
  },
  createCategory: async (payload: { name: string; code: string; description?: string }) => {
    const { data } = await apiClient.post('/master-data/categories', payload);
    return data.data;
  },
  getSubCategories: async (categoryId?: string) => {
    const { data } = await apiClient.get('/master-data/subcategories', { params: { categoryId } });
    return data.data;
  },
  createSubCategory: async (payload: { categoryId: string; name: string; code: string; description?: string }) => {
    const { data } = await apiClient.post('/master-data/subcategories', payload);
    return data.data;
  },

  // UOM & Conversions
  getUOMs: async () => {
    const { data } = await apiClient.get('/master-data/uoms');
    return data.data;
  },
  createUOM: async (payload: { name: string; code: string; symbol: string; type?: string; decimalPrecision?: number }) => {
    const { data } = await apiClient.post('/master-data/uoms', payload);
    return data.data;
  },
  getUOMConversions: async () => {
    const { data } = await apiClient.get('/master-data/uom-conversions');
    return data.data;
  },
  createUOMConversion: async (payload: { fromUomId: string; toUomId: string; conversionFactor: number; roundingRule?: string }) => {
    const { data } = await apiClient.post('/master-data/uom-conversions', payload);
    return data.data;
  },

  // Suppliers
  getSuppliers: async (params: { page?: number; limit?: number; search?: string; status?: string } = {}) => {
    const { data } = await apiClient.get('/master-data/suppliers', { params });
    return data;
  },
  getSupplierById: async (id: string) => {
    const { data } = await apiClient.get(`/master-data/suppliers/${id}`);
    return data.data;
  },
  createSupplier: async (payload: any) => {
    const { data } = await apiClient.post('/master-data/suppliers', payload);
    return data.data;
  },
  updateSupplier: async (id: string, payload: any) => {
    const { data } = await apiClient.patch(`/master-data/suppliers/${id}`, payload);
    return data.data;
  },
  toggleSupplierStatus: async (id: string, statusOrActive: string | boolean) => {
    const status = typeof statusOrActive === 'boolean'
      ? (statusOrActive ? 'ACTIVE' : 'INACTIVE')
      : String(statusOrActive).toUpperCase();
    const { data } = await apiClient.patch(`/master-data/suppliers/${id}/status`, {
      status,
      isActive: status === 'ACTIVE',
    });
    return data.data;
  },
  getSupplierPerformance: async (id: string) => {
    const { data } = await apiClient.get(`/master-data/suppliers/${id}/performance`);
    return data.data;
  },
  getSupplierHistory: async (id: string, params: { page?: number; limit?: number } = {}) => {
    const { data } = await apiClient.get(`/master-data/suppliers/${id}/history`, { params });
    return data;
  },

  // Customers
  getCustomers: async (params: { page?: number; limit?: number; search?: string } = {}) => {
    const { data } = await apiClient.get('/master-data/customers', { params });
    return data;
  },
  getCustomerById: async (id: string) => {
    const { data } = await apiClient.get(`/master-data/customers/${id}`);
    return data.data;
  },
  createCustomer: async (payload: any) => {
    const { data } = await apiClient.post('/master-data/customers', payload);
    return data.data;
  },

  // Departments
  getDepartments: async () => {
    const { data } = await apiClient.get('/master-data/departments');
    return data.data;
  },
  createDepartment: async (payload: { code: string; name: string; description?: string }) => {
    const { data } = await apiClient.post('/master-data/departments', payload);
    return data.data;
  },

  // Tax Codes
  getTaxCodes: async () => {
    const { data } = await apiClient.get('/master-data/tax-codes');
    return data.data;
  },
  createTaxCode: async (payload: { code: string; name: string; rate: number; type?: string }) => {
    const { data } = await apiClient.post('/master-data/tax-codes', payload);
    return data.data;
  },

  // Payment Terms
  getPaymentTerms: async () => {
    const { data } = await apiClient.get('/master-data/payment-terms');
    return data.data;
  },
  createPaymentTerm: async (payload: { code: string; name: string; days: number }) => {
    const { data } = await apiClient.post('/master-data/payment-terms', payload);
    return data.data;
  },

  // Currencies
  getCurrencies: async () => {
    const { data } = await apiClient.get('/master-data/currencies');
    return data.data;
  },
  createCurrency: async (payload: { code: string; name: string; symbol: string; decimalPrecision?: number }) => {
    const { data } = await apiClient.post('/master-data/currencies', payload);
    return data.data;
  },

  // Reasons
  getWastageReasons: async () => {
    const { data } = await apiClient.get('/master-data/reasons/wastage');
    return data.data;
  },
  createWastageReason: async (payload: { code: string; name: string; description?: string }) => {
    const { data } = await apiClient.post('/master-data/reasons/wastage', payload);
    return data.data;
  },
  getStockAdjustmentReasons: async () => {
    const { data } = await apiClient.get('/master-data/reasons/stock-adjustment');
    return data.data;
  },
  createStockAdjustmentReason: async (payload: { code: string; name: string; description?: string }) => {
    const { data } = await apiClient.post('/master-data/reasons/stock-adjustment', payload);
    return data.data;
  },

  // Starter setup & Sample/Dummy data management
  initializeStarterData: async () => {
    const { data } = await apiClient.post('/master-data/initialize-starter');
    return data;
  },
  clearSampleData: async () => {
    const { data } = await apiClient.post('/master-data/clear-sample-data');
    return data;
  },
};

