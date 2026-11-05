import { apiClient } from './client';

export interface PRItem {
  _id?: string;
  itemId: any;
  description?: string;
  requestedQuantity: number;
  approvedQuantity?: number;
  issuedQuantity?: number;
  remainingQuantity?: number;
  availableQuantityAtCheck?: number;
  shortageQuantity?: number;
  uomId: any;
  estimatedUnitPrice: number;
  estimatedTotal: number;
  requiredDate?: string;
  remarks?: string;
}

export interface PurchaseRequisition {
  _id: string;
  tenantId: string;
  prNumber: string;
  requesterId: any;
  departmentId?: any;
  warehouseId: any;
  requiredDate: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  purpose?: string;
  notes?: string;
  items: PRItem[];
  estimatedTotal: number;
  attachments?: string[];
  status:
    | 'DRAFT'
    | 'SUBMITTED'
    | 'PENDING_APPROVAL'
    | 'APPROVED'
    | 'PARTIALLY_APPROVED'
    | 'REJECTED'
    | 'STOCK_CHECK_PENDING'
    | 'PARTIALLY_AVAILABLE'
    | 'PURCHASE_REQUIRED'
    | 'PARTIALLY_ISSUED'
    | 'ISSUED'
    | 'FULFILLED'
    | 'CONVERTED'
    | 'CLOSED'
    | 'CANCELLED';
  approvalComment?: string;
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  issuedAt?: string;
  fulfilledAt?: string;
  cancelledAt?: string;
  cancelledBy?: any;
  cancellationReason?: string;
  approvedBy?: any;
  rejectedBy?: any;
  rejectionReason?: string;
  stockIssueTransactionIds?: any[];
  createdAt: string;
  updatedAt: string;
}

export interface RFQSupplier {
  _id?: string;
  supplierId: any;
  contact?: string;
  issueDate?: string;
  responseDeadline?: string;
  status: 'INVITED' | 'QUOTED' | 'DECLINED';
  remarks?: string;
  emailSent?: boolean;
  smsSent?: boolean;
  notifiedAt?: string;
}

export interface RFQItem {
  _id?: string;
  itemId: any;
  prLineId?: string;
  description?: string;
  quantity: number;
  uomId: any;
  requestedDeliveryDate?: string;
  specifications?: string;
  remarks?: string;
}

export interface RFQ {
  _id: string;
  tenantId: string;
  rfqNumber: string;
  sourceType: 'PURCHASE_REQUISITION' | 'MANUAL';
  sourceId?: any;
  sourcePRIds: any[];
  issueDate: string;
  responseDeadline: string;
  requestedDeliveryDate?: string;
  terms?: string;
  notes?: string;
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_RESPONDED' | 'FULLY_RESPONDED' | 'CLOSED' | 'CANCELLED';
  suppliers: RFQSupplier[];
  items: RFQItem[];
  createdAt: string;
}

export interface SupplierQuoteItem {
  _id?: string;
  itemId: any;
  rfqLineId?: string;
  quantity: number;
  uomId: any;
  unitPrice: number;
  discount: number;
  tax: number;
  deliveryDays?: number;
  lineTotal: number;
  remarks?: string;
}

export interface SupplierQuote {
  _id: string;
  tenantId: string;
  quoteNumber: string;
  rfqId: any;
  supplierId: any;
  quoteDate: string;
  validityDate: string;
  deliveryDate?: string;
  paymentTermsId?: any;
  currency: string;
  shippingTerms?: string;
  discount: number;
  tax: number;
  subtotal: number;
  total: number;
  items: SupplierQuoteItem[];
  notes?: string;
  status: 'DRAFT' | 'RECEIVED' | 'UNDER_REVIEW' | 'SELECTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
  submittedAt?: string;
  finalizedAt?: string;
  finalizedBy?: any;
  selectionReason?: string;
  createdAt: string;
}

export interface POItem {
  _id?: string;
  itemId: any;
  description?: string;
  quantity: number;
  uomId: any;
  unitPrice: number;
  discount: number;
  tax: number;
  lineTotal: number;
  expectedDeliveryDate?: string;
  receivedQuantity: number;
  pendingQuantity: number;
  remarks?: string;
}

