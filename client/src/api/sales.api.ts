import { apiClient } from './client';

export type QuotationStatus =
  | 'DRAFT'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CONVERTED';

export type SalesOrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'CONFIRMED'
  | 'PARTIALLY_FULFILLED'
  | 'FULFILLED'
  | 'CANCELLED'
  | 'REJECTED';

export type PackageStatus = 'DRAFT' | 'PACKED' | 'DISPATCHED' | 'CANCELLED';
export type DispatchStatus = 'DRAFT' | 'READY' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
export type GatePassStatus = 'DRAFT' | 'READY' | 'APPROVED' | 'GATE_OUT' | 'CLOSED';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'VOID';
export type PaymentStatus = 'RECORDED' | 'REVERSED';

export interface ISalesOrderItem {
  _id?: string;
  itemId: any;
  description?: string;
  orderedQuantity: number;
  uomId: any;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  lineSubtotal: number;
  lineTotal: number;
  allocatedQuantity: number;
  packedQuantity: number;
  dispatchedQuantity: number;
  invoicedQuantity: number;
  pendingQuantity: number;
  remarks?: string;
}

export interface SalesOrder {
  _id: string;
  tenantId: string;
  soNumber: string;
  customerId: any;
  warehouseId: any;
  deliveryAddress?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  billingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  paymentTermId?: any;
  orderDate: string;
  requestedDeliveryDate?: string;
  currency: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingAmount: number;
  grandTotal: number;
  items: ISalesOrderItem[];
  status: SalesOrderStatus;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: any;
  approvedAt?: string;
  rejectionReason?: string;
  confirmedBy?: any;
  confirmedAt?: string;
  cancellationReason?: string;
  notes?: string;
  attachments?: string[];
  createdBy: any;
  updatedBy?: any;
  createdAt: string;
  updatedAt: string;
}

export interface PackageItem {
  _id?: string;
  itemId: any;
  quantity: number;
  uomId: any;
  batchNumber?: string;
  serialNumbers?: string[];
  weight?: number;
  remarks?: string;
}

export interface Package {
  _id: string;
  tenantId: string;
  packageNumber: string;
  salesOrderId: any;
  customerId: any;
  warehouseId: any;
  packingMaterial?: string;
  totalWeight?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  items: PackageItem[];
  status: PackageStatus;
  packedAt?: string;
  packedBy?: any;
  notes?: string;
  createdBy: any;
  updatedBy?: any;
  createdAt: string;
  updatedAt: string;
}

export interface Dispatch {
  _id: string;
  tenantId: string;
  dispatchNumber: string;
  salesOrderId: any;
  packageIds: any[];
  customerId: any;
  warehouseId: any;
  carrier?: string;
  vehicleNumber?: string;
  driverName?: string;
  driverContact?: string;
  trackingNumber?: string;
  shippingAddress?: any;
  dispatchDate: string;
  dispatchedBy?: any;
  status: DispatchStatus;
  inventoryIssued: boolean;
  remarks?: string;
  createdBy: any;
  updatedBy?: any;
  createdAt: string;
  updatedAt: string;
}

export interface GatePass {
  _id: string;
  tenantId: string;
  gatePassNumber: string;
  salesOrderId: any;
  dispatchId: any;
  invoiceId?: any;
  customerId: any;
  warehouseId: any;
  vehicleNumber?: string;
  driverName?: string;
  driverContact?: string;
  packageIds: any[];
  items?: {
    itemId: any;
    description?: string;
    quantity: number;
    uomId: any;
  }[];
  gateOutTime?: string;
  securityOfficerId?: any;
  status: GatePassStatus;
  remarks?: string;
  createdBy: any;
  updatedBy?: any;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  _id?: string;
  itemId: any;
  description?: string;
  quantity: number;
  uomId: any;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  lineSubtotal: number;
  lineTotal: number;
  batchNumber?: string;
  serialNumbers?: string[];
}

