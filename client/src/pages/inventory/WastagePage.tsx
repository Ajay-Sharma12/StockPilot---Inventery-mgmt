import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Trash2,
  Plus,
  RefreshCw,
  CheckCircle2,
  DollarSign,
  AlertTriangle,
  XCircle,
  Filter,
  ShieldAlert,
  Package,
  Layers,
  Info,
  Building2,
  Warehouse,
  ChevronDown,
  Check,
  Search,
  X,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { inventoryApi } from '../../api/inventory.api';
import { warehouseApi } from '../../api/warehouse.api';
import { itemApi } from '../../api/item.api';
import { masterDataApi } from '../../api/masterData.api';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../context/ToastContext';

export const WastagePage: React.FC = () => {
  const { can, isSuperAdmin } = usePermissions();
  const { success, error: toastError } = useToast();

  const [wastages, setWastages] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [itemsList, setItemsList] = useState<any[]>([]);
  const [reasons, setReasons] = useState<any[]>([]);
  const [bins, setBins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'COMPLETED' | 'REJECTED'>('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('ALL');
  const [warehouseDropdownOpen, setWarehouseDropdownOpen] = useState(false);
  const [warehouseSearchQuery, setWarehouseSearchQuery] = useState('');
  const warehouseDropdownRef = useRef<HTMLDivElement>(null);

  // Close custom warehouse dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (warehouseDropdownRef.current && !warehouseDropdownRef.current.contains(e.target as Node)) {
        setWarehouseDropdownOpen(false);
      }
    };
    if (warehouseDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [warehouseDropdownOpen]);

  // Clean warehouses list without temporary test facilities
  const displayWarehouses = useMemo(() => {
    return (warehouses || []).filter(
      (w) => !w.code?.startsWith('PERSIST-') && !w.code?.startsWith('TEST-')
    );
  }, [warehouses]);

  const selectedWarehouse = useMemo(() => {
    return displayWarehouses.find((w) => w._id === warehouseFilter);
  }, [displayWarehouses, warehouseFilter]);

  const filteredDropdownWarehouses = useMemo(() => {
    if (!warehouseSearchQuery.trim()) return displayWarehouses;
    const q = warehouseSearchQuery.toLowerCase();
    return displayWarehouses.filter(
      (w) => w.code?.toLowerCase().includes(q) || w.name?.toLowerCase().includes(q)
    );
  }, [displayWarehouses, warehouseSearchQuery]);

  // Reject Modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; wastageNumber: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('Inspection rejected / Stock intact');
  const [rejectionError, setRejectionError] = useState('');

  // Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [itemId, setItemId] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [reasonId, setReasonId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [autoApprove, setAutoApprove] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const loadData = async () => {
    try {
      setLoading(true);
      const [wRes, whRes, itemsRes, reasonsRes] = await Promise.all([
        inventoryApi.getWastages({ limit: 100 }),
        warehouseApi.getWarehouses(),
        itemApi.getItems({ limit: 200 }),
        masterDataApi.getWastageReasons(),
      ]);

      let whs = whRes || [];
      let rsn = reasonsRes || [];
      if (whs.length === 0 || rsn.length === 0) {
        try {
          await masterDataApi.initializeStarterData();
          [whs, rsn] = await Promise.all([
            warehouseApi.getWarehouses(),
            masterDataApi.getWastageReasons(),
          ]);
        } catch (initErr) {
          console.warn('Auto starter data initialization in WastagePage skipped:', initErr);
        }
      }

      setWastages(wRes.data || []);
      setWarehouses(whs || []);
      setItemsList(itemsRes.data || []);
      setReasons(rsn || []);
    } catch (err) {
      console.error('Failed to load wastages', err);
      toastError('Failed to load wastage records');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadData();
      success('Wastage and scrap data refreshed');
    } catch (err: any) {
      toastError('Failed to refresh data');
    } finally {
      setTimeout(() => setRefreshing(false), 300);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch bins when warehouse is selected in modal
  useEffect(() => {
    if (!warehouseId) {
      setBins([]);
      setLocationId('');
      return;
    }
    const fetchBins = async () => {
      try {
        const binData = await warehouseApi.getBins({ warehouseId });
        setBins(binData || []);
      } catch (err) {
        setBins([]);
      }
    };
    fetchBins();
  }, [warehouseId]);

  // Selected item object for cost preview
  const selectedItem = useMemo(() => {
    return itemsList.find((i) => i._id === itemId);
  }, [itemsList, itemId]);

  const unitCostPreview = useMemo(() => {
    if (!selectedItem) return 0;
    return selectedItem.standardCost || selectedItem.sellingPrice || 0;
  }, [selectedItem]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!warehouseId) errors.warehouseId = 'Please select a facility / warehouse';
    if (!itemId) errors.itemId = 'Please select an item (SKU)';
    if (quantity === undefined || quantity === null || isNaN(quantity) || quantity <= 0) {
      errors.quantity = 'Please enter a valid scrap quantity (> 0)';
    }
    if (!reasonId) errors.reasonId = 'Please select a scrap reason';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    try {
      setActionLoading(true);
      setActionError('');
      const res = await inventoryApi.createWastage({
        warehouseId,
        locationId: locationId || undefined,
        items: [
          {
            itemId,
            batchNumber: batchNumber?.trim() || undefined,
            quantity: Number(quantity),
            reasonId: reasonId || undefined,
            remarks: remarks?.trim() || undefined,
          },
        ],
        remarks: remarks?.trim() || undefined,
      });

      if (autoApprove && res?._id) {
        try {
          await inventoryApi.approveWastage(res._id);
          success(`Scrap record ${res.wastageNumber ? `#${res.wastageNumber} ` : ''}logged and approved! Stock deducted and write-off finalized.`);
        } catch (approveErr: any) {
          success(`Scrap request ${res.wastageNumber ? `#${res.wastageNumber} ` : ''}logged for review (${approveErr.response?.data?.message || 'Awaiting manual approval'}).`);
        }
      } else {
        success(`Scrap request ${res.wastageNumber ? `#${res.wastageNumber} ` : ''}logged! Supervisor approval is now required.`);
      }

      setIsModalOpen(false);
      setWarehouseId('');
      setLocationId('');
      setItemId('');
      setBatchNumber('');
      setQuantity(1);
      setReasonId('');
      setRemarks('');
      setAutoApprove(false);
      setFormErrors({});

      loadData();
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to log wastage';
      setActionError(errMsg);
      toastError(errMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (id: string, wastageNumber?: string) => {
    try {
      setActionLoading(true);
      await inventoryApi.approveWastage(id);
      success(`Scrap record ${wastageNumber ? `#${wastageNumber} ` : ''}approved! Inventory deducted and financial loss recorded.`);
      loadData();
    } catch (err: any) {
      toastError(err.response?.data?.message || err.message || 'Failed to approve wastage');
    } finally {
      setActionLoading(false);
    }
  };

  const openRejectModal = (id: string, wastageNumber?: string) => {
    setRejectTarget({ id, wastageNumber: wastageNumber || '' });
    setRejectionReason('Inspection rejected / Stock intact');
    setRejectionError('');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!rejectTarget) return;

    if (!rejectionReason.trim()) {
      setRejectionError('Please provide a reason for rejecting this scrap report');
      return;
    }

    try {
      setActionLoading(true);
      await inventoryApi.rejectWastage(rejectTarget.id, rejectionReason.trim());
      success(`Scrap record #${rejectTarget.wastageNumber} was marked as REJECTED.`);
      setRejectModalOpen(false);
      setRejectTarget(null);
      loadData();
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to reject wastage';
      setRejectionError(errMsg);
      toastError(errMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const canAdjust = isSuperAdmin || can('inventory:adjust');

  // KPI Calculations
  // KPI Calculations
  const metrics = useMemo(() => {
    let totalScrapLoss = 0; // Total financial loss across all active scrap records (Approved + Pending)
    let approvedLoss = 0;   // Completed write-offs
    let pendingLoss = 0;    // Awaiting supervisor authorization
    let pendingCount = 0;
    let completedCount = 0;
    let totalScrappedUnits = 0;
    let approvedUnits = 0;
    let pendingUnits = 0;

    for (const w of wastages) {
      if (w.status === 'REJECTED') continue; // Exclude rejected scrap reports

      // Apply warehouse filter to metrics if one is actively selected
      if (warehouseFilter !== 'ALL') {
        const whId = w.warehouseId?._id || w.warehouseId;
        if (whId !== warehouseFilter) continue;
      }

      const itemCost = w.items?.reduce((sum: number, it: any) => sum + (it.totalCost || 0), 0) || 0;
      const itemQty = w.items?.reduce((sum: number, it: any) => sum + (it.quantity || 0), 0) || 0;

      totalScrapLoss += itemCost;
      totalScrappedUnits += itemQty;

      if (w.status === 'COMPLETED') {
        completedCount++;
        approvedLoss += itemCost;
        approvedUnits += itemQty;
      } else if (w.status === 'DRAFT' || w.status === 'SUBMITTED') {
        pendingCount++;
        pendingLoss += itemCost;
        pendingUnits += itemQty;
      }
    }

    return {
      totalScrapLoss,
      approvedLoss,
      pendingLoss,
      pendingCount,
      completedCount,
      totalScrappedUnits,
      approvedUnits,
      pendingUnits,
    };
  }, [wastages, warehouseFilter]);

  // Filtered List
  const filteredWastages = useMemo(() => {
    return wastages.filter((w) => {
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'DRAFT') {
          if (w.status !== 'DRAFT' && w.status !== 'SUBMITTED') return false;
        } else if (w.status !== statusFilter) {
          return false;
        }
      }
      if (warehouseFilter !== 'ALL') {
        const whId = w.warehouseId?._id || w.warehouseId;
        if (whId !== warehouseFilter) return false;
      }
      return true;
    });
  }, [wastages, statusFilter, warehouseFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Trash2 className="w-7 h-7 text-rose-400" />
            Wastage & Scrap Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track damaged, expired, or obsolete stock with financial scrap valuation, location binning, and disposal authorization
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

          {canAdjust && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setActionError('');
                setIsModalOpen(true);
              }}
              className="text-xs bg-rose-600 hover:bg-rose-500 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Log Scrap Request
            </Button>
          )}
        </div>
      </div>

      {/* Top Attention / In-Page Notification Banner */}
      {metrics.pendingCount > 0 && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/40 via-rose-950/20 to-slate-900 border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg shadow-amber-950/20 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-white">Pending Scrap Authorizations</h4>
                <Badge variant="warning">{metrics.pendingCount} Action Required</Badge>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                There are <span className="font-semibold text-amber-300">{metrics.pendingCount}</span> scrap request(s) totaling <span className="font-mono font-semibold text-white">${metrics.pendingLoss.toFixed(2)}</span> awaiting supervisor review. Authorizing will officially issue the stock from inventory balances and record financial write-off.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {statusFilter !== 'DRAFT' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatusFilter('DRAFT')}
                className="text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
              >
                Review Pending ({metrics.pendingCount})
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatusFilter('ALL')}
                className="text-xs text-slate-400 hover:text-white"
              >
                Show All Records
              </Button>
            )}
          </div>
        </div>
      )}

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Scrap Loss</p>
              <h3 className="text-xl font-bold text-rose-400 font-mono mt-1">
                ${metrics.totalScrapLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {metrics.approvedLoss > 0 && metrics.pendingLoss > 0 ? (
                  <>
                    <span className="text-emerald-400 font-medium">${metrics.approvedLoss.toFixed(2)} approved</span>
                    {' • '}
                    <span className="text-amber-400 font-medium">${metrics.pendingLoss.toFixed(2)} pending</span>
                  </>
                ) : metrics.approvedLoss > 0 ? (
                  <span className="text-emerald-400 font-medium">${metrics.approvedLoss.toFixed(2)} approved write-offs</span>
                ) : metrics.pendingLoss > 0 ? (
                  <span className="text-amber-400 font-medium">${metrics.pendingLoss.toFixed(2)} pending review</span>
                ) : (
                  'No scrap loss logged'
                )}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Pending Review</p>
              <h3 className="text-xl font-bold text-amber-400 font-mono mt-1">
                {metrics.pendingCount}
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {metrics.pendingCount > 0 ? (
                  <span className="text-amber-300 font-medium">${metrics.pendingLoss.toFixed(2)} awaiting action</span>
                ) : (
                  'All requests reviewed'
                )}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Written Off Loss</p>
              <h3 className="text-xl font-bold text-emerald-400 font-mono mt-1">
                ${metrics.approvedLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {metrics.completedCount > 0 ? (
                  <span>{metrics.completedCount} disposal(s) finalized</span>
                ) : (
                  '0 finalized write-offs'
                )}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Scrapped Units</p>
              <h3 className="text-xl font-bold text-white font-mono mt-1">
                {metrics.totalScrappedUnits.toLocaleString()}
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {metrics.approvedUnits > 0 && metrics.pendingUnits > 0 ? (
                  `${metrics.approvedUnits} approved • ${metrics.pendingUnits} pending`
                ) : metrics.approvedUnits > 0 ? (
                  `${metrics.approvedUnits} items removed`
                ) : metrics.pendingUnits > 0 ? (
                  `${metrics.pendingUnits} items pending review`
                ) : (
                  '0 items removed'
                )}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Package className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 font-medium mr-1.5 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
              statusFilter === 'ALL'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            All ({wastages.length})
          </button>
          <button
            onClick={() => setStatusFilter('DRAFT')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
              statusFilter === 'DRAFT'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Pending Review ({metrics.pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter('COMPLETED')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
              statusFilter === 'COMPLETED'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Written Off ({metrics.completedCount})
          </button>
        </div>

        {/* Custom Modern Warehouse Filter Dropdown */}
        <div className="relative" ref={warehouseDropdownRef}>
          <button
            type="button"
            onClick={() => setWarehouseDropdownOpen(!warehouseDropdownOpen)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all duration-150 shadow-sm ${
              warehouseDropdownOpen
                ? 'border-rose-500/60 bg-slate-900 text-white ring-2 ring-rose-500/20'
                : warehouseFilter !== 'ALL'
                ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                : 'border-slate-800 bg-slate-950/80 hover:bg-slate-900 hover:border-slate-700 text-slate-300'
            }`}
          >
            <div className="w-5 h-5 rounded-md bg-rose-500/15 flex items-center justify-center border border-rose-500/25 text-rose-400">
              <Building2 className="w-3 h-3" />
            </div>

            <div className="flex items-center gap-1.5 text-left">
              {selectedWarehouse ? (
                <>
                  <span className="font-mono text-[10px] font-bold text-rose-300 px-1.5 py-0.5 rounded bg-slate-950 border border-rose-500/30">
                    {selectedWarehouse.code}
                  </span>
                  <span className="text-slate-200 font-medium max-w-[140px] truncate">
                    {selectedWarehouse.name}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-medium text-slate-200">All Warehouses</span>
                  <span className="px-1.5 py-0.2 text-[10px] font-mono rounded-full bg-slate-800 text-slate-400">
                    {displayWarehouses.length}
                  </span>
                </>
              )}
            </div>

            {warehouseFilter !== 'ALL' && (
              <span
                role="button"
                title="Clear filter"
                onClick={(e) => {
                  e.stopPropagation();
                  setWarehouseFilter('ALL');
                }}
                className="p-0.5 rounded-md hover:bg-rose-500/30 text-rose-300 hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </span>
            )}

            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                warehouseDropdownOpen ? 'rotate-180 text-rose-400' : ''
              }`}
            />
          </button>

          {/* Custom Glassmorphism Dropdown Menu Popover */}
          {warehouseDropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-slate-900/98 backdrop-blur-xl border border-slate-700/90 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Dropdown Header */}
              <div className="px-3.5 py-2.5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
                  <Warehouse className="w-3.5 h-3.5 text-rose-400" />
                  <span>Facility Filter</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono bg-slate-800/80 px-2 py-0.5 rounded-full">
                  {displayWarehouses.length} locations
                </span>
              </div>

              {/* Search Bar if multiple facilities */}
              {displayWarehouses.length > 2 && (
                <div className="p-2 border-b border-slate-800/60 bg-slate-950/40">
                  <div className="relative">
                    <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={warehouseSearchQuery}
                      onChange={(e) => setWarehouseSearchQuery(e.target.value)}
                      placeholder="Search facility name or code..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500/60"
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {/* Options List */}
              <div className="p-1.5 max-h-60 overflow-y-auto space-y-1">
                {/* Global 'All Warehouses' Option */}
                <button
                  type="button"
                  onClick={() => {
                    setWarehouseFilter('ALL');
                    setWarehouseDropdownOpen(false);
                    setWarehouseSearchQuery('');
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all group ${
                    warehouseFilter === 'ALL'
                      ? 'bg-rose-500/15 border border-rose-500/30 text-rose-200 font-semibold'
                      : 'hover:bg-slate-800/70 text-slate-300 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                        warehouseFilter === 'ALL'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">All Warehouses</div>
                      <div className="text-[10px] text-slate-500">Consolidated cross-facility report</div>
                    </div>
                  </div>
                  {warehouseFilter === 'ALL' && (
                    <Check className="w-4 h-4 text-rose-400 shrink-0 stroke-[2.5]" />
                  )}
                </button>

                <div className="border-t border-slate-800/80 my-1" />

                {/* Warehouse List */}
                {filteredDropdownWarehouses.map((wh) => {
                  const isSelected = warehouseFilter === wh._id;
                  return (
                    <button
                      key={wh._id}
                      type="button"
                      onClick={() => {
                        setWarehouseFilter(wh._id);
                        setWarehouseDropdownOpen(false);
                        setWarehouseSearchQuery('');
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all group ${
                        isSelected
                          ? 'bg-rose-500/15 border border-rose-500/30 text-rose-200 font-semibold shadow-sm'
                          : 'hover:bg-slate-800/70 text-slate-300 hover:text-white border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'
                          }`}
                        >
                          <Building2 className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-slate-950 text-rose-300 border border-slate-800">
                              {wh.code}
                            </span>
                            <span className="text-xs text-slate-200 truncate font-medium">
                              {wh.name}
                            </span>
                          </div>
                          {wh.type && (
                            <span className="text-[10px] text-slate-500 block truncate mt-0.5">
                              {wh.type}
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-rose-400 shrink-0 stroke-[2.5] ml-2" />
                      )}
                    </button>
                  );
                })}

                {filteredDropdownWarehouses.length === 0 && (
                  <div className="py-4 text-center text-xs text-slate-500">
                    No matching facilities found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Wastage Table */}
      <Card className="bg-slate-900/80 border-slate-800 shadow-md">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Wastage #</th>
                  <th className="py-3 px-4 font-semibold">Warehouse / Location</th>
                  <th className="py-3 px-4 font-semibold">Item (SKU)</th>
                  <th className="py-3 px-4 font-semibold text-right">Scrapped Qty</th>
                  <th className="py-3 px-4 font-semibold text-right">Unit Cost</th>
                  <th className="py-3 px-4 font-semibold text-right">Total Scrap Loss</th>
                  <th className="py-3 px-4 font-semibold">Reason & Remarks</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {filteredWastages.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500">
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-rose-600 dark:text-rose-400" />
                          <span>Loading scrap records...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <Trash2 className="w-8 h-8 text-slate-400 dark:text-slate-600 mb-1" />
                          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No wastage records found</p>
                          <p className="text-xs text-slate-400 dark:text-slate-600">No damaged stock recorded under current filters.</p>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredWastages.map((w) => {
                    const isPending = w.status === 'DRAFT' || w.status === 'SUBMITTED';
                    const isCompleted = w.status === 'COMPLETED';
                    const isRejected = w.status === 'REJECTED';

                    return (
                      <tr key={w._id} className="hover:bg-slate-100/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-rose-600 dark:text-rose-400">
                          {w.wastageNumber}
                          <span className="block text-[10px] font-normal text-slate-500 font-sans mt-0.5">
                            {new Date(w.createdAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {w.warehouseId?.code || 'WH'}
                          </div>
                          {w.locationId ? (
                            <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                              <Layers className="w-3 h-3" />
                              {w.locationId?.code || w.locationId?.name}
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-500">General Facility Area</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {w.items?.map((i: any, idx: number) => (
                            <div key={idx} className="min-w-0">
                              <span className="font-mono font-bold text-slate-900 dark:text-slate-200">
                                {i.itemId?.sku || 'SKU'}
                              </span>
                              <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                                {i.itemId?.name}
                              </span>
                              {i.batchNumber && (
                                <span className="inline-block text-[10px] font-mono bg-slate-100 dark:bg-slate-950 px-1 py-0.5 rounded text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 mt-0.5">
                                  Lot: {i.batchNumber}
                                </span>
                              )}
                            </div>
                          ))}
                        </td>
                        <td className="py-3 px-4 font-bold text-rose-600 dark:text-rose-400 font-mono text-right">
                          -{w.items?.[0]?.quantity ?? 0}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300 text-right">
                          ${(w.items?.[0]?.unitCost || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white text-right">
                          ${(w.items?.[0]?.totalCost || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 max-w-[180px]">
                          <span className="font-medium text-slate-200 block truncate">
                            {w.items?.[0]?.reasonId?.name || 'Damaged stock'}
                          </span>
                          {(w.remarks || w.items?.[0]?.remarks) && (
                            <span className="text-[10px] text-slate-400 truncate block mt-0.5">
                              {w.remarks || w.items?.[0]?.remarks}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {isCompleted ? (
                            <Badge variant="error">Written Off</Badge>
                          ) : isPending ? (
                            <Badge variant="warning">Awaiting Approval</Badge>
                          ) : isRejected ? (
                            <Badge variant="default">Rejected</Badge>
                          ) : (
                            <Badge variant="default">{w.status}</Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {isPending && canAdjust && (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleApprove(w._id, w.wastageNumber)}
                                isLoading={actionLoading}
                                className="text-[11px] h-7 bg-rose-600 hover:bg-rose-500"
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Approve Write-off
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openRejectModal(w._id, w.wastageNumber)}
                                isLoading={actionLoading}
                                className="text-[11px] h-7 border-slate-700 text-slate-400 hover:text-rose-400 hover:bg-rose-950/20"
                                title="Reject scrap report"
                              >
                                <XCircle className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                          {isCompleted && (
                            <div className="text-right">
                              <span className="text-xs text-slate-400 flex items-center justify-end gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                Approved
                              </span>
                              {w.approvedBy?.name && (
                                <span className="block text-[10px] text-slate-500">by {w.approvedBy.name}</span>
                              )}
                            </div>
                          )}
                          {isRejected && (
                            <span className="text-xs text-slate-500">Discarded</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Log Wastage Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setFormErrors({});
        }}
        title="Record Damaged or Expired Stock (Wastage)"
        description="Scraps inventory and writes off the financial value against organizational loss"
      >
        <form onSubmit={handleCreate} noValidate className="space-y-4 text-xs">
          {actionError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
              {actionError}
            </div>
          )}

          {/* Facility & Location Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Select
                label="Facility / Warehouse *"
                value={warehouseId}
                variant="rose"
                onChange={(e) => {
                  setWarehouseId(e.target.value);
                  if (formErrors.warehouseId) setFormErrors((prev) => ({ ...prev, warehouseId: '' }));
                }}
                placeholder="Select facility..."
                options={displayWarehouses.map((wh) => ({
                  value: wh._id,
                  label: `${wh.code} - ${wh.name}`,
                }))}
                error={formErrors.warehouseId}
              />
            </div>

            <div>
              <Select
                label="Bin Location (Optional)"
                value={locationId}
                variant="rose"
                onChange={(e) => setLocationId(e.target.value)}
                placeholder={bins.length > 0 ? 'Select storage bin...' : 'All / Default Area'}
                disabled={!warehouseId || bins.length === 0}
                options={bins.map((b) => ({
                  value: b._id,
                  label: `${b.code} - ${b.name || 'Storage Bin'}`,
                }))}
              />
            </div>
          </div>

          {itemsList.length === 0 ? (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
              <span>No items registered in your catalog yet.</span>
              <a href="/inventory/items" className="font-semibold text-rose-400 hover:underline">
                Register Items &rarr;
              </a>
            </div>
          ) : (
            <div>
              <Select
                label="Scrapped Item (SKU) *"
                value={itemId}
                variant="rose"
                searchable={true}
                onChange={(e) => {
                  setItemId(e.target.value);
                  if (formErrors.itemId) setFormErrors((prev) => ({ ...prev, itemId: '' }));
                }}
                placeholder="Select SKU..."
                options={itemsList.map((item) => ({
                  value: item._id,
                  label: `${item.sku} - ${item.name}`,
                  sublabel: `Category: ${item.category || 'General'} | UOM: ${item.uom || 'Unit'}`,
                }))}
                error={formErrors.itemId}
              />
            </div>
          )}

          {/* Quantity & Reason */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Quantity to Scrap *"
              type="number"
              min="0.001"
              step="any"
              value={quantity}
              onChange={(e) => {
                setQuantity(Number(e.target.value));
                if (formErrors.quantity) setFormErrors((prev) => ({ ...prev, quantity: '' }));
              }}
              error={formErrors.quantity}
            />

            <Select
              label="Scrap Reason *"
              value={reasonId}
              variant="rose"
              onChange={(e) => {
                setReasonId(e.target.value);
                if (formErrors.reasonId) setFormErrors((prev) => ({ ...prev, reasonId: '' }));
              }}
              placeholder="Select reason..."
              options={reasons.map((r) => ({
                value: r._id,
                label: r.name,
                sublabel: r.description,
              }))}
              error={formErrors.reasonId}
            />
          </div>

          {/* Batch Number & Live Cost Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Batch / Lot Number (Optional)"
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
              placeholder="e.g. LOT-2026-03"
            />

            {selectedItem && (
              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex flex-col justify-center">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Financial Impact Preview</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-slate-400">Est. Total Loss:</span>
                  <span className="font-mono font-bold text-rose-400 text-sm">
                    ${(unitCostPreview * (quantity || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <Input
            label="Incident Report / Remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. Water leak in aisle 4 / expired inventory"
          />

          {canAdjust && (
            <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer bg-slate-950/70 border border-slate-800 p-2.5 rounded-lg hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={autoApprove}
                onChange={(e) => setAutoApprove(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-rose-500 h-4 w-4"
              />
              <div>
                <span className="font-semibold text-white">Approve & Write-off Immediately</span>
                <span className="block text-[10px] text-slate-400">
                  Directly deduct stock from warehouse balances and record financial write-off (skips pending supervisor review)
                </span>
              </div>
            </label>
          )}

          <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/20 text-slate-300 text-[11px] flex items-start gap-2">
            <Info className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>
              Submitting logs a scrap draft. When approved by authorized staff, stock is deducted from balances, ledger records a <code className="text-rose-300 font-mono">WASTAGE</code> event, and total loss is booked.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsModalOpen(false);
                setFormErrors({});
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={actionLoading}
              className="bg-rose-600 hover:bg-rose-500"
            >
              Log Scrap Request
            </Button>
          </div>
        </form>
      </Modal>

      {/* Rejection Justification Modal */}
      {rejectModalOpen && (
        <Modal
          isOpen={rejectModalOpen}
          onClose={() => {
            setRejectModalOpen(false);
            setRejectTarget(null);
          }}
          title={`Reject Scrap Record: #${rejectTarget?.wastageNumber || ''}`}
          description="Enter a justification for discarding this write-off request. The scrap log will be marked as REJECTED."
          maxWidth="md"
        >
          <form onSubmit={handleConfirmReject} className="space-y-4 text-xs">
            {rejectionError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{rejectionError}</span>
              </div>
            )}

            <div>
              <label className="block text-slate-300 font-semibold mb-1 uppercase tracking-wider text-[11px]">
                Rejection Reason / Justification *
              </label>
              <Input
                value={rejectionReason}
                onChange={(e) => {
                  setRejectionReason(e.target.value);
                  if (rejectionError) setRejectionError('');
                }}
                placeholder="Enter justification..."
                autoFocus
              />
            </div>

            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5 font-semibold">
                Quick Reason Presets:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Inspection rejected / Stock intact',
                  'Damage claim unverified upon floor inspection',
                  'Incorrect SKU / batch entered in report',
                  'Item repaired & returned to active storage',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setRejectionReason(preset);
                      if (rejectionError) setRejectionError('');
                    }}
                    className={`text-[10px] px-2 py-1 rounded-md border transition-all text-left ${
                      rejectionReason === preset
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-medium'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setRejectModalOpen(false);
                  setRejectTarget(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={actionLoading}
                className="bg-rose-600 hover:bg-rose-500 shadow-sm"
              >
                Confirm Rejection
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
