import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Boxes,
  Layers,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Plus,
  X,
  Search,
  Factory,
  ShieldCheck,
  Play,
  Package,
  Clock,
  Filter,
  AlertCircle,
  Sparkles,
  RefreshCw,
  ChevronRight,
  FileText,
  Check,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { productionApi, ProductionOrder, ProductionOrderMaterial } from '../../api/production.api';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../context/ToastContext';

type TabType = 'active' | 'pending' | 'all';

export const MaterialConsumptionPage: React.FC = () => {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { success, error: toastError } = useToast();

  const [allOrders, setAllOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [materialSearch, setMaterialSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null);

  // Quick Action Loading states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Consume Modal State
  const [consumeMaterial, setConsumeMaterial] = useState<ProductionOrderMaterial | null>(null);
  const [consumeQty, setConsumeQty] = useState<number>(0);
  const [consumeScrapQty, setConsumeScrapQty] = useState<number>(0);
  const [consumeBatch, setConsumeBatch] = useState<string>('');
  const [consumeNotes, setConsumeNotes] = useState<string>('');
  const [consumeSubmitting, setConsumeSubmitting] = useState<boolean>(false);
  const [consumeError, setConsumeError] = useState<string>('');

  // Return Modal State
  const [returnMaterial, setReturnMaterial] = useState<ProductionOrderMaterial | null>(null);
  const [returnQty, setReturnQty] = useState<number>(0);
  const [returnNotes, setReturnNotes] = useState<string>('');
  const [returnSubmitting, setReturnSubmitting] = useState<boolean>(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const res = await productionApi.getOrders({ limit: 100 });
      const ordersList: ProductionOrder[] = Array.isArray(res) ? res : (res?.data || []);
      setAllOrders(ordersList);

      // Default selection from eligible active orders
      const eligible = ordersList.filter(
        (o) => o.status === 'RELEASED' || o.status === 'IN_PROGRESS' || o.status === 'PAUSED'
      );

      if (eligible.length > 0) {
        if (!selectedOrder || !eligible.some((o) => o._id === selectedOrder._id)) {
          setSelectedOrder(eligible[0]);
        } else {
          const updated = eligible.find((o) => o._id === selectedOrder._id);
          if (updated) setSelectedOrder(updated);
        }
      } else if (ordersList.length > 0 && !selectedOrder) {
        setSelectedOrder(ordersList[0]);
      }
    } catch (err) {
      console.error('Failed to load production orders', err);
      toastError('Failed to load production orders');
    } finally {
      setLoading(false);
    }
  };

  // Filter orders by tab & search
  const filteredOrders = useMemo(() => {
    return allOrders.filter((ord) => {
      // Tab filter
      if (activeTab === 'active') {
        const isActive = ord.status === 'RELEASED' || ord.status === 'IN_PROGRESS' || ord.status === 'PAUSED';
        if (!isActive) return false;
      } else if (activeTab === 'pending') {
        const isPending = ord.status === 'APPROVED' || ord.status === 'PLANNED' || ord.status === 'DRAFT';
        if (!isPending) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const num = (ord.productionOrderNumber || '').toLowerCase();
        const itemName = (ord.productionItemId?.name || '').toLowerCase();
        const sku = (ord.productionItemId?.sku || '').toLowerCase();
        return num.includes(q) || itemName.includes(q) || sku.includes(q);
      }
      return true;
    });
  }, [allOrders, activeTab, searchQuery]);

  // Aggregate stats
  const stats = useMemo(() => {
    const active = allOrders.filter(
      (o) => o.status === 'RELEASED' || o.status === 'IN_PROGRESS' || o.status === 'PAUSED'
    );
    const pending = allOrders.filter(
      (o) => o.status === 'APPROVED' || o.status === 'PLANNED' || o.status === 'DRAFT'
    );
    const totalMaterials = active.reduce((acc, curr) => acc + (curr.materials?.length || 0), 0);
    return {
      activeCount: active.length,
      pendingCount: pending.length,
      totalMaterials,
    };
  }, [allOrders]);

  // Quick Action: Release Order
  const handleReleaseOrder = async (orderId: string, orderNumber: string) => {
    try {
      setActionLoadingId(orderId);
      await productionApi.releaseOrder(orderId);
      success(`Work order ${orderNumber} released! Raw materials reserved in warehouse inventory.`);
      await loadOrders();
      setActiveTab('active');
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to release order');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Quick Action: Approve & Release
  const handleApproveAndRelease = async (orderId: string, orderNumber: string) => {
    try {
      setActionLoadingId(orderId);
      await productionApi.approveOrder(orderId);
      await productionApi.releaseOrder(orderId);
      success(`Work order ${orderNumber} approved and released! Stock reserved successfully.`);
      await loadOrders();
      setActiveTab('active');
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to approve and release order');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Quick Action: Start Production Run
  const handleStartProduction = async (orderId: string) => {
    try {
      setActionLoadingId(orderId);
      await productionApi.startProduction(orderId);
      success('Production run started!');
      await loadOrders();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to start production run');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConsumeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !consumeMaterial) return;
    setConsumeError('');

    if (consumeQty <= 0) return setConsumeError('Quantity to consume must be greater than 0');

    // Live tolerance guard check
    const plannedWithTol = consumeMaterial.plannedQuantity * 1.2;
    if (consumeMaterial.actualConsumedQuantity + Number(consumeQty) > plannedWithTol) {
      return setConsumeError(
        `Over-consumption alert: Total consumption would exceed 20% tolerance limit (${plannedWithTol} max). Manager override required.`
      );
    }

    try {
      setConsumeSubmitting(true);
      await productionApi.consumeMaterial(selectedOrder._id, {
        itemId: consumeMaterial.itemId?._id || consumeMaterial.itemId,
        quantity: Number(consumeQty),
        batchNumber: consumeBatch || undefined,
        scrapQuantity: Number(consumeScrapQty) || 0,
        remarks: consumeNotes,
      });

      success(`Material issued successfully to order ${selectedOrder.productionOrderNumber}`);
      setConsumeMaterial(null);
      await loadOrders();
    } catch (err: any) {
      setConsumeError(err.response?.data?.message || 'Failed to consume material');
    } finally {
      setConsumeSubmitting(false);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !returnMaterial) return;
    if (returnQty <= 0) {
      toastError('Return quantity must be greater than 0');
      return;
    }

    try {
      setReturnSubmitting(true);
      await productionApi.returnMaterial(selectedOrder._id, {
        itemId: returnMaterial.itemId?._id || returnMaterial.itemId,
        quantity: Number(returnQty),
        remarks: returnNotes,
      });

      success('Material returned to warehouse inventory successfully');
      setReturnMaterial(null);
      await loadOrders();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to return material');
    } finally {
      setReturnSubmitting(false);
    }
  };

  // Filter materials within selected order
  const displayedMaterials = useMemo(() => {
    if (!selectedOrder || !selectedOrder.materials) return [];
    if (!materialSearch.trim()) return selectedOrder.materials;
    const q = materialSearch.toLowerCase();
    return selectedOrder.materials.filter((m) => {
      const name = (m.itemId?.name || '').toLowerCase();
      const sku = (m.itemId?.sku || '').toLowerCase();
      return name.includes(q) || sku.includes(q);
    });
  }, [selectedOrder, materialSearch]);

  const isOrderEligibleForIssuance =
    selectedOrder &&
    (selectedOrder.status === 'RELEASED' ||
      selectedOrder.status === 'IN_PROGRESS' ||
      selectedOrder.status === 'PAUSED');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Production Control</span>
            <span>&bull;</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-bold">Inventory Ledger Interface</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">Material Issuance & Consumption</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Shop-floor raw material issuance from warehouse inventory with 20% anti-over-consumption tolerance guards.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadOrders()}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            to="/production/orders"
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Factory className="w-4 h-4" />
            Manage Work Orders
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Top Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Issuance Orders</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.activeCount}</h3>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
              Ready for material dispatch
            </p>
          </div>
          <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Release</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.pendingCount}</h3>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
              Awaiting stock reservation
            </p>
          </div>
          <div className="w-11 h-11 bg-amber-50 dark:bg-amber-950/40 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Raw Components</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.totalMaterials}</h3>
            <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
              BOM line items being tracked
            </p>
          </div>
          <div className="w-11 h-11 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tolerance Guard</p>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">20% Anti-Wastage</h3>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
              Ledger protection active
            </p>
          </div>
          <div className="w-11 h-11 bg-blue-50 dark:bg-blue-950/40 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Work Order Selector & Filters */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Select Work Order</h2>
              <span className="text-xs text-slate-500 font-mono">
                {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Filter Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800/70 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setActiveTab('active')}
                className={`py-1.5 px-2 rounded-lg text-center transition-all ${
                  activeTab === 'active'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Active ({stats.activeCount})
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={`py-1.5 px-2 rounded-lg text-center transition-all ${
                  activeTab === 'pending'
                    ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-white shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Pending ({stats.pendingCount})
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`py-1.5 px-2 rounded-lg text-center transition-all ${
                  activeTab === 'all'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All ({allOrders.length})
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by order #, item name, sku..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>

          {/* Orders List */}
          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {filteredOrders.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <Boxes className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-semibold">No work orders in this view</p>
                {activeTab === 'active' && stats.pendingCount > 0 && (
                  <button
                    onClick={() => setActiveTab('pending')}
                    className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 font-semibold underline"
                  >
                    View {stats.pendingCount} Pending Orders &rarr;
                  </button>
                )}
              </div>
            ) : (
              filteredOrders.map((ord) => {
                const isSelected = selectedOrder?._id === ord._id;
                const isEligible = ord.status === 'RELEASED' || ord.status === 'IN_PROGRESS' || ord.status === 'PAUSED';

                return (
                  <div
                    key={ord._id}
                    onClick={() => setSelectedOrder(ord)}
                    className={`cursor-pointer w-full text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/60 border-indigo-500 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                        {ord.productionOrderNumber}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ord.status === 'IN_PROGRESS'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                            : ord.status === 'RELEASED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                            : ord.status === 'APPROVED'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {ord.status}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-slate-900 dark:text-white mt-1 truncate">
                      {ord.productionItemId?.name || 'Manufactured Item'}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                      <span>
                        Target: {ord.plannedQuantity} {ord.uomId?.code || 'Units'}
                      </span>
                      <span>{ord.materials?.length || 0} Components</span>
                    </div>

                    {/* Quick release inline button if order is approved */}
                    {ord.status === 'APPROVED' && (
                      <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                        <button
                          type="button"
                          disabled={actionLoadingId === ord._id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReleaseOrder(ord._id, ord.productionOrderNumber);
                          }}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1 shadow-sm disabled:opacity-50"
                        >
                          <Play className="w-3 h-3" />
                          Release &amp; Reserve Stock
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Material Issuance Table OR Educational Flow Guide */}
        <div className="lg:col-span-2 space-y-6">
          {selectedOrder ? (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              {/* Selected Order Header Card */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                      {selectedOrder.productionOrderNumber}
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        selectedOrder.status === 'IN_PROGRESS'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                          : selectedOrder.status === 'RELEASED'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : selectedOrder.status === 'APPROVED'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {selectedOrder.status}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-2">
                    <Factory className="w-5 h-5 text-indigo-500" />
                    {selectedOrder.productionItemId?.name || 'Production Run'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    BOM Recipe: <strong>{selectedOrder.bomId?.bomNumber || 'Standard BOM'}</strong> &bull; Target: {selectedOrder.plannedQuantity}{' '}
                    {selectedOrder.uomId?.code || 'Units'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {selectedOrder.status === 'RELEASED' && (
                    <button
                      disabled={actionLoadingId === selectedOrder._id}
                      onClick={() => handleStartProduction(selectedOrder._id)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Start Production Run
                    </button>
                  )}

                  {selectedOrder.status === 'APPROVED' && (
                    <button
                      disabled={actionLoadingId === selectedOrder._id}
                      onClick={() => handleReleaseOrder(selectedOrder._id, selectedOrder.productionOrderNumber)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Release &amp; Reserve Materials
                    </button>
                  )}

                  {selectedOrder.status === 'PLANNED' && (
                    <button
                      disabled={actionLoadingId === selectedOrder._id}
                      onClick={() => handleApproveAndRelease(selectedOrder._id, selectedOrder.productionOrderNumber)}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve &amp; Release
                    </button>
                  )}

                  <div className="flex items-center gap-1 text-[11px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2.5 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    20% Guard
                  </div>
                </div>
              </div>

              {/* Status Warning Banner if not yet released */}
              {!isOrderEligibleForIssuance && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <h4 className="font-bold text-amber-900 dark:text-amber-300">
                      Work Order Is Currently in '{selectedOrder.status}' Status
                    </h4>
                    <p className="text-amber-700 dark:text-amber-400 mt-0.5">
                      Materials can only be issued from warehouse stock when the work order is <strong>RELEASED</strong> or <strong>IN_PROGRESS</strong>. Releasing reserves the raw materials in inventory ledger.
                    </p>
                    <div className="mt-2.5 flex items-center gap-2">
                      {selectedOrder.status === 'APPROVED' ? (
                        <button
                          disabled={actionLoadingId === selectedOrder._id}
                          onClick={() => handleReleaseOrder(selectedOrder._id, selectedOrder.productionOrderNumber)}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg text-xs shadow-sm flex items-center gap-1"
                        >
                          <Play className="w-3 h-3" />
                          Click Here to Release Order Now
                        </button>
                      ) : (
                        <button
                          disabled={actionLoadingId === selectedOrder._id}
                          onClick={() => handleApproveAndRelease(selectedOrder._id, selectedOrder.productionOrderNumber)}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg text-xs shadow-sm flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          Approve &amp; Release Order Now
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Material Search and Table Header */}
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Raw Component Allocations ({selectedOrder.materials?.length || 0})
                </div>
                <div className="w-48">
                  <input
                    type="text"
                    placeholder="Filter components..."
                    value={materialSearch}
                    onChange={(e) => setMaterialSearch(e.target.value)}
                    className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Materials Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 uppercase border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Raw Component</th>
                      <th className="py-2.5 px-3">Planned Qty</th>
                      <th className="py-2.5 px-3">Reserved</th>
                      <th className="py-2.5 px-3">Consumed</th>
                      <th className="py-2.5 px-3">Scrap</th>
                      <th className="py-2.5 px-3">Progress</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {displayedMaterials.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No materials found matching criteria
                        </td>
                      </tr>
                    ) : (
                      displayedMaterials.map((mat, idx) => {
                        const pct = Math.min(
                          100,
                          Math.round((mat.actualConsumedQuantity / (mat.plannedQuantity || 1)) * 100)
                        );
                        const isOver = mat.actualConsumedQuantity > mat.plannedQuantity;
                        const isComplete = mat.actualConsumedQuantity >= mat.plannedQuantity;

                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-3">
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {mat.itemId?.name || 'Raw Component'}
                              </div>
                              <div className="text-[10px] font-mono text-slate-500">
                                {mat.itemId?.sku || mat.itemId?.itemCode || 'SKU-RAW'}
                              </div>
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">
                              {mat.plannedQuantity} {mat.uomId?.code || 'Units'}
                            </td>
                            <td className="py-3 px-3 text-indigo-600 dark:text-indigo-400 font-bold">
                              {mat.reservedQuantity || 0}
                            </td>
                            <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                              {mat.actualConsumedQuantity || 0}
                            </td>
                            <td className="py-3 px-3 text-rose-600 dark:text-rose-400 font-semibold">
                              {mat.scrapQuantity || 0}
                            </td>
                            <td className="py-3 px-3">
                              <div className="w-24">
                                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                                  <span>{pct}%</span>
                                  {isOver && (
                                    <span className="text-[9px] text-amber-600 font-bold uppercase">+Over</span>
                                  )}
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      isOver
                                        ? 'bg-amber-500'
                                        : isComplete
                                        ? 'bg-emerald-500'
                                        : 'bg-indigo-600'
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isOrderEligibleForIssuance ? (
                                  <>
                                    <button
                                      onClick={() => {
                                        setConsumeMaterial(mat);
                                        const remaining = Math.max(0, mat.plannedQuantity - mat.actualConsumedQuantity);
                                        setConsumeQty(remaining > 0 ? remaining : 1);
                                        setConsumeScrapQty(0);
                                        setConsumeBatch('');
                                        setConsumeNotes('');
                                        setConsumeError('');
                                      }}
                                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                                    >
                                      Issue Stock
                                    </button>
                                    {mat.actualConsumedQuantity > 0 && (
                                      <button
                                        onClick={() => {
                                          setReturnMaterial(mat);
                                          setReturnQty(1);
                                          setReturnNotes('');
                                        }}
                                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg transition-colors"
                                        title="Return unused stock to warehouse"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-medium italic">
                                    Release order first
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Interactive Workflow & Educational State when no order selected */
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-6">
              <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto border border-indigo-100 dark:border-indigo-900">
                <Boxes className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  No Active Released Work Orders
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Materials can only be issued from the warehouse to manufacturing runs that have been{' '}
                  <strong>approved &amp; released</strong>. Releasing locks and reserves the required inventory stock.
                </p>
              </div>

              {/* 4-Step Manufacturing Workflow Guide */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-left">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  Standard Production &amp; Material Workflow:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">1. Create Work Order</span>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Choose finished product, target quantity &amp; BOM recipe.
                    </p>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">2. Release &amp; Reserve</span>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      System automatically reserves raw stock in the warehouse.
                    </p>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">3. Material Issuance (Here)</span>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Dispatch raw items to machinists with 20% tolerance guard.
                    </p>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">4. Record Output &amp; QC</span>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Log finished goods into inventory &amp; inspect batch quality.
                    </p>
                  </div>
                </div>
              </div>

              {/* Direct Action Links */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Link
                  to="/production/orders"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
                >
                  <Factory className="w-4 h-4" />
                  Go to Work Orders &rarr;
                </Link>
                <Link
                  to="/production/boms"
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
                >
                  <FileText className="w-4 h-4" />
                  View BOM Recipes
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Consume Stock Modal */}
      {consumeMaterial && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Issue Material from Stock</h3>
                <p className="text-xs text-slate-500 font-mono">{consumeMaterial.itemId?.name || 'Raw Component'}</p>
              </div>
              <button
                onClick={() => setConsumeMaterial(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {consumeError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{consumeError}</span>
              </div>
            )}

            <form onSubmit={handleConsumeSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Consume Qty *
                  </label>
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    required
                    value={consumeQty}
                    onChange={(e) => setConsumeQty(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>Planned: {consumeMaterial.plannedQuantity}</span>
                    <span>Reserved: {consumeMaterial.reservedQuantity}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Scrap / Defect Qty
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={consumeScrapQty}
                    onChange={(e) => setConsumeScrapQty(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white"
                  />
                  <span className="text-[10px] text-slate-400">Waste during shift</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Batch / Lot Number (Optional)
                </label>
                <input
                  type="text"
                  value={consumeBatch}
                  onChange={(e) => setConsumeBatch(e.target.value)}
                  placeholder="e.g. BATCH-2026-RAW-001"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Issuance Remarks / Notes
                </label>
                <input
                  type="text"
                  value={consumeNotes}
                  onChange={(e) => setConsumeNotes(e.target.value)}
                  placeholder="Issued to Shift A machining line..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setConsumeMaterial(null)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={consumeSubmitting}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {consumeSubmitting ? 'Posting Ledger...' : 'Confirm Issuance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Material Modal */}
      {returnMaterial && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Return Material to Warehouse</h3>
                <p className="text-xs text-slate-500 font-mono">{returnMaterial.itemId?.name}</p>
              </div>
              <button
                onClick={() => setReturnMaterial(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Quantity to Return *
                </label>
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  required
                  value={returnQty}
                  onChange={(e) => setReturnQty(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white"
                />
                <span className="text-[10px] text-slate-400">
                  Currently Consumed: {returnMaterial.actualConsumedQuantity}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Return
                </label>
                <input
                  type="text"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Excess component unconsumed..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReturnMaterial(null)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={returnSubmitting}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                  {returnSubmitting ? 'Posting Return...' : 'Post Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
