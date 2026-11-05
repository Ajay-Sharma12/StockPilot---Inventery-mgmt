import React, { useState, useEffect } from 'react';
import {
  Truck,
  Package,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  ArrowRight,
  Send,
  Phone,
  Mail,
  Warehouse as WarehouseIcon,
  ShieldAlert,
  ClipboardList,
  ExternalLink,
  Plus,
  RefreshCw,
  X,
  Building,
  User,
  Hash,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { procurementApi } from '../../api/procurement.api';
import { warehouseApi } from '../../api/warehouse.api';
import { Skeleton } from '../../components/ui/Skeleton';
import { Select } from '../../components/ui/Select';

interface IncomingShipment {
  _id: string;
  poNumber: string;
  status: string;
  supplier: {
    _id: string;
    name: string;
    supplierCode?: string;
    email?: string;
    phone?: string;
  };
  warehouse: {
    _id: string;
    name: string;
    code?: string;
    address?: string;
  };
  orderDate: string;
  expectedDeliveryDate?: string;
  totalAmount: number;
  totalOrderedQty: number;
  totalReceivedQty: number;
  pendingQty: number;
  progressPercent: number;
  timingCategory: 'DUE_TODAY' | 'OVERDUE' | 'THIS_WEEK' | 'FUTURE' | 'UNSCHEDULED';
  notes?: string;
  emailSent?: boolean;
  smsSent?: boolean;
  notifiedAt?: string;
  itemsCount: number;
  items: Array<{
    _id: string;
    itemId?: {
      _id: string;
      name: string;
      sku?: string;
      itemCode?: string;
      standardCost?: number;
      qcRequired?: boolean;
    };
    description?: string;
    orderedQty: number;
    receivedQty: number;
    pendingQty: number;
    uom?: {
      name?: string;
      symbol?: string;
    };
  }>;
}

interface IncomingMetrics {
  totalIncoming: number;
  dueTodayCount: number;
  overdueCount: number;
  upcomingWeekCount: number;
  partiallyReceivedCount: number;
  totalPendingUnits: number;
}

export const IncomingPurchasesPage: React.FC = () => {
  const navigate = useNavigate();

  const [shipments, setShipments] = useState<IncomingShipment[]>([]);
  const [metrics, setMetrics] = useState<IncomingMetrics>({
    totalIncoming: 0,
    dueTodayCount: 0,
    overdueCount: 0,
    upcomingWeekCount: 0,
    partiallyReceivedCount: 0,
    totalPendingUnits: 0,
  });

  const [loading, setLoading] = useState(true);
  const [timingTab, setTimingTab] = useState<'ALL' | 'DUE_TODAY' | 'OVERDUE' | 'THIS_WEEK' | 'PARTIAL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [warehouses, setWarehouses] = useState<any[]>([]);

  // Action modals
  const [selectedShipment, setSelectedShipment] = useState<IncomingShipment | null>(null);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpPO, setFollowUpPO] = useState<IncomingShipment | null>(null);
  const [followUpEmail, setFollowUpEmail] = useState('');
  const [followUpPhone, setFollowUpPhone] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Inward Gate Pass Quick Tool
  const [showGatePassModal, setShowGatePassModal] = useState(false);
  const [gatePO, setGatePO] = useState<IncomingShipment | null>(null);
  const [gateCarrier, setGateCarrier] = useState('');
  const [gateVehicle, setGateVehicle] = useState('');
  const [gateDriverName, setGateDriverName] = useState('');
  const [gateDriverPhone, setGateDriverPhone] = useState('');
  const [gateChallan, setGateChallan] = useState('');
  const [gatePackages, setGatePackages] = useState(1);

  useEffect(() => {
    loadPipeline();
    loadWarehouses();
  }, [timingTab, warehouseFilter]);

  const loadPipeline = async () => {
    try {
      setLoading(true);
      const res = await procurementApi.getIncomingPipeline({
        timing: timingTab,
        warehouseId: warehouseFilter || undefined,
        search: searchTerm || undefined,
      });

      setShipments(res.data || []);
      if (res.metrics) {
        setMetrics(res.metrics);
      }
    } catch (err: any) {
      console.error('Failed to load incoming pipeline', err);
    } finally {
      setLoading(false);
    }
  };

  const loadWarehouses = async () => {
    try {
      const res = await warehouseApi.getWarehouses();
      const list = Array.isArray(res) ? res : res.data || [];
      setWarehouses(list);
    } catch (err) {
      console.error('Failed to load warehouses', err);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadPipeline();
  };

  const openFollowUp = (shipment: IncomingShipment) => {
    setFollowUpPO(shipment);
    setFollowUpEmail(shipment.supplier?.email || '');
    setFollowUpPhone(shipment.supplier?.phone || '');
    setFollowUpNote(`Please provide transporter name, vehicle number, and dispatch LR tracking number for PO #${shipment.poNumber}.`);
    setShowFollowUpModal(true);
    setActionErrorMsg(null);
  };

  const handleSendFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpPO) return;

    try {
      setFollowUpLoading(true);
      setActionErrorMsg(null);
      const res = await procurementApi.sendDeliveryFollowUp(followUpPO._id, {
        recipientEmail: followUpEmail.trim() || undefined,
        recipientPhone: followUpPhone.trim() || undefined,
        customNote: followUpNote.trim() || undefined,
      });

      setShowFollowUpModal(false);
      setActionSuccessMsg(res.message || 'Delivery follow-up dispatched to supplier!');
      setTimeout(() => setActionSuccessMsg(null), 6000);
    } catch (err: any) {
      setActionErrorMsg(err.response?.data?.message || err.message || 'Failed to dispatch follow-up.');
    } finally {
      setFollowUpLoading(false);
    }
  };

  const openGatePass = (shipment: IncomingShipment) => {
    setGatePO(shipment);
    setGateCarrier('');
    setGateVehicle('');
    setGateDriverName('');
    setGateDriverPhone(shipment.supplier?.phone || '');
    setGateChallan('');
    setGatePackages(1);
    setShowGatePassModal(true);
  };

  const handleProceedToDockReceive = (poId: string, challan?: string, carrier?: string, vehicle?: string) => {
    setShowGatePassModal(false);
    const params = new URLSearchParams();
    params.set('poId', poId);
    if (challan) params.set('challan', challan);
    if (carrier) params.set('carrier', carrier);
    if (vehicle) params.set('vehicle', vehicle);
    navigate(`/purchase/grns?${params.toString()}`);
  };

  const getTimingBadge = (timing: string, deliveryDate?: string) => {
    switch (timing) {
      case 'DUE_TODAY':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 animate-pulse">
            <Clock className="w-3.5 h-3.5 mr-1" /> Due Today
          </span>
        );
      case 'OVERDUE':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Delayed / Overdue
          </span>
        );
      case 'THIS_WEEK':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Calendar className="w-3.5 h-3.5 mr-1" /> Expected This Week
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            <Calendar className="w-3.5 h-3.5 mr-1" />
            {deliveryDate ? new Date(deliveryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Scheduled'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Truck className="h-7 w-7 text-indigo-400" />
            Incoming Purchases & Inbound Pipeline
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Track in-transit vendor shipments, manage inbound delivery schedules, register security gate entries, and receive materials at the warehouse dock.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => navigate('/purchase/orders')}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Package className="w-4 h-4 text-emerald-400" /> Purchase Orders
          </button>
          <button
            onClick={() => navigate('/purchase/grns')}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-1.5"
          >
            <WarehouseIcon className="w-4 h-4" /> Dock Receipts (GRN)
          </button>
        </div>
      </div>

      {/* Success / Alert Banner */}
      {actionSuccessMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-emerald-400 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pipeline Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div
          onClick={() => setTimingTab('ALL')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            timingTab === 'ALL'
              ? 'bg-indigo-950/40 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Total Inbound</span>
            <Truck className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-1.5">{metrics.totalIncoming}</div>
          <div className="text-[11px] text-slate-500 mt-1">{metrics.totalPendingUnits.toLocaleString()} pending units</div>
        </div>

        <div
          onClick={() => setTimingTab('DUE_TODAY')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            timingTab === 'DUE_TODAY'
              ? 'bg-emerald-950/40 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Due Today</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-1.5">{metrics.dueTodayCount}</div>
          <div className="text-[11px] text-emerald-500/80 mt-1">Expected at dock today</div>
        </div>

        <div
          onClick={() => setTimingTab('OVERDUE')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            timingTab === 'OVERDUE'
              ? 'bg-rose-950/40 border-rose-500/50 shadow-lg shadow-rose-500/10'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Overdue / Delayed</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 mt-1.5">{metrics.overdueCount}</div>
          <div className="text-[11px] text-rose-400/80 mt-1">Requires vendor inquiry</div>
        </div>

        <div
          onClick={() => setTimingTab('THIS_WEEK')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            timingTab === 'THIS_WEEK'
              ? 'bg-blue-950/40 border-blue-500/50 shadow-lg shadow-blue-500/10'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Next 7 Days</span>
            <Calendar className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400 mt-1.5">{metrics.upcomingWeekCount}</div>
          <div className="text-[11px] text-blue-400/80 mt-1">Scheduled for delivery</div>
        </div>

        <div
          onClick={() => setTimingTab('PARTIAL')}
          className={`p-4 rounded-xl border cursor-pointer transition-all col-span-2 md:col-span-1 ${
            timingTab === 'PARTIAL'
              ? 'bg-amber-950/40 border-amber-500/50 shadow-lg shadow-amber-500/10'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Partial Receipts</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-1.5">{metrics.partiallyReceivedCount}</div>
          <div className="text-[11px] text-amber-400/80 mt-1">Remaining lines awaiting</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search PO #, supplier name, item..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </form>

        <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
          <div className="w-full sm:w-64">
            <Select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              placeholder="All Receiving Warehouses"
              options={[
                { value: '', label: 'All Receiving Warehouses' },
                ...warehouses.map((w) => ({
                  value: w._id,
                  label: `${w.name} (${w.code})`,
                })),
              ]}
              variant="indigo"
              size="sm"
            />
          </div>

          <button
            onClick={() => loadPipeline()}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700"
            title="Refresh Inbound Pipeline"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Inbound Shipment List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-indigo-400" />
            Scheduled Inbound Deliveries ({shipments.length})
          </h3>
          <span className="text-xs text-slate-500">Live dock queue updated real-time</span>
        </div>

        {loading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-16 w-full bg-slate-800/60 rounded-lg" />
            <Skeleton className="h-16 w-full bg-slate-800/60 rounded-lg" />
            <Skeleton className="h-16 w-full bg-slate-800/60 rounded-lg" />
          </div>
        ) : shipments.length === 0 ? (
          <div className="p-12 text-center">
            <Truck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h4 className="text-base font-semibold text-white">No Inbound Shipments Found</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              There are no purchase orders matching your selected timing filter. Approved and dispatched POs will automatically queue here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {shipments.map((shipment) => {
              const deliveryDateStr = shipment.expectedDeliveryDate
                ? new Date(shipment.expectedDeliveryDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'Not specified';

              return (
                <div
                  key={shipment._id}
                  className="p-5 hover:bg-slate-850/50 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  {/* Left Column: PO & Supplier Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-base font-mono font-bold text-indigo-400">{shipment.poNumber}</span>
                      {getTimingBadge(shipment.timingCategory, shipment.expectedDeliveryDate)}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                        {shipment.status === 'PARTIALLY_RECEIVED' ? 'Partially Received' : 'Awaiting Arrival'}
                      </span>
                    </div>

                    <div className="mt-2.5 flex items-center gap-4 text-xs text-slate-300 flex-wrap">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        {shipment.supplier?.name || 'Unknown Supplier'}
                      </span>
                      <span className="text-slate-500">|</span>
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <WarehouseIcon className="w-3.5 h-3.5 text-slate-500" />
                        Destination: <strong className="text-slate-200">{shipment.warehouse?.name}</strong>
                      </span>
                      <span className="text-slate-500">|</span>
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        Expected Date: <strong className="text-slate-200">{deliveryDateStr}</strong>
                      </span>
                    </div>

                    {/* Items preview preview chips */}
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      {shipment.items.slice(0, 3).map((it, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 text-[11px] bg-slate-800/80 px-2 py-0.5 rounded text-slate-300 border border-slate-700/60"
                        >
                          <span className="font-medium text-white">{it.itemId?.name || it.description}</span>
                          <span className="text-slate-500">
                            ({it.receivedQty}/{it.orderedQty} {it.uom?.symbol || 'pcs'})
                          </span>
                        </span>
                      ))}
                      {shipment.items.length > 3 && (
                        <span className="text-[11px] text-slate-500">+{shipment.items.length - 3} more lines</span>
                      )}
                    </div>
                  </div>

                  {/* Middle Column: Receiving Progress Bar */}
                  <div className="w-full lg:w-48 flex flex-col justify-center">
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="text-slate-400">Received Units</span>
                      <span className="font-semibold text-white">
                        {shipment.totalReceivedQty} / {shipment.totalOrderedQty}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          shipment.progressPercent === 100
                            ? 'bg-emerald-500'
                            : shipment.progressPercent > 0
                            ? 'bg-indigo-500'
                            : 'bg-slate-700'
                        }`}
                        style={{ width: `${shipment.progressPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                      <span>{shipment.progressPercent}% complete</span>
                      <span className="font-medium text-amber-400">{shipment.pendingQty} pending</span>
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <button
                      onClick={() => openFollowUp(shipment)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5"
                      title="Send delivery inquiry & tracking request email/SMS to supplier"
                    >
                      <Send className="w-3.5 h-3.5 text-indigo-400" />
                      Follow-up
                    </button>

                    <button
                      onClick={() => openGatePass(shipment)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5"
                      title="Register security gate entry & vehicle challan"
                    >
                      <Truck className="w-3.5 h-3.5 text-blue-400" />
                      Gate Inward
                    </button>

                    <button
                      onClick={() => handleProceedToDockReceive(shipment._id)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5"
                    >
                      <WarehouseIcon className="w-3.5 h-3.5" />
                      Receive at Dock
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Follow-up / Supplier Reminder Modal */}
      {showFollowUpModal && followUpPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-indigo-400" />
                  Supplier Delivery Follow-up: {followUpPO.poNumber}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Send automated inquiry email & SMS asking for dispatch ETA and LR tracking number.
                </p>
              </div>
              <button onClick={() => setShowFollowUpModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionErrorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs mb-4">
                {actionErrorMsg}
              </div>
            )}

            <form onSubmit={handleSendFollowUp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Supplier Name</label>
                <input
                  type="text"
                  disabled
                  value={followUpPO.supplier?.name}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 opacity-80"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Recipient Email</label>
                  <input
                    type="email"
                    value={followUpEmail}
                    onChange={(e) => setFollowUpEmail(e.target.value)}
                    placeholder="supplier@domain.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Recipient Mobile (SMS)</label>
                  <input
                    type="text"
                    value={followUpPhone}
                    onChange={(e) => setFollowUpPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Inquiry Note / Instructions</label>
                <textarea
                  rows={3}
                  value={followUpNote}
                  onChange={(e) => setFollowUpNote(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFollowUpModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={followUpLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className={`w-3.5 h-3.5 ${followUpLoading ? 'animate-spin' : ''}`} />
                  {followUpLoading ? 'Sending Follow-up...' : 'Dispatch Follow-up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inward Gate Pass Modal */}
      {showGatePassModal && gatePO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Truck className="w-5 h-5 text-blue-400" />
                  Security Gate Inward Entry (Gate Pass)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Record vehicle arrival at gate before routing to dock bay for unloading.
                </p>
              </div>
              <button onClick={() => setShowGatePassModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs flex justify-between items-center">
                <div>
                  <span className="text-slate-500 block">Purchase Order:</span>
                  <span className="font-mono font-bold text-indigo-400 text-sm">{gatePO.poNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Supplier:</span>
                  <span className="font-semibold text-slate-200">{gatePO.supplier?.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Destination:</span>
                  <span className="font-semibold text-slate-200">{gatePO.warehouse?.name}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Vehicle Number <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={gateVehicle}
                    onChange={(e) => setGateVehicle(e.target.value.toUpperCase())}
                    placeholder="e.g. MH-12-AB-1234"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Transporter / Carrier Name</label>
                  <input
                    type="text"
                    value={gateCarrier}
                    onChange={(e) => setGateCarrier(e.target.value)}
                    placeholder="e.g. VRL Logistics / Blue Dart"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Delivery Challan #</label>
                  <input
                    type="text"
                    value={gateChallan}
                    onChange={(e) => setGateChallan(e.target.value)}
                    placeholder="DC-98765"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Package / Box Count</label>
                  <input
                    type="number"
                    min={1}
                    value={gatePackages}
                    onChange={(e) => setGatePackages(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Driver Name</label>
                  <input
                    type="text"
                    value={gateDriverName}
                    onChange={(e) => setGateDriverName(e.target.value)}
                    placeholder="Driver full name"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Driver Mobile</label>
                  <input
                    type="text"
                    value={gateDriverPhone}
                    onChange={(e) => setGateDriverPhone(e.target.value)}
                    placeholder="Driver phone number"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowGatePassModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleProceedToDockReceive(gatePO._id, gateChallan, gateCarrier, gateVehicle)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-md transition-all flex items-center gap-1.5"
                >
                  <WarehouseIcon className="w-3.5 h-3.5" />
                  Proceed to Dock Unloading & Receive
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
