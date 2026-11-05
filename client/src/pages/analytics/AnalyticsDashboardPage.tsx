import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Boxes,
  ShoppingBag,
  Factory,
  ShieldCheck,
  Percent,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Users,
  Truck,
  BarChart3,
  Activity,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import {
  analyticsApi,
  AnalyticsPeriod,
  ExecutiveAnalyticsData,
  InventoryAnalyticsData,
  ProductionAnalyticsData,
  QCAnalyticsData,
  SalesAnalyticsData,
  ProcurementAnalyticsData,
} from '../../api/analytics.api';
import { warehouseApi, Warehouse } from '../../api/warehouse.api';
import { StatCardSkeleton } from '../../components/ui/Skeleton';

export const AnalyticsDashboardPage: React.FC = () => {
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');
  const [activeTab, setActiveTab] = useState<
    'EXECUTIVE' | 'PRODUCTION' | 'INVENTORY' | 'SALES' | 'PROCUREMENT' | 'QC'
  >('EXECUTIVE');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Warehouses
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [isWarehouseDropdownOpen, setIsWarehouseDropdownOpen] = useState(false);
  const warehouseDropdownRef = useRef<HTMLDivElement>(null);

  // Close warehouse custom dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        warehouseDropdownRef.current &&
        !warehouseDropdownRef.current.contains(e.target as Node)
      ) {
        setIsWarehouseDropdownOpen(false);
      }
    };
    if (isWarehouseDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isWarehouseDropdownOpen]);

  // Analytics Datasets
  const [execData, setExecData] = useState<ExecutiveAnalyticsData | null>(null);
  const [invData, setInvData] = useState<InventoryAnalyticsData | null>(null);
  const [prodData, setProdData] = useState<ProductionAnalyticsData | null>(null);
  const [qcData, setQcData] = useState<QCAnalyticsData | null>(null);
  const [salesData, setSalesData] = useState<SalesAnalyticsData | null>(null);
  const [procData, setProcData] = useState<ProcurementAnalyticsData | null>(null);

  // Error tracking per slice
  const [fetchErrors, setFetchErrors] = useState<Record<string, string>>({});

  // Hover state for SVG chart tooltip
  const [activeTrendIdx, setActiveTrendIdx] = useState<number | null>(null);

  // Load warehouses once on mount
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const res = await warehouseApi.getWarehouses();
        const list = Array.isArray(res) ? res : res?.warehouses || [];
        setWarehouses(list);
      } catch (err) {
        console.warn('Could not load warehouses for analytics filter', err);
      }
    };
    fetchWarehouses();
  }, []);

  // Main analytics loader with Promise.allSettled
  const loadAnalytics = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      else setRefreshing(true);

      const [
        execResult,
        invResult,
        prodResult,
        qcResult,
        salesResult,
        procResult,
      ] = await Promise.allSettled([
        analyticsApi.getExecutiveDashboard(period, selectedWarehouse || undefined),
        analyticsApi.getInventoryAnalytics(selectedWarehouse || undefined),
        analyticsApi.getProductionAnalytics(period, selectedWarehouse || undefined),
        analyticsApi.getQCAnalytics(period),
        analyticsApi.getSalesAnalytics(period, selectedWarehouse || undefined),
        analyticsApi.getProcurementAnalytics(period, selectedWarehouse || undefined),
      ]);

      const errors: Record<string, string> = {};

      if (execResult.status === 'fulfilled') {
        setExecData(execResult.value);
      } else {
        errors.executive = 'Failed to load executive metrics';
      }

      if (invResult.status === 'fulfilled') {
        setInvData(invResult.value);
      } else {
        errors.inventory = 'Failed to load inventory metrics';
      }

      if (prodResult.status === 'fulfilled') {
        setProdData(prodResult.value);
      } else {
        errors.production = 'Failed to load production metrics';
      }

      if (qcResult.status === 'fulfilled') {
        setQcData(qcResult.value);
      } else {
        errors.qc = 'Failed to load QC metrics';
      }

      if (salesResult.status === 'fulfilled') {
        setSalesData(salesResult.value);
      } else {
        errors.sales = 'Failed to load sales metrics';
      }

      if (procResult.status === 'fulfilled') {
        setProcData(procResult.value);
      } else {
        errors.procurement = 'Failed to load procurement metrics';
      }

      setFetchErrors(errors);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Unexpected error loading operational analytics', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, selectedWarehouse]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Auto-refresh timer (30s)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadAnalytics(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadAnalytics]);

  const renderGrowthBadge = (growth: number) => {
    const val = Number.isFinite(growth) ? growth : 0;
    const isPositive = val >= 0;
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
          isPositive
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400'
        }`}
      >
        {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
        {Math.abs(val)}% vs prev
      </span>
    );
  };

  // Trend Chart Calculation
  const trendPoints = useMemo(() => {
    return execData?.trends && execData.trends.length > 0 ? execData.trends : [];
  }, [execData]);

  const maxTrendValue = useMemo(() => {
    if (trendPoints.length === 0) return 1000;
    const maxVal = Math.max(
      ...trendPoints.map((p) => Math.max(p.sales || 0, p.procurement || 0)),
      100
    );
    return maxVal;
  }, [trendPoints]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-indigo-500" />
              Operational Intelligence
            </span>
            <span>&bull;</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-bold">Real-Time Aggregation</span>
            <span>&bull;</span>
            <span className="text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {lastUpdated.toLocaleTimeString()}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight flex items-center gap-2">
            Operational Analytics Engine
            {autoRefresh && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                LIVE
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Multi-dimensional enterprise telemetry, period-over-period comparisons, and cross-functional performance
          </p>
        </div>

        {/* Controls: Warehouse Filter, Period, Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Warehouse Facility Selector Custom Dropdown */}
          <div className="relative" ref={warehouseDropdownRef}>
            <button
              type="button"
              onClick={() => setIsWarehouseDropdownOpen(!isWarehouseDropdownOpen)}
              className={`flex items-center gap-2 bg-white dark:bg-slate-900 border rounded-xl px-3 py-1.5 shadow-sm text-xs font-semibold transition-all ${
                isWarehouseDropdownOpen
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                  : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate max-w-[160px]">
                {selectedWarehouse
                  ? warehouses.find((w) => w._id === selectedWarehouse)?.name ||
                    warehouses.find((w) => w._id === selectedWarehouse)?.code ||
                    'All Warehouses'
                  : 'All Warehouses'}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
                  isWarehouseDropdownOpen ? 'rotate-180 text-indigo-500' : ''
                }`}
              />
            </button>

            {isWarehouseDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[220px] max-h-64 overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedWarehouse('');
                    setIsWarehouseDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                    !selectedWarehouse
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 opacity-70" />
                    <span>All Warehouses</span>
                  </div>
                  {!selectedWarehouse && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />}
                </button>

                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

                {warehouses.map((wh) => {
                  const isCurrent = selectedWarehouse === wh._id;
                  return (
                    <button
                      key={wh._id}
                      type="button"
                      onClick={() => {
                        setSelectedWarehouse(wh._id);
                        setIsWarehouseDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                        isCurrent
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0 font-medium border border-slate-200 dark:border-slate-700/60">
                          {wh.code}
                        </span>
                        <span className="truncate">{wh.name || wh.code}</span>
                      </div>
                      {isCurrent && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Period Selector */}
          <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm text-xs">
            {(['today', 'week', 'month', 'quarter', 'year', 'all'] as AnalyticsPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1.5 rounded-lg font-semibold capitalize transition-all ${
                  period === p
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              autoRefresh
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
            }`}
            title="Auto-refresh every 30 seconds"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>30s Auto</span>
          </button>

          {/* Manual Refresh Button */}
          <button
            onClick={() => loadAnalytics()}
            disabled={refreshing || loading}
            className="flex items-center justify-center p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all shadow-sm disabled:opacity-50"
            title="Refresh now"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Partial Error Banner if some endpoints failed */}
      {Object.keys(fetchErrors).length > 0 && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Some telemetry feeds could not be loaded ({Object.keys(fetchErrors).join(', ')}). Other operational modules remain active.
            </span>
          </div>
          <button
            onClick={() => loadAnalytics()}
            className="font-bold underline hover:no-underline ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state skeleton */}
      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-64 shimmer-effect" />
            <div className="bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-64 shimmer-effect" />
          </div>
        </div>
      )}

      {/* Top Executive KPI Cards */}
      {!loading && execData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Sales Revenue */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 hover:border-emerald-300 dark:hover:border-emerald-800 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Sales Revenue</span>
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                ${(execData.kpis?.totalSalesRevenue ?? 0).toLocaleString()}
              </span>
              {renderGrowthBadge(execData.growth?.salesRevenueGrowth ?? execData.growth?.salesGrowth ?? 0)}
            </div>
            <div className="text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800/60 pt-2 flex justify-between">
              <span>Unpaid Invoices:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                ${(execData.kpis?.outstandingReceivables ?? 0).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Procurement Spend */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Procurement Spend</span>
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                ${(execData.kpis?.totalProcurementSpend ?? 0).toLocaleString()}
              </span>
              {renderGrowthBadge(execData.growth?.procurementSpendGrowth ?? execData.growth?.procurementGrowth ?? 0)}
            </div>
            <div className="text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800/60 pt-2 flex justify-between">
              <span>Open POs:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {execData.summary?.openPurchaseOrders ?? 0} orders
              </span>
            </div>
          </div>

          {/* Inventory Valuation */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 hover:border-blue-300 dark:hover:border-blue-800 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Inventory Valuation</span>
              <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-xl text-blue-600">
                <Boxes className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                ${(execData.kpis?.totalInventoryValuation ?? 0).toLocaleString()}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {execData.summary?.totalItems ?? 0} SKUs
              </span>
            </div>
            <div className="text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800/60 pt-2 flex justify-between">
              <span>Active Balances:</span>
              <span className="font-semibold text-emerald-600">Live Cost Valuation</span>
            </div>
          </div>

          {/* Manufacturing Yield */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 hover:border-purple-300 dark:hover:border-purple-800 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Manufacturing Yield</span>
              <div className="p-2 bg-purple-50 dark:bg-purple-950/50 rounded-xl text-purple-600">
                <Percent className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-purple-600 dark:text-purple-400">
                {execData.kpis?.productionYieldRate ?? 100}%
              </span>
              <span className="text-xs text-slate-400">
                QC Pass: {execData.kpis?.qcPassRate ?? 100}%
              </span>
            </div>
            <div className="text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800/60 pt-2 flex justify-between">
              <span>Active Runs:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {execData.summary?.activeWorkOrders ?? 0} on shop floor
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Domain Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        {[
          { id: 'EXECUTIVE', label: 'Executive Pulse', icon: Activity },
          { id: 'PRODUCTION', label: 'Production & Yield', icon: Factory },
          { id: 'INVENTORY', label: 'Inventory & Facilities', icon: Boxes },
          { id: 'SALES', label: 'Sales & Revenue', icon: TrendingUp },
          { id: 'PROCUREMENT', label: 'Procurement & Spend', icon: ShoppingBag },
          { id: 'QC', label: 'Quality Assurance', icon: ShieldCheck },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Executive Pulse */}
      {activeTab === 'EXECUTIVE' && execData && (
        <div className="space-y-6">
          {/* Trend Chart: Revenue vs Procurement Spend */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-500" />
                  Financial Inflow vs Outflow Velocity ({period.toUpperCase()})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Period comparison of customer billing vs vendor procurement disbursements
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-emerald-500 inline-block" />
                  <span className="text-slate-600 dark:text-slate-300">Sales Revenue</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-indigo-500 inline-block" />
                  <span className="text-slate-600 dark:text-slate-300">Procurement Spend</span>
                </div>
              </div>
            </div>

            {/* SVG Visual Trend Chart */}
            <div className="relative pt-4">
              {trendPoints.length > 0 ? (
                <div className="w-full overflow-x-auto">
                  <svg
                    viewBox="0 0 700 220"
                    className="w-full h-56 text-slate-300 dark:text-slate-700"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="procGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                      const y = 180 - pct * 150;
                      return (
                        <g key={i}>
                          <line
                            x1="50"
                            y1={y}
                            x2="680"
                            y2={y}
                            stroke="currentColor"
                            strokeDasharray="4 4"
                            strokeWidth="1"
                            opacity="0.2"
                          />
                          <text
                            x="42"
                            y={y + 4}
                            fontSize="9"
                            textAnchor="end"
                            fill="currentColor"
                            opacity="0.6"
                          >
                            ${Math.round((pct * maxTrendValue) / 1000)}k
                          </text>
                        </g>
                      );
                    })}

                    {/* Area & Polyline calculations */}
                    {(() => {
                      const step = (680 - 50) / Math.max(trendPoints.length - 1, 1);
                      const salesCoords = trendPoints.map((p, i) => {
                        const x = 50 + i * step;
                        const y = 180 - ((p.sales || 0) / maxTrendValue) * 150;
                        return { x, y };
                      });
                      const procCoords = trendPoints.map((p, i) => {
                        const x = 50 + i * step;
                        const y = 180 - ((p.procurement || 0) / maxTrendValue) * 150;
                        return { x, y };
                      });

                      const salesPath =
                        salesCoords.reduce((acc, c, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`, '') +
                        ` L ${salesCoords[salesCoords.length - 1].x} 180 L 50 180 Z`;
                      const procPath =
                        procCoords.reduce((acc, c, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`, '') +
                        ` L ${procCoords[procCoords.length - 1].x} 180 L 50 180 Z`;

                      const salesLine = salesCoords.reduce(
                        (acc, c, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`,
                        ''
                      );
                      const procLine = procCoords.reduce(
                        (acc, c, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`,
                        ''
                      );

                      return (
                        <>
                          <path d={salesPath} fill="url(#salesGrad)" />
                          <path d={procPath} fill="url(#procGrad)" />

                          <path d={salesLine} fill="none" stroke="#10b981" strokeWidth="2.5" />
                          <path d={procLine} fill="none" stroke="#6366f1" strokeWidth="2.5" />

                          {/* Data points */}
                          {salesCoords.map((c, i) => (
                            <circle
                              key={`s-${i}`}
                              cx={c.x}
                              cy={c.y}
                              r={activeTrendIdx === i ? 5 : 3.5}
                              fill="#10b981"
                              stroke="#ffffff"
                              strokeWidth="1.5"
                              className="cursor-pointer transition-all"
                              onMouseEnter={() => setActiveTrendIdx(i)}
                              onMouseLeave={() => setActiveTrendIdx(null)}
                            />
                          ))}
                          {procCoords.map((c, i) => (
                            <circle
                              key={`p-${i}`}
                              cx={c.x}
                              cy={c.y}
                              r={activeTrendIdx === i ? 5 : 3.5}
                              fill="#6366f1"
                              stroke="#ffffff"
                              strokeWidth="1.5"
                              className="cursor-pointer transition-all"
                              onMouseEnter={() => setActiveTrendIdx(i)}
                              onMouseLeave={() => setActiveTrendIdx(null)}
                            />
                          ))}

                          {/* X-axis date labels */}
                          {trendPoints.map((p, i) => (
                            <text
                              key={`t-${i}`}
                              x={50 + i * step}
                              y="202"
                              fontSize="10"
                              textAnchor="middle"
                              fill="currentColor"
                              opacity={activeTrendIdx === i ? '1' : '0.7'}
                              fontWeight={activeTrendIdx === i ? 'bold' : 'normal'}
                            >
                              {p.date}
                            </text>
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                </div>
              ) : (
                <div className="h-44 flex items-center justify-center text-xs text-slate-400">
                  No transaction data available for the chosen period and filter.
                </div>
              )}

              {/* Tooltip on active hover */}
              {activeTrendIdx !== null && trendPoints[activeTrendIdx] && (
                <div className="absolute top-2 right-4 bg-slate-900/90 text-white backdrop-blur-md px-3 py-2 rounded-xl text-xs space-y-1 shadow-lg border border-slate-700 pointer-events-none">
                  <div className="font-bold text-slate-200 border-b border-slate-700 pb-1">
                    {trendPoints[activeTrendIdx].date}
                  </div>
                  <div className="text-emerald-400 font-semibold flex justify-between gap-3">
                    <span>Revenue:</span>
                    <span>${trendPoints[activeTrendIdx].sales.toLocaleString()}</span>
                  </div>
                  <div className="text-indigo-400 font-semibold flex justify-between gap-3">
                    <span>Spend:</span>
                    <span>${trendPoints[activeTrendIdx].procurement.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Operational Flow Health & Queue Counts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                Operational Flow Health Summary
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <span className="text-xs text-slate-600 dark:text-slate-300">Manufacturing Yield Rate</span>
                  <span className="text-sm font-extrabold text-emerald-600">
                    {execData.kpis?.productionYieldRate ?? 100}%
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <span className="text-xs text-slate-600 dark:text-slate-300">Quality Control Pass Rate</span>
                  <span className="text-sm font-extrabold text-teal-600">
                    {execData.kpis?.qcPassRate ?? 100}%
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <span className="text-xs text-slate-600 dark:text-slate-300">Outstanding Receivables Exposure</span>
                  <span className="text-sm font-extrabold text-amber-600">
                    ${(execData.kpis?.outstandingReceivables ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-500" />
                Active Operational Queue Counts
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center">
                  <span className="block text-2xl font-black text-slate-900 dark:text-white">
                    {execData.summary?.activeWorkOrders ?? 0}
                  </span>
                  <span className="text-xs text-slate-500">Active Work Orders</span>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center">
                  <span className="block text-2xl font-black text-slate-900 dark:text-white">
                    {execData.summary?.openPurchaseOrders ?? 0}
                  </span>
                  <span className="text-xs text-slate-500">Open Purchase Orders</span>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center">
                  <span className="block text-2xl font-black text-slate-900 dark:text-white">
                    {execData.summary?.unpaidInvoices ?? 0}
                  </span>
                  <span className="text-xs text-slate-500">Unpaid Invoices</span>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center">
                  <span className="block text-2xl font-black text-slate-900 dark:text-white">
                    {execData.summary?.totalItems ?? 0}
                  </span>
                  <span className="text-xs text-slate-500">Active Item Catalog</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Production Analytics */}
      {activeTab === 'PRODUCTION' && prodData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs text-slate-400 font-semibold block uppercase">Total Production Orders</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">
                {prodData.totalOrders}
              </span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs text-slate-400 font-semibold block uppercase">Average Yield Rate</span>
              <span className="text-2xl font-black text-emerald-600 mt-1 block">{prodData.yieldRate}%</span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs text-slate-400 font-semibold block uppercase">Average Scrap Rate</span>
              <span className="text-2xl font-black text-rose-600 mt-1 block">{prodData.scrapRate}%</span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs text-slate-400 font-semibold block uppercase">Material Cost Variance</span>
              <span
                className={`text-2xl font-black mt-1 block ${
                  prodData.costVariance <= 0 ? 'text-emerald-600' : 'text-amber-600'
                }`}
              >
                ${Math.abs(prodData.costVariance).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Output vs Scrap Progress bar */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Factory className="w-4 h-4 text-indigo-500" />
                Physical Output vs Scrap Ratio
              </span>
              <span>
                Produced: <span className="text-emerald-600 font-extrabold">{prodData.totalProduced}</span> | Scrap: <span className="text-rose-600 font-extrabold">{prodData.totalScrap}</span>
              </span>
            </div>
            {(() => {
              const totalPhysical = (prodData.totalProduced || 0) + (prodData.totalScrap || 0) + (prodData.totalRejected || 0);
              const producedPct = totalPhysical > 0 ? ((prodData.totalProduced || 0) / totalPhysical) * 100 : 100;
              const scrapPct = totalPhysical > 0 ? ((prodData.totalScrap || 0) / totalPhysical) * 100 : 0;
              return (
                <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${producedPct}%` }}
                    className="bg-emerald-500 transition-all duration-500"
                    title={`Produced: ${producedPct.toFixed(1)}%`}
                  />
                  <div
                    style={{ width: `${scrapPct}%` }}
                    className="bg-rose-500 transition-all duration-500"
                    title={`Scrap: ${scrapPct.toFixed(1)}%`}
                  />
                </div>
              );
            })()}
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
              Work Order Status Distribution
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {Object.entries(prodData.statusDistribution || {}).map(([st, count]) => (
                <div key={st} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block truncate">{st}</span>
                  <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Inventory Health */}
      {activeTab === 'INVENTORY' && invData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Boxes className="w-4 h-4 text-blue-500" />
                Stock Health Distribution
              </h3>
              <span className="text-xs font-semibold text-slate-400">{invData.totalItems} Total SKUs</span>
            </div>

            {/* Health multi-color meter */}
            {(() => {
              const totalBalances =
                (invData.stockHealth?.healthy || 0) +
                (invData.stockHealth?.lowStock || 0) +
                (invData.stockHealth?.outOfStock || 0);
              const healthyPct = totalBalances > 0 ? (invData.stockHealth.healthy / totalBalances) * 100 : 0;
              const lowPct = totalBalances > 0 ? (invData.stockHealth.lowStock / totalBalances) * 100 : 0;
              const oosPct = totalBalances > 0 ? (invData.stockHealth.outOfStock / totalBalances) * 100 : 0;

              return (
                <div className="space-y-1.5">
                  <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                    <div
                      style={{ width: `${healthyPct}%` }}
                      className="bg-emerald-500 transition-all duration-500"
                    />
                    <div
                      style={{ width: `${lowPct}%` }}
                      className="bg-amber-500 transition-all duration-500"
                    />
                    <div
                      style={{ width: `${oosPct}%` }}
                      className="bg-rose-500 transition-all duration-500"
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>{healthyPct.toFixed(0)}% Healthy</span>
                    <span>{lowPct.toFixed(0)}% Reorder</span>
                    <span>{oosPct.toFixed(0)}% Out of Stock</span>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl">
                <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Healthy Stock</span>
                <span className="text-sm font-bold text-emerald-600">{invData.stockHealth?.healthy ?? 0} SKUs</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl">
                <span className="text-xs font-medium text-amber-800 dark:text-amber-300">Low Stock (At Reorder Level)</span>
                <span className="text-sm font-bold text-amber-600">{invData.stockHealth?.lowStock ?? 0} SKUs</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl">
                <span className="text-xs font-medium text-rose-800 dark:text-rose-300">Critical Stockout</span>
                <span className="text-sm font-bold text-rose-600">{invData.stockHealth?.outOfStock ?? 0} SKUs</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-500" />
              Warehouse Facility Distribution
            </h3>
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {invData.warehouseDistribution && invData.warehouseDistribution.length > 0 ? (
                invData.warehouseDistribution.map((w, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-xs text-slate-900 dark:text-white block">{w.name}</span>
                        <span className="text-[10px] text-slate-500">{w.count} items stored</span>
                      </div>
                      <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                        ${(w.value || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-slate-400">
                  No warehouse distribution records found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Sales & Revenue */}
      {activeTab === 'SALES' && salesData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Sales Revenue</span>
              <span className="text-2xl font-black text-emerald-600 mt-1 block">
                ${(salesData.totalRevenue || 0).toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">Across confirmed fulfillment</span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Sales Orders</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">
                {salesData.totalSalesOrders || 0}
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">In selected period</span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Average Order Value</span>
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
                ${(salesData.avgOrderValue || 0).toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">Per customer sales order</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Customers */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500" />
                Top Revenue Generating Customers
              </h3>
              <div className="space-y-3">
                {salesData.topCustomers && salesData.topCustomers.length > 0 ? (
                  salesData.topCustomers.map((c, idx) => {
                    const pct = salesData.totalRevenue > 0 ? ((c.revenue / salesData.totalRevenue) * 100) : 0;
                    return (
                      <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900 dark:text-white">{c.customerName}</span>
                          <span className="font-extrabold text-emerald-600">${c.revenue.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>{c.orderCount} orders</span>
                          <span>{pct.toFixed(1)}% of period sales</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${Math.min(pct, 100)}%` }}
                            className="bg-emerald-500 h-full rounded-full"
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-xs text-slate-400">
                    No customer sales records in this period.
                  </div>
                )}
              </div>
            </div>

            {/* Sales Status Breakdown */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-500" />
                Sales Order Lifecycle Breakdown
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(salesData.statusDistribution || {}).map(([st, cnt]) => (
                  <div key={st} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center">
                    <span className="text-xs font-semibold text-slate-400 block truncate">{st}</span>
                    <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
                      {cnt}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Procurement & Spend */}
      {activeTab === 'PROCUREMENT' && procData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total PO Spend</span>
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
                ${(procData.totalSpend || 0).toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">Committed vendor orders</span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Purchase Orders</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">
                {procData.totalPurchaseOrders || 0}
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">In selected period</span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Average PO Value</span>
              <span className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1 block">
                ${(procData.avgPOValue || 0).toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">Average procurement batch</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Suppliers */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-500" />
                Top Vendor Spend Allocations
              </h3>
              <div className="space-y-3">
                {procData.topSuppliers && procData.topSuppliers.length > 0 ? (
                  procData.topSuppliers.map((s, idx) => {
                    const pct = procData.totalSpend > 0 ? ((s.spend / procData.totalSpend) * 100) : 0;
                    return (
                      <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900 dark:text-white">{s.supplierName}</span>
                          <span className="font-extrabold text-indigo-600 dark:text-indigo-400">${s.spend.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>{s.orderCount} POs</span>
                          <span>{pct.toFixed(1)}% of total spend</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${Math.min(pct, 100)}%` }}
                            className="bg-indigo-500 h-full rounded-full"
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-xs text-slate-400">
                    No supplier spend records in this period.
                  </div>
                )}
              </div>
            </div>

            {/* PO Status Breakdown */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-500" />
                Procurement Pipeline Status
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(procData.statusDistribution || {}).map(([st, cnt]) => (
                  <div key={st} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center">
                    <span className="text-xs font-semibold text-slate-400 block truncate">{st}</span>
                    <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
                      {cnt}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: QC Analytics */}
      {activeTab === 'QC' && qcData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-500" />
              Quality Inspection Pass Rate
            </h3>
            <div className="flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-800/50 rounded-2xl space-y-3">
              {/* Radial gauge */}
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-slate-200 dark:text-slate-700"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#10b981"
                    strokeWidth="8"
                    strokeDasharray={251.2}
                    strokeDashoffset={251.2 * (1 - (qcData.passRate || 0) / 100)}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                    {qcData.passRate}%
                  </span>
                  <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                    Pass Rate
                  </span>
                </div>
              </div>
              <span className="text-xs text-slate-500 font-medium text-center">
                Across {qcData.totalInspections} Verified Production & Inbound Inspections
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Disposition Allocation Breakdown</h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl">
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  Accepted & Credited into Stock
                </span>
                <span className="text-sm font-bold text-emerald-600">
                  {qcData.dispositionDistribution?.accepted ?? qcData.acceptedUnits ?? 0} units
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl">
                <span className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                  Rejected / Scrapped
                </span>
                <span className="text-sm font-bold text-rose-600">
                  {qcData.dispositionDistribution?.rejected ?? qcData.rejectedUnits ?? 0} units
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl">
                <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">Held in Quarantine</span>
                <span className="text-sm font-bold text-amber-600">
                  {qcData.dispositionDistribution?.held ?? qcData.heldUnits ?? 0} units
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl">
                <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">Sent for Rework</span>
                <span className="text-sm font-bold text-blue-600">
                  {qcData.dispositionDistribution?.rework ?? qcData.reworkUnits ?? 0} units
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
