import { apiClient } from './client';

export interface AIInsightItem {
  id: string;
  category: 'REPLENISHMENT' | 'DEAD_STOCK' | 'SUPPLIER_RISK' | 'PRODUCTION_BOTTLENECK' | 'FINANCIAL_ANOMALY';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  summary: string;
  impact: string;
  recommendedAction: string;
  confidenceScore: number;
  actionType?: 'GENERATE_PO' | 'ADJUST_REORDER' | 'FLAG_QUARANTINE' | 'INVESTIGATE_LINE' | 'DISCOUNT_STOCK';
  actionLabel?: string;
  actionPayload?: Record<string, any>;
  metrics?: {
    daysRunway?: number;
    burnRatePerDay?: number;
    capitalTrapped?: number;
    defectRate?: number;
    scrapRate?: number;
    suggestedQty?: number;
    deficit?: number;
  };
  metadata?: Record<string, any>;
}

export interface AIKPISummary {
  criticalAlertsCount: number;
  itemsUnderSevenDaysRunway: number;
  totalCapitalTrapped: number;
  highRiskSuppliersCount: number;
  activeProductionBottlenecks: number;
  healthScore: number;
}

export interface AIInsightsResponse {
  insights: AIInsightItem[];
  kpiSummary: AIKPISummary;
  metadata: {
    generatedAt: string;
    analyzedEntitiesCount: number;
    tenantIsolationEnforced: boolean;
    dataScope: string[];
  };
}

export interface AISimulationResponse {
  feasible: boolean;
  finishedItem: {
    id: string;
    name: string;
    sku: string;
  };
  targetQuantity: number;
  components: Array<{
    itemId: string;
    name: string;
    sku: string;
    requiredQuantity: number;
    availableStock: number;
    shortage: number;
    isAvailable: boolean;
    estimatedCost: number;
  }>;
  totalEstimatedShortageCost: number;
  summary: string;
}

export interface AIAuditRecord {
  _id: string;
  userId: any;
  requestType: string;
  dataScope: string[];
  feature: string;
  provider: string;
  responseStatus: string;
  usageMetadata?: Record<string, any>;
  createdAt: string;
}

export const aiApi = {
  getInsights: async (): Promise<AIInsightsResponse> => {
    const { data } = await apiClient.get('/ai/insights');
    return data.data;
  },

  askAssistant: async (prompt: string): Promise<{ answer: string; references: string[] }> => {
    const { data } = await apiClient.post('/ai/query', { prompt });
    return data.data;
  },

  executeAction: async (actionType: string, payload: Record<string, any>): Promise<{ success: boolean; message: string; data?: any }> => {
    const { data } = await apiClient.post('/ai/actions/execute', { actionType, payload });
    return data;
  },

  simulateDemand: async (finishedItemId: string, targetQuantity: number): Promise<AISimulationResponse> => {
    const { data } = await apiClient.post('/ai/simulate', { finishedItemId, targetQuantity });
    return data.data;
  },

  getAuditLogs: async (params: any = {}): Promise<AIAuditRecord[]> => {
    const { data } = await apiClient.get('/ai/audits', { params });
    return data.data;
  },
};
