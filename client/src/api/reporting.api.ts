import { apiClient } from './client';

export type ReportCategory = 'INVENTORY' | 'PROCUREMENT' | 'SALES' | 'PRODUCTION' | 'QC';

export interface ReportDefinition {
  category: ReportCategory;
  reportType: string;
  name: string;
  description: string;
  defaultColumns: string[];
}

export interface ReportQueryResult {
  data: any[];
  summary: Record<string, any>;
  reportType: string;
  category: ReportCategory;
  generatedAt: string;
  snapshotId?: string;
}

export interface ReportSnapshot {
  _id: string;
  snapshotNumber: string;
  reportType: string;
  category: ReportCategory;
  filters: Record<string, any>;
  data: any[];
  summary: Record<string, any>;
  generatedBy: any;
  generatedAt: string;
  createdAt: string;
}

export const reportingApi = {
  getReportTypes: async (): Promise<ReportDefinition[]> => {
    const { data } = await apiClient.get('/reports/types');
    return data.data;
  },

  runReport: async (payload: {
    category: ReportCategory;
    reportType: string;
    warehouseId?: string;
    startDate?: string;
    endDate?: string;
    customerId?: string;
    supplierId?: string;
    itemId?: string;
    status?: string;
    saveSnapshot?: boolean;
  }): Promise<ReportQueryResult> => {
    const { data: resBody } = await apiClient.post('/reports/query', payload);
    if (resBody?.data && Array.isArray(resBody.data.data)) {
      return resBody.data;
    }
    if (resBody?.data && typeof resBody.data === 'object' && 'data' in resBody.data) {
      return resBody.data;
    }
    if (Array.isArray(resBody?.data)) {
      return {
        data: resBody.data,
        summary: resBody.summary || {},
        reportType: resBody.reportType || payload.reportType,
        category: resBody.category || payload.category,
        generatedAt: resBody.generatedAt || new Date().toISOString(),
      };
    }
    return resBody?.data || resBody;
  },

  exportReportCsv: async (payload: {
    category: ReportCategory;
    reportType: string;
    warehouseId?: string;
    startDate?: string;
    endDate?: string;
    customerId?: string;
    supplierId?: string;
    itemId?: string;
    status?: string;
  }): Promise<Blob> => {
    const response = await apiClient.post('/reports/export', payload, {
      responseType: 'blob',
    });
    return response.data;
  },

  getSnapshots: async (params: any = {}): Promise<ReportSnapshot[]> => {
    const { data } = await apiClient.get('/reports/snapshots', { params });
    return data.data;
  },

  getSnapshotById: async (id: string): Promise<ReportSnapshot> => {
    const { data } = await apiClient.get(`/reports/snapshots/${id}`);
    return data.data;
  },
};
