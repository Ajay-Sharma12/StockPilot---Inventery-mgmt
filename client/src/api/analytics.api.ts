import { apiClient } from './client';

export type AnalyticsPeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all';

export interface TrendDataPoint {
  date: string;
  sales: number;
  procurement: number;
}

export interface ExecutiveAnalyticsData {
  kpis: {
    totalInventoryValuation: number;
    totalSalesRevenue: number;
    totalProcurementSpend: number;
    outstandingReceivables: number;
    productionYieldRate: number;
    qcPassRate: number;
  };
  growth: {
    salesRevenueGrowth: number;
    procurementSpendGrowth: number;
    salesGrowth?: number;
    procurementGrowth?: number;
  };
  summary: {
    totalItems: number;
    activeWorkOrders: number;
    openPurchaseOrders: number;
    unpaidInvoices: number;
  };
  trends?: TrendDataPoint[];
}

export interface InventoryAnalyticsData {
  totalItems: number;
  totalValuation: number;
  stockHealth: {
    healthy: number;
    lowStock: number;
    outOfStock: number;
  };
  warehouseDistribution: Array<{
    name: string;
    value: number;
    count: number;
  }>;
}

export interface ProductionAnalyticsData {
  totalOrders: number;
  yieldRate: number;
  scrapRate: number;
  totalProduced: number;
  totalScrap: number;
  totalRejected: number;
  totalActualCost: number;
  totalPlannedCost?: number;
  costVariance: number;
  statusDistribution: Record<string, number>;
}

export interface QCAnalyticsData {
  totalInspections: number;
  passRate: number;
  totalUnitsInspected?: number;
  acceptedUnits?: number;
  rejectedUnits?: number;
  heldUnits?: number;
  reworkUnits?: number;
  dispositionDistribution: {
    accepted: number;
    rejected: number;
    held: number;
    rework: number;
  };
}

export interface SalesAnalyticsData {
  totalSalesOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  topCustomers: Array<{
    customerName: string;
    revenue: number;
    orderCount: number;
  }>;
  statusDistribution: Record<string, number>;
}

export interface ProcurementAnalyticsData {
  totalPurchaseOrders: number;
  totalSpend: number;
  avgPOValue: number;
  topSuppliers: Array<{
    supplierName: string;
    spend: number;
    orderCount: number;
  }>;
  statusDistribution: Record<string, number>;
}

export const analyticsApi = {
  getExecutiveDashboard: async (
    period: AnalyticsPeriod = 'month',
    warehouseId?: string
  ): Promise<ExecutiveAnalyticsData> => {
    const { data } = await apiClient.get('/analytics/executive', {
      params: { period, warehouseId: warehouseId || undefined },
    });
    return data.data;
  },

  getInventoryAnalytics: async (warehouseId?: string): Promise<InventoryAnalyticsData> => {
    const { data } = await apiClient.get('/analytics/inventory', {
      params: { warehouseId: warehouseId || undefined },
    });
    return data.data;
  },

  getProcurementAnalytics: async (
    period: AnalyticsPeriod = 'month',
    warehouseId?: string
  ): Promise<ProcurementAnalyticsData> => {
    const { data } = await apiClient.get('/analytics/procurement', {
      params: { period, warehouseId: warehouseId || undefined },
    });
    return data.data;
  },

  getSalesAnalytics: async (
    period: AnalyticsPeriod = 'month',
    warehouseId?: string
  ): Promise<SalesAnalyticsData> => {
    const { data } = await apiClient.get('/analytics/sales', {
      params: { period, warehouseId: warehouseId || undefined },
    });
    return data.data;
  },

  getProductionAnalytics: async (
    period: AnalyticsPeriod = 'month',
    warehouseId?: string
  ): Promise<ProductionAnalyticsData> => {
    const { data } = await apiClient.get('/analytics/production', {
      params: { period, warehouseId: warehouseId || undefined },
    });
    return data.data;
  },

  getQCAnalytics: async (period: AnalyticsPeriod = 'month'): Promise<QCAnalyticsData> => {
    const { data } = await apiClient.get('/analytics/qc', { params: { period } });
    return data.data;
  },
};