export interface PurchaseOrder {
  _id: string;
  tenantId: string;
  poNumber: string;
  supplierId: any;
  sourceQuoteId?: any;
  sourceRFQId?: any;
  sourcePRIds: any[];
  orderDate: string;
  expectedDeliveryDate: string;
  warehouseId: any;
  paymentTermsId?: any;
  currency: string;
  shippingTerms?: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes?: string;
  status:
    | 'DRAFT'
    | 'SUBMITTED'
    | 'APPROVED'
    | 'REJECTED'
    | 'SENT'
    | 'PARTIALLY_RECEIVED'
    | 'FULLY_RECEIVED'
    | 'CLOSED'
    | 'CANCELLED';
  items: POItem[];
  revisions: any[];
  emailSent?: boolean;
  smsSent?: boolean;
  notifiedAt?: string;
  sentAt?: string;
  approvedBy?: any;
  approvedAt?: string;
  rejectedBy?: any;
  rejectedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface GRNItem {
  _id?: string;
  itemId: any;
  poLineId: string;
  orderedQuantity: number;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  heldQuantity: number;
  pendingQuantity: number;
  uomId: any;
  batchNumber?: string;
  manufacturingDate?: string;
  expiryDate?: string;
  qcRequired: boolean;
  remarks?: string;
}

export interface GoodsReceiptNote {
  _id: string;
  tenantId: string;
  grnNumber: string;
  purchaseOrderId: any;
  supplierId: any;
  warehouseId: any;
  receiptDate: string;
  receivedBy: any;
  status:
    | 'DRAFT'
    | 'RECEIVED'
    | 'QC_PENDING'
    | 'PARTIALLY_ACCEPTED'
    | 'ACCEPTED'
    | 'REJECTED'
    | 'COMPLETED'
    | 'CANCELLED';
  deliveryChallanNumber?: string;
  deliveryChallanDate?: string;
  transporterName?: string;
  vehicleNumber?: string;
  lrNumber?: string;
  packageCount?: number;
  supplierNotifiedEmail?: boolean;
  supplierNotifiedSMS?: boolean;
  notifiedAt?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: any;
  remarks?: string;
  items: GRNItem[];
  createdAt: string;
}

export interface PurchaseQCInspection {
  _id: string;
  tenantId: string;
  qcNumber: string;
  grnId: any;
  grnLineId: string;
  itemId: any;
  batchNumber?: string;
  inspectedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  heldQuantity: number;
  inspectorId: any;
  templateId?: string;
  results: { parameter: string; expected?: string; actual?: string; status: 'PASS' | 'FAIL' | 'NA' }[];
  overallResult: 'PASS' | 'FAIL' | 'CONDITIONAL' | 'HOLD';
  status: 'PENDING' | 'INSPECTED' | 'DISPOSITIONED';
  remarks?: string;
  inspectedAt?: string;
  dispositionedAt?: string;
  dispositionedBy?: any;
  dispositionNotes?: string;
  createdAt: string;
}

export interface ProcurementStats {
  pendingPRs: number;
  approvedPRs: number;
  openRFQs: number;
  receivedQuotes: number;
  submittedPOs: number;
  openPOs: number;
  pendingGRNs: number;
  pendingQC: number;
}

export const procurementApi = {
  // Stats
  getStats: async (): Promise<ProcurementStats> => {
    const { data } = await apiClient.get('/procurement/dashboard-stats');
    return data.data;
  },

  // Traceability
  getTraceability: async (type: string, id: string) => {
    const { data } = await apiClient.get(`/procurement/traceability/${type}/${id}`);
    return data.data;
  },

  // Purchase Requisitions
  getPRs: async (params: any = {}) => {
    const { data } = await apiClient.get('/purchase-requisitions', { params });
    return data;
  },
  getPRById: async (id: string): Promise<PurchaseRequisition> => {
    const { data } = await apiClient.get(`/purchase-requisitions/${id}`);
    return data.data;
  },
  createPR: async (payload: any) => {
    const { data } = await apiClient.post('/purchase-requisitions', payload);
    return data.data;
  },
  updatePR: async (id: string, payload: any) => {
    const { data } = await apiClient.patch(`/purchase-requisitions/${id}`, payload);
    return data.data;
  },
  submitPR: async (id: string) => {
    const { data } = await apiClient.post(`/purchase-requisitions/${id}/submit`);
    return data.data;
  },
  approvePR: async (id: string, payload?: { approvalComment?: string; items?: { itemId: string; approvedQuantity: number }[] }) => {
    const { data } = await apiClient.post(`/purchase-requisitions/${id}/approve`, payload || {});
    return data.data;
  },
  rejectPR: async (id: string, reason: string) => {
    const { data } = await apiClient.post(`/purchase-requisitions/${id}/reject`, { reason });
    return data.data;
  },
  cancelPR: async (id: string, reason: string) => {
    const { data } = await apiClient.post(`/purchase-requisitions/${id}/cancel`, { reason });
    return data.data;
  },
  checkPRAvailability: async (id: string): Promise<{ pr: PurchaseRequisition; isFullyAvailable: boolean }> => {
    const { data } = await apiClient.post(`/purchase-requisitions/${id}/availability`);
    return data;
  },
  issuePRStock: async (id: string, payload: { itemsToIssue: { itemId: string; quantity: number; locationId?: string; batchNumber?: string }[]; remarks?: string }) => {
    const { data } = await apiClient.post(`/purchase-requisitions/${id}/issue`, payload);
    return data.data;
  },
  deletePR: async (id: string) => {
    const { data } = await apiClient.delete(`/purchase-requisitions/${id}`);
    return data;
  },

  // RFQs
  getRFQs: async (params: any = {}) => {
    const { data } = await apiClient.get('/rfqs', { params });
    return data;
  },
  getRFQById: async (id: string): Promise<RFQ> => {
    const { data } = await apiClient.get(`/rfqs/${id}`);
    return data.data;
  },
  createRFQ: async (payload: any) => {
    const { data } = await apiClient.post('/rfqs', payload);
    return data.data;
  },
  issueRFQ: async (id: string, payload?: { supplierOverrides?: Array<{ supplierId: string; email?: string; phone?: string; updateSupplier?: boolean }> }) => {
    const { data } = await apiClient.post(`/rfqs/${id}/issue`, payload || {});
    return data.data;
  },
  resendRFQInvite: async (id: string, supplierId: string, payload?: { email?: string; phone?: string; updateSupplier?: boolean }) => {
    const { data } = await apiClient.post(`/rfqs/${id}/suppliers/${supplierId}/resend`, payload || {});
    return data.data;
  },
  closeRFQ: async (id: string) => {
    const { data } = await apiClient.post(`/rfqs/${id}/close`);
    return data.data;
  },
  getQuoteComparison: async (id: string) => {
    const { data } = await apiClient.get(`/rfqs/${id}/quote-comparison`);
    return data.data;
  },

  // Notification Gateway Config & Diagnostics
  getNotificationGatewayStatus: async () => {
    const { data } = await apiClient.get('/system/notifications/gateway');
    return data.data;
  },
  saveNotificationGatewayConfig: async (config: any) => {
    const { data } = await apiClient.post('/system/notifications/gateway', config);
    return data.data;
  },
  testNotificationEmail: async (email: string) => {
    const { data } = await apiClient.post('/system/notifications/gateway/test-email', { email });
    return data;
  },
  testNotificationSMS: async (phone: string) => {
    const { data } = await apiClient.post('/system/notifications/gateway/test-sms', { phone });
    return data;
  },

  // Supplier Quotes
  getQuotes: async (params: any = {}) => {
    const { data } = await apiClient.get('/supplier-quotes', { params });
    return data;
  },
  getQuoteById: async (id: string): Promise<SupplierQuote> => {
    const { data } = await apiClient.get(`/supplier-quotes/${id}`);
    return data.data;
  },
  createQuote: async (payload: any) => {
    const { data } = await apiClient.post('/supplier-quotes', payload);
    return data.data;
  },
  finalizeQuote: async (id: string, selectionReason: string) => {
    const { data } = await apiClient.post(`/supplier-quotes/${id}/finalize`, { selectionReason });
    return data.data;
  },
  rejectQuote: async (id: string, reason?: string) => {
    const { data } = await apiClient.post(`/supplier-quotes/${id}/reject`, { reason });
    return data.data;
  },

  // Purchase Orders
  getPOs: async (params: any = {}) => {
    const { data } = await apiClient.get('/purchase-orders', { params });
    return data;
  },
  getPOById: async (id: string): Promise<PurchaseOrder> => {
    const { data } = await apiClient.get(`/purchase-orders/${id}`);
    return data.data;
  },
  createPO: async (payload: any) => {
    const { data } = await apiClient.post('/purchase-orders', payload);
    return data.data;
  },
  updatePO: async (id: string, payload: any) => {
    const { data } = await apiClient.patch(`/purchase-orders/${id}`, payload);
    return data.data;
  },
  submitPO: async (id: string) => {
    const { data } = await apiClient.post(`/purchase-orders/${id}/submit`);
    return data.data;
  },
  approvePO: async (id: string) => {
    const { data } = await apiClient.post(`/purchase-orders/${id}/approve`);
    return data.data;
  },
  rejectPO: async (id: string, reason: string) => {
    const { data } = await apiClient.post(`/purchase-orders/${id}/reject`, { reason });
    return data.data;
  },
  sendPO: async (id: string, payload?: { recipientEmail?: string; recipientPhone?: string; updateSupplier?: boolean }) => {
    const { data } = await apiClient.post(`/purchase-orders/${id}/send`, payload || {});
    return data.data;
  },
  resendPONotification: async (id: string, payload?: { recipientEmail?: string; recipientPhone?: string; updateSupplier?: boolean }) => {
    const { data } = await apiClient.post(`/purchase-orders/${id}/resend-notification`, payload || {});
    return data.data;
  },
  cancelPO: async (id: string, reason?: string) => {
    const { data } = await apiClient.post(`/purchase-orders/${id}/cancel`, { reason });
    return data.data;
  },
  getIncomingPipeline: async (params: any = {}) => {
    const { data } = await apiClient.get('/purchase-orders/incoming/pipeline', { params });
    return data;
  },
  sendDeliveryFollowUp: async (id: string, payload?: { recipientEmail?: string; recipientPhone?: string; customNote?: string }) => {
    const { data } = await apiClient.post(`/purchase-orders/${id}/delivery-followup`, payload || {});
    return data;
  },

  // Goods Receipt Notes (GRN)
  getGRNs: async (params: any = {}) => {
    const { data } = await apiClient.get('/grns', { params });
    return data;
  },
  getGRNById: async (id: string): Promise<GoodsReceiptNote> => {
    const { data } = await apiClient.get(`/grns/${id}`);
    return data.data;
  },
  createGRN: async (payload: any) => {
    const { data } = await apiClient.post('/grns', payload);
    return data.data;
  },
  cancelGRN: async (id: string, reason: string) => {
    const { data } = await apiClient.post(`/grns/${id}/cancel`, { reason });
    return data.data;
  },
  resendGRNNotification: async (id: string, payload?: { email?: string; phone?: string }) => {
    const { data } = await apiClient.post(`/grns/${id}/resend-notification`, payload || {});
    return data.data;
  },
  sendGRNToQC: async (id: string) => {
    const { data } = await apiClient.post(`/grns/${id}/send-to-qc`);
    return data;
  },

  // Purchase QC
  getQCQueue: async (params: any = {}) => {
    const { data } = await apiClient.get('/purchase-qc', { params });
    return data;
  },
  getQCById: async (id: string): Promise<PurchaseQCInspection> => {
    const { data } = await apiClient.get(`/purchase-qc/${id}`);
    return data.data;
  },
  inspectQC: async (id: string, payload: any) => {
    const { data } = await apiClient.post(`/purchase-qc/${id}/inspect`, payload);
    return data.data;
  },
  dispositionQC: async (id: string, payload: any) => {
    const { data } = await apiClient.post(`/purchase-qc/${id}/disposition`, payload);
    return data.data;
  },
};
