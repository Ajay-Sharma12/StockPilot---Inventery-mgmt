import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileText,
  Search,
  RefreshCw,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Download,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Info,
  X,
  Calendar,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { DateRangePicker, DateRangeState } from '../../components/ui/DateRangePicker';
import { inventoryApi } from '../../api/inventory.api';
import { warehouseApi } from '../../api/warehouse.api';

const TRANSACTION_TYPES = [
  { value: '', label: 'All Transaction Types' },
  { value: 'OPENING_BALANCE', label: 'Opening Balance' },
  { value: 'GENERIC_RECEIPT', label: 'Stock Receipt (Generic)' },
  { value: 'PURCHASE_RECEIPT', label: 'Purchase Receipt (GRN)' },
  { value: 'PRODUCTION_RECEIPT', label: 'Production Receipt' },
  { value: 'PRODUCTION_OUTPUT', label: 'Production Output (Finished Goods)' },
  { value: 'GENERIC_ISSUE', label: 'Stock Issue (Generic)' },
  { value: 'STOCK_ISSUE', label: 'Material Issue / Requisition Issue' },
  { value: 'PRODUCTION_CONSUMPTION', label: 'Production Consumption (BOM)' },
  { value: 'SALE', label: 'Sale / Dispatch' },
  { value: 'STOCK_ADJUSTMENT', label: 'Stock / Variance Adjustment' },
  { value: 'TRANSFER_IN', label: 'Transfer In (Inter-Warehouse)' },
  { value: 'TRANSFER_OUT', label: 'Transfer Out (Inter-Warehouse)' },
  { value: 'RETURN_IN', label: 'Customer Return (Inbound)' },
  { value: 'RETURN_OUT', label: 'Vendor Return (Outbound)' },
  { value: 'PURCHASE_RETURN', label: 'Purchase Return (GRN Rejection)' },
  { value: 'WASTAGE', label: 'Material Scrap / Wastage' },
  { value: 'CYCLE_COUNT_ADJUSTMENT', label: 'Cycle Count Adjustment' },
  { value: 'OTHER', label: 'Other Transaction' },
];

const TYPE_COLORS: Record<string, string> = {
  PURCHASE_RECEIPT: 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30',
  OPENING_BALANCE: 'bg-blue-950/40 text-blue-300 border-blue-500/30',
  GENERIC_RECEIPT: 'bg-teal-950/40 text-teal-300 border-teal-500/30',
  TRANSFER_IN: 'bg-cyan-950/40 text-cyan-300 border-cyan-500/30',
  PRODUCTION_RECEIPT: 'bg-green-950/40 text-green-300 border-green-500/30',
  PRODUCTION_OUTPUT: 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30',
  RETURN_IN: 'bg-lime-950/40 text-lime-300 border-lime-500/30',
  GENERIC_ISSUE: 'bg-rose-950/40 text-rose-300 border-rose-500/30',
  STOCK_ISSUE: 'bg-rose-950/40 text-rose-300 border-rose-500/30',
  SALE: 'bg-orange-950/40 text-orange-300 border-orange-500/30',
  TRANSFER_OUT: 'bg-amber-950/40 text-amber-300 border-amber-500/30',
  STOCK_ADJUSTMENT: 'bg-purple-950/40 text-purple-300 border-purple-500/30',
  CYCLE_COUNT_ADJUSTMENT: 'bg-indigo-950/40 text-indigo-300 border-indigo-500/30',
  WASTAGE: 'bg-red-950/40 text-red-300 border-red-500/30',
  PRODUCTION_CONSUMPTION: 'bg-yellow-950/40 text-yellow-300 border-yellow-500/30',
  RETURN_OUT: 'bg-pink-950/40 text-pink-300 border-pink-500/30',
  PURCHASE_RETURN: 'bg-pink-950/40 text-pink-300 border-pink-500/30',
  OTHER: 'bg-slate-800 text-slate-200 border-slate-700',
};

const PAGE_LIMIT = 25;