export interface Invoice {
  _id: string;
  tenantId: string;
  invoiceNumber: string;
  customerId: any;
  salesOrderId: any;
  dispatchId?: any;
  invoiceDate: string;
  dueDate: string;
  paymentTermId?: any;
  currency: string;
  items: InvoiceItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingAmount: number;
  roundOff: number;
  grandTotal: number;
  paidAmount: number;
  outstandingAmount: number;
  status: InvoiceStatus;
  notes?: string;
  issuedAt?: string;
  issuedBy?: any;
  createdBy: any;
  updatedBy?: any;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  _id: string;
  tenantId: string;
  paymentNumber: string;
  invoiceId: any;
  customerId: any;
  paymentDate: string;
  amount: number;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'ONLINE_PAYMENT' | 'OTHER';
  paymentReference?: string;
  currency: string;
  notes?: string;
  receivedBy: any;
  status: PaymentStatus;
  reversedBy?: any;
  reversedAt?: string;
  reversalReason?: string;
  createdBy: any;
  updatedBy?: any;
  createdAt: string;
  updatedAt: string;
}

export interface SalesDashboardStats {
  ordersToday: number;
  ordersThisMonth: number;
  totalOrderValueThisMonth: number;
  pendingApprovalCount: number;
  awaitingFulfillmentCount: number;
  partiallyFulfilledCount: number;
  readyForPackagingCount: number;
  readyForDispatchCount: number;
  todayDispatchesCount: number;
  pendingGatePassesCount: number;
  invoicesIssuedCount: number;
  outstandingReceivables: number;
  overdueInvoicesCount: number;
}

export interface ItemAvailabilityReport {
  itemId: string;
  sku: string;
  name: string;
  warehouseId: string;
  warehouseName: string;
  requestedQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  freeQuantity: number;
  alreadyAllocated: number;
  shortfall: number;
  status: 'SUFFICIENT' | 'SHORTFALL' | 'OUT_OF_STOCK';
}

export interface SalesLineageDag {
  salesOrder?: SalesOrder;
  packages: Package[];
  dispatches: Dispatch[];
  gatePasses: GatePass[];
  invoices: Invoice[];
  payments: Payment[];
  customer?: any;
}

export interface ReceivablesSummary {
  totalOutstanding: number;
  totalOverdue: number;
  customers: {
    customerId: string;
    customerName: string;
    outstanding: number;
    overdue: number;
  }[];
}

export interface IQuotationItem {
  _id?: string;
  itemId: any;
  description?: string;
  quantity: number;
  uomId?: any;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  lineSubtotal: number;
  lineTotal: number;
  remarks?: string;
}

export interface Quotation {
  _id: string;
  tenantId: string;
  quotationNumber: string;
  customerId: any;
  warehouseId?: any;
  quotationDate: string;
  validUntil: string;
  paymentTermId?: any;
  currency: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingAmount: number;
  grandTotal: number;
  items: IQuotationItem[];
  status: QuotationStatus;
  commercialTerms?: string;
  notes?: string;
  salesOrderId?: any;
  convertedSalesOrderId?: any;
  publicToken?: string;
  clientFeedback?: string;
  sentAt?: string;
  sentBy?: any;
  acceptedAt?: string;
  acceptedBy?: any;
  rejectionReason?: string;
  rejectedAt?: string;
  rejectedBy?: any;
  convertedAt?: string;
  convertedBy?: any;
  createdBy: any;
  updatedBy?: any;
  createdAt: string;
  updatedAt: string;
}

export interface PickListItem {
  itemId: string;
  itemSku: string;
  itemName: string;
  uom: string;
  orderedQuantity: number;
  allocatedQuantity: number;
  packedQuantity: number;
  toPickQuantity: number;
  locationDetails: Array<{
    balanceId: string;
    warehouseId: string;
    locationId: string;
    locationCode: string;
    zone: string;
    aisle: string;
    rack: string;
    shelf: string;
    bin: string;
    lotNumber?: string;
    serialNumber?: string;
    availableQuantity: number;
    pickSuggestQty: number;
  }>;
}

