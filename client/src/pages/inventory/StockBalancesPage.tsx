import React, { useState, useEffect } from 'react';
import {
  Layers,
  Search,
  Filter,
  Warehouse as WarehouseIcon,
  RefreshCw,
  AlertTriangle,
  Lock,
  Boxes,
  DollarSign,
  TrendingDown,
  ShieldAlert,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { inventoryApi } from '../../api/inventory.api';
import { warehouseApi } from '../../api/warehouse.api';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

export const StockBalancesPage: React.FC = () => {
  const { user } = useAuth();
  const [balances, setBalances] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Live Auto-Sync engine
  const [liveSync, setLiveSync] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  const isAdmin =
    Boolean(user?.isSuperAdmin) ||
    user?.roles?.some((r: any) => {
      const name = typeof r === 'string' ? r : r?.slug || r?.name;
      return ['tenant-admin', 'super-admin', 'admin', 'Tenant Administrator', 'Super Administrator'].includes(name);
    }) ||
    user?.permissions?.includes('*') ||
    user?.permissions?.includes('warehouses:manage') ||
    user?.permissions?.includes('inventory:manage');

  const warehouseScope = isAdmin ? [] : (user?.accessScope?.warehouses || []);
  const hasRestrictedScope = !isAdmin && warehouseScope.length > 0;

  const loadWarehouses = async () => {
    try {
      const data = await warehouseApi.getWarehouses();
      setWarehouses(data || []);
    } catch (err) {
      console.error('Failed to load warehouses', err);
    }
  };

  const loadBalances = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await inventoryApi.getBalances({
        warehouseId: selectedWarehouse || undefined,
        lowStockOnly: lowStockOnly || (statusFilter === 'LOW_OR_CRITICAL') || undefined,
        limit: 100,
      });
      setBalances(res.data || []);
      setLastSyncTime(new Date());
    } catch (err) {
      console.error('Failed to load stock balances', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await Promise.all([loadWarehouses(), loadBalances(false)]);
    } finally {
      setTimeout(() => setRefreshing(false), 300);
    }
  };

  useEffect(() => {
    loadWarehouses();
  }, []);

  useEffect(() => {
    loadBalances(false);
  }, [selectedWarehouse, lowStockOnly, statusFilter]);

  // Live background polling interval (every 15 seconds)
  useEffect(() => {
    if (!liveSync) return;
    const interval = setInterval(() => {
      loadBalances(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [liveSync, selectedWarehouse, lowStockOnly, statusFilter]);

  // Derived KPI Metrics
  const totalSkus = new Set(balances.map((b) => b.item?.sku).filter(Boolean)).size;
  const totalPhysical = balances.reduce((acc, b) => acc + (Number(b.quantity) || 0), 0);
  const totalAvailable = balances.reduce((acc, b) => acc + (Number(b.availableQuantity) || 0), 0);
  const totalReserved = balances.reduce((acc, b) => acc + (Number(b.reservedQuantity) || 0), 0);
  const totalValuation = balances.reduce((acc, b) => acc + (Number(b.totalValue) || 0), 0);
  const criticalCount = balances.filter((b) => b.stockStatus === 'CRITICAL' || b.stockStatus === 'OUT_OF_STOCK').length;
  const lowCount = balances.filter((b) => b.stockStatus === 'LOW').length;

  const filteredBalances = balances.filter((b) => {
    if (selectedWarehouse) {
      const whId = b.warehouse?.id || b.warehouse?._id;
      const whCode = b.warehouse?.code;
      if (
        whId &&
        String(whId) !== String(selectedWarehouse) &&
        whCode !== String(selectedWarehouse)
      ) {
        return false;
      }
    }

    if (search) {
      const q = search.toLowerCase();
      const match =
        b.item?.sku?.toLowerCase().includes(q) ||
        b.item?.name?.toLowerCase().includes(q) ||
        b.warehouse?.name?.toLowerCase().includes(q) ||
        b.location?.code?.toLowerCase().includes(q) ||
        b.location?.name?.toLowerCase().includes(q) ||
        b.batchNumber?.toLowerCase().includes(q);
      if (!match) return false;
    }

    if (statusFilter === 'OUT_OF_STOCK') return b.stockStatus === 'OUT_OF_STOCK';
    if (statusFilter === 'CRITICAL') return b.stockStatus === 'CRITICAL';
    if (statusFilter === 'LOW') return b.stockStatus === 'LOW';
    if (statusFilter === 'NORMAL') return b.stockStatus === 'NORMAL';
    if (statusFilter === 'LOW_OR_CRITICAL') return b.stockStatus !== 'NORMAL';

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <Layers className="w-7 h-7 text-emerald-400" />
              Live Stock Balances
            </h1>

            {/* Live Sync Status Indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700 text-xs">
              <span className="relative flex h-2 w-2">
                {liveSync && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${liveSync ? 'bg-emerald-500' : 'bg-slate-500'}`}></span>
              </span>
              <span className={`text-[11px] font-medium ${liveSync ? 'text-emerald-400' : 'text-slate-400'}`}>
                {liveSync ? 'Live Sync Active (15s)' : 'Live Sync Paused'}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time physical inventory levels, allocated reservations, and facility valuation updated live
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLiveSync(!liveSync)}
            className={`text-xs border ${
              liveSync
                ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/30'
                : 'border-slate-700 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5 mr-1.5" />
            {liveSync ? 'Pause Live Sync' : 'Resume Live Sync'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="text-xs border-slate-700 hover:bg-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing || loading ? 'animate-spin text-emerald-400' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>

          <Link to="/inventory">
            <Button variant="primary" size="sm" className="text-xs bg-emerald-600 hover:bg-emerald-500">
              Quick Stock Action &rarr;
            </Button>
          </Link>
        </div>
      </div>

      {/* Live Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1">
            <span>Tracked SKUs</span>
            <Boxes className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white font-mono">{totalSkus}</div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Across facilities</span>
        </Card>

        <Card className="bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1">
            <span>Physical Stock</span>
            <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white font-mono">{totalPhysical.toLocaleString()}</div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Total on-hand units</span>
        </Card>

        <Card className="bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1">
            <span>Available to Issue</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">{totalAvailable.toLocaleString()}</div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Free unallocated</span>
        </Card>

        <Card className="bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1">
            <span>Allocated / Reserved</span>
            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-300 font-mono">{totalReserved.toLocaleString()}</div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Committed orders</span>
        </Card>

        <Card className="bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1">
            <span>Stock Valuation</span>
            <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white font-mono">${totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Weighted avg cost</span>
        </Card>

        <Card className="bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1">
            <span>Reorder Alerts</span>
            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400 font-mono">{criticalCount + lowCount}</div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">{criticalCount} critical, {lowCount} low</span>
        </Card>
      </div>

      {/* ABAC Scope Alert Banner (if user has limited facility access) */}
      {hasRestrictedScope && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-blue-950/40 border border-blue-800/40 text-blue-300 text-xs">
          <Lock className="w-4 h-4 shrink-0 text-blue-400" />
          <span>
            <strong>Facility-Scoped Access:</strong> Your role is scoped to warehouses: {warehouseScope.join(', ')}. Other facilities are automatically restricted.
          </span>
        </div>
      )}

      {/* Filter Toolbar */}
      <Card className="bg-slate-900/60 border-slate-800 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 items-center">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by SKU, item, batch..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 min-h-[38px]"
            />
          </div>

          <div>
            <Select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              placeholder="All Permitted Warehouses"
              options={[
                { value: '', label: 'All Permitted Warehouses' },
                ...warehouses.map((wh) => ({
                  value: String(wh._id || wh.id),
                  label: `${wh.code} - ${wh.name}`,
                })),
              ]}
            />
          </div>

          <div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              placeholder="Stock Level Status"
              options={[
                { value: 'ALL', label: 'All Stock Levels' },
                { value: 'NORMAL', label: 'Adequate Stock' },
                { value: 'LOW', label: 'Low Stock (At Reorder)' },
                { value: 'CRITICAL', label: 'Critical (Below Safety)' },
                { value: 'OUT_OF_STOCK', label: 'Out of Stock (Zero)' },
                { value: 'LOW_OR_CRITICAL', label: 'All Low & Critical Alerts' },
              ]}
            />
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 text-xs text-slate-400">
            <span className="text-[11px] text-slate-500">
              Synced {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
      </Card>

      {/* Balances Table */}
      <Card className="bg-slate-900/80 border-slate-800 shadow-md">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap min-w-[140px]">SKU / Item</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap min-w-[150px]">Warehouse</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap min-w-[130px]">
                    <div className="flex items-center gap-1.5">
                      <WarehouseIcon className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Location / Bin</span>
                    </div>
                  </th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap min-w-[130px]">Batch / Lot</th>
                  <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Physical Qty</th>
                  <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Reserved</th>
                  <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Available</th>
                  <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Thresholds (Reorder/Min)</th>
                  <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Avg Cost</th>
                  <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Total Valuation</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Stock Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {filteredBalances.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-500">
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                          <span>Streaming live balances...</span>
                        </div>
                      ) : (
                        'No inventory balance records found matching your filters.'
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredBalances.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-100/60 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono whitespace-nowrap">
                        <span className="font-bold text-slate-900 dark:text-white">{b.item?.sku}</span>
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-sans">{b.item?.name}</span>
                        {b.item?.itemType && (
                          <span className="inline-block text-[10px] text-slate-500 font-sans mt-0.5">
                            {b.item.itemType}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-800 dark:text-slate-200">
                        <span className="font-semibold text-slate-900 dark:text-white">{b.warehouse?.name || b.warehouse?.code}</span>
                        {b.warehouse?.code && b.warehouse?.name && (
                          <span className="block text-[11px] text-slate-500 font-mono">Code: {b.warehouse.code}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono whitespace-nowrap">
                        {b.location?.code ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs font-mono shadow-xs">
                            <WarehouseIcon className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                            <span>{b.location.code}</span>
                            {b.location.name && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans font-normal ml-0.5 max-w-[130px] truncate">
                                &bull; {b.location.name}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 text-xs font-mono">
                            <WarehouseIcon className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                            <span>{b.warehouse?.code ? `${b.warehouse.code}-BIN1` : 'BIN-01'}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {b.batchNumber || '—'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200 text-right font-mono whitespace-nowrap">
                        {b.quantity}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-right font-mono whitespace-nowrap">
                        {b.reservedQuantity || 0}
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400 text-right font-mono whitespace-nowrap">
                        {b.availableQuantity}
                      </td>
                      <td className="py-3 px-4 font-mono text-right text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                        <span>R: {b.item?.reorderLevel ?? '—'}</span> / <span className="text-slate-400 dark:text-slate-500">M: {b.item?.minimumStock ?? '—'}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">
                        ${b.averageCost?.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white text-right whitespace-nowrap">
                        ${b.totalValue?.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {b.stockStatus === 'OUT_OF_STOCK' && (
                          <Badge variant="error" size="sm">Out of Stock</Badge>
                        )}
                        {b.stockStatus === 'CRITICAL' && (
                          <Badge variant="error" size="sm">Critical</Badge>
                        )}
                        {b.stockStatus === 'LOW' && (
                          <Badge variant="warning" size="sm">Low Stock</Badge>
                        )}
                        {b.stockStatus === 'NORMAL' && (
                          <Badge variant="success" size="sm">Adequate</Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