// Detail Panel for a single transaction
const TransactionDetailPanel: React.FC<{ txn: any; onClose: () => void }> = ({ txn, onClose }) => {
  const isIn = Number(txn.quantityIn) > 0;
  const delta = isIn ? txn.quantityIn : -txn.quantityOut;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-6 space-y-5 animate-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-sm">{txn.transactionNumber}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {new Date(txn.transactionDate).toLocaleString()}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Type Badge */}
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono px-2.5 py-1 rounded border ${TYPE_COLORS[txn.transactionType] || TYPE_COLORS.OTHER}`}>
            {txn.transactionType}
          </span>
          {txn.referenceType && (
            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono">
              {txn.referenceType}: {txn.referenceId || '—'}
            </span>
          )}
        </div>

        {/* Stock Movement Visual */}
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between gap-4">
            <div className="text-center">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">Previous Stock</div>
              <div className="text-2xl font-bold font-mono text-slate-800 dark:text-slate-300">
                {txn.balanceBefore !== null && txn.balanceBefore !== undefined ? txn.balanceBefore : '—'}
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ArrowRight className="w-5 h-5 text-slate-400 dark:text-slate-500" />
              <span className={`text-sm font-bold font-mono ${isIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {isIn ? `+${txn.quantityIn}` : `-${txn.quantityOut}`}
              </span>
            </div>
            <div className="text-center">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">New Stock</div>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">{txn.balanceAfter}</div>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-[11px] text-slate-500 mb-0.5">Item</div>
            <div className="text-slate-900 dark:text-white font-semibold">{txn.item?.sku}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{txn.item?.name}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 mb-0.5">Warehouse</div>
            <div className="text-slate-900 dark:text-white">{txn.warehouse?.code} — {txn.warehouse?.name}</div>
          </div>
          {txn.batchNumber && (
            <div>
              <div className="text-[11px] text-slate-500 mb-0.5">Batch / Lot</div>
              <div className="text-slate-800 dark:text-slate-200 font-mono text-xs">{txn.batchNumber}</div>
            </div>
          )}
          <div>
            <div className="text-[11px] text-slate-500 mb-0.5">Unit Cost</div>
            <div className="text-slate-800 dark:text-slate-200 font-mono">${(txn.unitCost || 0).toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 mb-0.5">Total Value</div>
            <div className="text-slate-900 dark:text-white font-semibold font-mono">${(txn.totalValue || 0).toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 mb-0.5">Performed By</div>
            <div className="text-slate-800 dark:text-slate-200">{txn.user?.name || 'System'}</div>
            <div className="text-[10px] text-slate-500">{txn.user?.email || ''}</div>
          </div>
        </div>

        {txn.reason && (
          <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">Reason / Remarks</div>
            <div className="text-sm text-slate-800 dark:text-slate-200">{txn.reason}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export const InventoryLedgerPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') || searchParams.get('q') || '';
  const urlType = searchParams.get('type') || searchParams.get('transactionType') || '';
  const urlWarehouse = searchParams.get('warehouseId') || searchParams.get('warehouse') || '';

  const [transactions, setTransactions] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState(urlType);
  const [selectedWarehouse, setSelectedWarehouse] = useState(urlWarehouse);
  const [dateRange, setDateRange] = useState<DateRangeState>({
    startDate: '',
    endDate: '',
    presetKey: 'ALL',
    label: 'All Dates',
  });
  const [search, setSearch] = useState(urlSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedTxn, setSelectedTxn] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Debounce search input so server-side search updates smoothly
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  const loadWarehouses = useCallback(async () => {
    try {
      const data = await warehouseApi.getWarehouses();
      setWarehouses(data || []);
    } catch (err) {
      console.error('Failed to load warehouses', err);
    }
  }, []);

  const loadTransactions = useCallback(
    async (pg = 1, currentSearch = debouncedSearch) => {
      try {
        setLoading(true);

        // Convert local date string boundaries to ISO strings to preserve timezone accuracy
        let startIso: string | undefined = undefined;
        let endIso: string | undefined = undefined;

        if (dateRange.startDate) {
          const start = new Date(`${dateRange.startDate}T00:00:00`);
          if (!isNaN(start.getTime())) {
            startIso = start.toISOString();
          }
        }
        if (dateRange.endDate) {
          const end = new Date(`${dateRange.endDate}T23:59:59.999`);
          if (!isNaN(end.getTime())) {
            endIso = end.toISOString();
          }
        }

        const res = await inventoryApi.getLedger({
          warehouseId: selectedWarehouse || undefined,
          transactionType: selectedType || undefined,
          startDate: startIso,
          endDate: endIso,
          search: currentSearch.trim() || undefined,
          page: pg,
          limit: PAGE_LIMIT,
        });

        const list = Array.isArray(res.data) ? res.data : [];
        setTransactions(list);
        const serverTotal = res.meta?.pagination?.total ?? res.total ?? list.length;
        setTotal(serverTotal);
      } catch (err) {
        console.error('Failed to load transactions', err);
      } finally {
        setLoading(false);
      }
    },
    [selectedWarehouse, selectedType, dateRange, debouncedSearch]
  );

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await Promise.all([loadWarehouses(), loadTransactions(page, debouncedSearch)]);
    } finally {
      setTimeout(() => setRefreshing(false), 300);
    }
  };

  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  // When filters or debounced search change, reset to page 1 and fetch from server
  useEffect(() => {
    setPage(1);
    loadTransactions(1, debouncedSearch);
  }, [selectedType, selectedWarehouse, dateRange, debouncedSearch]);

  const handleClearAllFilters = () => {
    setSelectedType('');
    setSelectedWarehouse('');
    setSearch('');
    setDebouncedSearch('');
    setDateRange({
      startDate: '',
      endDate: '',
      presetKey: 'ALL',
      label: 'All Dates',
    });
    setSearchParams({}, { replace: true });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadTransactions(newPage, debouncedSearch);
  };

  // Instant client-side search fallback across multiple fields within current loaded records
  const filteredTransactions = transactions.filter((t) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      t.transactionNumber?.toLowerCase().includes(q) ||
      t.item?.sku?.toLowerCase().includes(q) ||
      t.item?.name?.toLowerCase().includes(q) ||
      t.referenceId?.toLowerCase().includes(q) ||
      t.referenceType?.toLowerCase().includes(q) ||
      t.batchNumber?.toLowerCase().includes(q) ||
      t.warehouse?.code?.toLowerCase().includes(q) ||
      t.warehouse?.name?.toLowerCase().includes(q) ||
      t.location?.code?.toLowerCase().includes(q) ||
      t.transactionType?.toLowerCase().includes(q) ||
      t.reason?.toLowerCase().includes(q) ||
      t.user?.name?.toLowerCase().includes(q)
    );
  });

  // KPI Metrics
  const totalQtyIn = filteredTransactions.reduce((acc, t) => acc + (Number(t.quantityIn) || 0), 0);
  const totalQtyOut = filteredTransactions.reduce((acc, t) => acc + (Number(t.quantityOut) || 0), 0);
  const netMovement = totalQtyIn - totalQtyOut;
  const totalTransactedVal = filteredTransactions.reduce((acc, t) => acc + (Number(t.totalValue) || 0), 0);

  // CSV Export
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) return;
    const headers = [
      'Transaction Number', 'Date & Time', 'Type', 'Reference Type', 'Reference ID',
      'SKU', 'Item Name', 'Batch Number', 'Warehouse', 'Location Bin',
      'Qty In', 'Qty Out', 'Previous Balance', 'New Balance',
      'Unit Cost', 'Total Value', 'User', 'Reason',
    ];

    const rows = filteredTransactions.map((t) => [
      `"${t.transactionNumber || ''}"`,
      `"${new Date(t.transactionDate).toISOString()}"`,
      `"${t.transactionType || ''}"`,
      `"${t.referenceType || ''}"`,
      `"${t.referenceId || ''}"`,
      `"${t.item?.sku || ''}"`,
      `"${(t.item?.name || '').replace(/"/g, '""')}"`,
      `"${t.batchNumber || ''}"`,
      `"${t.warehouse?.code || ''}"`,
      `"${t.location?.code || ''}"`,
      t.quantityIn || 0,
      t.quantityOut || 0,
      t.balanceBefore !== null && t.balanceBefore !== undefined ? t.balanceBefore : '',
      t.balanceAfter || 0,
      (t.unitCost || 0).toFixed(2),
      (t.totalValue || 0).toFixed(2),
      `"${t.user?.name || 'System'}"`,
      `"${(t.reason || '').replace(/"/g, '""')}"`,
    ]);

    const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    const dateTag = dateRange.startDate ? `_${dateRange.startDate}_to_${dateRange.endDate || dateRange.startDate}` : `_${new Date().toISOString().slice(0, 10)}`;
    link.setAttribute('download', `inventory_ledger${dateTag}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {selectedTxn && <TransactionDetailPanel txn={selectedTxn} onClose={() => setSelectedTxn(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <FileText className="w-7 h-7 text-emerald-400" />
            Immutable Transaction Ledger
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Permanent, tamper-evident audit journal — every stock change permanently recorded with before & after balance
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 text-xs">
            <ShieldCheck className="w-4 h-4" />
            <span>Audit-Verified Ledger</span>
          </div>

          <Button variant="outline" size="sm" onClick={handleExportCSV}
            disabled={filteredTransactions.length === 0}
            className="text-xs border-slate-700 hover:bg-slate-800">
            <Download className="w-3.5 h-3.5 mr-1.5 text-slate-300" />
            Export CSV
          </Button>

          <Button variant="outline" size="sm" onClick={handleRefresh}
            disabled={loading || refreshing}
            className="text-xs border-slate-700 hover:bg-slate-800">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing || loading ? 'animate-spin text-emerald-400' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 p-3 shadow-sm">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Total Records</span>
          <div className="text-lg font-bold text-slate-900 dark:text-white font-mono">{total.toLocaleString()}</div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">All matching entries</span>
        </Card>
        <Card className="bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 p-3 shadow-sm">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <ArrowDownLeft className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Inward Stock
          </span>
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">+{totalQtyIn.toLocaleString()}</div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">This page receipts</span>
        </Card>
        <Card className="bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 p-3 shadow-sm">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3 text-rose-600 dark:text-rose-400" /> Outward Stock
          </span>
          <div className="text-lg font-bold text-rose-600 dark:text-rose-400 font-mono">-{totalQtyOut.toLocaleString()}</div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">This page issues</span>
        </Card>
        <Card className="bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 p-3 shadow-sm">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Net Delta</span>
          <div className={`text-lg font-bold font-mono ${netMovement >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
            {netMovement >= 0 ? `+${netMovement.toLocaleString()}` : netMovement.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Page net volume</span>
        </Card>
        <Card className="bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 p-3 shadow-sm">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Value
          </span>
          <div className="text-lg font-bold text-slate-900 dark:text-white font-mono">
            ${totalTransactedVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Page valuation</span>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="bg-slate-900/60 border-slate-800 p-4 relative z-20 overflow-visible space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SKU, Txn#, Ref, Batch, User, Reason..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3.5 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[38px] transition-all"
            />
          </div>

          <div>
            <Select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              placeholder="All Transaction Types"
              options={TRANSACTION_TYPES}
            />
          </div>

          <div>
            <Select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              placeholder="All Warehouses"
              options={[
                { value: '', label: 'All Warehouses' },
                ...warehouses.map((wh) => ({ value: wh._id, label: `${wh.code} - ${wh.name}` })),
              ]}
            />
          </div>

          <div>
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
            />
          </div>
        </div>

        {/* Active Filters Strip */}
        {(dateRange.presetKey !== 'ALL' || selectedType || selectedWarehouse || search) && (
          <div className="flex items-center gap-2 pt-2.5 border-t border-slate-800/80 flex-wrap text-xs">
            <span className="text-[11px] text-slate-500 font-medium">Applied filters:</span>

            {dateRange.presetKey !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-[11px] shadow-sm">
                <Calendar className="w-3 h-3 text-emerald-400" />
                <span>Date: {dateRange.label}</span>
                <button
                  type="button"
                  onClick={() => setDateRange({ startDate: '', endDate: '', presetKey: 'ALL', label: 'All Dates' })}
                  className="hover:text-rose-400 text-slate-400 transition-colors ml-0.5"
                  title="Clear date filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedType && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700 text-slate-200 text-[11px]">
                <span>Type: {TRANSACTION_TYPES.find((t) => t.value === selectedType)?.label || selectedType}</span>
                <button
                  type="button"
                  onClick={() => setSelectedType('')}
                  className="hover:text-rose-400 text-slate-400 transition-colors ml-0.5"
                  title="Clear type filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedWarehouse && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700 text-slate-200 text-[11px]">
                <span>Warehouse: {warehouses.find((w) => w._id === selectedWarehouse)?.code || 'Selected'}</span>
                <button
                  type="button"
                  onClick={() => setSelectedWarehouse('')}
                  className="hover:text-rose-400 text-slate-400 transition-colors ml-0.5"
                  title="Clear warehouse filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {search && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700 text-slate-200 text-[11px]">
                <span>Search: "{search}"</span>
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="hover:text-rose-400 text-slate-400 transition-colors ml-0.5"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={handleClearAllFilters}
              className="text-[11px] text-slate-400 hover:text-white underline transition-colors ml-auto"
            >
              Reset all filters
            </button>
          </div>
        )}
      </Card>

      {/* Ledger Table */}
      <Card className="bg-slate-900/80 border-slate-800 shadow-md">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-3 font-semibold">Txn Number</th>
                  <th className="py-3 px-3 font-semibold">Date & Time</th>
                  <th className="py-3 px-3 font-semibold">Type</th>
                  <th className="py-3 px-3 font-semibold">Reference</th>
                  <th className="py-3 px-3 font-semibold">SKU / Item</th>
                  <th className="py-3 px-3 font-semibold">Batch</th>
                  <th className="py-3 px-3 font-semibold">Facility</th>
                  <th className="py-3 px-3 font-semibold text-right">Qty In</th>
                  <th className="py-3 px-3 font-semibold text-right">Qty Out</th>
                  <th className="py-3 px-3 font-semibold text-right text-amber-700 dark:text-amber-400/80">Prev Balance</th>
                  <th className="py-3 px-3 font-semibold text-right text-slate-900 dark:text-white">New Balance</th>
                  <th className="py-3 px-3 font-semibold text-right">Value</th>
                  <th className="py-3 px-3 font-semibold">Author / Reason</th>
                  <th className="py-3 px-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="py-12 text-center text-slate-500">
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin" /> Loading ledger...
                        </span>
                      ) : 'No ledger transactions found.'}
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((t) => {
                    const isReceipt = Number(t.quantityIn) > 0;
                    return (
                      <tr key={t.id} className="hover:bg-slate-100/60 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedTxn(t)}>
                        <td className="py-3 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {t.transactionNumber}
                        </td>
                        <td className="py-3 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap font-mono text-[11px]">
                          {new Date(t.transactionDate).toLocaleDateString()}{' '}
                          <span className="text-slate-400 dark:text-slate-500">
                            {new Date(t.transactionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${TYPE_COLORS[t.transactionType] || TYPE_COLORS.OTHER}`}>
                            {t.transactionType}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {t.referenceType ? (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                              {t.referenceType}{t.referenceId ? `: ${t.referenceId.slice(-8)}` : ''}
                            </span>
                          ) : <span className="text-slate-400 dark:text-slate-600">—</span>}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300">
                          <span className="font-semibold text-slate-900 dark:text-white">{t.item?.sku}</span>
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[130px] font-sans">{t.item?.name}</span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {t.batchNumber ? <span className="text-[11px]">{t.batchNumber}</span> : <span className="text-slate-400 dark:text-slate-600">—</span>}
                        </td>
                        <td className="py-3 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          <span className="font-semibold text-slate-900 dark:text-white">{t.warehouse?.code}</span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-right font-mono">
                          {isReceipt ? (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
                              <ArrowDownLeft className="w-3.5 h-3.5" />+{t.quantityIn}
                            </span>
                          ) : <span className="text-slate-400 dark:text-slate-600">—</span>}
                        </td>
                        <td className="py-3 px-3 font-semibold text-right font-mono">
                          {!isReceipt && Number(t.quantityOut) > 0 ? (
                            <span className="text-rose-600 dark:text-rose-400 flex items-center justify-end gap-1">
                              <ArrowUpRight className="w-3.5 h-3.5" />-{t.quantityOut}
                            </span>
                          ) : <span className="text-slate-400 dark:text-slate-600">—</span>}
                        </td>
                        {/* BEFORE balance */}
                        <td className="py-3 px-3 font-mono text-amber-700 dark:text-amber-300/80 text-right">
                          {t.balanceBefore !== null && t.balanceBefore !== undefined ? t.balanceBefore : (
                            <span className="text-slate-400 dark:text-slate-600">—</span>
                          )}
                        </td>
                        {/* AFTER balance */}
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white text-right">{t.balanceAfter}</td>
                        <td className="py-3 px-3 font-mono text-slate-800 dark:text-slate-200 text-right font-semibold">
                          ${(t.totalValue || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400 max-w-[160px]">
                          <span className="block truncate text-slate-900 dark:text-slate-200 font-sans">{t.reason || '—'}</span>
                          <span className="text-[10px] text-slate-500 font-sans">By {t.user?.name || 'System'}</span>
                        </td>
                        <td className="py-3 px-3">
                          <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                            title="View details" onClick={(e) => { e.stopPropagation(); setSelectedTxn(t); }}>
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Page <span className="font-semibold text-slate-900 dark:text-white">{page}</span> of{' '}
                <span className="font-semibold text-slate-900 dark:text-white">{totalPages}</span>
                {' '}· {total.toLocaleString()} total records
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={page === 1 || loading}
                  className="px-2 py-1.5 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >First</button>
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1 || loading}
                  className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold font-mono">
                  {page}
                </span>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages || loading}
                  className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={page >= totalPages || loading}
                  className="px-2 py-1.5 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >Last</button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