export interface PickListResponse {
  salesOrderId: string;
  soNumber: string;
  warehouseId: string;
  customer: any;
  pickList: PickListItem[];
}

export const salesApi = {
  // Quotations
  getQuotations: async (params: any = {}) => {
    const { data } = await apiClient.get('/sales-quotations', { params });
    return data;
  },
  getQuotationById: async (id: string): Promise<Quotation> => {
    const { data } = await apiClient.get(`/sales-quotations/${id}`);
    return data.data;
  },
  createQuotation: async (payload: any) => {
    const { data } = await apiClient.post('/sales-quotations', payload);
    return data.data;
  },
  updateQuotation: async (id: string, payload: any) => {
    const { data } = await apiClient.patch(`/sales-quotations/${id}`, payload);
    return data.data;
  },
  sendQuotation: async (id: string, payload?: { portalBaseUrl?: string }) => {
    const { data } = await apiClient.post(`/sales-quotations/${id}/send`, payload);
    return data.data;
  },
  acceptQuotation: async (id: string) => {
    const { data } = await apiClient.post(`/sales-quotations/${id}/accept`);
    return data.data;
  },
  rejectQuotation: async (id: string, reason: string) => {
    const { data } = await apiClient.post(`/sales-quotations/${id}/reject`, { reason });
    return data.data;
  },
  convertQuotationToSalesOrder: async (id: string, payload: any = {}) => {
    const { data } = await apiClient.post(`/sales-quotations/${id}/convert-to-so`, payload);
    return data.data;
  },
  // Public Portal Quotations
  getPublicQuotation: async (id: string, token?: string) => {
    const { data } = await apiClient.get(`/sales-quotations/public/${id}`, {
      params: token ? { token } : {},
    });
    return data.data;
  },
  publicAcceptQuotation: async (id: string, token?: string, feedback?: string) => {
    const { data } = await apiClient.post(`/sales-quotations/public/${id}/accept`, {
      token,
      feedback,
    });
    return data.data;
  },
  publicRejectQuotation: async (id: string, token?: string, reason?: string) => {
    const { data } = await apiClient.post(`/sales-quotations/public/${id}/reject`, {
      token,
      reason,
    });
    return data.data;
  },
  // Sales Orders
  getSalesOrders: async (params: any = {}) => {
    const { data } = await apiClient.get('/sales-orders', { params });
    return data;
  },
  getSalesOrderById: async (id: string): Promise<SalesOrder> => {
    const { data } = await apiClient.get(`/sales-orders/${id}`);
    return data.data;
  },
  createSalesOrder: async (payload: any) => {
    const { data } = await apiClient.post('/sales-orders', payload);
    return data.data;
  },
  updateSalesOrder: async (id: string, payload: any) => {
    const { data } = await apiClient.patch(`/sales-orders/${id}`, payload);
    return data.data;
  },
  submitSalesOrder: async (id: string) => {
    const { data } = await apiClient.post(`/sales-orders/${id}/submit`);
    return data.data;
  },
  approveSalesOrder: async (id: string) => {
    const { data } = await apiClient.post(`/sales-orders/${id}/approve`);
    return data.data;
  },
  rejectSalesOrder: async (id: string, reason: string) => {
    const { data } = await apiClient.post(`/sales-orders/${id}/reject`, { reason });
    return data.data;
  },
  checkAvailability: async (id: string): Promise<ItemAvailabilityReport[]> => {
    const { data } = await apiClient.get(`/sales-orders/${id}/availability`);
    return data.data;
  },
  confirmSalesOrder: async (id: string) => {
    const { data } = await apiClient.post(`/sales-orders/${id}/confirm`);
    return data.data;
  },
  cancelSalesOrder: async (id: string, reason: string) => {
    const { data } = await apiClient.post(`/sales-orders/${id}/cancel`, { reason });
    return data.data;
  },
  getPickList: async (id: string): Promise<PickListResponse> => {
    const { data } = await apiClient.get(`/sales-orders/${id}/pick-list`);
    return data.data;
  },

  // Packaging
  getPackages: async (params: any = {}) => {
    const { data } = await apiClient.get('/packaging', { params });
    return data;
  },
  getPackageById: async (id: string): Promise<Package> => {
    const { data } = await apiClient.get(`/packaging/${id}`);
    return data.data;
  },
  createPackage: async (payload: any) => {
    const { data } = await apiClient.post('/packaging', payload);
    return data.data;
  },
  packOrder: async (id: string) => {
    const { data } = await apiClient.post(`/packaging/${id}/pack`);
    return data.data;
  },
  cancelPackage: async (id: string, reason?: string) => {
    const { data } = await apiClient.post(`/packaging/${id}/cancel`, { reason });
    return data.data;
  },

  // Dispatches
  getDispatches: async (params: any = {}) => {
    const { data } = await apiClient.get('/dispatches', { params });
    return data;
  },
  getDispatchById: async (id: string): Promise<Dispatch> => {
    const { data } = await apiClient.get(`/dispatches/${id}`);
    return data.data;
  },
  createDispatch: async (payload: any) => {
    const { data } = await apiClient.post('/dispatches', payload);
    return data.data;
  },
  dispatchOrder: async (id: string) => {
    const { data } = await apiClient.post(`/dispatches/${id}/dispatch`);
    return data.data;
  },
  cancelDispatch: async (id: string, reason?: string) => {
    const { data } = await apiClient.post(`/dispatches/${id}/cancel`, { reason });
    return data.data;
  },

  // Gate Passes
  getGatePasses: async (params: any = {}) => {
    const { data } = await apiClient.get('/gate-passes', { params });
    return data;
  },
  getGatePassById: async (id: string): Promise<GatePass> => {
    const { data } = await apiClient.get(`/gate-passes/${id}`);
    return data.data;
  },
  createGatePass: async (payload: any) => {
    const { data } = await apiClient.post('/gate-passes', payload);
    return data.data;
  },
  approveGatePass: async (id: string) => {
    const { data } = await apiClient.post(`/gate-passes/${id}/approve`);
    return data.data;
  },
  recordGateOut: async (id: string, notes?: string) => {
    const { data } = await apiClient.post(`/gate-passes/${id}/gate-out`, { notes });
    return data.data;
  },

  // Invoices
  getInvoices: async (params: any = {}) => {
    const { data } = await apiClient.get('/invoices', { params });
    return data;
  },
  getInvoiceById: async (id: string): Promise<Invoice> => {
    const { data } = await apiClient.get(`/invoices/${id}`);
    return data.data;
  },
  createInvoice: async (payload: any) => {
    const { data } = await apiClient.post('/invoices', payload);
    return data.data;
  },
  cancelInvoice: async (id: string, reason?: string) => {
    const { data } = await apiClient.post(`/invoices/${id}/cancel`, { reason });
    return data.data;
  },

  // Payments
  getPayments: async (params: any = {}) => {
    const { data } = await apiClient.get('/payments', { params });
    return data;
  },
  getPaymentById: async (id: string): Promise<Payment> => {
    const { data } = await apiClient.get(`/payments/${id}`);
    return data.data;
  },
  recordPayment: async (payload: any) => {
    const { data } = await apiClient.post('/payments', payload);
    return data.data;
  },
  reversePayment: async (id: string, reason: string) => {
    const { data } = await apiClient.post(`/payments/${id}/reverse`, { reason });
    return data.data;
  },
  getReceivablesSummary: async (): Promise<ReceivablesSummary> => {
    const { data } = await apiClient.get('/payments/receivables');
    return data.data;
  },

  // Dashboard & Lineage
  getDashboardStats: async (): Promise<SalesDashboardStats> => {
    const { data } = await apiClient.get('/sales/overview');
    return data.data;
  },
  getLineage: async (type: string, id: string): Promise<SalesLineageDag> => {
    const { data } = await apiClient.get(`/sales/traceability/${type}/${id}`);
    return data.data;
  },
};
