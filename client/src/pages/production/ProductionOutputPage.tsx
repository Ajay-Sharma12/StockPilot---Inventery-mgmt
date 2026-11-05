import React, { useState, useEffect, useCallback } from 'react';
import {
  Factory,
  Package,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  BarChart2,
  Layers,
  RefreshCw,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Clock,
  Boxes,
  Trash2,
  Eye,
  Plus,
  X,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ShieldCheck,
  CalendarDays,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { productionApi } from '../../api/production.api';
import { warehouseApi } from '../../api/warehouse.api';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../context/ToastContext';
import { Skeleton } from '../../components/ui/Skeleton';
import { Select } from '../../components/ui/Select';

interface ProductionOutput {
  _id: string;
  outputNumber: string;
  productionOrderId: any;
  productionOrderNumber: string;
  itemId: any;
  bomId: any;
  warehouseId: any;
  plannedQuantity: number;
  producedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  scrapQuantity: number;
  wastageQuantity: number;
  uomId: any;
  productionDate: string;
  qcStatus: string;
  qcInspectionId?: any;
  batchNumber?: string;
  remarks?: string;
  createdAt: string;
}

const getResolvedQCStatus = (out: ProductionOutput): string => {
  const qc = out.qcInspectionId;
  if (qc && typeof qc === 'object') {
    if (qc.status === 'DISPOSITIONED') {
      return (qc.overallResult === 'FAIL' || qc.acceptedQuantity === 0) ? 'FAILED' : 'PASSED';
    }
    if (qc.status === 'INSPECTED') {
      return 'INSPECTED';
    }
  }
  return out.qcStatus || 'PENDING';
};

interface DashboardData {
  summary: {
    totalOutputs: number;
    totalProduced: number;
    totalAccepted: number;
    totalRejected: number;
    totalScrap: number;
    totalWastage: number;
    avgYieldRate: number;
    avgScrapRate: number;
  };
  byItem?: Array<{ itemId: any; itemName: string; sku: string; totalProduced: number; totalAccepted: number; yieldRate: number }>;
  byWarehouse?: Array<{ warehouseId: any; warehouseName: string; totalProduced: number; totalAccepted: number }>;
  trend?: Array<{ date: string; produced: number; accepted: number; rejected: number }>;
}

const QC_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  INSPECTED: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
  PASSED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  DISPOSITIONED: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
};

