import React, { useState, useEffect } from 'react';
import {
  Factory,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Play,
  Clock,
  ArrowRight,
  TrendingUp,
  Search,
  Plus,
  Compass,
  FileSpreadsheet,
  Boxes,
  ShieldCheck,
  Percent,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { productionApi, ProductionOverviewStats, ProductionOrder, ProductionTraceabilityDAG } from '../../api/production.api';
import { usePermissions } from '../../hooks/usePermissions';

export const ProductionOverviewPage: React.FC = () => {
  const { can } = usePermissions();
  const [stats, setStats] = useState<ProductionOverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Quick Traceability Search
  const [lookupType, setLookupType] = useState<'ORDER' | 'BOM' | 'BATCH' | 'QC'>('ORDER');
  const [lookupId, setLookupId] = useState('');
  const [traceResult, setTraceResult] = useState<ProductionTraceabilityDAG | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await productionApi.getOverview();
      setStats(data);
    } catch (err) {
      console.error('Failed to load production overview', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTraceLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupId.trim()) return;
    try {
      setTraceLoading(true);
      setTraceError('');
      const res = await productionApi.getLineage(lookupType, lookupId.trim());
      setTraceResult(res);
    } catch (err: any) {
      setTraceError(err.response?.data?.message || 'Traceability record not found');
      setTraceResult(null);
    } finally {
      setTraceLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-2xl shadow-xl border border-slate-800 text-white">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Factory className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Production & Manufacturing Control</h1>
              <p className="text-sm text-slate-300">
                Discrete manufacturing, multi-level BOMs, material reservation, and finished goods quality gating
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/production/planning"
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-medium transition-all shadow-sm"
          >
            <Compass className="w-4 h-4 text-cyan-400" />
            MRP Planning
          </Link>
          <Link
            to="/production/boms"
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-medium transition-all shadow-sm"
          >
            <Layers className="w-4 h-4 text-emerald-400" />
            BOM Recipes
          </Link>
          {can('production.create') && (
            <Link
              to="/production/orders"
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-600/30"
            >
              <Plus className="w-4 h-4" />
              New Work Order
            </Link>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Work Orders
            </span>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Factory className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">
              {loading ? '...' : stats?.totalOrders || 0}
            </span>
            <span className="text-xs text-slate-500">all time</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/60 pt-3">
            <span>Planned: {stats?.plannedOrders || 0}</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Completed: {stats?.completedOrders || 0}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Active Production Runs
            </span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/50 rounded-xl text-amber-600 dark:text-amber-400">
              <Play className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">
              {loading ? '...' : stats?.activeOrders || 0}
            </span>
            <span className="text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full">
              In Shop Floor
            </span>
          </div>
          <div className="mt-3 flex items-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/60 pt-3">
            <span>Allocating live inventory stock</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Active BOM Recipes
            </span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600 dark:text-emerald-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">
              {loading ? '...' : stats?.activeBOMCount || 0}
            </span>
            <span className="text-xs text-emerald-600">Active v1/v2</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/60 pt-3">
            <span>Cycle-free verified DAGs</span>
            <Link to="/production/boms" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              View &rarr;
            </Link>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              QC Inspection Queue
            </span>
            <div className="p-2 bg-cyan-50 dark:bg-cyan-950/50 rounded-xl text-cyan-600 dark:text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">
              {loading ? '...' : stats?.pendingQCInspections || 0}
            </span>
            <span className="text-xs font-medium text-cyan-600 bg-cyan-50 dark:bg-cyan-950/60 px-2 py-0.5 rounded-full">
              Pending Gating
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/60 pt-3">
            <span>Finished batches awaiting sign-off</span>
            <Link to="/production/qc" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              Inspect &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Fast Navigation Quick-Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
        <Link
          to="/production/orders"
          className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-800 transition-all text-center group"
        >
          <Factory className="w-5 h-5 text-indigo-600 group-hover:scale-110 transition-transform mb-2" />
          <span className="text-xs font-semibold text-slate-900 dark:text-white">Work Orders</span>
          <span className="text-[10px] text-slate-500">Pipeline & Status</span>
        </Link>
        <Link
          to="/production/boms"
          className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-800 transition-all text-center group"
        >
          <Layers className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform mb-2" />
          <span className="text-xs font-semibold text-slate-900 dark:text-white">BOM Builder</span>
          <span className="text-[10px] text-slate-500">Versions & Scrap %</span>
        </Link>
        <Link
          to="/production/planning"
          className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-800 transition-all text-center group"
        >
          <Compass className="w-5 h-5 text-cyan-600 group-hover:scale-110 transition-transform mb-2" />
          <span className="text-xs font-semibold text-slate-900 dark:text-white">MRP Calculator</span>
          <span className="text-[10px] text-slate-500">Gross & Net Shortage</span>
        </Link>
        <Link
          to="/production/materials"
          className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-800 transition-all text-center group"
        >
          <Boxes className="w-5 h-5 text-amber-600 group-hover:scale-110 transition-transform mb-2" />
          <span className="text-xs font-semibold text-slate-900 dark:text-white">Material Issuance</span>
          <span className="text-[10px] text-slate-500">Reserved Consumption</span>
        </Link>
        <Link
          to="/production/batches"
          className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-800 transition-all text-center group"
        >
          <Percent className="w-5 h-5 text-purple-600 group-hover:scale-110 transition-transform mb-2" />
          <span className="text-xs font-semibold text-slate-900 dark:text-white">Batch Registry</span>
          <span className="text-[10px] text-slate-500">Lot Allocation</span>
        </Link>
        <Link
          to="/production/qc"
          className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-800 transition-all text-center group"
        >
          <ShieldCheck className="w-5 h-5 text-teal-600 group-hover:scale-110 transition-transform mb-2" />
          <span className="text-xs font-semibold text-slate-900 dark:text-white">Production QC</span>
          <span className="text-[10px] text-slate-500">Checklist & Gating</span>
        </Link>
      </div>

      {/* Main Grid: Recent Orders & Interactive Traceability Lookup */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Work Orders (2 Columns) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Work Orders</h2>
              <p className="text-xs text-slate-500">Live execution queue on plant floor</p>
            </div>
            <Link
              to="/production/orders"
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              View All Orders &rarr;
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 uppercase border-y border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-3">Order #</th>
                  <th className="py-3 px-3">Manufactured Item</th>
                  <th className="py-3 px-3">Planned Qty</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Loading orders...
                    </td>
                  </tr>
                ) : !stats?.recentOrders || stats.recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No recent work orders found.
                    </td>
                  </tr>
                ) : (
                  stats.recentOrders.map((order) => (
                    <tr key={order._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-3 font-semibold text-indigo-600 dark:text-indigo-400">
                        {order.productionOrderNumber}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {order.productionItemId?.name || (typeof order.productionItemId === 'string' ? order.productionItemId : 'Manufactured Item')}
                        </div>
                        <div className="text-xs text-slate-500">{order.productionItemId?.sku || 'N/A'}</div>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-700 dark:text-slate-300">
                        {order.plannedQuantity} {order.uomId?.code || (typeof order.uomId === 'string' ? '' : 'PCS')}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            order.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                              : order.status === 'IN_PROGRESS'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                              : order.status === 'RELEASED'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400'
                              : order.status === 'PAUSED'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Link
                          to={`/production/orders`}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                        >
                          Manage &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bi-directional Traceability Quick Console (1 Column) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Compass className="w-5 h-5 text-indigo-500" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Audit Lineage Explorer</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Inspect full Bi-Directional DAG: BOM &rarr; Work Order &rarr; Materials &rarr; Batch &rarr; QC &rarr; Ledger
            </p>

            <form onSubmit={handleTraceLookup} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLookupType('ORDER')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    lookupType === 'ORDER'
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Order #
                </button>
                <button
                  type="button"
                  onClick={() => setLookupType('BATCH')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    lookupType === 'BATCH'
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Batch #
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={lookupId}
                  onChange={(e) => setLookupId(e.target.value)}
                  placeholder={lookupType === 'ORDER' ? 'e.g. PROD-202609-001' : 'e.g. BAT-202609-001'}
                  className="w-full px-3 py-2 pl-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>

              <button
                type="submit"
                disabled={traceLoading}
                className="w-full py-2 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {traceLoading ? 'Querying Graph...' : 'Trace Complete Lineage'}
              </button>
            </form>

            {traceError && (
              <div className="mt-3 p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{traceError}</span>
              </div>
            )}

            {traceResult && (
              <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                <div className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Lineage Verified
                </div>
                <div className="text-slate-700 dark:text-slate-300">
                  <span className="font-medium text-slate-500">BOM:</span> {traceResult.bom?.bomNumber || 'N/A'} (v
                  {traceResult.bom?.version || 1})
                </div>
                <div className="text-slate-700 dark:text-slate-300">
                  <span className="font-medium text-slate-500">Order:</span>{' '}
                  {traceResult.productionOrder?.productionOrderNumber}
                </div>
                <div className="text-slate-700 dark:text-slate-300">
                  <span className="font-medium text-slate-500">Allocated Batch:</span>{' '}
                  {traceResult.batch?.batchNumber || 'In Progress'}
                </div>
                <div className="text-slate-700 dark:text-slate-300">
                  <span className="font-medium text-slate-500">QC Status:</span>{' '}
                  <span className="font-bold">{traceResult.qcInspection?.status || 'PENDING'}</span> (
                  {traceResult.qcInspection?.disposition || 'Pending Inspection'})
                </div>
                <div className="text-slate-700 dark:text-slate-300">
                  <span className="font-medium text-slate-500">Materials:</span>{' '}
                  {traceResult.materials?.length || 0} items allocated
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
            <Link
              to="/production/traceability"
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Open Full Interactive DAG Visualizer &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
