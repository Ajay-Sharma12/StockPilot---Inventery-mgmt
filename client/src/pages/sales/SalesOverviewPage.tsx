import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  ShoppingCart,
  Clock,
  PackageCheck,
  Truck,
  ShieldCheck,
  Receipt,
  DollarSign,
  ArrowUpRight,
  Search,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Check,
  CheckCircle2,
  AlertCircle,
  FileText,
  Boxes,
  Activity,
  FileCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { salesApi, SalesDashboardStats, SalesOrder, SalesLineageDag } from '../../api/sales.api';
import { usePermissions } from '../../hooks/usePermissions';
import { Skeleton } from '../../components/ui/Skeleton';

const LOOKUP_OPTIONS = [
  {
    value: 'SO',
    label: 'Sales Order',
    badge: 'SO',
    badgeColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    icon: ShoppingCart,
    iconColor: 'text-indigo-400',
    placeholder: 'e.g. SO-00001 or Order ID...',
  },
  {
    value: 'PACKAGE',
    label: 'Package',
    badge: 'PKG',
    badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    icon: Boxes,
    iconColor: 'text-amber-400',
    placeholder: 'e.g. PKG-00001 or Package ID...',
  },
  {
    value: 'DISPATCH',
    label: 'Dispatch',
    badge: 'DSP',
    badgeColor: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    icon: Truck,
    iconColor: 'text-sky-400',
    placeholder: 'e.g. DSP-00001 or Dispatch ID...',
  },
  {
    value: 'GATE_PASS',
    label: 'Gate Pass',
    badge: 'GP',
    badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    icon: ShieldCheck,
    iconColor: 'text-emerald-400',
    placeholder: 'e.g. GP-00001 or Pass ID...',
  },
  {
    value: 'INVOICE',
    label: 'Invoice',
    badge: 'INV',
    badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    icon: Receipt,
    iconColor: 'text-purple-400',
    placeholder: 'e.g. INV-00001 or Invoice ID...',
  },
  {
    value: 'PAYMENT',
    label: 'Payment',
    badge: 'PAY',
    badgeColor: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
    icon: DollarSign,
    iconColor: 'text-teal-400',
    placeholder: 'e.g. PAY-00001 or Payment ID...',
  },
];

