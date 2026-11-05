import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Layers,
  DollarSign,
  AlertTriangle,
  XCircle,
  History,
  PlusCircle,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ClipboardList,
  RefreshCw,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { inventoryApi, InventoryOverviewStats } from '../../api/inventory.api';
import { warehouseApi } from '../../api/warehouse.api';
import { masterDataApi } from '../../api/masterData.api';
import { itemApi } from '../../api/item.api';
import { usePermissions } from '../../hooks/usePermissions';
import { Link } from 'react-router-dom';
import { StatCardSkeleton, TableSkeleton } from '../../components/ui/Skeleton';

export const InventoryOverviewPage: React.FC = () => {
  const { can, isSuperAdmin } = usePermissions();
  const [stats, setStats] = useState<InventoryOverviewStats | null>(null);
  const [recentLedger, setRecentLedger] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Action Modal states
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [itemsList, setItemsList] = useState<any[]>([]);
  const [warehousesList, setWarehousesList] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Form states
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitCost, setUnitCost] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const loadData = async () => {
    try {
      setLoading(true);
      const [overviewData, ledgerData, balancesData, itemsData, warehousesData] = await Promise.all([
        inventoryApi.getOverview(),
        inventoryApi.getLedger({ limit: 6 }),
        inventoryApi.getBalances({ limit: 50 }),
        itemApi.getItems({ limit: 100 }),
        warehouseApi.getWarehouses(),
      ]);

      let warehouses = warehousesData || [];
      if (warehouses.length === 0) {
        try {
          await masterDataApi.initializeStarterData();
          warehouses = await warehouseApi.getWarehouses();
        } catch (initErr) {
          console.warn('Auto starter warehouse initialization skipped:', initErr);
        }
      }

      setStats(overviewData);
      setRecentLedger(ledgerData.data || []);
      setItemsList(itemsData.data || []);
      setWarehousesList(warehouses || []);

      // Filter balances for low / critical stock
      const criticalOrLow = (balancesData.data || []).filter(
        (b: any) => b.stockStatus === 'CRITICAL' || b.stockStatus === 'LOW' || b.stockStatus === 'OUT_OF_STOCK'
      );
      setLowStockItems(criticalOrLow);
    } catch (err) {
      console.error('Failed to load inventory overview', err);
    } finally {
      setLoading(false);
    }
  };

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadData();
    } finally {
      setTimeout(() => setRefreshing(false), 300);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReceiveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!selectedItemId) {
      errors.itemId = 'Target item is required';
    }
    if (!selectedWarehouseId) {
      errors.warehouseId = 'Destination warehouse is required';
    }
    if (!quantity || Number(quantity) <= 0) {
      errors.quantity = 'Quantity must be at least 1';
    }
    if (unitCost !== undefined && Number(unitCost) < 0) {
      errors.unitCost = 'Unit cost cannot be negative';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    try {
      setActionLoading(true);
      setActionError('');
      await inventoryApi.receiveStock({
        itemId: selectedItemId,
        warehouseId: selectedWarehouseId,
        quantity: Number(quantity),
        unitCost: Number(unitCost) || undefined,
        reason: reason || 'Manual stock receipt',
      });
      setIsReceiptModalOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || 'Stock receipt failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleIssueStock = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!selectedItemId) {
      errors.itemId = 'Source item is required';
    }
    if (!selectedWarehouseId) {
      errors.warehouseId = 'Source warehouse is required';
    }
    if (!quantity || Number(quantity) <= 0) {
      errors.quantity = 'Quantity must be at least 1';
    }
    if (!reason || !reason.trim()) {
      errors.reason = 'Reason / Purpose is required';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    try {
      setActionLoading(true);
      setActionError('');
      await inventoryApi.issueStock({
        itemId: selectedItemId,
        warehouseId: selectedWarehouseId,
        quantity: Number(quantity),
        reason: reason.trim(),
      });
      setIsIssueModalOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || 'Stock issue failed');
    } finally {
      setActionLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedItemId('');
    setSelectedWarehouseId('');
    setQuantity(1);
    setUnitCost(0);
    setReason('');
    setActionError('');
    setFormErrors({});
  };

  const canAdjust = isSuperAdmin || can('inventory:adjust');
  const canTransfer = isSuperAdmin || can('inventory:transfer');
  const canCount = isSuperAdmin || can('inventory:count');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Boxes className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            Inventory & Warehouse Hub
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Centralized inventory engine with Weighted Average Costing (WAC) and immutable ledger audit trail
          </p>
        </div>

        {/* Quick Operations Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing || loading ? 'animate-spin text-emerald-500' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>

          {canAdjust && (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  resetForm();
                  setIsReceiptModalOpen(true);
                }}
                className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
              >
                <ArrowDownLeft className="w-3.5 h-3.5 mr-1.5" />
                Receive Stock
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  resetForm();
                  setIsIssueModalOpen(true);
                }}
                className="text-xs border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-300 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-950/40"
              >
                <ArrowUpRight className="w-3.5 h-3.5 mr-1.5" />
                Issue Stock
              </Button>
            </>
          )}

          {canTransfer && (
            <Link to="/inventory/transfers">
              <Button variant="outline" size="sm" className="text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">
                <ArrowLeftRight className="w-3.5 h-3.5 mr-1.5" />
                Transfers
              </Button>
            </Link>
          )}

          {canCount && (
            <Link to="/inventory/counts">
              <Button variant="outline" size="sm" className="text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">
                <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
                Cycle Count
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {loading && !stats ? (
          Array.from({ length: 6 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))
        ) : (
          <>
            <Card className="bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow transition-all backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total SKUs</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/80 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
                    <Boxes className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {stats?.totalSkus ?? 0}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Active items in catalog</p>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow transition-all backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Units</span>
                  <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-500/10 border border-teal-200/80 dark:border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400 shadow-sm">
                    <Layers className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {stats?.totalStockUnits?.toLocaleString() ?? 0}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Physical on-hand units</p>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow transition-all backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Valuation (WAC)</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200/80 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  ${stats?.totalValuation?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0.00'}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Weighted average cost</p>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow transition-all backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Low Stock</span>
                  <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-sm">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400 tracking-tight">
                  {stats?.lowStockCount ?? 0}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">At or below reorder level</p>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow transition-all backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Out of Stock</span>
                  <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200/80 dark:border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-sm">
                    <XCircle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400 tracking-tight">
                  {stats?.outOfStockCount ?? 0}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Zero available inventory</p>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow transition-all backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ledger Txns</span>
                  <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-500/10 border border-purple-200/80 dark:border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-sm">
                    <History className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {stats?.totalTransactions ?? 0}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Immutable ledger movements</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Two Column Layout: Critical Stock & Recent Ledger Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alerts */}
        <Card className="bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between py-3.5 px-4 border-b border-slate-200 dark:border-slate-800">
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              Low Stock & Reorder Thresholds
            </CardTitle>
            <Link to="/inventory/balances" className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 font-medium">
              View all balances &rarr;
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {loading && lowStockItems.length === 0 ? (
              <div className="p-4">
                <TableSkeleton rows={4} columns={5} />
              </div>
            ) : lowStockItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                All inventory levels are currently above reorder thresholds.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">SKU / Item</th>
                      <th className="py-2.5 px-3 font-semibold">Warehouse</th>
                      <th className="py-2.5 px-3 font-semibold">Available</th>
                      <th className="py-2.5 px-3 font-semibold">Reorder Pt</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {lowStockItems.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-3 font-mono">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{b.item?.sku}</span>
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[160px]">
                            {b.item?.name}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                          {b.warehouse?.code}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                          {b.availableQuantity}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                          {b.item?.reorderLevel}
                        </td>
                        <td className="py-2.5 px-3">
                          {b.stockStatus === 'OUT_OF_STOCK' && (
                            <Badge variant="error" size="sm">Out of Stock</Badge>
                          )}
                          {b.stockStatus === 'CRITICAL' && (
                            <Badge variant="error" size="sm">Critical</Badge>
                          )}
                          {b.stockStatus === 'LOW' && (
                            <Badge variant="warning" size="sm">Low Stock</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Ledger Activity */}
        <Card className="bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between py-3.5 px-4 border-b border-slate-200 dark:border-slate-800">
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Recent Immutable Ledger Activity
            </CardTitle>
            <Link to="/inventory/ledger" className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 font-medium">
              View full ledger &rarr;
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {loading && recentLedger.length === 0 ? (
              <div className="p-4">
                <TableSkeleton rows={4} columns={6} />
              </div>
            ) : recentLedger.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                No ledger transactions recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Txn #</th>
                      <th className="py-2.5 px-3 font-semibold">Type</th>
                      <th className="py-2.5 px-3 font-semibold">SKU</th>
                      <th className="py-2.5 px-3 font-semibold">Quantity</th>
                      <th className="py-2.5 px-3 font-semibold">Balance After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {recentLedger.map((t) => {
                      const isReceipt = t.quantityIn > 0;
                      return (
                        <tr key={t.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                            {t.transactionNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono border border-slate-200 dark:border-slate-700">
                              {t.transactionType}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                            {t.item?.sku}
                          </td>
                          <td className="py-2.5 px-3 font-semibold">
                            {isReceipt ? (
                              <span className="text-emerald-600 dark:text-emerald-400">+{t.quantityIn}</span>
                            ) : (
                              <span className="text-rose-600 dark:text-rose-400">-{t.quantityOut}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-800 dark:text-slate-200">
                            {t.balanceAfter}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Receive Stock Modal */}
      <Modal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        title="Receive Stock into Warehouse"
        description="Records incoming inventory, computes Weighted Average Cost, and creates an immutable ledger entry"
      >
        <form onSubmit={handleReceiveStock} className="space-y-4 text-xs" noValidate>
          {actionError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
              {actionError}
            </div>
          )}

          {itemsList.length === 0 ? (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
              <span>No items registered in your catalog yet.</span>
              <Link to="/inventory/items" className="font-semibold text-emerald-400 hover:underline">
                Create Items &rarr;
              </Link>
            </div>
          ) : (
            <div>
              <Select
                label="Target Item (SKU) *"
                value={selectedItemId}
                onChange={(e) => {
                  setSelectedItemId(e.target.value);
                  if (formErrors.itemId) setFormErrors((prev) => ({ ...prev, itemId: '' }));
                }}
                error={formErrors.itemId}
                options={[
                  { value: '', label: 'Select item...' },
                  ...itemsList.map((item) => ({ value: item._id, label: `${item.sku} - ${item.name}` })),
                ]}
                placeholder="Select item..."
              />
            </div>
          )}

          <div>
            <Select
              label="Destination Warehouse *"
              value={selectedWarehouseId}
              onChange={(e) => {
                setSelectedWarehouseId(e.target.value);
                if (formErrors.warehouseId) setFormErrors((prev) => ({ ...prev, warehouseId: '' }));
              }}
              error={formErrors.warehouseId}
              options={[
                { value: '', label: 'Select warehouse...' },
                ...warehousesList.map((wh) => ({ value: wh._id, label: `${wh.code} - ${wh.name}` })),
              ]}
              placeholder="Select warehouse..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                label="Quantity *"
                type="number"
                min="1"
                step="any"
                value={quantity}
                onChange={(e) => {
                  setQuantity(Number(e.target.value));
                  if (formErrors.quantity) setFormErrors((prev) => ({ ...prev, quantity: '' }));
                }}
                error={formErrors.quantity}
              />
            </div>
            <div>
              <Input
                label="Unit Cost ($ USD)"
                type="number"
                min="0"
                step="0.01"
                value={unitCost}
                onChange={(e) => {
                  setUnitCost(Number(e.target.value));
                  if (formErrors.unitCost) setFormErrors((prev) => ({ ...prev, unitCost: '' }));
                }}
                placeholder="Optional standard cost"
                error={formErrors.unitCost}
              />
            </div>
          </div>

          <div>
            <Input
              label="Reason / Notes"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Supplier inbound shipment, Opening correction"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsReceiptModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              Receive Stock
            </Button>
          </div>
        </form>
      </Modal>

      {/* Issue Stock Modal */}
      <Modal
        isOpen={isIssueModalOpen}
        onClose={() => setIsIssueModalOpen(false)}
        title="Issue Stock from Warehouse"
        description="Deducts stock with concurrency checks and records an immutable issue transaction in the ledger"
      >
        <form onSubmit={handleIssueStock} className="space-y-4 text-xs" noValidate>
          {actionError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
              {actionError}
            </div>
          )}

          {itemsList.length === 0 ? (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
              <span>No items registered in your catalog yet.</span>
              <Link to="/inventory/items" className="font-semibold text-rose-400 hover:underline">
                Create Items &rarr;
              </Link>
            </div>
          ) : (
            <div>
              <Select
                label="Source Item (SKU) *"
                value={selectedItemId}
                onChange={(e) => {
                  setSelectedItemId(e.target.value);
                  if (formErrors.itemId) setFormErrors((prev) => ({ ...prev, itemId: '' }));
                }}
                error={formErrors.itemId}
                options={[
                  { value: '', label: 'Select item...' },
                  ...itemsList.map((item) => ({ value: item._id, label: `${item.sku} - ${item.name}` })),
                ]}
                placeholder="Select item..."
              />
            </div>
          )}

          <div>
            <Select
              label="Source Warehouse *"
              value={selectedWarehouseId}
              onChange={(e) => {
                setSelectedWarehouseId(e.target.value);
                if (formErrors.warehouseId) setFormErrors((prev) => ({ ...prev, warehouseId: '' }));
              }}
              error={formErrors.warehouseId}
              options={[
                { value: '', label: 'Select warehouse...' },
                ...warehousesList.map((wh) => ({ value: wh._id, label: `${wh.code} - ${wh.name}` })),
              ]}
              placeholder="Select warehouse..."
            />
          </div>

          <div>
            <Input
              label="Quantity to Issue *"
              type="number"
              min="1"
              step="any"
              value={quantity}
              onChange={(e) => {
                setQuantity(Number(e.target.value));
                if (formErrors.quantity) setFormErrors((prev) => ({ ...prev, quantity: '' }));
              }}
              error={formErrors.quantity}
            />
          </div>

          <div>
            <Input
              label="Reason / Purpose *"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (formErrors.reason) setFormErrors((prev) => ({ ...prev, reason: '' }));
              }}
              placeholder="e.g. Production consumption, Internal usage, Sample release"
              error={formErrors.reason}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsIssueModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={actionLoading}
              className="bg-rose-600 hover:bg-rose-500 text-white"
            >
              Issue Stock
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
