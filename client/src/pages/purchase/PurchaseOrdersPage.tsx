import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Trash2,
  Search,
  Send,
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
  Mail,
  Phone,
  RotateCcw,
  Server,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { procurementApi, PurchaseOrder, SupplierQuote } from '../../api/procurement.api';
import { masterDataApi, Supplier, PaymentTerm } from '../../api/masterData.api';
import { warehouseApi, Warehouse } from '../../api/warehouse.api';
import { itemApi, Item } from '../../api/item.api';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../context/ToastContext';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Select } from '../../components/ui/Select';
import { NotificationGatewayModal } from '../../components/common/NotificationGatewayModal';

export const PurchaseOrdersPage: React.FC = () => {
  const { user } = useAuth();
  const { can, canApproveAmount } = usePermissions();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  // Creation State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [winningQuotes, setWinningQuotes] = useState<SupplierQuote[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [itemsCatalog, setItemsCatalog] = useState<Item[]>([]);

  const [createMode, setCreateMode] = useState<'FROM_QUOTE' | 'MANUAL'>('FROM_QUOTE');
  const [formData, setFormData] = useState({
    supplierId: '',
    warehouseId: '',
    sourceQuoteId: '',
    expectedDeliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    shippingTerms: 'FOB Facility Dock',
    notes: '',
    items: [{ itemId: '', quantity: 1, uomId: '', unitPrice: 0, remarks: '' }],
  });

  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { itemId: '', quantity: 1, uomId: '', unitPrice: 0, remarks: '' }],
    }));
  };

  const handleRemoveItem = (index: number) => {
    if (formData.items.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  // Rejection modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    loadPOs();
  }, [statusFilter]);

  const loadPOs = async () => {
    try {
      setLoading(true);
      const res = await procurementApi.getPOs({
        status: statusFilter || undefined,
        search: searchTerm || undefined,
      });
      setPOs(res.data || []);
    } catch (err) {
      console.error('Failed to load purchase orders', err);
    } finally {
      setLoading(false);
    }
  };

  const normalizeList = (res: any): any[] => {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.items)) return res.items;
    return [];
  };

  const loadPrerequisites = async () => {
    try {
      const [quotesRes, suppsRes, whsRes, itemsRes] = await Promise.all([
        procurementApi.getQuotes({ status: 'SELECTED' }),
        masterDataApi.getSuppliers(),
        warehouseApi.getWarehouses(),
        itemApi.getItems({ limit: 100 }),
      ]);
      const whList = normalizeList(whsRes);
      setWinningQuotes(normalizeList(quotesRes));
      setSuppliers(normalizeList(suppsRes));
      setWarehouses(whList);
      setItemsCatalog(normalizeList(itemsRes));

      if (whList.length > 0) {
        setFormData((prev) => ({ ...prev, warehouseId: prev.warehouseId || whList[0]._id }));
      }
    } catch (err) {
      console.error('Failed to load prerequisites', err);
    }
  };

  const openCreateModal = () => {
    loadPrerequisites();
    setShowCreateModal(true);
  };

  const handleQuoteSelect = (quoteId: string) => {
    const q = winningQuotes.find((item) => item._id === quoteId);
    if (q) {
      const suppId = typeof q.supplierId === 'object' ? q.supplierId._id : q.supplierId;
      const mappedItems = q.items.map((it) => ({
        itemId: typeof it.itemId === 'object' ? it.itemId._id : it.itemId,
        quantity: it.quantity,
        uomId: typeof it.uomId === 'object' ? it.uomId._id : it.uomId,
        unitPrice: it.unitPrice,
        remarks: it.remarks || '',
      }));

      setFormData((prev) => ({
        ...prev,
        sourceQuoteId: quoteId,
        supplierId: suppId,
        shippingTerms: q.shippingTerms || prev.shippingTerms,
        items: mappedItems,
      }));
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await procurementApi.createPO(formData);
      setShowCreateModal(false);
      success(`Purchase order ${res.poNumber || ''} created successfully`);
      loadPOs();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to create purchase order');
    }
  };

  const handleSubmitPO = async (id: string) => {
    try {
      await procurementApi.submitPO(id);
      success('Purchase order submitted for approval');
      loadPOs();
      if (selectedPO?._id === id) {
        const updated = await procurementApi.getPOById(id);
        setSelectedPO(updated);
      }
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to submit order');
    }
  };

  const handleApprovePO = async (id: string) => {
    try {
      await procurementApi.approvePO(id);
      success('Purchase order approved');
      loadPOs();
      if (selectedPO?._id === id) {
        const updated = await procurementApi.getPOById(id);
        setSelectedPO(updated);
      }
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Approval authorization denied');
    }
  };

  const handleRejectPO = async () => {
    if (!selectedPO || !rejectionReason.trim()) return;
    try {
      await procurementApi.rejectPO(selectedPO._id, rejectionReason.trim());
      setShowRejectModal(false);
      setRejectionReason('');
      success('Purchase order rejected');
      loadPOs();
      const updated = await procurementApi.getPOById(selectedPO._id);
      setSelectedPO(updated);
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to reject order');
    }
  };

  // Gateway Status
  const [gatewayStatus, setGatewayStatus] = useState<any>(null);
  const [showGatewayModal, setShowGatewayModal] = useState(false);

  const loadGatewayStatus = async () => {
    try {
      const data = await procurementApi.getNotificationGatewayStatus();
      setGatewayStatus(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadGatewayStatus();
  }, []);

  // PO Dispatch Notification State
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [saveSupplierContact, setSaveSupplierContact] = useState(true);

  const openDispatchModal = (po: PurchaseOrder) => {
    const email = po.supplierId?.email || po.supplierId?.contactEmail || '';
    const phone = po.supplierId?.phone || '';
    setRecipientEmail(email);
    setRecipientPhone(phone);
    setSaveSupplierContact(true);
    setShowDispatchModal(true);
  };

  const handleConfirmSendPO = async () => {
    if (!selectedPO) return;
    try {
      setDispatching(true);
      const payload = {
        recipientEmail: recipientEmail.trim(),
        recipientPhone: recipientPhone.trim(),
        updateSupplier: saveSupplierContact,
      };

      const updated = selectedPO.status === 'APPROVED'
        ? await procurementApi.sendPO(selectedPO._id, payload)
        : await procurementApi.resendPONotification(selectedPO._id, payload);

      success(`Purchase order ${selectedPO.poNumber} notification dispatched via Email & SMS!`);
      setShowDispatchModal(false);
      loadPOs();
      setSelectedPO(updated);
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to dispatch PO');
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Package className="w-6 h-6 text-emerald-400" />
            Purchase Orders (PO)
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Manage binding purchase contracts, multi-level approvals, and inbound fulfillment progress.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {can('purchase:create') && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition shadow-lg shadow-emerald-600/25"
            >
              <Plus className="w-4 h-4" />
              Create Purchase Order
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 rounded-xl p-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search PO # or supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadPOs()}
              className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl pl-9 pr-3 py-2 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            onClick={loadPOs}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 font-medium"
          >
            Filter
          </button>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
          {['', 'DRAFT', 'SUBMITTED', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {st === '' ? 'All Orders' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={6} columns={8} />
          </div>
        ) : pos.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            No purchase orders found. Click "Create Purchase Order" to begin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">PO Number</th>
                  <th className="py-3.5 px-4">Supplier</th>
                  <th className="py-3.5 px-4">Warehouse</th>
                  <th className="py-3.5 px-4">Expected Delivery</th>
                  <th className="py-3.5 px-4">Order Value</th>
                  <th className="py-3.5 px-4">Fulfillment Progress</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {pos.map((po) => {
                  const totalOrdered = po.items.reduce((sum, i) => sum + i.quantity, 0);
                  const totalReceived = po.items.reduce((sum, i) => sum + i.receivedQuantity, 0);
                  const percent = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

                  return (
                    <tr
                      key={po._id}
                      onClick={() => setSelectedPO(po)}
                      className="hover:bg-slate-800/40 cursor-pointer transition"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-xs text-emerald-400">
                        {po.poNumber}
                      </td>
                      <td className="py-3 px-4 text-white font-medium">
                        {po.supplierId?.name || 'Vendor'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-300">
                        {po.warehouseId?.name || 'Facility'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400 font-mono">
                        {new Date(po.expectedDeliveryDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-sm text-white">
                        ${po.total?.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-32">
                          <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                            <span>{totalReceived}/{totalOrdered}</span>
                            <span>{percent}%</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${
                                percent === 100 ? 'bg-emerald-500' : percent > 0 ? 'bg-indigo-500' : 'bg-slate-700'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            po.status === 'FULLY_RECEIVED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : po.status === 'PARTIALLY_RECEIVED'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : po.status === 'APPROVED' || po.status === 'SENT'
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              : po.status === 'SUBMITTED'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {po.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {(po.status === 'SENT' || po.status === 'PARTIALLY_RECEIVED') && can('grn:create') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/purchase/grns?poId=${po._id}`);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-600/20 dark:hover:bg-emerald-600/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 text-xs font-semibold flex items-center gap-1 transition"
                              title="Receive Goods at Dock (GRN)"
                            >
                              <Truck className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                              Receive
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPO(po);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-300 dark:border-slate-700 transition"
                          >
                            Inspect
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PO Details Drawer */}
      {selectedPO && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs text-emerald-400 font-mono font-semibold">Purchase Order Details</span>
                <h2 className="text-xl font-bold text-white">{selectedPO.poNumber}</h2>
              </div>
              <button onClick={() => setSelectedPO(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400">Supplier</span>
                <p className="font-semibold text-white mt-0.5">{selectedPO.supplierId?.name || 'Supplier'}</p>
              </div>
              <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400">Warehouse Dock</span>
                <p className="font-semibold text-white mt-0.5">{selectedPO.warehouseId?.name || 'Warehouse'}</p>
              </div>
              <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400">Expected Delivery</span>
                <p className="font-semibold text-white mt-0.5 font-mono">
                  {new Date(selectedPO.expectedDeliveryDate).toLocaleDateString()}
                </p>
              </div>
              <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400">Status</span>
                <p className="font-semibold text-emerald-400 mt-0.5">{selectedPO.status}</p>
              </div>
            </div>

            {/* Notification Status Banner */}
            {(selectedPO.status === 'SENT' || selectedPO.status === 'PARTIALLY_RECEIVED' || selectedPO.status === 'FULLY_RECEIVED' || selectedPO.status === 'CLOSED') && (
              <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-indigo-300 font-semibold flex items-center gap-1.5 text-xs">
                    <Send className="w-3.5 h-3.5 text-indigo-400" />
                    Supplier Dispatch & Delivery Notification Status
                  </span>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    {selectedPO.notifiedAt ? `Dispatched on ${new Date(selectedPO.notifiedAt).toLocaleString()}` : 'Past order record (notification pending)'}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                    selectedPO.emailSent ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    <Mail className="w-3 h-3" /> {selectedPO.emailSent ? 'Email Dispatched' : 'Email Pending / Not Sent'}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                    selectedPO.smsSent ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    <Phone className="w-3 h-3" /> {selectedPO.smsSent ? 'SMS Dispatched' : 'SMS Pending / No Phone'}
                  </span>
                  <button
                    onClick={() => openDispatchModal(selectedPO)}
                    className="px-3 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-[11px] font-semibold shadow-md flex items-center gap-1 transition"
                  >
                    <Send className="w-3 h-3" />
                    {selectedPO.emailSent && selectedPO.smsSent ? 'Resend' : 'Send Now 🚀'}
                  </button>
                </div>
              </div>
            )}

            {/* Line Items Table */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Order Line Items</h3>
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="p-2.5">Item</th>
                      <th className="p-2.5">Ordered</th>
                      <th className="p-2.5">Received</th>
                      <th className="p-2.5">Pending</th>
                      <th className="p-2.5 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {selectedPO.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 text-white">
                          <span className="font-medium">{it.itemId?.name || it.description}</span>
                          <span className="text-[10px] text-slate-500 block font-mono">{it.itemId?.sku}</span>
                        </td>
                        <td className="p-2.5 text-slate-200">{it.quantity}</td>
                        <td className="p-2.5 text-emerald-400 font-semibold">{it.receivedQuantity}</td>
                        <td className="p-2.5 text-amber-400">{it.pendingQuantity}</td>
                        <td className="p-2.5 text-right text-white font-mono">${it.lineTotal?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-right mt-2 text-sm font-bold text-white">
                Total Order Value: <span className="font-mono text-emerald-400">${selectedPO.total?.toLocaleString()}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-800">
              {selectedPO.status === 'DRAFT' && can('purchase:create') && (
                <button
                  onClick={() => handleSubmitPO(selectedPO._id)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  Submit for Sign-off
                </button>
              )}

              {selectedPO.status === 'SUBMITTED' && can('purchase:approve') && (
                <>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-600/20 dark:hover:bg-rose-600/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-600/30 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <XCircle className="w-3.5 h-3.5 text-rose-700 dark:text-rose-300" />
                    Reject PO
                  </button>
                  <button
                    onClick={() => handleApprovePO(selectedPO._id)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-600/25"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Authorize PO
                  </button>
                </>
              )}

              {selectedPO.status === 'APPROVED' && can('purchase:create') && (
                <button
                  onClick={() => openDispatchModal(selectedPO)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/25"
                >
                  <Send className="w-3.5 h-3.5" />
                  Dispatch PO (Send Email & SMS)
                </button>
              )}

              {(selectedPO.status === 'SENT' || selectedPO.status === 'PARTIALLY_RECEIVED' || selectedPO.status === 'FULLY_RECEIVED' || selectedPO.status === 'CLOSED') && (
                <button
                  onClick={() => openDispatchModal(selectedPO)}
                  disabled={dispatching}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  Send / Resend Email & SMS
                </button>
              )}

              {(selectedPO.status === 'SENT' || selectedPO.status === 'PARTIALLY_RECEIVED') && can('grn:create') && (
                <button
                  onClick={() => navigate(`/purchase/grns?poId=${selectedPO._id}`)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-600/25"
                >
                  <Truck className="w-3.5 h-3.5" />
                  Receive Inbound Dock Shipment
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PO Dispatch Confirmation Modal */}
      {showDispatchModal && selectedPO && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-400" />
                Dispatch PO: Supply Confirmation Notice
              </h3>
              <button onClick={() => setShowDispatchModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Official Purchase Order <strong className="text-emerald-400">#{selectedPO.poNumber}</strong> will be sent to the supplier with clear supply and delivery instructions:
            </p>

            {/* Vendor & Order Details */}
            <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60 space-y-2 text-xs">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Vendor</span>
                  <p className="font-bold text-white">{selectedPO.supplierId?.name || 'Selected Supplier'}</p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Order</span>
                  <p className="font-bold text-emerald-400 font-mono">Rs. {selectedPO.total?.toLocaleString()}</p>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-700/50">
                <strong>Delivery Destination:</strong> {selectedPO.warehouseId?.name || 'Warehouse'} (Due: {new Date(selectedPO.expectedDeliveryDate).toLocaleDateString()})
              </div>
            </div>

            {/* Recipient Email & Phone Input Fields */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">
                  Recipient Email Address (for Official PO & Specifications):
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-blue-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="vendor@company.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">
                  Recipient Mobile / Phone Number (for Instant SMS "Supply Ker Do"):
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="+91 98765 43210 (or 10-digit mobile number)"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                {!recipientPhone.trim() && (
                  <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Supplier is missing a phone number. Enter mobile number above so SMS is dispatched.
                  </p>
                )}
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300 text-xs pt-1">
                <input
                  type="checkbox"
                  checked={saveSupplierContact}
                  onChange={(e) => setSaveSupplierContact(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-purple-600 focus:ring-0 w-3.5 h-3.5"
                />
                <span>Save phone and email to supplier profile ({selectedPO.supplierId?.name || 'Supplier'})</span>
              </label>
            </div>

            {/* Notification Preview */}
            <div className="bg-emerald-950/20 border border-emerald-800/40 p-3 rounded-xl space-y-1 text-xs">
              <span className="text-emerald-400 font-semibold text-[11px] uppercase tracking-wide flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />
                Live SMS Preview (Dispatched to {recipientPhone.trim() || 'Entered Mobile Number'})
              </span>
              <p className="text-slate-300 italic text-[11px] leading-relaxed">
                "[StockPilot] Official PO #{selectedPO.poNumber} issued to {selectedPO.supplierId?.name || 'Supplier'}. Total: Rs. {selectedPO.total?.toLocaleString()}. Please initiate supply & deliver by {new Date(selectedPO.expectedDeliveryDate).toLocaleDateString()} at {selectedPO.warehouseId?.name || 'Warehouse'}. Full PO details sent to your registered email."
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDispatchModal(false)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSendPO}
                disabled={dispatching || (!recipientEmail.trim() && !recipientPhone.trim())}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30"
              >
                <Send className="w-3.5 h-3.5" />
                {dispatching ? 'Dispatching...' : 'Dispatch Real Email & SMS Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-base font-bold text-white">Reject Purchase Order</h3>
            <p className="text-xs text-slate-400">Provide required audit reason for declining this purchase order.</p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-rose-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-3 py-1.5 rounded-lg text-slate-400 text-xs hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectPO}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-400" />
                Generate Purchase Order
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="flex items-center gap-4 bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 font-semibold">PO Generation Mode:</span>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-200">
                  <input
                    type="radio"
                    name="mode"
                    value="FROM_QUOTE"
                    checked={createMode === 'FROM_QUOTE'}
                    onChange={() => setCreateMode('FROM_QUOTE')}
                  />
                  From Awarded Quotation
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-200">
                  <input
                    type="radio"
                    name="mode"
                    value="MANUAL"
                    checked={createMode === 'MANUAL'}
                    onChange={() => setCreateMode('MANUAL')}
                  />
                  Direct Purchase Order
                </label>
              </div>

              {createMode === 'FROM_QUOTE' && (
                <div>
                  <Select
                    label="Select Awarded Vendor Quote"
                    value={formData.sourceQuoteId}
                    onChange={(e) => handleQuoteSelect(e.target.value)}
                    placeholder="Select a Selected Quotation..."
                    variant="emerald"
                    options={winningQuotes.map((q) => ({
                      value: q._id,
                      label: `${q.quoteNumber} - ${q.supplierId?.name} ($${q.total})`,
                      badge: q.quoteNumber,
                    }))}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  label="Supplier"
                  value={formData.supplierId}
                  onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                  placeholder="Select Supplier..."
                  options={suppliers.map((s) => ({
                    value: s._id,
                    label: `${s.name} (${s.supplierCode})`,
                  }))}
                />

                <Select
                  label="Receiving Warehouse Dock"
                  value={formData.warehouseId}
                  onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                  placeholder="Select Warehouse..."
                  options={warehouses.map((w) => ({
                    value: w._id,
                    label: `${w.name} (${w.code})`,
                  }))}
                />

                <div>
                  <label className="block text-slate-400 mb-1">Expected Delivery Date</label>
                  <input
                    type="date"
                    value={formData.expectedDeliveryDate}
                    onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })}
                    required
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Shipping Terms</label>
                  <input
                    type="text"
                    value={formData.shippingTerms}
                    onChange={(e) => setFormData({ ...formData, shippingTerms: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="pt-3 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-200 uppercase tracking-wider text-xs block">
                      Order Line Items (ऑर्डर की जाने वाली वस्तुएं)
                    </span>
                    <p className="text-[11px] text-slate-400">
                      नीचे आइटम चुनें, उसकी मात्रा (Qty) और प्रति यूनिट रेट (Price) भरें:
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Item</span>
                  </button>
                </div>

                {/* Column Headers */}
                <div className="grid grid-cols-12 gap-2 px-3 py-1.5 bg-slate-800/80 rounded-lg text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                  <div className="col-span-5">1. Item / Product (आइटम) *</div>
                  <div className="col-span-2 text-center">2. Quantity (मात्रा) *</div>
                  <div className="col-span-2 text-right">3. Unit Price ($) *</div>
                  <div className="col-span-2 text-right">4. Total ($)</div>
                  <div className="col-span-1 text-center">Action</div>
                </div>

                {/* Rows */}
                <div className="space-y-2">
                  {formData.items.map((row, idx) => {
                    const rowTotal = (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0);
                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-2 items-center bg-slate-800/40 hover:bg-slate-800/60 p-2.5 rounded-xl border border-slate-800 transition"
                      >
                        {/* 1. Item Selection */}
                        <div className="col-span-5">
                          <label className="block text-[10px] text-slate-400 font-medium mb-1 sm:hidden">
                            Item / Product:
                          </label>
                          <Select
                            size="sm"
                            value={row.itemId}
                            placeholder="Select Item"
                            variant="emerald"
                            onChange={(e) => {
                              const itm = itemsCatalog.find((i) => i._id === e.target.value);
                              const updated = [...formData.items];
                              updated[idx].itemId = e.target.value;
                              if (itm) {
                                updated[idx].unitPrice = itm.standardCost || 0;
                                const bUom = typeof itm.baseUomId === 'object' ? (itm.baseUomId as any)._id : itm.baseUomId;
                                updated[idx].uomId = bUom || '';
                              }
                              setFormData({ ...formData, items: updated });
                            }}
                            options={itemsCatalog.map((i) => ({
                              value: i._id,
                              label: `${i.name} (${i.sku})`,
                              badge: i.sku,
                            }))}
                          />
                        </div>

                        {/* 2. Quantity */}
                        <div className="col-span-2">
                          <label className="block text-[10px] text-slate-400 font-medium mb-1 sm:hidden">
                            Quantity:
                          </label>
                          <input
                            type="number"
                            placeholder="Qty"
                            min="0.001"
                            step="any"
                            value={row.quantity}
                            onChange={(e) => {
                              const updated = [...formData.items];
                              updated[idx].quantity = Number(e.target.value);
                              setFormData({ ...formData, items: updated });
                            }}
                            required
                            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs font-mono text-center focus:border-emerald-500 focus:outline-none"
                          />
                        </div>

                        {/* 3. Unit Price */}
                        <div className="col-span-2">
                          <label className="block text-[10px] text-slate-400 font-medium mb-1 sm:hidden">
                            Unit Price ($):
                          </label>
                          <input
                            type="number"
                            placeholder="Price $"
                            min="0"
                            step="any"
                            value={row.unitPrice}
                            onChange={(e) => {
                              const updated = [...formData.items];
                              updated[idx].unitPrice = Number(e.target.value);
                              setFormData({ ...formData, items: updated });
                            }}
                            required
                            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs font-mono text-right focus:border-emerald-500 focus:outline-none"
                          />
                        </div>

                        {/* 4. Total calculation */}
                        <div className="col-span-2 text-right">
                          <label className="block text-[10px] text-slate-400 font-medium mb-1 sm:hidden">
                            Line Total:
                          </label>
                          <span className="font-mono text-xs font-semibold text-emerald-400 block px-1 py-1.5 bg-slate-900/50 rounded-lg border border-slate-700/50">
                            ${rowTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        {/* Action / Delete */}
                        <div className="col-span-1 flex justify-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            disabled={formData.items.length <= 1}
                            title="Remove Item"
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:bg-transparent"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Total Summary Footer */}
                <div className="flex items-center justify-between p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                  <div className="text-xs text-slate-400">
                    Total Items: <span className="font-bold text-white">{formData.items.length}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Total PO Amount:</span>
                    <span className="text-base font-bold text-emerald-400 font-mono">
                      $
                      {formData.items
                        .reduce((acc, curr) => acc + (Number(curr.quantity) || 0) * (Number(curr.unitPrice) || 0), 0)
                        .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  Save Purchase Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Gateway Settings Modal */}
      <NotificationGatewayModal
        isOpen={showGatewayModal}
        onClose={() => setShowGatewayModal(false)}
        onSaved={loadGatewayStatus}
      />
    </div>
  );
};
