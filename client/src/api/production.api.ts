import { apiClient } from './client';

export type BOMStatus = 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type ProductionOrderStatus =
  | 'DRAFT'
  | 'PLANNED'
  | 'APPROVED'
  | 'RELEASED'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'CLOSED';
export type ProductionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type ProductionBatchStatus = 'ACTIVE' | 'QUARANTINED' | 'RELEASED' | 'REJECTED';
export type ProductionQCStatus = 'PENDING' | 'INSPECTED' | 'DISPOSITIONED';
export type ProductionQCOverallResult = 'PASS' | 'FAIL' | 'CONDITIONAL' | 'HOLD';
export type ProductionQCDisposition = 'ACCEPT' | 'REJECT' | 'HOLD' | 'REWORK' | 'SCRAP';

export interface BOMComponent {
  itemId: any;
  quantity: number;
  uomId: any;
  scrapPercentage?: number;
  sequence: number;
  operationCode?: string;
  remarks?: string;
}

export interface BOM {
  _id: string;
  bomNumber: string;
  name: string;
  finishedItemId: any;
  version: number;
  description?: string;
  quantity: number;
  uomId: any;
  components: BOMComponent[];
  status: BOMStatus;
  effectiveFrom?: string;
  effectiveTo?: string;
  isDefault: boolean;
  routingNotes?: string;
  approvedBy?: any;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionOrderMaterial {
  _id?: string;
  itemId: any;
  plannedQuantity: number;
  reservedQuantity: number;
  issuedQuantity: number;
  actualConsumedQuantity: number;
  returnedQuantity: number;
  scrapQuantity: number;
  uomId: any;
  batchNumber?: string;
  unitCost: number;
  operationCode?: string;
}

export interface ProductionOrder {
  _id: string;
  productionOrderNumber: string;
  productionItemId: any;
  bomId: any;
  bomVersion: number;
  plannedQuantity: number;
  yieldQuantity: number;
  scrapQuantity: number;
  rejectedQuantity: number;
  uomId: any;
  warehouseId: any;
  productionLocation?: string;
  batchNumber?: string;
  status: ProductionOrderStatus;
  priority: ProductionPriority;
  plannedMaterialCost: number;
  actualMaterialCost: number;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  materials: ProductionOrderMaterial[];
  notes?: string;
  approvedBy?: any;
  approvedAt?: string;
  releasedBy?: any;
  releasedAt?: string;
  startedBy?: any;
  startedAt?: string;
  completedBy?: any;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionBatch {
  _id: string;
  batchNumber: string;
  productionOrderId: any;
  itemId: any;
  manufacturingDate: string;
  expiryDate?: string;
  quantity: number;
  uomId: any;
  status: ProductionBatchStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionQCInspection {
  _id: string;
  qcNumber: string;
  productionOrderId: any;
  itemId: any;
  batchId?: any;
  batchNumber?: string;
  inspectedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  heldQuantity: number;
  reworkQuantity: number;
  inspectorId?: any;
  results: Array<{
    parameter: string;
    expected?: string;
    actual?: string;
    status: 'PASS' | 'FAIL' | 'NA';
  }>;
  overallResult: ProductionQCOverallResult;
  status: ProductionQCStatus;
  disposition?: ProductionQCDisposition;
  remarks?: string;
  dispositionNotes?: string;
  dispositionedAt?: string;
  dispositionedBy?: any;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionOverviewStats {
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
  plannedOrders: number;
  activeBOMCount: number;
  pendingQCInspections: number;
  recentOrders: ProductionOrder[];
}

export interface ProductionTraceabilityDAG {
  bom: any;
  productionOrder: any;
  materials: any[];
  batch: any;
  qcInspection: any;
  finishedGoodsReceipt: any;
  inventoryTransactions: any[];
  inboundGRNs?: any[];
}

export interface MaterialRequirementPlan {
  bomId: string;
  bomNumber: string;
  bomVersion: number;
  finishedItemId: string;
  finishedItemName: string;
  plannedQuantity: number;
  warehouseId?: string;
  feasible: boolean;
  totalEstimatedMaterialCost: number;
  components: Array<{
    itemId: string;
    sku: string;
    name: string;
    itemCode: string;
    uomId: string;
    uomName?: string;
    uomCode?: string;
    baseQuantity: number;
    scrapPercentage: number;
    grossRequiredQuantity: number;
    currentStock: number;
    reservedStock: number;
    availableStock: number;
    shortfall: number;
    isAvailable: boolean;
    unitCost: number;
    estimatedCost: number;
    sequence: number;
    operationCode?: string;
  }>;
}

export const productionApi = {
  // Overview
  getOverview: async (): Promise<ProductionOverviewStats> => {
    const { data } = await apiClient.get('/production/overview');
    const resData = data?.data || data || {};
    const metrics = resData.metrics || {};
    return {
      totalOrders: resData.totalOrders ?? metrics.totalOrders ?? 0,
      activeOrders: resData.activeOrders ?? metrics.activeOrders ?? metrics.inProgressOrders ?? 0,
      completedOrders: resData.completedOrders ?? metrics.completedOrders ?? 0,
      plannedOrders: resData.plannedOrders ?? metrics.plannedOrders ?? 0,
      activeBOMCount: resData.activeBOMCount ?? metrics.activeBOMCount ?? metrics.activeBOMs ?? 0,
      pendingQCInspections: resData.pendingQCInspections ?? metrics.pendingQCInspections ?? 0,
      recentOrders: Array.isArray(resData.recentOrders) ? resData.recentOrders : [],
    };
  },

  // Bill of Materials (BOM)
  getBOMs: async (params: any = {}) => {
    const { data } = await apiClient.get('/boms', { params });
    const list = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
    return { data: list, total: data.total ?? list.length };
  },
  getBOMById: async (id: string): Promise<BOM> => {
    const { data } = await apiClient.get(`/boms/${id}`);
    return data.data;
  },
  createBOM: async (payload: any): Promise<BOM> => {
    const { data } = await apiClient.post('/boms', payload);
    return data.data;
  },
  updateBOM: async (id: string, payload: any): Promise<BOM> => {
    const { data } = await apiClient.put(`/boms/${id}`, payload);
    return data.data;
  },
  activateBOM: async (id: string): Promise<BOM> => {
    const { data } = await apiClient.post(`/boms/${id}/activate`);
    return data.data;
  },
  archiveBOM: async (id: string): Promise<BOM> => {
    const { data } = await apiClient.post(`/boms/${id}/archive`);
    return data.data;
  },
  cloneBOM: async (id: string): Promise<BOM> => {
    const { data } = await apiClient.post(`/boms/${id}/clone`);
    return data.data;
  },

  // Planning & MRP
  calculateMRP: async (payload: {
    bomId: string;
    plannedQuantity: number;
    warehouseId?: string;
  }): Promise<MaterialRequirementPlan> => {
    const { data } = await apiClient.post('/production/planning/calculate', payload);
    return data.data;
  },

  // Production Orders
  getOrders: async (params: any = {}) => {
    const { data } = await apiClient.get('/production-orders', { params });
    const list = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
    return { data: list, total: data.total ?? list.length };
  },
  getOrderById: async (id: string): Promise<ProductionOrder> => {
    const { data } = await apiClient.get(`/production-orders/${id}`);
    return data.data;
  },
  createOrder: async (payload: any): Promise<ProductionOrder> => {
    const { data } = await apiClient.post('/production-orders', payload);
    return data.data;
  },
  updateOrder: async (id: string, payload: any): Promise<ProductionOrder> => {
    const { data } = await apiClient.put(`/production-orders/${id}`, payload);
    return data.data;
  },
  submitOrder: async (id: string): Promise<ProductionOrder> => {
    const { data } = await apiClient.post(`/production-orders/${id}/submit`);
    return data.data;
  },
  approveOrder: async (id: string): Promise<ProductionOrder> => {
    const { data } = await apiClient.post(`/production-orders/${id}/approve`);
    return data.data;
  },
  releaseOrder: async (id: string): Promise<ProductionOrder> => {
    const { data } = await apiClient.post(`/production-orders/${id}/release`);
    return data.data;
  },
  cancelOrder: async (id: string, reason?: string): Promise<ProductionOrder> => {
    const { data } = await apiClient.post(`/production-orders/${id}/cancel`, { reason });
    return data.data;
  },

  // Execution
  startProduction: async (id: string): Promise<ProductionOrder> => {
    const { data } = await apiClient.post(`/production-orders/${id}/start`);
    return data.data;
  },
  pauseProduction: async (id: string, reason?: string): Promise<ProductionOrder> => {
    const { data } = await apiClient.post(`/production-orders/${id}/pause`, { reason });
    return data.data;
  },
  resumeProduction: async (id: string): Promise<ProductionOrder> => {
    const { data } = await apiClient.post(`/production-orders/${id}/resume`);
    return data.data;
  },
  recordOutput: async (
    id: string,
    payload: {
      producedQuantity: number;
      acceptedQuantity?: number;
      rejectedQuantity?: number;
      scrapQuantity?: number;
      scrapReason?: string;
      wastageQuantity?: number;
      wastageReason?: string;
      batchNumber?: string;
      expiryDate?: string;
      warehouseId?: string;
      qcStatus?: 'PENDING' | 'PASSED' | 'FAILED' | 'DISPOSITIONED';
      notes?: string;
      remarks?: string;
    }
  ): Promise<{ output?: any; order: ProductionOrder; batch?: ProductionBatch; qcInspection: ProductionQCInspection }> => {
    const { data } = await apiClient.post(`/production-orders/${id}/output`, payload);
    return data.data;
  },

  // Material Issuance & Consumption
  consumeMaterial: async (
    orderId: string,
    payload: {
      itemId: string;
      quantity: number;
      batchNumber?: string;
      warehouseId?: string;
      scrapQuantity?: number;
      remarks?: string;
    }
  ): Promise<ProductionOrder> => {
    const { data } = await apiClient.post(`/production-orders/${orderId}/consume`, payload);
    return data.data;
  },
  returnMaterial: async (
    orderId: string,
    payload: {
      itemId: string;
      quantity: number;
      batchNumber?: string;
      warehouseId?: string;
      remarks?: string;
    }
  ): Promise<ProductionOrder> => {
    const { data } = await apiClient.post(`/production-orders/${orderId}/return`, payload);
    return data.data;
  },

  // Production Batches
  getBatches: async (params: any = {}) => {
    const { data } = await apiClient.get('/production-batches', { params });
    const list = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
    return { data: list, total: data.total ?? list.length };
  },
  getBatchById: async (id: string): Promise<ProductionBatch> => {
    const { data } = await apiClient.get(`/production/batches/${id}`);
    return data.data;
  },

  // Production QC
  getQCInspections: async (params: any = {}) => {
    const { data } = await apiClient.get('/production-qc', { params });
    const list = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
    return { data: list, total: data.total ?? list.length };
  },
  getQCById: async (id: string): Promise<ProductionQCInspection> => {
    const { data } = await apiClient.get(`/production-qc/${id}`);
    return data.data;
  },
  inspectQC: async (
    id: string,
    payload: {
      results: Array<{ parameter: string; expected?: string; actual?: string; status: 'PASS' | 'FAIL' | 'NA' }>;
      overallResult: ProductionQCOverallResult;
      remarks?: string;
    }
  ): Promise<ProductionQCInspection> => {
    const { data } = await apiClient.post(`/production-qc/${id}/inspect`, payload);
    return data.data;
  },
  dispositionQC: async (
    id: string,
    payload: {
      disposition: ProductionQCDisposition;
      acceptedQuantity: number;
      rejectedQuantity?: number;
      heldQuantity?: number;
      reworkQuantity?: number;
      dispositionNotes: string;
    }
  ): Promise<ProductionQCInspection> => {
    const { data } = await apiClient.post(`/production-qc/${id}/disposition`, payload);
    return data.data;
  },
  overrideQCVerdict: async (
    id: string,
    payload: { overallResult: ProductionQCOverallResult; remarks?: string }
  ): Promise<ProductionQCInspection> => {
    const { data } = await apiClient.patch(`/production-qc/${id}/verdict`, payload);
    return data.data;
  },

  // Traceability & Lineage
  getLineage: async (type: 'BOM' | 'ORDER' | 'BATCH' | 'QC' | 'GRN', identifier: string): Promise<ProductionTraceabilityDAG> => {
    const { data } = await apiClient.get(`/production/traceability/${type}/${identifier}`);
    return data.data;
  },
  traceRawMaterial: async (itemId: string, batchNumber?: string) => {
    const { data } = await apiClient.get(`/production/traceability/raw-material/${itemId}`, {
      params: { batchNumber },
    });
    return data.data;
  },

  // Costing
  getOrderCosting: async (id: string) => {
    const { data } = await apiClient.get(`/production-orders/${id}/costing`);
    return data.data;
  },

  // Production Outputs (finished goods recording)
  getOutputs: async (params: any = {}) => {
    const { data } = await apiClient.get('/production/outputs', { params });
    const list = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
    return { data: list, total: data.total ?? list.length };
  },
  getOutputById: async (id: string) => {
    const { data } = await apiClient.get(`/production/outputs/${id}`);
    return data.data;
  },
  createOutput: async (payload: {
    productionOrderId: string;
    producedQuantity: number;
    acceptedQuantity?: number;
    rejectedQuantity?: number;
    scrapQuantity?: number;
    scrapReason?: string;
    wastageQuantity?: number;
    wastageReason?: string;
    batchNumber?: string;
    expiryDate?: string;
    warehouseId?: string;
    qcStatus?: 'PENDING' | 'PASSED' | 'FAILED' | 'DISPOSITIONED';
    remarks?: string;
  }) => {
    const { data } = await apiClient.post('/production/outputs', payload);
    return data.data;
  },

  // Production Output Dashboard & Matrices
  getProductionDashboard: async (params: { warehouseId?: string; startDate?: string; endDate?: string } = {}) => {
    const { data } = await apiClient.get('/production/outputs/dashboard', { params });
    return data.data;
  },
  getMaterialConsumptionMatrix: async (params: { warehouseId?: string; startDate?: string; endDate?: string } = {}) => {
    const { data } = await apiClient.get('/production/outputs/matrices/consumption', { params });
    return data.data;
  },
  getOutputMatrix: async (params: { warehouseId?: string; startDate?: string; endDate?: string } = {}) => {
    const { data } = await apiClient.get('/production/outputs/matrices/output', { params });
    return data.data;
  },
};

