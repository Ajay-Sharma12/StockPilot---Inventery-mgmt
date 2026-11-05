import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Warehouse as WarehouseIcon,
  Calendar,
  DollarSign,
  X,
  History,
  TrendingUp,
  AlertCircle,
  Truck,
  Boxes,
  ShieldAlert,
  Layers,
  FileCheck,
  MapPin,
  Printer,
  Download,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { salesApi, SalesOrder, ItemAvailabilityReport, PickListResponse } from '../../api/sales.api';
import { downloadElementAsPdf } from '../../utils/pdfExport';
import { masterDataApi } from '../../api/masterData.api';
import { warehouseApi, Warehouse } from '../../api/warehouse.api';
import { itemApi, Item } from '../../api/item.api';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { Skeleton } from '../../components/ui/Skeleton';
import { Select } from '../../components/ui/Select';
import { useToast } from '../../context/ToastContext';

export const SalesOrdersPage: React.FC = () => {
  const { user } = useAuth();
  const { can, canApproveAmount } = usePermissions();
  const { success: toastSuccess, error: toastError } = useToast();
  const [searchParams] = useSearchParams();

  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);

  // Availability Modal
  const [availabilityReport, setAvailabilityReport] = useState<ItemAvailabilityReport[] | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Creation State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [itemsCatalog, setItemsCatalog] = useState<Item[]>([]);

  const [formData, setFormData] = useState({
    customerId: '',
    warehouseId: '',
    deliveryAddress: { street: '', city: '', state: '', country: 'USA', postalCode: '' },
    requestedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    currency: 'USD',
    shippingAmount: 0,
    notes: '',
    items: [{ itemId: '', quantity: 1, uomId: '', unitPrice: 0, discount: 0, taxRate: 0, remarks: '' }],
  });

  // Rejection & Cancellation modals
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Pick-List & Print Modals
  const [pickListData, setPickListData] = useState<PickListResponse | null>(null);
  const [loadingPickList, setLoadingPickList] = useState(false);
  const [showPrintOrderModal, setShowPrintOrderModal] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleViewPickList = async (orderId: string) => {
    try {
      setLoadingPickList(true);
      const data = await salesApi.getPickList(orderId);
      setPickListData(data);
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to fetch warehouse pick list coordinates');
    } finally {
      setLoadingPickList(false);
    }
  };

  useEffect(() => {
    loadOrders();
    loadPrerequisites();
  }, [statusFilter]);

  const loadPrerequisites = async () => {
    try {
      const [custData, whData, itemData] = await Promise.all([
        masterDataApi.getCustomers().catch((err) => {
          console.warn('Could not load customers:', err?.message);
          return [];
        }),
        warehouseApi.getWarehouses().catch((err) => {
          console.warn('Could not load warehouses:', err?.message);
          return [];
        }),
        itemApi.getItems({ limit: 100 }).catch((err) => {
          console.warn('Could not load items catalog:', err?.message);
          return { data: [] };
        }),
      ]);
      const custList = Array.isArray(custData)
        ? custData
        : Array.isArray((custData as any)?.data)
        ? (custData as any).data
        : [];
      setCustomers(custList);
      setWarehouses(Array.isArray(whData) ? whData : (whData as any)?.data || []);
      setItemsCatalog(Array.isArray((itemData as any)?.data) ? (itemData as any).data : Array.isArray(itemData) ? itemData : []);
    } catch (err) {
      console.warn('Failed to load prerequisites:', err);
    }
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      const res = await salesApi.getSalesOrders({
        status: statusFilter || undefined,
        limit: 50,
      });
      setOrders(res.data || []);

      // If URL has ?id=, pre-select it
      const queryId = searchParams.get('id');
      if (queryId && res.data) {
        const found = res.data.find((o: SalesOrder) => o._id === queryId);
        if (found) setSelectedOrder(found);
      }
    } catch (err) {
      console.error('Failed to load sales orders', err);
    } finally {
      setLoading(false);
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...formData.items];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-populate item price & base UOM when item changes
    if (field === 'itemId') {
      const itm = itemsCatalog.find((i) => i._id === value);
      if (itm) {
        updated[index].unitPrice = itm.sellingPrice || itm.standardCost || 0;
        updated[index].uomId =
          (itm.baseUomId as any)?._id ||
          (itm.baseUomId as any) ||
          (itm as any).uomId?._id ||
          (itm as any).uomId ||
          '';
      }
    }

    setFormData({ ...formData, items: updated });
  };

  const addItemRow = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { itemId: '', quantity: 1, uomId: '', unitPrice: 0, discount: 0, taxRate: 0, remarks: '' }],
    });
  };

  const removeItemRow = (index: number) => {
    if (formData.items.length <= 1) return;
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const payload = {
        customerId: formData.customerId,
        warehouseId: formData.warehouseId,
        deliveryAddress: formData.deliveryAddress,
        requestedDeliveryDate: formData.requestedDeliveryDate,
        currency: formData.currency,
        shippingAmount: Number(formData.shippingAmount),
        notes: formData.notes,
        items: formData.items.map((it) => ({
          itemId: it.itemId,
          orderedQuantity: Number(it.quantity),
          uomId: it.uomId,
          unitPrice: Number(it.unitPrice),
          discount: Number(it.discount || 0),
          taxRate: Number(it.taxRate || 0),
          remarks: it.remarks,
        })),
      };

      await salesApi.createSalesOrder(payload);
      setShowCreateModal(false);
      toastSuccess('Sales Order created successfully!');
      await loadOrders();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to create sales order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitOrder = async (orderId: string) => {
    try {
      setActionLoading(true);
      await salesApi.submitSalesOrder(orderId);
      toastSuccess('Sales Order submitted for approval!');
      await loadOrders();
      if (selectedOrder?._id === orderId) {
        const updated = await salesApi.getSalesOrderById(orderId);
        setSelectedOrder(updated);
      }
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to submit sales order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveOrder = async (order: SalesOrder) => {
    try {
      setActionLoading(true);
      await salesApi.approveSalesOrder(order._id);
      toastSuccess(`Sales Order ${order.soNumber} approved successfully!`);
      await loadOrders();
      const updated = await salesApi.getSalesOrderById(order._id);
      setSelectedOrder(updated);
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to approve sales order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectOrder = async () => {
    if (!selectedOrder || !rejectionReason.trim()) return;
    try {
      setActionLoading(true);
      await salesApi.rejectSalesOrder(selectedOrder._id, rejectionReason.trim());
      setShowRejectModal(false);
      setRejectionReason('');
      toastSuccess('Sales Order rejection recorded.');
      await loadOrders();
      const updated = await salesApi.getSalesOrderById(selectedOrder._id);
      setSelectedOrder(updated);
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to reject sales order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckAvailability = async (orderId: string) => {
    try {
      setCheckingAvailability(true);
      const report = await salesApi.checkAvailability(orderId);
      setAvailabilityReport(report);
      toastSuccess('Stock availability analyzed.');
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to check stock availability');
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleConfirmOrder = async (orderId: string) => {
    try {
      setActionLoading(true);
      await salesApi.confirmSalesOrder(orderId);
      toastSuccess('Order confirmed and inventory allocated!');
      await loadOrders();
      const updated = await salesApi.getSalesOrderById(orderId);
      setSelectedOrder(updated);
      setAvailabilityReport(null);
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to confirm order and reserve inventory');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    try {
      setActionLoading(true);
      const reason = cancellationReason.trim() || 'Cancelled by user';
      await salesApi.cancelSalesOrder(selectedOrder._id, reason);
      setShowCancelModal(false);
      setCancellationReason('');
      toastSuccess('Sales Order cancelled and reserved stock released.');
      await loadOrders();
      const updated = await salesApi.getSalesOrderById(selectedOrder._id);
      setSelectedOrder(updated);
    } catch (err: any) {
      toastError(err.response?.data?.message || err.response?.data?.errors?.[0]?.message || 'Failed to cancel sales order');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredOrders = (Array.isArray(orders) ? orders : []).filter((o) => {
    const term = (searchTerm || '').toLowerCase();
    const matchesSearch =
      (o.soNumber || '').toLowerCase().includes(term) ||
      (o.customerId?.name || '').toLowerCase().includes(term) ||
      (o.customerId?.customerCode || '').toLowerCase().includes(term);
    return matchesSearch;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <ShoppingCart className="w-6 h-6 text-indigo-400" />
            <span>Sales Orders</span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Customer order management with multi-tier ABAC approval &amp; inventory reservation
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-indigo-600/20 transition self-start"
        >
          <Plus className="w-4 h-4" />
          <span>New Sales Order</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl p-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by SO # or Customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 text-white pl-9 pr-3 py-1.5 text-xs rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['', 'DRAFT', 'SUBMITTED', 'APPROVED', 'CONFIRMED', 'FULFILLED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {st || 'All Orders'}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table and Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table List */}
        <div className={`${selectedOrder ? 'lg:col-span-2' : 'lg:col-span-3'} bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl overflow-hidden shadow-sm`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/50 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">SO Number</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Warehouse</th>
                  <th className="py-3 px-4">Delivery Date</th>
                  <th className="py-3 px-4 text-right">Grand Total</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="hover:bg-slate-800/20">
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-24 bg-slate-800" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-32 bg-slate-800" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-20 bg-slate-800" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-24 bg-slate-800" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-20 bg-slate-800" /></td>
                      <td className="py-3.5 px-4 text-center"><Skeleton className="h-5 w-20 rounded-full mx-auto bg-slate-800" /></td>
                      <td className="py-3.5 px-4 text-right"><Skeleton className="h-8 w-16 rounded ml-auto bg-slate-800" /></td>
                    </tr>
                  ))
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-500">
                      No sales orders match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((so) => (
                    <tr
                      key={so._id}
                      onClick={() => setSelectedOrder(so)}
                      className={`cursor-pointer transition hover:bg-slate-800/40 ${
                        selectedOrder?._id === so._id ? 'bg-indigo-600/10 border-l-2 border-indigo-500' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-bold text-white">{so.soNumber}</td>
                      <td className="py-3.5 px-4 text-slate-300 font-medium truncate max-w-[160px]">
                        {so.customerId?.name || 'Customer'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">{so.warehouseId?.name || 'Warehouse'}</td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {so.requestedDeliveryDate ? new Date(so.requestedDeliveryDate).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-white">
                        ${(so.grandTotal ?? 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                          so.status === 'FULFILLED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          so.status === 'CONFIRMED' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          so.status === 'APPROVED' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                          so.status === 'SUBMITTED' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          so.status === 'CANCELLED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          so.status === 'REJECTED' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          'bg-slate-700/30 text-slate-400 border-slate-700'
                        }`}>
                          {so.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrder(so);
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Panel */}
        {selectedOrder && (
          <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-5 shadow-lg space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Order Details</div>
                <h3 className="text-lg font-bold text-white mt-0.5">{selectedOrder.soNumber}</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowPrintOrderModal(true)}
                  title="Print Official Sales Order Document"
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Customer & Address */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
              <div>
                <span className="text-slate-400 font-medium">Customer:</span>
                <p className="font-semibold text-white mt-0.5">{selectedOrder.customerId?.name}</p>
                <p className="text-slate-500">{selectedOrder.customerId?.customerCode}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Fulfillment Warehouse:</span>
                <p className="font-semibold text-white mt-0.5">{selectedOrder.warehouseId?.name}</p>
                <p className="text-slate-500">{selectedOrder.warehouseId?.code}</p>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="space-y-1.5 bg-slate-950/40 p-3 rounded-lg border border-slate-800/60 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span className="text-white">${(selectedOrder.subtotal ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Tax:</span>
                <span className="text-white">${(selectedOrder.taxAmount ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Shipping:</span>
                <span className="text-white">${(selectedOrder.shippingAmount ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-indigo-400 pt-1.5 border-t border-slate-800">
                <span>Grand Total:</span>
                <span>${(selectedOrder.grandTotal ?? 0).toLocaleString()}</span>
              </div>
            </div>

            {/* Order Line Items */}
            <div>
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Line Items ({selectedOrder.items.length})</div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {selectedOrder.items.map((line, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-950/40 rounded-lg border border-slate-800/60 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">{line.itemId?.name || line.description}</span>
                      <span className="font-bold text-slate-200">
                        ${(line.lineTotal != null ? line.lineTotal : (Number(line.orderedQuantity || 0) * Number(line.unitPrice || 0)) || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Ordered: {line.orderedQuantity} &bull; Allocated: {line.allocatedQuantity || 0}</span>
                      <span>Dispatched: {line.dispatchedQuantity || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Contextual Lifecycle Actions */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              {/* DRAFT -> Submit */}
              {selectedOrder.status === 'DRAFT' && (
                <button
                  onClick={() => handleSubmitOrder(selectedOrder._id)}
                  disabled={actionLoading}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition"
                >
                  Submit for Approval
                </button>
              )}

              {/* SUBMITTED -> Approve / Reject (ABAC Checked) */}
              {selectedOrder.status === 'SUBMITTED' && (
                <div className="space-y-2">
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11px] text-amber-300 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                    <span>Requires sign-off within approval limit (User limit evaluated on click)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleApproveOrder(selectedOrder)}
                      disabled={actionLoading}
                      className="py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition"
                    >
                      Approve Order
                    </button>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      disabled={actionLoading}
                      className="py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-600/40 rounded-lg text-xs font-semibold transition"
                    >
                      Reject Order
                    </button>
                  </div>
                </div>
              )}

              {/* APPROVED -> Check Availability & Confirm (Reserve Stock) */}
              {selectedOrder.status === 'APPROVED' && (
                <div className="space-y-2">
                  <button
                    onClick={() => handleCheckAvailability(selectedOrder._id)}
                    disabled={checkingAvailability}
                    className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Check Warehouse Availability</span>
                  </button>

                  <button
                    onClick={() => handleConfirmOrder(selectedOrder._id)}
                    disabled={actionLoading}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>Confirm Order &amp; Reserve Inventory</span>
                  </button>
                </div>
              )}

              {/* CONFIRMED / PARTIALLY_FULFILLED / FULFILLED -> Warehouse Pick List Button */}
              {['CONFIRMED', 'PARTIALLY_FULFILLED', 'FULFILLED'].includes(selectedOrder.status) && (
                <div className="space-y-2">
                  <button
                    onClick={() => handleViewPickList(selectedOrder._id)}
                    disabled={loadingPickList}
                    className="w-full py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{loadingPickList ? 'Fetching Locations...' : 'Warehouse Pick-List (Physical Bins)'}</span>
                  </button>
                </div>
              )}

              {/* CONFIRMED / APPROVED -> Cancel option */}
              {['DRAFT', 'SUBMITTED', 'APPROVED', 'CONFIRMED'].includes(selectedOrder.status) && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  disabled={actionLoading}
                  className="w-full py-1.5 text-slate-400 hover:text-rose-400 text-xs transition text-center"
                >
                  Cancel Order
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stock Availability Modal */}
      {availabilityReport && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-2xl w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-sky-400" />
                <span>Warehouse Stock Availability Report</span>
              </h3>
              <button onClick={() => setAvailabilityReport(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {availabilityReport.map((rep, idx) => (
                <div key={idx} className="p-3.5 bg-slate-950/60 rounded-lg border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white">{rep.name}</div>
                      <div className="text-slate-400 text-[11px]">{rep.sku} &bull; {rep.warehouseName}</div>
                    </div>
                    <span className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                      rep.status === 'SUFFICIENT' ? 'bg-emerald-500/20 text-emerald-400' :
                      rep.status === 'SHORTFALL' ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      {rep.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-800/60 text-[11px]">
                    <div>
                      <span className="text-slate-500">Requested:</span>
                      <p className="font-bold text-white">{rep.requestedQuantity}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Available:</span>
                      <p className="font-bold text-emerald-400">{rep.availableQuantity}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Reserved:</span>
                      <p className="font-bold text-amber-400">{rep.reservedQuantity}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Shortfall:</span>
                      <p className={`font-bold ${rep.shortfall > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                        {rep.shortfall}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setAvailabilityReport(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-3xl w-full shadow-2xl max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                <span>Create New Sales Order</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Customer *"
                  value={formData.customerId}
                  onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                  placeholder="Select Customer..."
                  variant="indigo"
                  searchable
                  options={(Array.isArray(customers) ? customers : []).map((c) => ({
                    value: c._id,
                    label: `${c.name || 'Customer'} ${c.customerCode ? `(${c.customerCode})` : ''}`,
                    badge: c.customerCode || undefined,
                  }))}
                />

                <Select
                  label="Fulfillment Warehouse *"
                  value={formData.warehouseId}
                  onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                  placeholder="Select Warehouse..."
                  variant="indigo"
                  searchable
                  options={(Array.isArray(warehouses) ? warehouses : []).map((w) => ({
                    value: w._id,
                    label: `${w.name || 'Warehouse'} ${w.code ? `(${w.code})` : ''}`,
                    badge: w.code,
                  }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Requested Delivery Date</label>
                  <input
                    type="date"
                    value={formData.requestedDeliveryDate}
                    onChange={(e) => setFormData({ ...formData, requestedDeliveryDate: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Shipping &amp; Handling ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.shippingAmount}
                    onChange={(e) => setFormData({ ...formData, shippingAmount: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Line Items</span>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {formData.items.map((row, idx) => (
                    <div key={idx} className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4">
                        <label className="text-[10px] text-slate-500 block mb-0.5">Item *</label>
                        <Select
                          size="sm"
                          variant="indigo"
                          searchable
                          value={row.itemId}
                          onChange={(e) => handleItemChange(idx, 'itemId', e.target.value)}
                          placeholder="Select Item..."
                          options={(Array.isArray(itemsCatalog) ? itemsCatalog : []).map((it) => ({
                            value: it._id,
                            label: it.name,
                            badge: it.sku,
                          }))}
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-500 block mb-0.5">Quantity *</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={row.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 text-white rounded px-2 py-1.5 text-xs outline-none text-right"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-500 block mb-0.5">Unit Price ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={row.unitPrice}
                          onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 text-white rounded px-2 py-1.5 text-xs outline-none text-right"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-500 block mb-0.5">Tax (%)</label>
                        <input
                          type="number"
                          min="0"
                          value={row.taxRate}
                          onChange={(e) => handleItemChange(idx, 'taxRate', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 text-white rounded px-2 py-1.5 text-xs outline-none text-right"
                        />
                      </div>

                      <div className="col-span-2 flex items-end justify-between pt-3">
                        <span className="font-bold text-white text-xs">
                          ${((Number(row.quantity || 0) * Number(row.unitPrice || 0)) || 0).toLocaleString()}
                        </span>
                        {formData.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItemRow(idx)}
                            className="text-slate-500 hover:text-rose-400"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Order Notes &amp; Special Instructions</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Carrier instructions, client PO reference, or inspection requirements..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !formData.customerId || !formData.warehouseId || formData.items.length === 0 || formData.items.some((i) => !i.itemId || Number(i.quantity) <= 0)}
                  className={`px-5 py-2 rounded-lg text-xs font-semibold shadow transition-all duration-150 flex items-center justify-center gap-1.5 ${
                    actionLoading || !formData.customerId || !formData.warehouseId || formData.items.length === 0 || formData.items.some((i) => !i.itemId || Number(i.quantity) <= 0)
                      ? 'bg-slate-200 text-slate-500 border border-slate-300 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700 cursor-not-allowed shadow-none'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 active:scale-[0.98]'
                  }`}
                >
                  {actionLoading ? 'Creating...' : 'Create Sales Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-400" />
              <span>Reject Sales Order</span>
            </h3>
            <p className="text-xs text-slate-400">
              Provide a clear reason for rejecting order {selectedOrder?.soNumber}. This will be logged in the immutable audit trail.
            </p>
            <textarea
              required
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Credit limit exceeded, pricing unapproved by finance..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white text-xs outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectOrder}
                disabled={actionLoading || !rejectionReason.trim()}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded text-xs font-semibold"
              >
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              <span>Cancel Sales Order</span>
            </h3>
            <p className="text-xs text-slate-400">
              Are you sure you want to cancel order {selectedOrder?.soNumber}? Any reserved inventory will be immediately released back to available stock.
            </p>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                Reason for cancellation (कारण - optional):
              </label>
              <textarea
                rows={3}
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="e.g. Customer cancelled agreement, procurement redirected..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white text-xs outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={actionLoading}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow transition"
              >
                {actionLoading ? 'Cancelling...' : 'Cancel Order & Release Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warehouse Pick-List Modal */}
      {pickListData && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-teal-400" />
                  <span>Warehouse Floor Pick-List &bull; {pickListData.soNumber}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Physical storage locations and bin coordinates for warehouse material handlers.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Pick Slip</span>
                </button>
                <button
                  onClick={() => setPickListData(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {(pickListData.pickList || []).map((item, idx) => (
                <div key={idx} className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-sm">{item.itemName}</div>
                      <div className="text-xs text-slate-400">SKU: {item.itemSku}</div>
                    </div>
                    <div className="flex gap-4 text-xs">
                      <div className="text-right">
                        <span className="text-slate-500 block text-[10px]">Ordered</span>
                        <span className="font-bold text-slate-300">{item.orderedQuantity}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 block text-[10px]">Packed</span>
                        <span className="font-bold text-slate-400">{item.packedQuantity}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 block text-[10px]">To Pick</span>
                        <span className="font-bold text-teal-400 text-sm">{item.toPickQuantity}</span>
                      </div>
                    </div>
                  </div>

                  {(!item.locationDetails || item.locationDetails.length === 0) ? (
                    <div className="p-2.5 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-lg text-xs">
                      No stock balances registered in specific warehouse bins for this item.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px]">
                          <tr>
                            <th className="p-2">Location Code</th>
                            <th className="p-2">Zone</th>
                            <th className="p-2">Aisle / Rack / Shelf</th>
                            <th className="p-2">Bin Code</th>
                            <th className="p-2">Lot #</th>
                            <th className="p-2 text-right">Available</th>
                            <th className="p-2 text-right font-bold text-teal-300">Pick Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-300">
                          {item.locationDetails?.map((loc, lIdx) => (
                            <tr key={lIdx} className="hover:bg-slate-900/40">
                              <td className="p-2 font-mono text-slate-300">{loc.locationCode}</td>
                              <td className="p-2 text-slate-400">{loc.zone}</td>
                              <td className="p-2 text-slate-400">
                                {loc.aisle} &bull; {loc.rack} &bull; {loc.shelf}
                              </td>
                              <td className="p-2 font-mono font-bold text-emerald-400 bg-emerald-950/20 px-2 rounded">
                                {loc.bin}
                              </td>
                              <td className="p-2 text-slate-400">{loc.lotNumber || 'N/A'}</td>
                              <td className="p-2 text-right">{loc.availableQuantity}</td>
                              <td className="p-2 text-right font-bold text-teal-400">{loc.pickSuggestQty}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setPickListData(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Sales Order Modal */}
      {showPrintOrderModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div
            id="printable-sales-order"
            className="bg-white text-slate-900 rounded-2xl max-w-3xl w-full p-8 shadow-2xl space-y-6 my-auto print:m-0 print:p-4 print:shadow-none printable-document"
          >
            <div className="flex justify-between items-start border-b border-slate-200 pb-5">
              <div>
                <div className="text-2xl font-black text-slate-900">StockPilot ERP</div>
                <div className="text-xs text-slate-500">Sales Order Confirmation</div>
                <div className="text-xs text-slate-500">100 Logistics Blvd, Industrial Area, USA</div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold px-2 py-1 bg-indigo-100 text-indigo-800 rounded uppercase">
                  Sales Order
                </span>
                <div className="text-xl font-bold text-slate-900 mt-2">{selectedOrder.soNumber}</div>
                <div className="text-xs text-slate-500">Order Date: {new Date(selectedOrder.orderDate).toLocaleDateString()}</div>
                <div className="text-xs text-slate-500">Status: {selectedOrder.status}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="font-semibold text-slate-500 uppercase text-[10px] mb-1">Customer / Consignee:</div>
                <div className="font-bold text-slate-900 text-sm">{selectedOrder.customerId?.name}</div>
                <div className="text-slate-600">{selectedOrder.customerId?.email}</div>
                <div className="text-slate-600">{selectedOrder.customerId?.phone}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="font-semibold text-slate-500 uppercase text-[10px] mb-1">Fulfillment Warehouse:</div>
                <div className="font-bold text-slate-900 text-sm">{selectedOrder.warehouseId?.name}</div>
                <div className="text-slate-600">Code: {selectedOrder.warehouseId?.code}</div>
              </div>
            </div>

            <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">Item Description</th>
                  <th className="p-2.5 text-center">Qty</th>
                  <th className="p-2.5 text-right">Unit Price</th>
                  <th className="p-2.5 text-center">Tax %</th>
                  <th className="p-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(Array.isArray(selectedOrder.items) ? selectedOrder.items : []).map((it, idx) => (
                  <tr key={idx}>
                    <td className="p-2.5 text-slate-500">{idx + 1}</td>
                    <td className="p-2.5 font-medium text-slate-900">{it.description || it.itemId?.name || 'Item'}</td>
                    <td className="p-2.5 text-center font-semibold text-slate-800">{it.orderedQuantity ?? 0}</td>
                    <td className="p-2.5 text-right">${Number(it.unitPrice || 0).toFixed(2)}</td>
                    <td className="p-2.5 text-center text-slate-600">{it.taxRate ?? 0}%</td>
                    <td className="p-2.5 text-right font-bold text-slate-900">${Number(it.lineTotal || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end">
              <div className="w-64 space-y-1 text-xs border-t border-slate-200 pt-2">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>${Number(selectedOrder.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tax:</span>
                  <span>+${Number(selectedOrder.taxAmount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Shipping:</span>
                  <span>+${Number(selectedOrder.shippingAmount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-extrabold text-sm border-t border-slate-300 pt-1">
                  <span>Grand Total:</span>
                  <span>${Number(selectedOrder.grandTotal || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 print:hidden">
              <button
                type="button"
                onClick={() => setShowPrintOrderModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setDownloadingPdf(true);
                    await downloadElementAsPdf('printable-sales-order', `${selectedOrder.soNumber}_Sales_Order.pdf`);
                  } finally {
                    setDownloadingPdf(false);
                  }
                }}
                disabled={downloadingPdf}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-2 transition"
              >
                <Download className="w-4 h-4" />
                <span>{downloadingPdf ? 'Exporting PDF...' : 'Download PDF'}</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-2 transition"
              >
                <Printer className="w-4 h-4" />
                <span>Print Order Document</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
