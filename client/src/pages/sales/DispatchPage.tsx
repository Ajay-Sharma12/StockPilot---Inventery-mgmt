import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Warehouse as WarehouseIcon,
  Calendar,
  X,
  AlertCircle,
  ShieldCheck,
  User,
  Phone,
  Barcode,
  ArrowRight,
  Boxes,
  Printer,
  QrCode,
  Download,
} from 'lucide-react';
import { salesApi, Dispatch, SalesOrder, Package } from '../../api/sales.api';
import { useToast } from '../../context/ToastContext';
import { downloadElementAsPdf } from '../../utils/pdfExport';
import { Skeleton } from '../../components/ui/Skeleton';

export const DispatchPage: React.FC = () => {
  const { success: toastSuccess, error: toastError } = useToast();
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDsp, setSelectedDsp] = useState<Dispatch | null>(null);
  const [showPrintChallanModal, setShowPrintChallanModal] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Creation State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [ordersWithPackages, setOrdersWithPackages] = useState<SalesOrder[]>([]);
  const [availablePackages, setAvailablePackages] = useState<Package[]>([]);
  const [selectedSOId, setSelectedSOId] = useState('');

  const [formData, setFormData] = useState({
    salesOrderId: '',
    packageIds: [] as string[],
    carrier: '',
    vehicleNumber: '',
    driverName: '',
    driverContact: '',
    trackingNumber: '',
    remarks: '',
  });

  const [showDispatchConfirmModal, setShowDispatchConfirmModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadDispatches();
  }, [statusFilter]);

  const loadDispatches = async () => {
    try {
      setLoading(true);
      const res = await salesApi.getDispatches({
        status: statusFilter || undefined,
        limit: 50,
      });
      setDispatches(res.data || []);
    } catch (err) {
      console.error('Failed to load dispatches', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = async () => {
    try {
      setFormData({
        salesOrderId: '',
        packageIds: [],
        carrier: '',
        vehicleNumber: '',
        driverName: '',
        driverContact: '',
        trackingNumber: '',
        remarks: '',
      });
      setShowCreateModal(true);
      // Fetch PACKED packages
      const res = await salesApi.getPackages({ status: 'PACKED', limit: 50 });
      setAvailablePackages(res.data || []);
    } catch (err) {
      console.error('Failed to load packed packages', err);
    }
  };

  const handleCreateDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.salesOrderId || formData.packageIds.length === 0) {
      toastError('Please select a Sales Order and at least one packed container');
      return;
    }
    try {
      setActionLoading(true);
      await salesApi.createDispatch(formData);
      toastSuccess('Dispatch shipment record created successfully!');
      setShowCreateModal(false);
      await loadDispatches();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to create dispatch');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDispatchOrder = async () => {
    if (!selectedDsp) return;
    try {
      setActionLoading(true);
      await salesApi.dispatchOrder(selectedDsp._id);
      toastSuccess(`Dispatch ${selectedDsp.dispatchNumber} completed! Inventory ledger updated.`);
      setShowDispatchConfirmModal(false);
      await loadDispatches();
      const updated = await salesApi.getDispatchById(selectedDsp._id);
      setSelectedDsp(updated);
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to dispatch shipment');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredDispatches = (Array.isArray(dispatches) ? dispatches : []).filter((d) => {
    const matches =
      d.dispatchNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.salesOrderId?.soNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.carrier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.vehicleNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    return matches;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Truck className="w-6 h-6 text-emerald-400" />
            <span>Outbound Dispatches</span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Carrier assignment, shipment verification &amp; physical inventory issue
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-emerald-600/20 transition self-start"
        >
          <Plus className="w-4 h-4" />
          <span>New Dispatch Shipment</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl p-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search Dispatch #, SO #, Carrier, Vehicle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 text-white pl-9 pr-3 py-1.5 text-xs rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['', 'READY', 'DISPATCHED', 'DELIVERED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {st || 'All Dispatches'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${selectedDsp ? 'lg:col-span-2' : 'lg:col-span-3'} bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl overflow-hidden shadow-sm`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/50 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Dispatch #</th>
                  <th className="py-3 px-4">Sales Order</th>
                  <th className="py-3 px-4">Carrier</th>
                  <th className="py-3 px-4">Vehicle #</th>
                  <th className="py-3 px-4">Tracking #</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="hover:bg-slate-800/20">
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-24 bg-slate-800" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-20 bg-slate-800" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-28 bg-slate-800" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-24 bg-slate-800" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-28 bg-slate-800" /></td>
                      <td className="py-3.5 px-4 text-center"><Skeleton className="h-5 w-20 rounded-full mx-auto bg-slate-800" /></td>
                      <td className="py-3.5 px-4 text-right"><Skeleton className="h-7 w-14 rounded ml-auto bg-slate-800" /></td>
                    </tr>
                  ))
                ) : filteredDispatches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-500">
                      No dispatches found.
                    </td>
                  </tr>
                ) : (
                  filteredDispatches.map((dsp) => (
                    <tr
                      key={dsp._id}
                      onClick={() => setSelectedDsp(dsp)}
                      className={`cursor-pointer transition hover:bg-slate-800/40 ${
                        selectedDsp?._id === dsp._id ? 'bg-emerald-600/10 border-l-2 border-emerald-500' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-bold text-white">{dsp.dispatchNumber}</td>
                      <td className="py-3.5 px-4 text-indigo-400 font-semibold">{dsp.salesOrderId?.soNumber || 'SO'}</td>
                      <td className="py-3.5 px-4 text-slate-300 font-medium">{dsp.carrier || 'Freight Line'}</td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono">{dsp.vehicleNumber || '-'}</td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">{dsp.trackingNumber || '-'}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                          dsp.status === 'DISPATCHED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          dsp.status === 'READY' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                          dsp.status === 'DELIVERED' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                          'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {dsp.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDsp(dsp);
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition"
                          >
                            View
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDsp(dsp);
                              setShowPrintChallanModal(true);
                            }}
                            title="Print Delivery Challan"
                            className="p-1 text-slate-400 hover:text-emerald-400 rounded hover:bg-slate-800 transition"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Dispatch Details */}
        {selectedDsp && (
          <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-5 shadow-lg space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Dispatch Shipment</div>
                <h3 className="text-lg font-bold text-white mt-0.5">{selectedDsp.dispatchNumber}</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowPrintChallanModal(true)}
                  title="Print Delivery Challan / Consignment Note"
                  className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium transition flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Challan</span>
                </button>
                <button
                  onClick={() => setSelectedDsp(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Sales Order:</span>
                <span className="font-semibold text-indigo-400">{selectedDsp.salesOrderId?.soNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Carrier:</span>
                <span className="font-semibold text-white">{selectedDsp.carrier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Vehicle #:</span>
                <span className="text-slate-200 font-mono">{selectedDsp.vehicleNumber || 'Unassigned'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Driver:</span>
                <span className="text-slate-200">{selectedDsp.driverName || '-'} ({selectedDsp.driverContact || '-'})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Inventory Status:</span>
                <span className={`font-semibold ${selectedDsp.inventoryIssued ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {selectedDsp.inventoryIssued ? 'Physical Stock Issued' : 'Reserved in Warehouse'}
                </span>
              </div>
            </div>

            {/* Packages in this dispatch */}
            <div>
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Containers ({selectedDsp.packageIds.length})
              </div>
              <div className="space-y-1.5">
                {selectedDsp.packageIds.map((p, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-950/40 rounded-lg border border-slate-800/60 text-xs flex items-center justify-between">
                    <span className="font-medium text-white">{p.packageNumber || `Package #${idx + 1}`}</span>
                    <span className="text-slate-400 font-mono text-[11px]">{p.packingMaterial || 'Container'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dispatch Action */}
            {selectedDsp.status === 'READY' && !selectedDsp.inventoryIssued && (
              <div className="pt-2 border-t border-slate-800">
                <button
                  onClick={() => setShowDispatchConfirmModal(true)}
                  disabled={actionLoading}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition flex items-center justify-center gap-1.5"
                >
                  <Truck className="w-4 h-4" />
                  <span>Dispatch Shipment &amp; Issue Inventory</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showDispatchConfirmModal && selectedDsp && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-emerald-400" />
              <span>Confirm Outbound Stock Issue</span>
            </h3>
            <p className="text-xs text-slate-300">
              Confirming dispatch <strong className="text-white">{selectedDsp.dispatchNumber}</strong> will immediately execute an immutable inventory ledger transaction:
            </p>
            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 text-xs space-y-1.5 text-slate-400">
              <div className="flex items-center gap-2 text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>Physical stock deducted from warehouse</span>
              </div>
              <div className="flex items-center gap-2 text-sky-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>Reserved quantity cleared for fulfilled items</span>
              </div>
              <div className="flex items-center gap-2 text-indigo-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>Sales order status updated to fulfilled</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDispatchConfirmModal(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDispatchOrder}
                disabled={actionLoading}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-semibold"
              >
                {actionLoading ? 'Issuing stock...' : 'Confirm Outbound Issue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-400" />
                <span>Create Outbound Dispatch Shipment</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDispatch} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Select Packed Container(s) to Dispatch *</label>
                {(Array.isArray(availablePackages) ? availablePackages : []).length === 0 ? (
                  <p className="text-slate-500 italic p-3 bg-slate-50 dark:bg-slate-950/60 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                    No containers currently in 'PACKED' status. Visit the Packaging Station first.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {(Array.isArray(availablePackages) ? availablePackages : []).map((pkg) => (
                      <label
                        key={pkg._id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          formData.packageIds.includes(pkg._id)
                            ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-600/50'
                            : 'bg-white dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.packageIds.includes(pkg._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                salesOrderId: pkg.salesOrderId?._id || pkg.salesOrderId,
                                packageIds: [...formData.packageIds, pkg._id],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                packageIds: formData.packageIds.filter((id) => id !== pkg._id),
                              });
                            }
                          }}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="flex-1">
                          <div className="font-bold text-white">{pkg.packageNumber}</div>
                          <div className="text-[10px] text-slate-400">
                            SO: {pkg.salesOrderId?.soNumber || 'SO'} &bull; Customer: {pkg.customerId?.name || 'Customer'}
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold text-emerald-400">{pkg.totalWeight || 0} kg</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Freight Carrier *</label>
                  <input
                    type="text"
                    required
                    value={formData.carrier}
                    onChange={(e) => setFormData({ ...formData, carrier: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                    placeholder="e.g. Apex Express Freight, FedEx, DHL"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Vehicle License / Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.vehicleNumber}
                    onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none font-mono"
                    placeholder="e.g. IL-TRK-7749"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Driver Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.driverName}
                    onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                    placeholder="e.g. Robert Lang"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Driver Phone / Contact *</label>
                  <input
                    type="text"
                    required
                    value={formData.driverContact}
                    onChange={(e) => setFormData({ ...formData, driverContact: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Tracking Number</label>
                <input
                  type="text"
                  value={formData.trackingNumber}
                  onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none font-mono"
                  placeholder="e.g. TRK-APX-899120"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || formData.packageIds.length === 0}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold shadow transition-all duration-150 flex items-center justify-center gap-1.5 ${
                    actionLoading || formData.packageIds.length === 0
                      ? 'bg-slate-200 text-slate-500 border border-slate-300 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700 cursor-not-allowed shadow-none'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 active:scale-[0.98]'
                  }`}
                >
                  {actionLoading ? 'Creating...' : 'Create Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Delivery Challan Modal */}
      {showPrintChallanModal && selectedDsp && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div
            id="printable-delivery-challan"
            className="bg-white text-slate-900 rounded-2xl max-w-3xl w-full p-8 shadow-2xl space-y-6 my-auto print:m-0 print:p-4 print:shadow-none printable-document"
          >
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
              <div>
                <div className="text-2xl font-black text-slate-900">StockPilot ERP</div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                  Logistics &bull; Delivery Challan / Consignment Note
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Official Goods Dispatch &amp; Transit Authorization (Rule 55 Compliant)
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider ${
                    selectedDsp.status === 'DISPATCHED'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                  }`}
                >
                  {selectedDsp.status}
                </span>
                <div className="text-xl font-mono font-bold text-slate-900 mt-2">
                  {selectedDsp.dispatchNumber}
                </div>
                <div className="text-xs text-slate-500">
                  Dispatch Date: {new Date(selectedDsp.dispatchDate).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Consignee & Order Metadata */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="font-bold text-slate-500 uppercase text-[10px]">Consignee / Deliver To:</div>
                <div className="text-sm font-bold text-slate-900">
                  {selectedDsp.customerId?.name || 'Customer Commercial Facility'}
                </div>
                <div className="text-slate-600">
                  {selectedDsp.shippingAddress?.street || 'Warehouse Receiving Dock'},{' '}
                  {selectedDsp.shippingAddress?.city || 'Industrial Park'},{' '}
                  {selectedDsp.shippingAddress?.state || ''}{' '}
                  {selectedDsp.shippingAddress?.postalCode || ''}
                </div>
                <div className="text-slate-500 text-[11px]">
                  Tax/GST ID: {selectedDsp.customerId?.gstin || selectedDsp.customerId?.taxId || 'N/A'}
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="font-bold text-slate-500 uppercase text-[10px]">Carrier &amp; Transit Info:</div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Carrier:</span>
                  <span className="font-bold text-slate-900">{selectedDsp.carrier || 'Dedicated Transporter'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Vehicle #:</span>
                  <span className="font-mono font-bold text-indigo-700">{selectedDsp.vehicleNumber || 'Unassigned'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Driver:</span>
                  <span className="text-slate-800">{selectedDsp.driverName || '-'} ({selectedDsp.driverContact || '-'})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">LR / Tracking #:</span>
                  <span className="font-mono text-slate-900 font-bold">{selectedDsp.trackingNumber || 'PENDING-LR'}</span>
                </div>
              </div>
            </div>

            {/* Sales Order Reference */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
              <div>
                <span className="text-slate-500 font-medium">Sales Order Ref: </span>
                <span className="font-bold text-slate-900">{selectedDsp.salesOrderId?.soNumber || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Inventory Issue: </span>
                <span className={`font-semibold ${selectedDsp.inventoryIssued ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {selectedDsp.inventoryIssued ? 'PHYSICALLY DEDUCTED' : 'RESERVED IN STOCK'}
                </span>
              </div>
            </div>

            {/* Packages Manifest */}
            <div>
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Consignment Packages Manifest ({(selectedDsp.packageIds?.length || 0)} Packages)
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="p-3">Package #</th>
                      <th className="p-3">Packaging Type</th>
                      <th className="p-3">Gross Weight</th>
                      <th className="p-3">Tare / Net</th>
                      <th className="p-3 text-right">Items Included</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(Array.isArray(selectedDsp.packageIds) ? selectedDsp.packageIds : []).map((pkg, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-slate-900">
                          {pkg.packageNumber || `PKG-${idx + 1}`}
                        </td>
                        <td className="p-3 text-slate-700">{pkg.packingMaterial || 'Standard Carton'}</td>
                        <td className="p-3 text-slate-700 font-semibold">{pkg.grossWeightKg ? `${pkg.grossWeightKg} kg` : 'Standard'}</td>
                        <td className="p-3 text-slate-500">{pkg.tareWeightKg ? `${pkg.tareWeightKg} kg` : '-'}</td>
                        <td className="p-3 text-right font-medium text-slate-800">
                          {pkg.items ? `${pkg.items.length} line item(s)` : 'Fulfilled'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Verification Barcode / QR Block */}
            <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-800">Outbound Delivery Challan Verification</div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  DISPATCH-ID: {selectedDsp._id} &bull; SECURE MANIFEST
                </div>
                <div className="text-[10px] text-slate-400 mt-1 italic">
                  Certified that the goods described above are being transported under valid commercial authorization.
                </div>
              </div>
              <div className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-center shadow-sm">
                <QrCode className="w-10 h-10 text-slate-900" />
              </div>
            </div>

            {/* Official Signatures */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-200 text-xs">
              <div>
                <div className="h-10 border-b border-slate-300"></div>
                <div className="mt-1 font-semibold text-slate-700">Prepared By (Logistics Officer)</div>
              </div>
              <div>
                <div className="h-10 border-b border-slate-300"></div>
                <div className="mt-1 font-semibold text-slate-700">Driver / Transporter Signature</div>
              </div>
              <div>
                <div className="h-10 border-b border-slate-300"></div>
                <div className="mt-1 font-semibold text-slate-700">Consignee Receiver (Stamp &amp; Sign)</div>
              </div>
            </div>

            {/* Actions footer */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 print:hidden">
              <button
                type="button"
                onClick={() => setShowPrintChallanModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setDownloadingPdf(true);
                    await downloadElementAsPdf('printable-delivery-challan', `${selectedDsp.dispatchNumber}_Delivery_Challan.pdf`);
                  } finally {
                    setDownloadingPdf(false);
                  }
                }}
                disabled={downloadingPdf}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-2 transition"
              >
                <Download className="w-4 h-4" />
                <span>{downloadingPdf ? 'Exporting PDF...' : 'Download PDF'}</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-2 transition"
              >
                <Printer className="w-4 h-4" />
                <span>Print Delivery Challan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
