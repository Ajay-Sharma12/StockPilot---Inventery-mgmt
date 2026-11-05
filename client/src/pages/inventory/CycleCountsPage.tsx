import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ClipboardList,
  Plus,
  RefreshCw,
  CheckCircle2,
  Edit3,
  Calendar,
  Layers,
  AlertTriangle,
  DollarSign,
  Package,
  Building2,
  Warehouse,
  Check,
  Search,
  X,
  FileText,
  TrendingUp,
  TrendingDown,
  Info,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { inventoryApi } from '../../api/inventory.api';
import { warehouseApi } from '../../api/warehouse.api';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../context/ToastContext';

export const CycleCountsPage: React.FC = () => {
  const { can, isSuperAdmin } = usePermissions();
  const { success, error: toastError } = useToast();

  const [counts, setCounts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PLANNED' | 'SUBMITTED' | 'COMPLETED'>('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('ALL');

  // Plan Count Modal
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState('');
  const [remarks, setRemarks] = useState('');

  // Record Counts Modal
  const [activeCount, setActiveCount] = useState<any>(null);
  const [countedQuantities, setCountedQuantities] = useState<Record<string, number>>({});

  const loadData = async () => {
    try {
      setLoading(true);
      const [countsRes, whRes] = await Promise.all([
        inventoryApi.getCounts({ limit: 100 }),
        warehouseApi.getWarehouses(),
      ]);
      setCounts(countsRes.data || []);
      setWarehouses(whRes || []);
    } catch (err: any) {
      console.error('Failed to load counts', err);
      toastError(err.response?.data?.message || 'Failed to load cycle counts');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadData();
      success('Cycle counts and audits refreshed');
    } catch (err: any) {
      toastError('Failed to refresh cycle counts');
    } finally {
      setTimeout(() => setRefreshing(false), 300);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter out any temporary test facilities
  const displayWarehouses = useMemo(() => {
    return (warehouses || []).filter(
      (w) => !w.code?.startsWith('PERSIST-') && !w.code?.startsWith('TEST-')
    );
  }, [warehouses]);

  // Compute KPI metrics according to document specs
  const metrics = useMemo(() => {
    let plannedCount = 0;
    let submittedCount = 0;
    let completedCount = 0;
    let totalItemsAudited = 0;

    for (const c of counts) {
      if (c.status === 'PLANNED') plannedCount++;
      else if (c.status === 'SUBMITTED') submittedCount++;
      else if (c.status === 'COMPLETED') completedCount++;
      totalItemsAudited += c.items?.length || 0;
    }

    return {
      total: counts.length,
      plannedCount,
      submittedCount,
      completedCount,
      totalItemsAudited,
    };
  }, [counts]);

  // Filtered counts
  const filteredCounts = useMemo(() => {
    return counts.filter((c) => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (warehouseFilter !== 'ALL') {
        const whId = (c.warehouseId?._id || c.warehouseId)?.toString();
        if (whId !== warehouseFilter) return false;
      }
      return true;
    });
  }, [counts, statusFilter, warehouseFilter]);

  const handlePlanCount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId) {
      setFormErrors({ warehouseId: 'Target Facility / Warehouse is required' });
      return;
    }
    setFormErrors({});

    try {
      setActionLoading(true);
      setActionError('');
      const newAudit = await inventoryApi.createCount({
        warehouseId,
        remarks: remarks?.trim() || 'Scheduled cycle count physical audit',
      });

      setIsPlanModalOpen(false);
      setWarehouseId('');
      setRemarks('');
      setFormErrors({});
      success(`Physical audit ${newAudit?.countNumber || ''} planned successfully`);
      loadData();
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to plan count';
      setActionError(errMsg);
      toastError(errMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const openRecordModal = async (count: any) => {
    setActionError('');
    setActiveCount(count);

    // Initial local map
    const initialMap: Record<string, number> = {};
    count.items?.forEach((itm: any, idx: number) => {
      const rowKey = itm._id || `${(itm.itemId?._id || itm.itemId)?.toString()}_${itm.batchNumber || ''}_${idx}`;
      initialMap[rowKey] = itm.countedQuantity ?? itm.systemQuantity;
    });
    setCountedQuantities(initialMap);

    // Fetch fresh, fully populated count details from backend to ensure SKUs & details are complete
    try {
      setModalLoading(true);
      const fresh = await inventoryApi.getCountById(count._id);
      if (fresh) {
        setActiveCount(fresh);
        const freshMap: Record<string, number> = {};
        fresh.items?.forEach((itm: any, idx: number) => {
          const rowKey = itm._id || `${(itm.itemId?._id || itm.itemId)?.toString()}_${itm.batchNumber || ''}_${idx}`;
          freshMap[rowKey] = itm.countedQuantity ?? itm.systemQuantity;
        });
        setCountedQuantities(freshMap);
      }
    } catch (err) {
      console.warn('Could not fetch detailed count record, using cached list', err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleSaveRecordedCounts = async () => {
    if (!activeCount) return;

    try {
      setActionLoading(true);
      setActionError('');

      const formattedItems = activeCount.items.map((i: any, idx: number) => {
        const rowKey = i._id || `${(i.itemId?._id || i.itemId)?.toString()}_${i.batchNumber || ''}_${idx}`;
        const enteredQty =
          countedQuantities[rowKey] !== undefined
            ? countedQuantities[rowKey]
            : i.countedQuantity ?? i.systemQuantity;

        const itemIdStr = (i.itemId?._id || i.itemId)?.toString();

        return {
          _id: i._id?.toString(),
          itemId: itemIdStr,
          countedQuantity: Number(enteredQty) >= 0 ? Number(enteredQty) : 0,
          batchNumber: i.batchNumber ? String(i.batchNumber).trim() : undefined,
          locationId: (i.locationId?._id || i.locationId)?.toString() || undefined,
        };
      });

      await inventoryApi.recordCounts(activeCount._id, formattedItems);
      success(`Physical counts for audit ${activeCount.countNumber} submitted for approval`);
      setActiveCount(null);
      loadData();
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to record counts';
      setActionError(errMsg);
      toastError(errMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (id: string, countNumber?: string) => {
    try {
      setActionLoading(true);
      await inventoryApi.approveCount(id);
      success(`Physical audit ${countNumber || ''} approved and reconciled to ledger`);
      loadData();
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to approve count';
      toastError(errMsg);
    } finally {
      setActionLoading(false);
    }
  };

  // Compute live variance stats inside modal
  const modalVarianceStats = useMemo(() => {
    if (!activeCount?.items) return { discrepancies: 0, totalImpact: 0, itemsCount: 0 };
    let discrepancies = 0;
    let totalImpact = 0;

    activeCount.items.forEach((itm: any, idx: number) => {
      const rowKey = itm._id || `${(itm.itemId?._id || itm.itemId)?.toString()}_${itm.batchNumber || ''}_${idx}`;
      const entered =
        countedQuantities[rowKey] !== undefined
          ? countedQuantities[rowKey]
          : itm.countedQuantity ?? itm.systemQuantity;
      const variance = entered - itm.systemQuantity;
      const unitCost = itm.unitCost || itm.itemId?.standardCost || 0;

      if (variance !== 0) {
        discrepancies++;
        totalImpact += variance * unitCost;
      }
    });

    return {
      discrepancies,
      totalImpact,
      itemsCount: activeCount.items.length,
    };
  }, [activeCount, countedQuantities]);

  const canCount = isSuperAdmin || can('inventory:count');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ClipboardList className="w-7 h-7 text-emerald-400" />
            Cycle Counts & Physical Audits
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Reconcile physical on-hand stock against system balances with automated variance calculation and ledger adjustment
          </p>
        </div>

        <div className="flex items-center gap-2.5">
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

          {canCount && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setActionError('');
                setFormErrors({});
                setWarehouseId('');
                setRemarks('');
                setIsPlanModalOpen(true);
              }}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Plan Cycle Count
            </Button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Card className="bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Audits</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/80 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-mono">{metrics.total}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{metrics.totalItemsAudited} SKUs snapshot</p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pending Counts</span>
              <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-500/10 border border-sky-200/80 dark:border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-sky-600 dark:text-sky-400 mt-1 font-mono">{metrics.plannedCount}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Floor counts open</p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Awaiting Approval</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono">{metrics.submittedCount}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Requires audit authorization</p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Reconciled</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/80 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">{metrics.completedCount}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Posted to inventory ledger</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs & Warehouse Dropdown */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
              statusFilter === 'ALL'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            All Audits ({counts.length})
          </button>
          <button
            onClick={() => setStatusFilter('PLANNED')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
              statusFilter === 'PLANNED'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Pending Floor Count ({metrics.plannedCount})
          </button>
          <button
            onClick={() => setStatusFilter('SUBMITTED')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
              statusFilter === 'SUBMITTED'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Awaiting Approval ({metrics.submittedCount})
          </button>
          <button
            onClick={() => setStatusFilter('COMPLETED')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
              statusFilter === 'COMPLETED'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Reconciled ({metrics.completedCount})
          </button>
        </div>

        <div className="w-56">
          <Select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            placeholder="All Warehouses"
            options={[
              { value: 'ALL', label: 'All Warehouses' },
              ...displayWarehouses.map((wh) => ({
                value: wh._id,
                label: `${wh.code} - ${wh.name}`,
              })),
            ]}
          />
        </div>
      </div>

      {/* Counts Table */}
      <Card className="bg-slate-900/80 border-slate-800 shadow-md">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Audit #</th>
                  <th className="py-3 px-4 font-semibold">Warehouse</th>
                  <th className="py-3 px-4 font-semibold">Count Date</th>
                  <th className="py-3 px-4 font-semibold">SKUs Audited</th>
                  <th className="py-3 px-4 font-semibold">Planned By</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {filteredCounts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                          <span>Loading physical audits...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <ClipboardList className="w-8 h-8 text-slate-400 dark:text-slate-600 mb-1" />
                          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No physical cycle count audits found</p>
                          <p className="text-xs text-slate-400 dark:text-slate-600">No audits match current filters.</p>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredCounts.map((c) => (
                    <tr key={c._id} className="hover:bg-slate-100/60 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {c.countNumber}
                        <span className="block text-[10px] font-normal text-slate-500 font-sans mt-0.5">
                          {c.remarks || 'Standard Audit'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {c.warehouseId?.code || 'WH'}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {c.warehouseId?.name}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                        {new Date(c.countDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                        <span className="font-semibold text-slate-900 dark:text-white">{c.items?.length || 0}</span> lines
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        {c.plannedBy?.name || 'Administrator'}
                      </td>
                      <td className="py-3 px-4">
                        {c.status === 'PLANNED' && <Badge variant="secondary">Planned</Badge>}
                        {c.status === 'SUBMITTED' && <Badge variant="warning">Submitted for Approval</Badge>}
                        {c.status === 'COMPLETED' && <Badge variant="success">Reconciled to Ledger</Badge>}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {c.status === 'PLANNED' && canCount && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openRecordModal(c)}
                              className="text-[11px] h-7 border-slate-700 hover:bg-slate-800"
                            >
                              <Edit3 className="w-3 h-3 mr-1" />
                              Enter Counts
                            </Button>
                          )}

                          {c.status === 'SUBMITTED' && canCount && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openRecordModal(c)}
                                className="text-[11px] h-7 border-slate-700"
                              >
                                Review Counts
                              </Button>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleApprove(c._id, c.countNumber)}
                                isLoading={actionLoading}
                                className="text-[11px] h-7 bg-emerald-600 hover:bg-emerald-500 shadow-sm"
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Approve Reconciliation
                              </Button>
                            </>
                          )}

                          {c.status === 'COMPLETED' && (
                            <div className="text-right">
                              <span className="text-[11px] text-emerald-400 flex items-center justify-end gap-1 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                Reconciled
                              </span>
                              {c.approvedBy?.name && (
                                <span className="block text-[10px] text-slate-500">by {c.approvedBy.name}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Plan Count Modal */}
      <Modal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        title="Plan New Cycle Count Audit"
        description="Snapshots current system quantities for physical verification"
      >
        <form onSubmit={handlePlanCount} className="space-y-4 text-xs" noValidate>
          {actionError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
              {actionError}
            </div>
          )}

          <Select
            label="Target Facility / Warehouse *"
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
              if (formErrors.warehouseId) setFormErrors((prev) => ({ ...prev, warehouseId: '' }));
            }}
            error={formErrors.warehouseId}
            placeholder="Select facility..."
            options={displayWarehouses.map((wh) => ({
              value: wh._id,
              label: `${wh.code} - ${wh.name}`,
            }))}
          />

          <Input
            label="Audit Notes / Scope"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. End of month complete facility verification"
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsPlanModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              Plan Audit
            </Button>
          </div>
        </form>
      </Modal>

      {/* Record Physical Counts Modal */}
      {activeCount && (
        <Modal
          isOpen={!!activeCount}
          onClose={() => {
            setActiveCount(null);
            setActionError('');
          }}
          title={`Physical Count Entry: ${activeCount.countNumber}`}
          description={`Facility: ${activeCount.warehouseId?.code || 'WH'} — Enter physical quantities observed on the warehouse floor`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            {actionError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Discrepancy Summary Banner */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center gap-3">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Audited SKUs</span>
                  <span className="text-sm font-bold text-white font-mono">{modalVarianceStats.itemsCount} lines</span>
                </div>
                <div className="h-6 border-r border-slate-800" />
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Discrepancies</span>
                  <span className={`text-sm font-bold font-mono ${modalVarianceStats.discrepancies > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {modalVarianceStats.discrepancies} items
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Estimated Value Impact</span>
                <span className={`text-sm font-bold font-mono ${
                  modalVarianceStats.totalImpact > 0
                    ? 'text-emerald-400'
                    : modalVarianceStats.totalImpact < 0
                    ? 'text-rose-400'
                    : 'text-slate-400'
                }`}>
                  {modalVarianceStats.totalImpact > 0 ? '+' : ''}
                  ${modalVarianceStats.totalImpact.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Physical Count Table */}
            <div className="max-h-[55vh] overflow-y-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Item (SKU)</th>
                    <th className="py-2.5 px-3">Batch / Lot</th>
                    <th className="py-2.5 px-3 text-right">System Qty</th>
                    <th className="py-2.5 px-3 text-right w-32">Physical Counted</th>
                    <th className="py-2.5 px-3 text-right">Variance</th>
                    <th className="py-2.5 px-3 text-right">Impact ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {modalLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        <RefreshCw className="w-4 h-4 animate-spin inline-block mr-2 text-emerald-400" />
                        Loading item snapshot details...
                      </td>
                    </tr>
                  ) : activeCount.items?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No items tracked in this audit.
                      </td>
                    </tr>
                  ) : (
                    activeCount.items?.map((itm: any, idx: number) => {
                      const rowKey = itm._id || `${(itm.itemId?._id || itm.itemId)?.toString()}_${itm.batchNumber || ''}_${idx}`;
                      const entered =
                        countedQuantities[rowKey] !== undefined
                          ? countedQuantities[rowKey]
                          : itm.countedQuantity ?? itm.systemQuantity;
                      const variance = entered - itm.systemQuantity;
                      const unitCost = itm.unitCost || itm.itemId?.standardCost || 0;
                      const itemImpact = variance * unitCost;

                      // Fully populated SKU & name with fallback
                      const itemSku = itm.itemId?.sku || itm.itemId?.code || (typeof itm.itemId === 'string' ? itm.itemId : 'SKU');
                      const itemName = itm.itemId?.name || 'Catalog Item';

                      return (
                        <tr key={rowKey} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2 px-3">
                            <span className="font-mono font-bold text-white block">{itemSku}</span>
                            <span className="block text-[11px] text-slate-400 max-w-[180px] truncate">{itemName}</span>
                            {itm.locationId && (
                              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 mt-0.5">
                                <Layers className="w-3 h-3" />
                                {itm.locationId.code || itm.locationId.name || 'Storage Bin'}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono">
                            {itm.batchNumber ? (
                              <span className="text-[10px] bg-slate-950 px-1.5 py-0.5 rounded text-slate-300 border border-slate-800">
                                {itm.batchNumber}
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-300 text-right">
                            {itm.systemQuantity}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              value={entered}
                              onChange={(e) =>
                                setCountedQuantities({
                                  ...countedQuantities,
                                  [rowKey]: Number(e.target.value),
                                })
                              }
                              className="text-right py-1 px-2 h-7 font-mono font-bold text-white focus:border-emerald-500"
                            />
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-right">
                            {variance > 0 ? (
                              <span className="text-emerald-400">+{variance}</span>
                            ) : variance < 0 ? (
                              <span className="text-rose-400">{variance}</span>
                            ) : (
                              <span className="text-slate-500">0</span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-right text-slate-300">
                            {unitCost > 0 ? (
                              <span className={variance > 0 ? 'text-emerald-400' : variance < 0 ? 'text-rose-400' : 'text-slate-500'}>
                                {itemImpact > 0 ? '+' : ''}${itemImpact.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                Variances will be automatically reconciled into stock balances upon approval.
              </span>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveCount(null);
                    setActionError('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveRecordedCounts}
                  isLoading={actionLoading}
                  className="bg-emerald-600 hover:bg-emerald-500 shadow-sm"
                >
                  Submit Physical Counts
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