export const ProductionOutputPage: React.FC = () => {
  const { can } = usePermissions();
  const { success: toastSuccess, error: toastError } = useToast();

  const [outputs, setOutputs] = useState<ProductionOutput[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashLoading, setDashLoading] = useState(true);

  // Record Output Modal State
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [submittingOutput, setSubmittingOutput] = useState(false);

  // Form State
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [formProducedQty, setFormProducedQty] = useState<number | ''>('');
  const [formRejectedQty, setFormRejectedQty] = useState<number | ''>(0);
  const [formAcceptedQty, setFormAcceptedQty] = useState<number | ''>('');
  const [formScrapQty, setFormScrapQty] = useState<number | ''>(0);
  const [formBatchNumber, setFormBatchNumber] = useState('');
  const [formWarehouseId, setFormWarehouseId] = useState('');
  const [formQcStatus, setFormQcStatus] = useState<'PASSED' | 'PENDING' | 'FAILED'>('PASSED');
  const [formRemarks, setFormRemarks] = useState('');

  const handleFormProducedChange = (val: number | '') => {
    setFormProducedQty(val);
    const prod = typeof val === 'number' ? val : 0;
    const rej = typeof formRejectedQty === 'number' ? formRejectedQty : 0;
    setFormAcceptedQty(Math.max(0, prod - rej));
  };

  const handleFormRejectedChange = (val: number | '') => {
    setFormRejectedQty(val);
    const prod = typeof formProducedQty === 'number' ? formProducedQty : 0;
    const rej = typeof val === 'number' ? val : 0;
    // Auto-calculate accepted quality from produced - rejected
    setFormAcceptedQty(Math.max(0, prod - rej));
  };

  const handleFormAcceptedChange = (val: number | '') => {
    setFormAcceptedQty(val);
    const prod = typeof formProducedQty === 'number' ? formProducedQty : 0;
    const acc = typeof val === 'number' ? val : 0;
    // Auto-calculate rejected quantity from produced - accepted
    setFormRejectedQty(Math.max(0, prod - acc));
  };

  const loadAvailableOrders = async () => {
    try {
      setOrdersLoading(true);
      const res = await productionApi.getOrders({ limit: 100 });
      const orderList = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      setOrders(orderList);
    } catch {
      /* ignore */
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleOpenRecordModal = () => {
    setIsRecordModalOpen(true);
    loadAvailableOrders();
  };

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    const ord = orders.find((o) => o._id === orderId);
    if (ord) {
      const planned = Number(ord.plannedQuantity) || 0;
      const yielded = Number(ord.yieldQuantity) || 0;
      const rem = planned > yielded ? planned - yielded : planned;
      setFormProducedQty(rem);
      setFormRejectedQty(0);
      setFormAcceptedQty(rem);
      setFormScrapQty(0);
      if (ord.warehouseId) {
        setFormWarehouseId(typeof ord.warehouseId === 'object' ? ord.warehouseId._id : ord.warehouseId);
      }
    }
  };

  const handleRecordOutputSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) {
      toastError('Please select a production order');
      return;
    }
    const produced = Number(formProducedQty);
    if (!produced || produced <= 0) {
      toastError('Total produced quantity must be greater than zero');
      return;
    }

    try {
      setSubmittingOutput(true);
      const payload: any = {
        productionOrderId: selectedOrderId,
        producedQuantity: produced,
        acceptedQuantity: Number(formAcceptedQty) || 0,
        rejectedQuantity: Number(formRejectedQty) || 0,
        scrapQuantity: Number(formScrapQty) || 0,
        batchNumber: formBatchNumber?.trim() || undefined,
        warehouseId: formWarehouseId || undefined,
        qcStatus: formQcStatus,
        remarks: formRemarks?.trim() || undefined,
      };

      const res = await productionApi.createOutput(payload);
      toastSuccess(
        `Production output recorded! #${res.output?.outputNumber || 'Saved'} logged (${res.output?.acceptedQuantity ?? formAcceptedQty} units received into stock).`
      );
      setIsRecordModalOpen(false);
      setSelectedOrderId('');
      setFormProducedQty('');
      setFormRejectedQty(0);
      setFormAcceptedQty('');
      setFormScrapQty(0);
      setFormBatchNumber('');
      setFormRemarks('');
      loadDashboard();
      loadOutputs(true);
    } catch (err: any) {
      toastError(err?.response?.data?.message || 'Failed to record production output');
    } finally {
      setSubmittingOutput(false);
    }
  };

  const [page, setPage] = useState(1);
  const limit = 20;
  const [search, setSearch] = useState('');
  const [qcFilter, setQcFilter] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [activeView, setActiveView] = useState<'list' | 'matrix' | 'consumption'>('list');
  const [matrix, setMatrix] = useState<any>(null);
  const [consumption, setConsumption] = useState<any>(null);
  const [matrixLoading, setMatrixLoading] = useState(false);

  const loadWarehouses = async () => {
    try {
      const res = await warehouseApi.getWarehouses();
      setWarehouses(Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []));
    } catch { /* ignore */ }
  };

  const loadDashboard = useCallback(async () => {
    try {
      setDashLoading(true);
      const data = await productionApi.getProductionDashboard({
        warehouseId: warehouseId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setDashboard(data);
    } catch {
      setDashboard(null);
    } finally {
      setDashLoading(false);
    }
  }, [warehouseId, startDate, endDate]);

  const loadOutputs = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const res = await productionApi.getOutputs({
        page,
        limit,
        search: search || undefined,
        qcStatus: qcFilter || undefined,
        warehouseId: warehouseId || undefined,
      });
      setOutputs(res.data);
      setTotal(res.total);
    } catch (err: any) {
      toastError(err?.response?.data?.message || 'Failed to load production outputs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, search, qcFilter, warehouseId]);

  const loadMatrix = useCallback(async () => {
    try {
      setMatrixLoading(true);
      const [outputData, consumptionData] = await Promise.all([
        productionApi.getOutputMatrix({ warehouseId: warehouseId || undefined, startDate: startDate || undefined, endDate: endDate || undefined }),
        productionApi.getMaterialConsumptionMatrix({ warehouseId: warehouseId || undefined, startDate: startDate || undefined, endDate: endDate || undefined }),
      ]);
      setMatrix(outputData);
      setConsumption(consumptionData);
    } catch { /* ignore */ } finally {
      setMatrixLoading(false);
    }
  }, [warehouseId, startDate, endDate]);

  useEffect(() => {
    loadWarehouses();
  }, []);

  useEffect(() => {
    loadDashboard();
    loadOutputs();
  }, [loadDashboard, loadOutputs]);

  useEffect(() => {
    if (activeView !== 'list') loadMatrix();
  }, [activeView, loadMatrix]);

  const handleRefresh = () => {
    loadDashboard();
    if (activeView === 'list') loadOutputs(true);
    else loadMatrix();
  };

  const totalPages = Math.ceil(total / limit);

  // Computed metrics with fallbacks
  const totalOutputsVal = dashboard?.summary?.totalOutputs ?? outputs.length;
  const totalProducedVal = dashboard?.summary?.totalProduced ?? outputs.reduce((sum, o) => sum + (o.producedQuantity || 0), 0);
  const totalAcceptedVal = dashboard?.summary?.totalAccepted ?? outputs.reduce((sum, o) => sum + (o.acceptedQuantity || 0), 0);
  const totalRejectedVal = dashboard?.summary?.totalRejected ?? outputs.reduce((sum, o) => sum + (o.rejectedQuantity || 0), 0);
  const totalScrapVal = dashboard?.summary?.totalScrap ?? outputs.reduce((sum, o) => sum + (o.scrapQuantity || 0), 0);

  const yieldRate = dashboard?.summary?.avgYieldRate !== undefined
    ? (dashboard.summary.avgYieldRate * 100).toFixed(1)
    : totalProducedVal > 0
    ? ((totalAcceptedVal / totalProducedVal) * 100).toFixed(1)
    : '—';

  const scrapRate = dashboard?.summary?.avgScrapRate !== undefined
    ? (dashboard.summary.avgScrapRate * 100).toFixed(1)
    : totalProducedVal > 0
    ? (((totalScrapVal + totalRejectedVal) / totalProducedVal) * 100).toFixed(1)
    : '—';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-6 rounded-2xl shadow-xl border border-slate-800 text-white">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400">
            <Factory className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Production Output</h1>
            <p className="text-sm text-slate-300">Finished goods recording, yield analysis, wastage & scrap tracking</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-medium transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-400' : 'text-slate-300'}`} />
            Refresh
          </button>
          <button
            onClick={handleOpenRecordModal}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-emerald-600/30 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Record Output
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Outputs', value: dashLoading ? '...' : String(totalOutputsVal), icon: Factory, color: 'indigo' },
          { label: 'Total Produced', value: dashLoading ? '...' : String(totalProducedVal), icon: Package, color: 'sky' },
          { label: 'Accepted', value: dashLoading ? '...' : String(totalAcceptedVal), icon: CheckCircle2, color: 'emerald' },
          { label: 'Rejected', value: dashLoading ? '...' : String(totalRejectedVal), icon: XCircle, color: 'red' },
          { label: 'Avg Yield', value: dashLoading ? '...' : `${yieldRate}%`, icon: TrendingUp, color: 'emerald' },
          { label: 'Avg Scrap', value: dashLoading ? '...' : `${scrapRate}%`, icon: Trash2, color: 'amber' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
              <div className={`p-1.5 rounded-lg bg-${color}-50 dark:bg-${color}-950/40 text-${color}-600 dark:text-${color}-400`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by output # or order #..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
            />
          </div>
          <div className="w-full sm:w-44 shrink-0">
            <Select
              value={qcFilter}
              onChange={(e) => { setQcFilter(e.target.value); setPage(1); }}
              variant="emerald"
              searchable={false}
              placeholder="All QC Status"
              options={[
                { value: '', label: 'All QC Status' },
                { value: 'PENDING', label: 'Pending' },
                { value: 'INSPECTED', label: 'Inspected' },
                { value: 'PASSED', label: 'Passed' },
                { value: 'DISPOSITIONED', label: 'Dispositioned' },
                { value: 'FAILED', label: 'Failed' },
              ]}
            />
          </div>
          <div className="w-full sm:w-48 shrink-0">
            <Select
              value={warehouseId}
              onChange={(e) => { setWarehouseId(e.target.value); setPage(1); }}
              variant="emerald"
              placeholder="All Warehouses"
              options={[
                { value: '', label: 'All Warehouses' },
                ...warehouses.map((w: any) => ({ value: w._id, label: w.name })),
              ]}
            />
          </div>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />

          {/* View Switcher */}
          <div className="ml-auto flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
            {(['list', 'matrix', 'consumption'] as const).map(v => (
              <button
                key={v}
                onClick={() => setActiveView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${activeView === v ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                {v === 'list' ? '📋 List' : v === 'matrix' ? '📊 Output Matrix' : '⚙️ Consumption'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List View */}
      {activeView === 'list' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 uppercase border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Output #</th>
                  <th className="py-3 px-4">Production Order</th>
                  <th className="py-3 px-4">Item</th>
                  <th className="py-3 px-4">Warehouse</th>
                  <th className="py-3 px-4">Produced / Accepted</th>
                  <th className="py-3 px-4">Scrap / Waste</th>
                  <th className="py-3 px-4">Yield</th>
                  <th className="py-3 px-4">QC Status</th>
                  <th className="py-3 px-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-full" /></td>
                    ))}</tr>
                  ))
                ) : outputs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-slate-400">
                      <Factory className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="font-medium text-slate-700 dark:text-slate-300">No production outputs found</p>
                      <p className="text-xs mt-1 text-slate-500">
                        Record output from a released Work Order to populate stock and yield metrics
                      </p>
                      <div className="mt-4 flex items-center justify-center gap-2">
                        <button
                          onClick={handleOpenRecordModal}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Record First Output
                        </button>
                        <Link
                          to="/production/orders"
                          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-all"
                        >
                          View Work Orders
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  outputs.map((out) => {
                    const resolvedStatus = getResolvedQCStatus(out);
                    const qc = out.qcInspectionId;
                    const acceptedQty =
                      qc && typeof qc === 'object' && typeof qc.acceptedQuantity === 'number' && qc.status === 'DISPOSITIONED'
                        ? qc.acceptedQuantity
                        : out.acceptedQuantity;
                    const yieldPct = out.producedQuantity > 0
                      ? ((acceptedQty / out.producedQuantity) * 100).toFixed(1)
                      : '—';
                    return (
                      <tr key={out._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">{out.outputNumber}</span>
                        </td>
                        <td className="py-3 px-4">
                          <Link to="/production/orders" className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline text-xs">
                            {out.productionOrderNumber}
                          </Link>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900 dark:text-white text-xs">{out.itemId?.name || '—'}</div>
                          <div className="text-slate-400 text-[10px]">{out.itemId?.sku || ''}</div>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">{out.warehouseId?.name || '—'}</td>
                        <td className="py-3 px-4">
                          <div className="text-xs">
                            <span className="font-semibold text-slate-900 dark:text-white">{out.producedQuantity}</span>
                            <span className="text-slate-400 mx-1">/</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{acceptedQty}</span>
                            <span className="text-slate-400 ml-1">{out.uomId?.code || ''}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-xs">
                            <span className="text-amber-600 dark:text-amber-400">{out.scrapQuantity || 0}</span>
                            <span className="text-slate-400 mx-1">/</span>
                            <span className="text-rose-600 dark:text-rose-400">{out.wastageQuantity || 0}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${yieldPct}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{yieldPct}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Link
                            to="/production/qc"
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold transition-opacity hover:opacity-80 ${QC_STATUS_STYLES[resolvedStatus] || 'bg-slate-100 text-slate-600'}`}
                            title={qc?.qcNumber ? `QC Inspection: ${qc.qcNumber}` : undefined}
                          >
                            {resolvedStatus}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500">{new Date(out.productionDate).toLocaleDateString()}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
              <span>Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800">Prev</button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Output Matrix View */}
      {activeView === 'matrix' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">Production Output Matrix</h2>
              <p className="text-xs text-slate-500 mt-0.5">Yield and efficiency by product and warehouse</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            {matrixLoading ? (
              <div className="p-8 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
              </div>
            ) : !matrix || (!matrix.byItem?.length && !matrix.items?.length) ? (
              <div className="py-16 text-center text-slate-400">
                <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No matrix data available</p>
                <p className="text-xs mt-1">Output matrix is calculated from recorded production outputs</p>
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 uppercase border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Item</th>
                    <th className="py-3 px-4">Total Produced</th>
                    <th className="py-3 px-4">Total Accepted</th>
                    <th className="py-3 px-4">Rejected</th>
                    <th className="py-3 px-4">Scrap</th>
                    <th className="py-3 px-4">Yield Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(matrix.byItem || matrix.items || []).map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-white">{row.itemName || row.name || '—'}</div>
                        <div className="text-xs text-slate-400">{row.sku || ''}</div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">{row.totalProduced ?? '—'}</td>
                      <td className="py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400">{row.totalAccepted ?? '—'}</td>
                      <td className="py-3 px-4 font-semibold text-red-500 dark:text-red-400">{row.totalRejected ?? '—'}</td>
                      <td className="py-3 px-4 font-semibold text-amber-600 dark:text-amber-400">{row.totalScrap ?? '—'}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${((row.yieldRate ?? 0) * 100).toFixed(1)}%` }} />
                          </div>
                          <span className={`text-xs font-bold ${(row.yieldRate ?? 0) >= 0.9 ? 'text-emerald-600 dark:text-emerald-400' : (row.yieldRate ?? 0) >= 0.7 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                            {(((row.yieldRate ?? 0) * 100)).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Consumption Matrix View */}
      {activeView === 'consumption' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800">
            <h2 className="font-bold text-slate-900 dark:text-white">Material Consumption Matrix</h2>
            <p className="text-xs text-slate-500 mt-0.5">Raw material consumption vs planned — efficiency analysis</p>
          </div>
          <div className="overflow-x-auto">
            {matrixLoading ? (
              <div className="p-8 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
              </div>
            ) : !consumption || (!consumption.byItem?.length && !consumption.items?.length) ? (
              <div className="py-16 text-center text-slate-400">
                <Boxes className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No consumption data available</p>
                <p className="text-xs mt-1">Material consumption matrix is built from issued materials</p>
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 uppercase border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Material</th>
                    <th className="py-3 px-4">Planned Qty</th>
                    <th className="py-3 px-4">Actual Consumed</th>
                    <th className="py-3 px-4">Variance</th>
                    <th className="py-3 px-4">Scrap</th>
                    <th className="py-3 px-4">Efficiency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(consumption.byItem || consumption.items || []).map((row: any, i: number) => {
                    const variance = (row.actualConsumed ?? 0) - (row.plannedQuantity ?? 0);
                    const effPct = row.plannedQuantity > 0 ? Math.min((row.plannedQuantity / Math.max(row.actualConsumed, 1)) * 100, 100).toFixed(1) : '—';
                    return (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900 dark:text-white">{row.itemName || row.name || '—'}</div>
                          <div className="text-xs text-slate-400">{row.sku || row.itemCode || ''}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{row.plannedQuantity ?? '—'}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{row.actualConsumed ?? row.issuedQuantity ?? '—'}</td>
                        <td className="py-3 px-4">
                          {variance !== 0 ? (
                            <span className={`flex items-center gap-1 text-xs font-semibold ${variance > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              {variance > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                              {Math.abs(variance)}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">On Plan</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-amber-600 dark:text-amber-400">{row.scrapQuantity ?? '—'}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                              <div className="h-full rounded-full bg-sky-500" style={{ width: `${effPct}%` }} />
                            </div>
                            <span className="text-xs font-bold text-sky-600 dark:text-sky-400">{effPct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Per-item breakdown from dashboard */}
      {activeView === 'list' && dashboard?.byItem && dashboard.byItem.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4">Top Items by Output Volume</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {dashboard.byItem.slice(0, 6).map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 flex items-center justify-center text-sm font-bold">
                  {item.itemName?.charAt(0) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{item.itemName}</p>
                  <p className="text-xs text-slate-500">{item.sku}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-20 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${((item.yieldRate || 0) * 100).toFixed(0)}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-500">Yield: {((item.yieldRate || 0) * 100).toFixed(1)}%</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{item.totalProduced}</p>
                  <p className="text-[10px] text-slate-400">produced</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Record Output Modal */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-600 dark:text-emerald-400">
                  <Factory className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Record Production Output</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Log finished goods run, auto-calculate quality yield, and credit inventory
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRecordModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordOutputSubmit} className="space-y-4">
              {/* Order Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Active Production Work Order *
                </label>
                {ordersLoading ? (
                  <Skeleton className="h-10 w-full rounded-xl" />
                ) : (
                  <Select
                    value={selectedOrderId}
                    onChange={(e) => handleSelectOrder(e.target.value)}
                    variant="emerald"
                    placeholder="-- Select a Production Order --"
                    options={[
                      { value: '', label: '-- Select a Production Order --' },
                      ...orders.map((o: any) => ({
                        value: o._id,
                        label: `${o.productionOrderNumber} • ${(o.productionItemId?.name || 'Item')} (Planned: ${o.plannedQuantity}, Yield: ${o.yieldQuantity || 0}) [${o.status}]`,
                      })),
                    ]}
                  />
                )}
              </div>

              {/* Order Detail Summary Banner if selected */}
              {selectedOrderId && (() => {
                const ord = orders.find((o) => o._id === selectedOrderId);
                if (!ord) return null;
                const planned = Number(ord.plannedQuantity) || 0;
                const yielded = Number(ord.yieldQuantity) || 0;
                const rem = Math.max(0, planned - yielded);
                return (
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Product</span>
                      <span className="font-semibold text-slate-900 dark:text-white truncate block">
                        {ord.productionItemId?.name || 'Finished Good'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{ord.productionItemId?.sku}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Planned vs Yield</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {yielded} / {planned} units
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Remaining</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {rem} units left
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Quality Split 3-Column Inputs */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Total Produced *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formProducedQty}
                    onChange={(e) => handleFormProducedChange(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 100"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Total Run Units</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1 flex items-center justify-between">
                    <span>Rejected Qty</span>
                    <span className="text-[10px] font-normal text-rose-500">Defects</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formRejectedQty}
                    onChange={(e) => handleFormRejectedChange(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-rose-50/40 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-xl text-sm font-bold text-rose-700 dark:text-rose-300 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-rose-500/80 mt-0.5 block">⚡ Auto-calculates accepted</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1 flex items-center justify-between">
                    <span>Accepted Qty *</span>
                    <span className="text-[10px] font-normal text-emerald-500">Good Quality</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formAcceptedQty}
                    onChange={(e) => handleFormAcceptedChange(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 95"
                    className="w-full px-3 py-2 bg-emerald-50/40 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-sm font-bold text-emerald-700 dark:text-emerald-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-emerald-600/80 mt-0.5 block">Enters FG Stock</span>
                </div>
              </div>

              {/* Dynamic Live Quality Math Indicator */}
              {(() => {
                const prod = Number(formProducedQty) || 0;
                const rej = Number(formRejectedQty) || 0;
                const acc = Number(formAcceptedQty) || 0;
                const yieldPct = prod > 0 ? ((acc / prod) * 100).toFixed(1) : '100';
                const isOver = acc + rej > prod;

                return (
                  <div className={`p-3 rounded-2xl border transition-all ${isOver ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300' : 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'}`}>
                    <div className="flex items-center justify-between mb-1.5 text-xs">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Quality Calculation:</span>
                        <span className="font-mono font-bold">
                          {prod} Produced - {rej} Rejected = {acc} Accepted Units
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white dark:bg-slate-800 shadow-xs border border-emerald-300 dark:border-emerald-700">
                        {yieldPct}% Yield
                      </span>
                    </div>

                    {/* Quality Visual Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex">
                      <div
                        className="bg-emerald-500 transition-all duration-300"
                        style={{ width: `${prod > 0 ? (acc / prod) * 100 : 100}%` }}
                        title={`${acc} Accepted`}
                      />
                      <div
                        className="bg-rose-500 transition-all duration-300"
                        style={{ width: `${prod > 0 ? (rej / prod) * 100 : 0}%` }}
                        title={`${rej} Rejected`}
                      />
                    </div>

                    {isOver && (
                      <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-1.5">
                        ⚠️ Accepted ({acc}) + Rejected ({rej}) exceeds Total Produced ({prod})! Please adjust numbers.
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Scrap and Batch Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Scrap / Material Waste Qty
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formScrapQty}
                    onChange={(e) => setFormScrapQty(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Non-recoverable scrap</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Batch Lot Number
                  </label>
                  <input
                    type="text"
                    value={formBatchNumber}
                    onChange={(e) => setFormBatchNumber(e.target.value)}
                    placeholder="Auto BAT-xxx if left blank"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Auto-assigned if empty</span>
                </div>
              </div>

              {/* Warehouse & QC Disposition Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Destination Warehouse
                  </label>
                  <Select
                    value={formWarehouseId}
                    onChange={(e) => setFormWarehouseId(e.target.value)}
                    variant="emerald"
                    placeholder="Default Warehouse"
                    options={[
                      { value: '', label: 'Default Order Warehouse' },
                      ...warehouses.map((w: any) => ({ value: w._id, label: w.name })),
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    QC Disposition Status
                  </label>
                  <Select
                    value={formQcStatus}
                    onChange={(e) => setFormQcStatus(e.target.value as any)}
                    variant="emerald"
                    searchable={false}
                    options={[
                      { value: 'PASSED', label: 'PASSED (Receive good units into stock)' },
                      { value: 'PENDING', label: 'PENDING (Hold for QC inspection)' },
                      { value: 'FAILED', label: 'FAILED (Mark run as failed)' },
                    ]}
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Run Notes & Inspection Remarks
                </label>
                <textarea
                  rows={2}
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  placeholder="Continuous shift operation, tool calibration verified, defect analysis notes..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Informational callout */}
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                <span>
                  Recording output updates order completion, logs batch lot lineage, and credits accepted finished goods to the warehouse inventory ledger.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRecordModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOutput || (Number(formAcceptedQty) + Number(formRejectedQty) > Number(formProducedQty))}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/30 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {submittingOutput ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Recording Output...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Record Output & Update Stock
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