export const SalesOverviewPage: React.FC = () => {
  const { can } = usePermissions();
  const [stats, setStats] = useState<SalesDashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Traceability Quick Lookup
  const [lookupType, setLookupType] = useState('SO');
  const [lookupId, setLookupId] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [lineageResult, setLineageResult] = useState<SalesLineageDag | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, ordersData] = await Promise.all([
        salesApi.getDashboardStats(),
        salesApi.getSalesOrders({ limit: 6 }),
      ]);
      setStats(statsData);
      setRecentOrders(ordersData.data || []);
    } catch (err) {
      console.error('Failed to load sales dashboard stats', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTraceabilityLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupId.trim()) return;
    try {
      setLookupLoading(true);
      setLookupError('');
      setLineageResult(null);
      const data = await salesApi.getLineage(lookupType, lookupId.trim());
      setLineageResult(data);
    } catch (err: any) {
      setLookupError(err.response?.data?.message || 'No linked lineage found for this document');
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl border border-indigo-500/30 text-indigo-400">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Sales & Order-to-Cash Hub</h1>
              <p className="text-sm text-slate-400">
                End-to-end execution: Orders &rarr; Allocation &rarr; Packaging &rarr; Dispatch &rarr; Gate Pass &rarr; Invoicing &rarr; Payments
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/sales/quotations"
            className="flex items-center gap-2 px-3.5 py-2 bg-sky-50 hover:bg-sky-100 dark:bg-sky-500/15 dark:hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 rounded-lg text-xs font-semibold border border-sky-300 dark:border-sky-500/30 transition shadow-xs"
          >
            <FileCheck className="w-4 h-4 text-sky-600 dark:text-sky-300" />
            <span>Quotations (Pre-Sales)</span>
          </Link>
          <Link
            to="/sales/orders"
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/25 transition"
          >
            <ShoppingCart className="w-4 h-4 text-white" />
            <span className="text-white">Manage Orders</span>
          </Link>
          <Link
            to="/sales/packaging"
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 transition shadow-xs"
          >
            <Boxes className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            <span>Packaging Bay</span>
          </Link>
          <Link
            to="/sales/dispatches"
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 transition shadow-xs"
          >
            <Truck className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            <span>Dispatches</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Orders This Month */}
        <div className="bg-white dark:bg-slate-900/60 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Orders This Month</span>
            <ShoppingCart className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {loading ? <Skeleton className="h-7 w-16 bg-slate-200 dark:bg-slate-800" /> : stats?.ordersThisMonth || 0}
          </div>
          <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 font-bold">
            {loading ? <Skeleton className="h-3.5 w-24 bg-slate-200 dark:bg-slate-800 mt-1" /> : `$${(stats?.totalOrderValueThisMonth || 0).toLocaleString()}`}
          </div>
        </div>

        {/* Pending Approval */}
        <div className="bg-white dark:bg-slate-900/60 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Pending Approval</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
            {loading ? <Skeleton className="h-7 w-14 bg-slate-200 dark:bg-slate-800" /> : stats?.pendingApprovalCount || 0}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Awaiting Manager / Admin Sign-off</div>
        </div>

        {/* Ready to Pack */}
        <div className="bg-white dark:bg-slate-900/60 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Packaging Queue</span>
            <PackageCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400">
            {loading ? <Skeleton className="h-7 w-14 bg-slate-200 dark:bg-slate-800" /> : stats?.readyForPackagingCount || 0}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Confirmed &amp; Stock Reserved</div>
        </div>

        {/* Dispatches Today */}
        <div className="bg-white dark:bg-slate-900/60 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Dispatches Today</span>
            <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {loading ? <Skeleton className="h-7 w-14 bg-slate-200 dark:bg-slate-800" /> : stats?.todayDispatchesCount || 0}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Outbound Logistics Active</div>
        </div>

        {/* Gate Passes */}
        <div className="bg-white dark:bg-slate-900/60 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Gate Passes</span>
            <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
            {loading ? <Skeleton className="h-7 w-14 bg-slate-200 dark:bg-slate-800" /> : stats?.pendingGatePassesCount || 0}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Security Clearance Queue</div>
        </div>

        {/* Receivables */}
        <div className="bg-white dark:bg-slate-900/60 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Receivables</span>
            <DollarSign className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="text-2xl font-black text-teal-600 dark:text-teal-400">
            {loading ? <Skeleton className="h-7 w-20 bg-slate-200 dark:bg-slate-800" /> : `$${(stats?.outstandingReceivables || 0).toLocaleString()}`}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {stats?.overdueInvoicesCount ? `${stats.overdueInvoicesCount} Overdue` : 'All within terms'}
          </div>
        </div>
      </div>

      {/* Bi-Directional Lineage DAG Traceability Visualizer */}
      <div className="bg-white dark:bg-slate-900/60 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Full Lineage DAG Traceability</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Query any sales document ID or document number to trace its upstream &amp; downstream chain across Customer &harr; SO &harr; Package &harr; Dispatch &harr; Gate Pass &harr; Invoice &harr; Payment
            </p>
          </div>

          {/* Lookup Form */}
          {(() => {
            const selectedOpt = LOOKUP_OPTIONS.find((opt) => opt.value === lookupType) || LOOKUP_OPTIONS[0];
            const SelectedIcon = selectedOpt.icon;
            return (
              <form onSubmit={handleTraceabilityLookup} className="flex flex-wrap items-center gap-2.5">
                {/* Custom Modern Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700/80 shadow-xs transition hover:border-indigo-400 dark:hover:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
                  >
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center bg-slate-200/80 dark:bg-slate-700/60 ${selectedOpt.iconColor}`}>
                      <SelectedIcon className="w-3.5 h-3.5" />
                    </div>
                    <span>{selectedOpt.label}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${selectedOpt.badgeColor}`}>
                      {selectedOpt.badge}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                        isDropdownOpen ? 'rotate-180 text-indigo-500' : ''
                      }`}
                    />
                  </button>

                  {/* Floating Options Menu */}
                  {isDropdownOpen && (
                    <div className="absolute left-0 top-full mt-1.5 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-md">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 py-1.5 mb-1">
                        Select Target Document
                      </div>
                      <div className="space-y-1">
                        {LOOKUP_OPTIONS.map((opt) => {
                          const Icon = opt.icon;
                          const isSelected = opt.value === lookupType;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setLookupType(opt.value);
                                setIsDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition text-left cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-50 dark:bg-indigo-600/15 text-indigo-600 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-500/30'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-6 h-6 rounded-md flex items-center justify-center ${
                                    isSelected
                                      ? 'bg-indigo-100 dark:bg-indigo-500/20'
                                      : 'bg-slate-100 dark:bg-slate-800'
                                  } ${opt.iconColor}`}
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                </div>
                                <span>{opt.label}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${opt.badgeColor}`}>
                                  {opt.badge}
                                </span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Input with contextual placeholder */}
                <input
                  type="text"
                  placeholder={selectedOpt.placeholder}
                  value={lookupId}
                  onChange={(e) => setLookupId(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-white rounded-xl px-3.5 py-2 text-xs w-68 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 font-mono transition"
                />

                {/* Trace Button */}
                <button
                  type="submit"
                  disabled={lookupLoading || !lookupId.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:cursor-not-allowed"
                >
                  <Search className="w-3.5 h-3.5 text-white" />
                  <span className="text-white">{lookupLoading ? 'Tracing...' : 'Trace DAG'}</span>
                </button>
              </form>
            );
          })()}
        </div>

        {lookupError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{lookupError}</span>
          </div>
        )}

        {/* Visual Lineage DAG Display */}
        {lookupLoading ? (
          <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800/80 overflow-x-auto">
            <div className="flex items-center gap-3 min-w-max pb-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <React.Fragment key={i}>
                  <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-52 shadow-xs space-y-2">
                    <Skeleton className="h-3 w-20 bg-slate-200 dark:bg-slate-800" />
                    <Skeleton className="h-4 w-32 bg-slate-200 dark:bg-slate-800" />
                    <Skeleton className="h-3 w-24 bg-slate-200 dark:bg-slate-800/60" />
                  </div>
                  {i < 4 && <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-700 flex-shrink-0" />}
                </React.Fragment>
              ))}
            </div>
          </div>
        ) : lineageResult ? (
          <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800/80 overflow-x-auto">
            <div className="flex items-center gap-3 min-w-max pb-2">
              {/* Customer Node */}
              {lineageResult.customer && (
                <>
                  <div className="p-3 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-500/40 rounded-xl w-52 shadow-xs">
                    <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">Customer</div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate mt-0.5">{lineageResult.customer.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{lineageResult.customer.customerCode}</div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">Limit: ${(lineageResult.customer.creditLimit || 0).toLocaleString()}</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-600 flex-shrink-0" />
                </>
              )}

              {/* Sales Order Node */}
              {lineageResult.salesOrder && (
                <>
                  <div className="p-3 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-500/40 rounded-xl w-56 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">Sales Order</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        lineageResult.salesOrder.status === 'FULFILLED' ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' :
                        lineageResult.salesOrder.status === 'CONFIRMED' ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400' : 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                      }`}>
                        {lineageResult.salesOrder.status}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white mt-1">{lineageResult.salesOrder.soNumber}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Total: ${(lineageResult.salesOrder.grandTotal ?? 0).toLocaleString()}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{lineageResult.salesOrder.items?.length || 0} line item(s)</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-600 flex-shrink-0" />
                </>
              )}

              {/* Packaging Node */}
              <div className="p-3 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/40 rounded-xl w-52 shadow-xs">
                <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">Packages ({lineageResult.packages.length})</div>
                {lineageResult.packages.length > 0 ? (
                  <div className="mt-1 space-y-1">
                    {lineageResult.packages.map((p) => (
                      <div key={p._id} className="text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span>{p.packageNumber}</span>
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-semibold">{p.status}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 dark:text-slate-500 italic mt-1">Pending Packing</div>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-600 flex-shrink-0" />

              {/* Dispatch Node */}
              <div className="p-3 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-500/40 rounded-xl w-56 shadow-xs">
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Dispatches ({lineageResult.dispatches.length})</div>
                {lineageResult.dispatches.length > 0 ? (
                  <div className="mt-1 space-y-1">
                    {lineageResult.dispatches.map((d) => (
                      <div key={d._id} className="text-xs text-slate-700 dark:text-slate-300">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900 dark:text-white">{d.dispatchNumber}</span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-semibold">{d.status}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">{d.carrier || 'Standard Freight'} &bull; {d.vehicleNumber || 'No vehicle'}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 dark:text-slate-500 italic mt-1">Awaiting Dispatch</div>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-600 flex-shrink-0" />

              {/* Gate Pass Node */}
              <div className="p-3 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-500/40 rounded-xl w-52 shadow-xs">
                <div className="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider">Gate Passes ({lineageResult.gatePasses.length})</div>
                {lineageResult.gatePasses.length > 0 ? (
                  <div className="mt-1 space-y-1">
                    {lineageResult.gatePasses.map((gp) => (
                      <div key={gp._id} className="text-xs text-slate-700 dark:text-slate-300">
                        <div className="flex items-center justify-between">
                          <span>{gp.gatePassNumber}</span>
                          <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">{gp.status}</span>
                        </div>
                        {gp.gateOutTime && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Exited: {new Date(gp.gateOutTime).toLocaleTimeString()}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 dark:text-slate-500 italic mt-1">Not Generated</div>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-600 flex-shrink-0" />

              {/* Invoice Node */}
              <div className="p-3 bg-white dark:bg-slate-900 border border-cyan-200 dark:border-cyan-500/40 rounded-xl w-52 shadow-xs">
                <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold uppercase tracking-wider">Invoices ({lineageResult.invoices.length})</div>
                {lineageResult.invoices.length > 0 ? (
                  <div className="mt-1 space-y-1">
                    {lineageResult.invoices.map((inv) => (
                      <div key={inv._id} className="text-xs text-slate-700 dark:text-slate-300">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900 dark:text-white">{inv.invoiceNumber}</span>
                          <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-semibold">{inv.status}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Total: ${(inv.grandTotal ?? 0).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 dark:text-slate-500 italic mt-1">Not Invoiced</div>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-600 flex-shrink-0" />

              {/* Payments Node */}
              <div className="p-3 bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-500/40 rounded-xl w-52 shadow-xs">
                <div className="text-[10px] text-teal-600 dark:text-teal-400 font-bold uppercase tracking-wider">Collections ({lineageResult.payments.length})</div>
                {lineageResult.payments.length > 0 ? (
                  <div className="mt-1 space-y-1">
                    {lineageResult.payments.map((p) => (
                      <div key={p._id} className="text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span>{p.paymentNumber}</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">${(p.amount ?? 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 dark:text-slate-500 italic mt-1">Awaiting Collection</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-2 text-center py-8 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
            Enter an active Sales Order #, Dispatch #, or Invoice # above to view the live bi-directional DAG graph.
          </div>
        )}
      </div>

      {/* Operational Pipeline Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders List */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900/60 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Recent Sales Orders</span>
            </h2>
            <Link to="/sales/orders" className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 flex items-center gap-1 font-semibold">
              <span>View all</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Order Number</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3 text-right">Grand Total</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-3"><Skeleton className="h-4 w-24 bg-slate-200 dark:bg-slate-800" /></td>
                      <td className="py-3 px-3"><Skeleton className="h-4 w-32 bg-slate-200 dark:bg-slate-800" /></td>
                      <td className="py-3 px-3"><Skeleton className="h-4 w-20 bg-slate-200 dark:bg-slate-800" /></td>
                      <td className="py-3 px-3 text-right"><Skeleton className="h-4 w-16 ml-auto bg-slate-200 dark:bg-slate-800" /></td>
                      <td className="py-3 px-3 text-center"><Skeleton className="h-5 w-20 rounded-full mx-auto bg-slate-200 dark:bg-slate-800" /></td>
                      <td className="py-3 px-3 text-right"><Skeleton className="h-6 w-14 rounded ml-auto bg-slate-200 dark:bg-slate-800" /></td>
                    </tr>
                  ))
                ) : recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-500">
                      No sales orders found.
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((so) => (
                    <tr key={so._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                      <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">{so.soNumber}</td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-medium truncate max-w-[160px]">
                        {so.customerId?.name || 'Customer'}
                      </td>
                      <td className="py-3 px-3 text-slate-500 dark:text-slate-400">
                        {new Date(so.orderDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                        ${(so.grandTotal ?? 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          so.status === 'FULFILLED' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' :
                          so.status === 'CONFIRMED' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20' :
                          so.status === 'APPROVED' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20' :
                          so.status === 'SUBMITTED' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20' :
                          so.status === 'CANCELLED' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20' :
                          'bg-slate-100 dark:bg-slate-700/30 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}>
                          {so.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Link
                          to={`/sales/orders?id=${so._id}`}
                          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-semibold inline-flex items-center gap-1"
                        >
                          <span>Manage</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Navigation & Module Links */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900/60 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Order-to-Cash Submodules</h3>
            <div className="space-y-2">
              <Link
                to="/sales/orders"
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">Sales Orders</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Quotes, draft, submit &amp; ABAC sign-off</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </Link>

              <Link
                to="/sales/packaging"
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-lg">
                    <Boxes className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">Packaging Station</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Containers, crates &amp; batch pack verification</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </Link>

              <Link
                to="/sales/dispatches"
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">Outbound Dispatches</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Physical inventory issue &amp; carrier booking</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </Link>

              <Link
                to="/sales/gate-passes"
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">Security Gate Passes</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Gate officer clearance &amp; gate-out timestamp</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </Link>

              <Link
                to="/sales/invoices"
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-lg">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">Customer Invoices</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Operational billing &amp; tax calculation</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </Link>

              <Link
                to="/sales/payments"
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-lg">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">Payments &amp; Collections</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Receivables tracking &amp; settlement</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
