import React, { useState, useEffect } from 'react';
import {
  Factory,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  RotateCw,
  Boxes,
  CheckCheck,
  X,
  Clock,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Layers,
  Compass,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ExternalLink,
} from 'lucide-react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  productionApi,
  ProductionOrder,
  ProductionOrderStatus,
  ProductionPriority,
  BOM,
} from '../../api/production.api';
import { warehouseApi, Warehouse } from '../../api/warehouse.api';
import { usePermissions } from '../../hooks/usePermissions';
import { Skeleton } from '../../components/ui/Skeleton';
import { Select } from '../../components/ui/Select';
import { useToast } from '../../context/ToastContext';

export const ProductionOrdersPage: React.FC = () => {
  const { can } = usePermissions();
  const { success, error: toastError } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Selected Order for Side Drawer Inspector
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null);

  // Master Data for Create Modal
  const [boms, setBoms] = useState<BOM[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Form State
  const [createForm, setCreateForm] = useState({
    bomId: '',
    plannedQuantity: 10,
    warehouseId: '',
    priority: 'HIGH' as ProductionPriority,
    plannedStartDate: '',
    plannedEndDate: '',
    productionLocation: 'Plant 1 Bay A',
    notes: '',
  });

  // Action Modals
  const [pauseModalOrder, setPauseModalOrder] = useState<ProductionOrder | null>(null);
  const [pauseReason, setPauseReason] = useState('Tooling calibration and maintenance');

  const [outputModalOrder, setOutputModalOrder] = useState<ProductionOrder | null>(null);
  const [outputProducedQty, setOutputProducedQty] = useState(0);
  const [outputRejectedQty, setOutputRejectedQty] = useState(0);
  const [outputAcceptedQty, setOutputAcceptedQty] = useState(0);
  const [outputScrapQty, setOutputScrapQty] = useState(0);
  const [outputBatchNumber, setOutputBatchNumber] = useState('');
  const [outputNotes, setOutputNotes] = useState('');
  const [outputSubmitting, setOutputSubmitting] = useState(false);

  const handleProducedChange = (val: number) => {
    setOutputProducedQty(val);
    const rej = Number(outputRejectedQty) || 0;
    setOutputAcceptedQty(Math.max(0, val - rej));
  };

  const handleRejectedChange = (val: number) => {
    setOutputRejectedQty(val);
    const prod = Number(outputProducedQty) || 0;
    setOutputAcceptedQty(Math.max(0, prod - val));
  };

  const handleAcceptedChange = (val: number) => {
    setOutputAcceptedQty(val);
    const prod = Number(outputProducedQty) || 0;
    setOutputRejectedQty(Math.max(0, prod - val));
  };

  // Costing & Material Variance Modal State
  const [costingModalOrder, setCostingModalOrder] = useState<ProductionOrder | null>(null);
  const [costingData, setCostingData] = useState<any>(null);
  const [costingLoading, setCostingLoading] = useState(false);

  const handleOpenCosting = async (order: ProductionOrder) => {
    setCostingModalOrder(order);
    setCostingLoading(true);
    setCostingData(null);
    try {
      const data = await productionApi.getOrderCosting(order._id);
      setCostingData(data);
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to calculate order costing');
    } finally {
      setCostingLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    loadPrerequisites();
  }, [statusFilter]);

  // Check if routed from MRP planning with prefill state
  useEffect(() => {
    const state = location.state as any;
    if (state?.prefillBomId) {
      setCreateForm((prev) => ({
        ...prev,
        bomId: state.prefillBomId,
        plannedQuantity: state.prefillPlannedQty || 10,
        warehouseId: state.prefillWarehouseId || '',
      }));
      setIsCreateModalOpen(true);
    }
  }, [location.state]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;
      const res = await productionApi.getOrders(params);
      const ordersList = Array.isArray(res) ? res : (res?.data || []);
      setOrders(ordersList);
    } catch (err) {
      console.error('Failed to load orders', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPrerequisites = async () => {
    try {
      const [bomsRes, whsRes] = await Promise.all([
        productionApi.getBOMs(),
        warehouseApi.getWarehouses(),
      ]);
      const allBoms = Array.isArray(bomsRes) ? bomsRes : (bomsRes?.data || []);
      const whs = whsRes || [];
      setBoms(allBoms);
      setWarehouses(whs);

      const activeBoms = allBoms.filter((b: any) => b.status === 'ACTIVE');
      const defaultBom = activeBoms.length > 0 ? activeBoms[0] : allBoms[0];

      if (!createForm.bomId && defaultBom) {
        setCreateForm((prev) => ({ ...prev, bomId: defaultBom._id }));
      }
      if (!createForm.warehouseId && whs.length > 0) {
        setCreateForm((prev) => ({ ...prev, warehouseId: whs[0]._id }));
      }
    } catch (err) {
      console.error('Failed to load order prerequisites', err);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadOrders();
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    if (!createForm.bomId) return setModalError('Active BOM recipe is required');
    if (createForm.plannedQuantity <= 0) return setModalError('Planned quantity must be greater than 0');
    if (!createForm.warehouseId) return setModalError('Warehouse is required');

    const selectedBom = boms.find((b) => b._id === createForm.bomId);
    if (!selectedBom) return setModalError('Selected BOM not found');

    try {
      setModalSubmitting(true);
      await productionApi.createOrder({
        bomId: createForm.bomId,
        productionItemId: selectedBom.finishedItemId?._id || selectedBom.finishedItemId,
        plannedQuantity: Number(createForm.plannedQuantity),
        warehouseId: createForm.warehouseId,
        priority: createForm.priority,
        productionLocation: createForm.productionLocation,
        plannedStartDate: createForm.plannedStartDate || undefined,
        plannedEndDate: createForm.plannedEndDate || undefined,
        notes: createForm.notes,
      });

      setIsCreateModalOpen(false);
      loadOrders();
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Failed to create work order');
    } finally {
      setModalSubmitting(false);
    }
  };

  // Execution actions
  const handleApprove = async (id: string) => {
    try {
      await productionApi.approveOrder(id);
      success('Order approved successfully');
      loadOrders();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to approve order');
    }
  };

  const handleRelease = async (id: string) => {
    try {
      await productionApi.releaseOrder(id);
      success('Order released & materials reserved');
      loadOrders();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to release order');
    }
  };

  const handleStart = async (id: string) => {
    try {
      await productionApi.startProduction(id);
      success('Production run started');
      loadOrders();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to start production run');
    }
  };

  const handlePauseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pauseModalOrder) return;
    try {
      await productionApi.pauseProduction(pauseModalOrder._id, pauseReason);
      success('Production paused');
      setPauseModalOrder(null);
      loadOrders();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to pause production');
    }
  };

  const handleResume = async (id: string) => {
    try {
      await productionApi.resumeProduction(id);
      success('Production resumed');
      loadOrders();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to resume production');
    }
  };

  const handleOutputSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outputModalOrder) return;
    try {
      setOutputSubmitting(true);
      const res = await productionApi.recordOutput(outputModalOrder._id, {
        producedQuantity: Number(outputProducedQty),
        acceptedQuantity: Number(outputAcceptedQty),
        rejectedQuantity: Number(outputRejectedQty),
        scrapQuantity: Number(outputScrapQty) || 0,
        batchNumber: outputBatchNumber || undefined,
        notes: outputNotes,
      });

      setOutputModalOrder(null);
      success(
        `Work order completed! Batch ${res.batch?.batchNumber || res.order.batchNumber} logged. QC Inspection ${res.qcInspection.qcNumber} auto-spawned!`
      );
      loadOrders();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to record output and complete order');
    } finally {
      setOutputSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Production Control</span>
            <span>&bull;</span>
            <span className="text-indigo-600 dark:text-indigo-400">Execution Pipeline</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">Manufacturing Work Orders</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage work order lifecycle: Planned &rarr; Approved &rarr; Released (Stock Reserved) &rarr; Active &rarr; Completed
          </p>
        </div>

        {can('production.create') && (
          <button
            onClick={() => {
              setModalError('');
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            Create Work Order
          </button>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Work Orders</span>
          <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">
            {orders.length}
          </span>
          <span className="text-xs text-slate-400 mt-1 block">Lifetime manufacturing orders</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider block">Shop Floor Active</span>
          <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 block">
            {orders.filter((o) => o.status === 'IN_PROGRESS').length}
          </span>
          <span className="text-xs text-slate-400 mt-1 block">In-progress runs</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-blue-500 uppercase tracking-wider block">Stock Reserved</span>
          <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1 block">
            {orders.filter((o) => o.status === 'RELEASED').length}
          </span>
          <span className="text-xs text-slate-400 mt-1 block">Released & materials locked</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-emerald-500 uppercase tracking-wider block">Completed Yield</span>
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
            {orders.filter((o) => o.status === 'COMPLETED').length}
          </span>
          <span className="text-xs text-slate-400 mt-1 block">Completed work orders</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <form onSubmit={handleSearch} className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search order #, batch #..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </form>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs">
          {['ALL', 'PLANNED', 'APPROVED', 'RELEASED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-lg font-semibold transition-all whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Orders Table & Side Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Orders Table Container */}
        <div className={`${selectedOrder ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 uppercase border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Order Number</th>
                  <th className="py-3.5 px-4">Manufactured Item</th>
                  <th className="py-3.5 px-4">BOM Spec</th>
                  <th className="py-3.5 px-4">Planned Qty</th>
                  <th className="py-3.5 px-4">Yield / Scrap</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="hover:bg-slate-800/20">
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-28 bg-slate-800" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-32 bg-slate-800" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-20 bg-slate-800" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-24 bg-slate-800" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-20 bg-slate-800" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-28 bg-slate-800" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-5 w-20 rounded-full bg-slate-800" /></td>
                      <td className="py-3.5 px-4 text-right"><Skeleton className="h-8 w-16 rounded ml-auto bg-slate-800" /></td>
                    </tr>
                  ))
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No work orders found matching filter.
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const isSelected = selectedOrder?._id === order._id;
                    return (
                      <tr
                        key={order._id}
                        onClick={() => setSelectedOrder(isSelected ? null : order)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-l-4 border-indigo-600'
                            : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {order.productionOrderNumber}
                          {order.batchNumber && (
                            <span className="block text-[10px] text-purple-600 dark:text-purple-400 font-normal">
                              Batch: {order.batchNumber}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {order.productionItemId?.name || 'Manufactured Item'}
                          </div>
                          <div className="text-xs text-slate-500 font-mono">
                            {order.productionItemId?.sku || 'SKU-001'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                            <Layers className="w-3.5 h-3.5 text-slate-400" />
                            {order.bomId?.bomNumber || 'BOM-001'} (v{order.bomVersion || 1})
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                          {order.plannedQuantity} {order.uomId?.code || 'PCS'}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-xs">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              {order.yieldQuantity || 0}
                            </span>{' '}
                            yield /{' '}
                            <span className="text-rose-600 dark:text-rose-400">{order.scrapQuantity || 0}</span> scrap
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                              order.priority === 'URGENT'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400'
                                : order.priority === 'HIGH'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {order.priority}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                              order.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                                : order.status === 'IN_PROGRESS'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 animate-pulse'
                                : order.status === 'RELEASED'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400'
                                : order.status === 'APPROVED'
                                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-400'
                                : order.status === 'PAUSED'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {/* Cost Analysis Button */}
                            <button
                              onClick={() => handleOpenCosting(order)}
                              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-emerald-500 rounded-lg transition-colors"
                              title="Cost & Variance Analysis"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>

                            {/* Trace DAG Lineage Link */}
                            <Link
                              to={`/production/traceability?type=ORDER&id=${encodeURIComponent(order.productionOrderNumber)}`}
                              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-400 rounded-lg transition-colors"
                              title="Trace Lineage DAG"
                            >
                              <Compass className="w-4 h-4" />
                            </Link>

                            {order.status === 'PLANNED' && can('production.approve') && (
                              <button
                                onClick={() => handleApprove(order._id)}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 rounded-lg text-xs font-semibold"
                              >
                                Approve
                              </button>
                            )}

                            {order.status === 'APPROVED' && can('production.release') && (
                              <button
                                onClick={() => handleRelease(order._id)}
                                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 rounded-lg text-xs font-semibold"
                              >
                                Release & Reserve
                              </button>
                            )}

                            {order.status === 'RELEASED' && can('production.start') && (
                              <button
                                onClick={() => handleStart(order._id)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                Start Run
                              </button>
                            )}

                            {order.status === 'IN_PROGRESS' && (
                              <>
                                <Link
                                  to="/production/materials"
                                  className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold"
                                >
                                  Materials
                                </Link>

                                <button
                                  onClick={() => setPauseModalOrder(order)}
                                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-lg"
                                  title="Pause run"
                                >
                                  <Pause className="w-4 h-4" />
                                </button>

                                <button
                                  onClick={() => {
                                    const planned = order.plannedQuantity || 0;
                                    const yieldSoFar = order.yieldQuantity || 0;
                                    const rem = planned > yieldSoFar ? planned - yieldSoFar : planned;
                                    setOutputModalOrder(order);
                                    setOutputProducedQty(rem);
                                    setOutputRejectedQty(0);
                                    setOutputAcceptedQty(rem);
                                    setOutputScrapQty(0);
                                    setOutputBatchNumber('');
                                    setOutputNotes('');
                                  }}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm"
                                >
                                  Complete Output
                                </button>
                              </>
                            )}

                            {order.status === 'PAUSED' && (
                              <button
                                onClick={() => handleResume(order._id)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-white rounded-lg text-xs font-semibold"
                              >
                                <RotateCw className="w-3.5 h-3.5" />
                                Resume
                              </button>
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

        {/* Side Inspector Drawer */}
        {selectedOrder && (
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Order Inspector</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-mono mt-0.5">
                  {selectedOrder.productionOrderNumber}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  {selectedOrder.status}
                </span>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Target Product Info */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Target Output</span>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <div className="font-bold text-slate-900 dark:text-white">
                  {selectedOrder.productionItemId?.name || 'Manufactured Item'}
                </div>
                <div className="text-xs font-mono text-slate-500">{selectedOrder.productionItemId?.sku || 'SKU'}</div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>Planned: <strong>{selectedOrder.plannedQuantity} units</strong></span>
                  <span>Yield: <strong className="text-emerald-500">{selectedOrder.yieldQuantity || 0} units</strong></span>
                </div>
              </div>
            </div>

            {/* Facility & Schedule */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Facility</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedOrder.warehouseId?.name || 'Main Warehouse'}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Priority</span>
                <span className="font-bold text-indigo-500">{selectedOrder.priority}</span>
              </div>
            </div>

            {/* Raw Material Allocation Summary */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Raw Material Allocation
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {selectedOrder.materials?.length || 0} Components
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl">
                {(selectedOrder.materials || []).map((m, idx) => (
                  <div key={idx} className="p-2 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {m.itemId?.name || 'Raw Component'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Planned: {m.plannedQuantity} | Reserved: {m.reservedQuantity}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-emerald-500">{m.actualConsumedQuantity} consumed</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Planned Material Cost</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  ${selectedOrder.plannedMaterialCost?.toLocaleString() ?? 0}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[10px] uppercase">Actual Consumed Cost</span>
                <span className="font-bold text-indigo-500">
                  ${selectedOrder.actualMaterialCost?.toLocaleString() ?? 0}
                </span>
              </div>
            </div>

            {/* Action Buttons in Inspector */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => handleOpenCosting(selectedOrder)}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
              >
                <DollarSign className="w-4 h-4" />
                Cost & Variance Analysis
              </button>
              <Link
                to={`/production/traceability?type=ORDER&id=${encodeURIComponent(selectedOrder.productionOrderNumber)}`}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all"
              >
                <Compass className="w-4 h-4 text-indigo-400" />
                Trace Lineage DAG
              </Link>
              {selectedOrder.status === 'IN_PROGRESS' && (
                <Link
                  to="/production/materials"
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100 rounded-xl text-xs font-semibold transition-all"
                >
                  <Boxes className="w-4 h-4" />
                  Shop Floor Material Issuance
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Work Order Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Factory className="w-5 h-5 text-indigo-500" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create Manufacturing Work Order</h2>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <Select
                label="Active Bill of Materials (BOM) *"
                value={createForm.bomId}
                onChange={(e) => setCreateForm({ ...createForm, bomId: e.target.value })}
                placeholder="Select BOM..."
                options={boms.map((b) => ({
                  value: b._id,
                  label: `${b.name} (${b.bomNumber} v${b.version})`,
                }))}
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Planned Batch Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={createForm.plannedQuantity}
                    onChange={(e) => setCreateForm({ ...createForm, plannedQuantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <Select
                  label="Priority"
                  value={createForm.priority}
                  onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value as ProductionPriority })}
                  options={[
                    { value: 'LOW', label: 'LOW' },
                    { value: 'MEDIUM', label: 'MEDIUM' },
                    { value: 'HIGH', label: 'HIGH' },
                    { value: 'URGENT', label: 'URGENT' },
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Warehouse Plant *"
                  value={createForm.warehouseId}
                  onChange={(e) => setCreateForm({ ...createForm, warehouseId: e.target.value })}
                  placeholder="Select Warehouse..."
                  options={warehouses.map((w) => ({
                    value: w._id,
                    label: `${w.name} (${w.code})`,
                  }))}
                />

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Shop Floor Location
                  </label>
                  <input
                    type="text"
                    value={createForm.productionLocation}
                    onChange={(e) => setCreateForm({ ...createForm, productionLocation: e.target.value })}
                    placeholder="e.g. Plant 1 Bay A"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Manufacturing Notes
                </label>
                <textarea
                  rows={2}
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  placeholder="Special handling instructions, machine calibration notes..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition-colors disabled:opacity-50"
                >
                  {modalSubmitting ? 'Creating Order...' : 'Create Order (Planned)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Output Modal */}
      {outputModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Record Production Output & Complete</h2>
                <p className="text-xs text-slate-500">
                  Logs finished batch and automatically spawns Production QC inspection
                </p>
              </div>
              <button onClick={() => setOutputModalOrder(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOutputSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Total Produced *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={outputProducedQty}
                    onChange={(e) => handleProducedChange(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1">
                    Rejected Qty (Defects)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={outputRejectedQty}
                    onChange={(e) => handleRejectedChange(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-xl text-sm font-bold text-rose-700 dark:text-rose-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                    Accepted Quality *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={outputAcceptedQty}
                    onChange={(e) => handleAcceptedChange(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-sm font-bold text-emerald-700 dark:text-emerald-300"
                  />
                </div>
              </div>

              {/* Dynamic Auto-Calculation & Quality Yield Banner */}
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">Quality Split:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {outputProducedQty} Total = <span className="text-emerald-600 dark:text-emerald-400">{outputAcceptedQty} Accepted</span> + <span className="text-rose-600 dark:text-rose-400">{outputRejectedQty} Rejected</span>
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  {outputProducedQty > 0 ? `${((outputAcceptedQty / outputProducedQty) * 100).toFixed(1)}% Yield` : '0% Yield'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Defective Scrap Qty (Material Scrap)
                </label>
                <input
                  type="number"
                  min="0"
                  value={outputScrapQty}
                  onChange={(e) => setOutputScrapQty(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Batch Lot Number (Auto-assigned if left blank)
                </label>
                <input
                  type="text"
                  value={outputBatchNumber}
                  onChange={(e) => setOutputBatchNumber(e.target.value)}
                  placeholder="e.g. BAT-202609-003"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Execution Run Summary Notes
                </label>
                <textarea
                  rows={2}
                  value={outputNotes}
                  onChange={(e) => setOutputNotes(e.target.value)}
                  placeholder="All inspection points calibrated, continuous shift run..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                <span>
                  Completing this run creates a quarantined batch and routes it directly to Dr. Mei Chen in QC.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setOutputModalOrder(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={outputSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md transition-colors disabled:opacity-50"
                >
                  {outputSubmitting ? 'Recording...' : 'Finalize Output & Spawn QC'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {pauseModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Pause Production Run</h3>
            <p className="text-xs text-slate-500">Provide the reason for halting work order {pauseModalOrder.productionOrderNumber}</p>
            <form onSubmit={handlePauseSubmit} className="space-y-4">
              <input
                type="text"
                required
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPauseModalOrder(null)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg shadow-sm"
                >
                  Confirm Pause
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cost & Variance Analysis Modal */}
      {costingModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Cost & Material Variance Analysis
                  </h2>
                  <p className="text-xs text-slate-500 font-mono">
                    Order: {costingModalOrder.productionOrderNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCostingModalOrder(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {costingLoading ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                Calculating production costs and material variance...
              </div>
            ) : costingData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Planned Cost</span>
                    <span className="text-base font-bold text-slate-900 dark:text-white">
                      ${costingData.plannedMaterialCost?.toLocaleString() ?? 0}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Actual Consumed</span>
                    <span className="text-base font-bold text-slate-900 dark:text-white">
                      ${costingData.actualMaterialCost?.toLocaleString() ?? 0}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Cost Variance</span>
                    <span
                      className={`text-base font-bold ${
                        (costingData.materialVariance ?? 0) > 0 ? 'text-rose-500' : 'text-emerald-500'
                      }`}
                    >
                      {(costingData.materialVariance ?? 0) > 0 ? '+' : ''}$
                      {costingData.materialVariance?.toLocaleString() ?? 0}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      ({costingData.materialVariancePercentage ?? 0}%)
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Cost Per Unit</span>
                    <span className="text-base font-bold text-indigo-500">
                      ${costingData.actualCostPerUnit?.toLocaleString() ?? 0}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Yield: {costingData.yieldQuantity || 0} units
                    </span>
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                    Raw Material Variance Breakdown
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 uppercase border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Component Item</th>
                        <th className="py-2.5 px-3">Planned Qty</th>
                        <th className="py-2.5 px-3">Actual Consumed</th>
                        <th className="py-2.5 px-3">Unit Cost</th>
                        <th className="py-2.5 px-3 text-right">Variance ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(costingData.materialDetails || []).map((m: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                            {m.itemId?.name || m.itemId || 'Component Part'}
                            {m.itemId?.sku && (
                              <span className="block text-[10px] text-slate-400 font-mono">{m.itemId.sku}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">{m.plannedQuantity}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                            {m.actualConsumedQuantity}
                          </td>
                          <td className="py-2.5 px-3">${m.unitCost}</td>
                          <td
                            className={`py-2.5 px-3 text-right font-bold ${
                              m.variance > 0 ? 'text-rose-500' : 'text-emerald-500'
                            }`}
                          >
                            {m.variance > 0 ? '+' : ''}${m.variance}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-sm">No costing details available.</div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setCostingModalOrder(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
