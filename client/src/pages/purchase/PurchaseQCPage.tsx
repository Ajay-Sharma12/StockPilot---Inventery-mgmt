import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Warehouse,
  Plus,
  Trash2,
  Layers,
  X,
  FileText,
  Sliders,
  ArrowRight,
  ClipboardList,
  ClipboardCheck,
  Lock,
  RotateCcw,
  Sparkles,
  UserCheck,
  Shield,
  Truck,
  Package,
} from 'lucide-react';
import { procurementApi, PurchaseQCInspection } from '../../api/procurement.api';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Skeleton } from '../../components/ui/Skeleton';
import { Select } from '../../components/ui/Select';
import { warehouseApi } from '../../api/warehouse.api';

export const PurchaseQCPage: React.FC = () => {
  const { user } = useAuth();
  const { can, hasRole } = usePermissions();
  const { success, error: toastError } = useToast();

  const [inspections, setInspections] = useState<PurchaseQCInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [activeInspection, setActiveInspection] = useState<PurchaseQCInspection | null>(null);
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [showDispositionModal, setShowDispositionModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Inspect Form State
  const [inspectParams, setInspectParams] = useState<
    { parameter: string; expected: string; actual: string; status: 'PASS' | 'FAIL' | 'NA' }[]
  >([
    { parameter: 'Visual Packaging & Seals', expected: 'Intact, no tampering', actual: 'Verified intact', status: 'PASS' },
    { parameter: 'Dimensional & Spec Verification', expected: 'Within standard tolerance', actual: 'Verified', status: 'PASS' },
    { parameter: 'Certificate of Analysis (CoA)', expected: 'Valid manufacturer CoA', actual: 'CoA attached', status: 'PASS' },
    { parameter: 'Labeling & Barcode Readability', expected: 'Compliant barcode/lot ID', actual: 'Legible', status: 'PASS' },
  ]);
  const [overallResult, setOverallResult] = useState<'PASS' | 'FAIL' | 'CONDITIONAL' | 'HOLD'>('PASS');
  const [inspectNotes, setInspectNotes] = useState('');

  // Disposition Form State
  const [acceptedQty, setAcceptedQty] = useState(0);
  const [rejectedQty, setRejectedQty] = useState(0);
  const [heldQty, setHeldQty] = useState(0);
  const [dispositionNotes, setDispositionNotes] = useState('');
  const [dispositionError, setDispositionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [warehouseBins, setWarehouseBins] = useState<any[]>([]);
  const [selectedBinId, setSelectedBinId] = useState('');

  // Role & Permissions Authorization
  const isQCInspector = Boolean(
    user?.isSuperAdmin ||
    user?.permissions?.includes('*') ||
    hasRole('qc-inspector') ||
    hasRole('QC Inspector') ||
    hasRole('tenant-admin') ||
    hasRole('operations-manager') ||
    can('purchase_qc.inspect') ||
    can('purchase_qc.approve') ||
    can('purchase_qc.disposition') ||
    can('qc:inspect') ||
    can('qc:approve')
  );

  const canApprove = Boolean(
    user?.isSuperAdmin ||
    user?.permissions?.includes('*') ||
    hasRole('qc-inspector') ||
    hasRole('QC Inspector') ||
    hasRole('tenant-admin') ||
    hasRole('operations-manager') ||
    can('purchase_qc.approve') ||
    can('purchase_qc.disposition') ||
    can('qc:approve')
  );

  useEffect(() => {
    loadQCQueue();
  }, [statusFilter]);

  const loadQCQueue = async () => {
    try {
      setLoading(true);
      const res = await procurementApi.getQCQueue({
        status: statusFilter || undefined,
        search: searchTerm || undefined,
      });
      setInspections(res.data || []);
    } catch (err) {
      console.error('Failed to load QC inspections', err);
    } finally {
      setLoading(false);
    }
  };

  const openInspectModal = (qc: PurchaseQCInspection) => {
    setActiveInspection(qc);
    if (qc.results && qc.results.length > 0) {
      setInspectParams(
        qc.results.map((r) => ({
          parameter: r.parameter,
          expected: r.expected || '',
          actual: r.actual || '',
          status: r.status,
        }))
      );
    } else {
      setInspectParams([
        { parameter: 'Visual Packaging & Seals', expected: 'Intact, no tampering', actual: 'Verified intact', status: 'PASS' },
        { parameter: 'Dimensional & Spec Verification', expected: 'Within standard tolerance', actual: 'Verified', status: 'PASS' },
        { parameter: 'Certificate of Analysis (CoA)', expected: 'Valid manufacturer CoA', actual: 'CoA attached', status: 'PASS' },
        { parameter: 'Labeling & Barcode Readability', expected: 'Compliant barcode/lot ID', actual: 'Legible', status: 'PASS' },
      ]);
    }
    setOverallResult(qc.overallResult || 'PASS');
    setInspectNotes(qc.remarks || '');
    setShowInspectModal(true);
  };

  const loadBinsForQC = async (qc: PurchaseQCInspection) => {
    setSelectedBinId('');
    setWarehouseBins([]);
    const whId = (qc.grnId as any)?.warehouseId?._id || (qc.grnId as any)?.warehouseId;
    if (whId) {
      try {
        const bins = await warehouseApi.getBins({ warehouseId: whId.toString() });
        if (bins && bins.length > 0) {
          setWarehouseBins(bins);
          setSelectedBinId(bins[0]._id);
        }
      } catch (err) {
        console.warn('Could not load warehouse bins for QC disposition', err);
      }
    }
  };

  const openDispositionModal = (qc: PurchaseQCInspection) => {
    setActiveInspection(qc);
    setDispositionError(null);
    const qty = qc.inspectedQuantity || 0;

    if (qc.overallResult === 'PASS') {
      setAcceptedQty(qty);
      setRejectedQty(0);
      setHeldQty(0);
    } else if (qc.overallResult === 'FAIL') {
      setAcceptedQty(0);
      setRejectedQty(qty);
      setHeldQty(0);
    } else {
      setAcceptedQty(0);
      setRejectedQty(0);
      setHeldQty(qty);
    }
    setDispositionNotes(
      qc.dispositionNotes ||
        `Quality inspection completed with determination: ${qc.overallResult || 'PASS'}. Material conformance verified.`
    );
    loadBinsForQC(qc);
    setShowDispositionModal(true);
  };

  const openQuickApprove = (qc: PurchaseQCInspection) => {
    setActiveInspection(qc);
    setDispositionError(null);
    const qty = qc.inspectedQuantity || 0;
    setAcceptedQty(qty);
    setRejectedQty(0);
    setHeldQty(0);
    setDispositionNotes('100% Passed visual inspection and technical specifications. Stock released to live inventory.');
    loadBinsForQC(qc);
    setShowDispositionModal(true);
  };

  const handleInspectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInspection) return;

    try {
      setSubmitting(true);
      await procurementApi.inspectQC(activeInspection._id, {
        inspectedQuantity: activeInspection.inspectedQuantity,
        results: inspectParams,
        overallResult,
        remarks: inspectNotes,
      });
      success(`Inspection checklist completed for ${activeInspection.qcNumber}!`);
      setShowInspectModal(false);
      await loadQCQueue();

      // Update active inspection in details modal if open
      if (showDetailsModal) {
        const updated = await procurementApi.getQCById(activeInspection._id);
        setActiveInspection(updated);
      }
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to submit inspection');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispositionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInspection) return;

    const total = acceptedQty + rejectedQty + heldQty;
    if (total !== activeInspection.inspectedQuantity) {
      setDispositionError(
        `Total allocated units (${total}) must match inspected batch quantity (${activeInspection.inspectedQuantity}).`
      );
      return;
    }

    try {
      setSubmitting(true);
      setDispositionError(null);
      await procurementApi.dispositionQC(activeInspection._id, {
        acceptedQuantity: acceptedQty,
        rejectedQuantity: rejectedQty,
        heldQuantity: heldQty,
        locationId: selectedBinId || undefined,
        dispositionNotes: dispositionNotes.trim() || 'Approved by Quality Assurance',
        notes: dispositionNotes.trim() || 'Approved by Quality Assurance',
      });

      success(
        `Disposition completed! ${acceptedQty} units released to live inventory.`
      );
      setShowDispositionModal(false);
      setShowDetailsModal(false);
      await loadQCQueue();
    } catch (err: any) {
      setDispositionError(err.response?.data?.message || err.message || 'Disposition failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const addInspectParam = () => {
    setInspectParams((prev) => [
      ...prev,
      { parameter: '', expected: '', actual: '', status: 'PASS' },
    ]);
  };

  const removeInspectParam = (index: number) => {
    setInspectParams((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateInspectParam = (
    index: number,
    patch: Partial<{ parameter: string; expected: string; actual: string; status: 'PASS' | 'FAIL' | 'NA' }>
  ) => {
    setInspectParams((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  };

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'PASS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> PASS
          </span>
        );
      case 'FAIL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-xs">
            <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" /> FAIL
          </span>
        );
      case 'CONDITIONAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" /> CONDITIONAL
          </span>
        );
      case 'HOLD':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shadow-xs">
            <Clock className="w-3.5 h-3.5 text-purple-500 shrink-0" /> HOLD
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
            {result || 'Pending'}
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            Awaiting Inspection
          </span>
        );
      case 'INSPECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Ready for Approval
          </span>
        );
      case 'DISPOSITIONED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            Stock Released
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium text-slate-400 bg-slate-800 border border-slate-700 whitespace-nowrap">
            {status}
          </span>
        );
    }
  };

  // Metrics summary
  const totalCount = inspections.length;
  const pendingCount = inspections.filter((i) => i.status === 'PENDING').length;
  const inspectedCount = inspections.filter((i) => i.status === 'INSPECTED').length;
  const dispositionedCount = inspections.filter((i) => i.status === 'DISPOSITIONED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>Quality Assurance</span>
            <span>&bull;</span>
            <span className="text-indigo-400">Procurement Dock QC Gating</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5 mt-1">
            <ShieldCheck className="h-7 w-7 text-emerald-400" />
            Purchase Quality Control (Inbound Receipt QC)
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Inspect incoming shipments received at the dock against purchase orders. Only QA-approved quantities enter available inventory.
          </p>
        </div>

        {/* Quality Inspector Role Badge */}
        <div className="flex items-center gap-2">
          {isQCInspector ? (
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold shadow-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>QA Inspector Authorized</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Read-Only Mode &bull; QC Inspector Login Required to Approve</span>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Counter Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-slate-400 text-xs font-medium">Total Inbound QC</div>
          <div className="text-2xl font-bold text-white mt-1 font-mono">{totalCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Shipments logged at dock</div>
        </div>
        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <div className="text-amber-400 text-xs font-medium flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Awaiting Inspection
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-1 font-mono">{pendingCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Needs physical checklist</div>
        </div>
        <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
          <div className="text-blue-400 text-xs font-medium flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Ready for Approval
          </div>
          <div className="text-2xl font-bold text-blue-400 mt-1 font-mono">{inspectedCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Awaiting stock disposition</div>
        </div>
        <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <div className="text-emerald-400 text-xs font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Released to Stock
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{dispositionedCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Active in warehouse ledger</div>
        </div>
      </div>

      {/* Safety Policy Banner */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-950/30 border border-indigo-500/20 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed text-slate-300">
          <span className="font-semibold text-white">Zero Inventory Contamination Guarantee:</span> Goods requiring Quality Check are strictly quarantined upon dock receipt. Stock is credited to live available inventory <strong>only upon official QC approval and disposition</strong>.
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by QC #, GRN #, Item name, SKU or Lot #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadQCQueue()}
            className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-sans"
          />
        </div>

        <div className="w-full sm:w-64">
          <Select
            size="sm"
            variant="indigo"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="All Workflow Statuses"
            options={[
              { value: '', label: 'All Workflow Statuses' },
              { value: 'PENDING', label: 'Awaiting Inspection', badge: 'PENDING' },
              { value: 'INSPECTED', label: 'Inspected (Ready for Approval)', badge: 'INSPECTED' },
              { value: 'DISPOSITIONED', label: 'Stock Released (Completed)', badge: 'DONE' },
            ]}
          />
        </div>
      </div>

      {/* QC Queue Table */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-800/60 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">QC Worksheet #</th>
                <th className="px-6 py-3.5">Source GRN & PO</th>
                <th className="px-6 py-3.5">Item & Description</th>
                <th className="px-6 py-3.5">Lot / Batch #</th>
                <th className="px-6 py-3.5 text-center">Inspected Qty</th>
                <th className="px-6 py-3.5 text-center">Result</th>
                <th className="px-6 py-3.5">Disposition Breakdown</th>
                <th className="px-6 py-3.5 whitespace-nowrap min-w-[140px]">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="hover:bg-slate-800/20">
                    <td className="px-6 py-4"><Skeleton className="h-4 w-28 bg-slate-800" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-32 bg-slate-800" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-24 bg-slate-800" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-20 bg-slate-800" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-28 bg-slate-800" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-20 bg-slate-800" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-20 bg-slate-800" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-20 rounded-full bg-slate-800" /></td>
                    <td className="px-6 py-4 text-right"><Skeleton className="h-8 w-20 rounded ml-auto bg-slate-800" /></td>
                  </tr>
                ))
              ) : inspections.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                    <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    No items in the QC queue. All received goods have been dispositioned or bypassed QC.
                  </td>
                </tr>
              ) : (
                inspections.map((qc) => (
                  <tr key={qc._id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-white flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      {qc.qcNumber}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      <div className="text-indigo-400 font-medium">
                        {qc.grnId?.grnNumber || 'GRN Reference'}
                      </div>
                      <div className="text-slate-500">
                        PO: {qc.grnId?.purchaseOrderId?.poNumber || 'PO Reference'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{qc.itemId?.name || 'Inventory Item'}</div>
                      <div className="text-xs text-slate-500 font-mono">{qc.itemId?.sku || qc.itemId?.code}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-300 text-xs">
                      {qc.batchNumber || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-center font-mono font-bold text-white">
                      {qc.inspectedQuantity}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getResultBadge(
                        qc.status === 'DISPOSITIONED' && (qc.overallResult === 'HOLD' || !qc.overallResult)
                          ? (qc.rejectedQuantity > 0 ? 'CONDITIONAL' : 'PASS')
                          : qc.overallResult
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono">
                      {qc.status === 'DISPOSITIONED' ? (
                        <div className="space-y-0.5">
                          <span className="text-emerald-400 font-semibold">{qc.acceptedQuantity} Passed</span>
                          <span className="text-slate-600"> · </span>
                          <span className="text-rose-400 font-semibold">{qc.rejectedQuantity} Rejected</span>
                          {qc.heldQuantity > 0 && (
                            <>
                              <span className="text-slate-600"> · </span>
                              <span className="text-amber-400 font-semibold">{qc.heldQuantity} Held</span>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">Awaiting Disposition</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap min-w-[140px]">{getStatusBadge(qc.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Pending: Inspection options */}
                        {qc.status === 'PENDING' && (
                          <>
                            {isQCInspector ? (
                              <>
                                <button
                                  onClick={() => openInspectModal(qc)}
                                  className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-lg text-xs font-medium transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                                  title="Perform inspection parameters checklist"
                                >
                                  <ClipboardList className="w-3.5 h-3.5" /> Inspect
                                </button>
                                <button
                                  onClick={() => openQuickApprove(qc)}
                                  className="px-2.5 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                                  title="Fast-track approve 100% accepted"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> Quick Approve
                                </button>
                              </>
                            ) : (
                              <button
                                disabled
                                className="px-2.5 py-1.5 bg-slate-800 text-slate-500 rounded-lg text-xs font-medium flex items-center gap-1 cursor-not-allowed opacity-60"
                                title="Login as Quality Inspector to perform inspection"
                              >
                                <Lock className="w-3 h-3" /> QC Login Req
                              </button>
                            )}
                          </>
                        )}

                        {/* Inspected: Disposition / Approval options */}
                        {qc.status === 'INSPECTED' && (
                          <>
                            {canApprove ? (
                              <button
                                onClick={() => openDispositionModal(qc)}
                                className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-indigo-600/30 flex items-center gap-1.5 animate-pulse"
                                title="Approve & Disposition: release accepted units to live warehouse inventory"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" /> Approve & Disposition
                              </button>
                            ) : (
                              <button
                                disabled
                                className="px-2.5 py-1.5 bg-slate-800 text-slate-500 rounded-lg text-xs font-medium flex items-center gap-1 cursor-not-allowed opacity-60"
                                title="Login as Quality Inspector to approve disposition"
                              >
                                <Lock className="w-3 h-3" /> Approve Req QC
                              </button>
                            )}
                          </>
                        )}

                        {/* View Report */}
                        <button
                          onClick={() => {
                            setActiveInspection(qc);
                            setShowDetailsModal(true);
                          }}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors border border-slate-700/50"
                        >
                          View Report
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Conduct Inspection Modal */}
      {showInspectModal && activeInspection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl p-6">
            <div className="flex justify-between items-start border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  Perform Quality Inspection — {activeInspection.qcNumber}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Item: <span className="text-white font-medium">{activeInspection.itemId?.name}</span> · Lot:{' '}
                  <span className="font-mono text-indigo-400">{activeInspection.batchNumber || 'N/A'}</span> · Qty:{' '}
                  <span className="font-mono text-white font-bold">{activeInspection.inspectedQuantity} units</span>
                </p>
              </div>
              <button
                onClick={() => setShowInspectModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInspectSubmit} className="space-y-5">
              {/* Checklist Parameters */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Inspection Test Parameters
                  </label>
                  <button
                    type="button"
                    onClick={addInspectParam}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Custom Check
                  </button>
                </div>

                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-2.5">Test Parameter</th>
                        <th className="px-4 py-2.5">Expected Spec</th>
                        <th className="px-4 py-2.5">Observed Finding</th>
                        <th className="px-3 py-2.5 text-center">Status</th>
                        <th className="px-2 py-2.5 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {inspectParams.map((param, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2.5">
                            <input
                              type="text"
                              required
                              value={param.parameter}
                              onChange={(e) => updateInspectParam(idx, { parameter: e.target.value })}
                              aria-label={`Test parameter ${idx + 1}`}
                              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <input
                              type="text"
                              value={param.expected}
                              onChange={(e) => updateInspectParam(idx, { expected: e.target.value })}
                              aria-label={`Expected specification for parameter ${idx + 1}`}
                              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <input
                              type="text"
                              value={param.actual}
                              onChange={(e) => updateInspectParam(idx, { actual: e.target.value })}
                              aria-label={`Observed finding for parameter ${idx + 1}`}
                              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="w-24 mx-auto">
                              <Select
                                size="sm"
                                variant={param.status === 'PASS' ? 'emerald' : param.status === 'FAIL' ? 'rose' : 'slate'}
                                value={param.status}
                                onChange={(e) =>
                                  updateInspectParam(idx, { status: e.target.value as any })
                                }
                                options={[
                                  { value: 'PASS', label: 'PASS', badge: 'PASS' },
                                  { value: 'FAIL', label: 'FAIL', badge: 'FAIL' },
                                  { value: 'NA', label: 'N/A', badge: 'N/A' },
                                ]}
                              />
                            </div>
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => removeInspectParam(idx)}
                              className="text-slate-500 hover:text-rose-400 p-1 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Overall Decision */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Select
                    label="Overall Inspection Determination *"
                    value={overallResult}
                    onChange={(e) => setOverallResult(e.target.value as any)}
                    variant={overallResult === 'PASS' ? 'emerald' : overallResult === 'FAIL' ? 'rose' : 'indigo'}
                    options={[
                      { value: 'PASS', label: 'PASS — Compliant to Specifications', badge: 'PASS' },
                      { value: 'FAIL', label: 'FAIL — Unacceptable Non-Conformance', badge: 'FAIL' },
                      { value: 'CONDITIONAL', label: 'CONDITIONAL — Deviations Noted', badge: 'WARN' },
                      { value: 'HOLD', label: 'HOLD — Pending Further Laboratory Tests', badge: 'HOLD' },
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Quality Observations & Inspector Notes
                  </label>
                  <textarea
                    rows={2}
                    value={inspectNotes}
                    onChange={(e) => setInspectNotes(e.target.value)}
                    placeholder="Enter observation notes, CoA batch references, or deviations..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowInspectModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold shadow-lg shadow-emerald-600/30 disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {submitting ? 'Saving Findings...' : 'Complete Inspection & Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disposition / Approval & Stock Release Modal */}
      {showDispositionModal && activeInspection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl p-6">
            <div className="flex justify-between items-start border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Warehouse className="w-5 h-5 text-indigo-400" />
                  Approve & Disposition Stock — {activeInspection.qcNumber}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Item: <span className="text-white font-medium">{activeInspection.itemId?.name}</span> · Inspected Qty:{' '}
                  <span className="font-mono text-white font-bold">{activeInspection.inspectedQuantity} units</span>
                </p>
              </div>
              <button
                onClick={() => setShowDispositionModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {dispositionError && (
              <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{dispositionError}</span>
              </div>
            )}

            <div className="p-3 mb-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 leading-relaxed">
              <strong>Stock Credit Mechanism:</strong> Exactly the <strong>Accepted quantity</strong> will be credited into live available warehouse inventory. Rejected items are recorded for vendor credit/RTV and locked out of stock.
            </div>

            {/* Live Allocation Real-time Balance Checker */}
            {activeInspection && (
              <div className="mb-4">
                {acceptedQty + rejectedQty + heldQty !== activeInspection.inspectedQuantity ? (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>
                        {acceptedQty + rejectedQty + heldQty > activeInspection.inspectedQuantity ? (
                          <>
                            <strong>Overallocated by {(acceptedQty + rejectedQty + heldQty) - activeInspection.inspectedQuantity} units!</strong> (Total {acceptedQty + rejectedQty + heldQty} &gt; Batch {activeInspection.inspectedQuantity}). Please adjust Accept or Reject.
                          </>
                        ) : (
                          <>
                            <strong>Underallocated by {activeInspection.inspectedQuantity - (acceptedQty + rejectedQty + heldQty)} units!</strong> (Total {acceptedQty + rejectedQty + heldQty} &lt; Batch {activeInspection.inspectedQuantity}).
                          </>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {activeInspection.inspectedQuantity - rejectedQty - heldQty >= 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setAcceptedQty(activeInspection.inspectedQuantity - rejectedQty - heldQty);
                            setDispositionError(null);
                          }}
                          className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded text-[11px] font-semibold transition-colors"
                        >
                          Auto-balance Accept ({activeInspection.inspectedQuantity - rejectedQty - heldQty})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setAcceptedQty(activeInspection.inspectedQuantity);
                          setRejectedQty(0);
                          setHeldQty(0);
                          setDispositionError(null);
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[11px] font-semibold transition-colors"
                      >
                        100% Accept
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>
                      <strong>Balanced!</strong> Total allocated ({acceptedQty + rejectedQty + heldQty} units) exactly matches batch quantity ({activeInspection.inspectedQuantity} units).
                    </span>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleDispositionSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-800/60 border border-emerald-500/30">
                  <label className="block text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
                    Accept (To Stock) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={activeInspection.inspectedQuantity}
                    value={acceptedQty}
                    onChange={(e) => {
                      setAcceptedQty(Number(e.target.value));
                      setDispositionError(null);
                    }}
                    aria-label="Accepted quantity"
                    className="w-full bg-slate-900 border border-emerald-500/40 rounded px-3 py-2 text-base font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-800/60 border border-rose-500/30">
                  <label className="block text-[11px] font-bold text-rose-400 uppercase tracking-wider mb-1">
                    Reject (Quarantine) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={activeInspection.inspectedQuantity}
                    value={rejectedQty}
                    onChange={(e) => {
                      setRejectedQty(Number(e.target.value));
                      setDispositionError(null);
                    }}
                    aria-label="Rejected quantity"
                    className="w-full bg-slate-900 border border-rose-500/40 rounded px-3 py-2 text-base font-mono font-bold text-rose-400 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-800/60 border border-purple-500/30">
                  <label className="block text-[11px] font-bold text-purple-400 uppercase tracking-wider mb-1">
                    Hold (Lab Pending) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={activeInspection.inspectedQuantity}
                    value={heldQty}
                    onChange={(e) => {
                      setHeldQty(Number(e.target.value));
                      setDispositionError(null);
                    }}
                    aria-label="Held quantity pending lab"
                    className="w-full bg-slate-900 border border-purple-500/40 rounded px-3 py-2 text-base font-mono font-bold text-purple-400 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Physical Storage Bin Selector */}
              {acceptedQty > 0 && (
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Warehouse className="w-3.5 h-3.5 text-emerald-400" />
                      Physical Storage Location / Bin
                    </span>
                    <span className="text-[11px] text-emerald-400 font-normal">
                      Physical bin placement
                    </span>
                  </label>
                  <Select
                    value={selectedBinId}
                    onChange={(e) => setSelectedBinId(e.target.value)}
                    placeholder="Warehouse Primary Bin (Auto-assign)"
                    searchable
                    variant="emerald"
                    options={[
                      { value: '', label: 'Warehouse Primary Bin (Auto-assign)' },
                      ...warehouseBins.map((bin) => ({
                        value: bin._id,
                        label: `${bin.code}${bin.name ? ` — ${bin.name}` : ''}`,
                        badge: bin.zone || undefined,
                      })),
                    ]}
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    {warehouseBins.length > 0
                      ? 'Stock will be credited directly to this physical bin for instant tracking.'
                      : 'Standard receiving bin for this facility will be assigned automatically.'}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Technical Disposition Justification / Sign-off Notes *
                </label>
                <textarea
                  required
                  rows={3}
                  value={dispositionNotes}
                  onChange={(e) => setDispositionNotes(e.target.value)}
                  placeholder="State technical basis for accepting/rejecting stock..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                <span className="text-xs text-slate-400 font-mono">
                  Allocated: {acceptedQty + rejectedQty + heldQty} / {activeInspection.inspectedQuantity}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDispositionModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || (acceptedQty + rejectedQty + heldQty !== activeInspection.inspectedQuantity)}
                    className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-lg text-sm font-semibold shadow-lg shadow-indigo-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <Warehouse className="w-4 h-4" />
                    {submitting ? 'Updating Ledger...' : 'Commit Approval & Release Stock'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QC Detail Worksheet View Modal (Photo 1 Enhanced) */}
      {showDetailsModal && activeInspection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl p-6 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-800 pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    QC Inspection Report: {activeInspection.qcNumber}
                  </h3>
                  {getStatusBadge(activeInspection.status)}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Item: <span className="text-white font-medium">{activeInspection.itemId?.name}</span> &bull; Lot:{' '}
                  <span className="font-mono text-indigo-400">{activeInspection.batchNumber || 'N/A'}</span>
                </p>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Visual Process Stepper (Explaining: eske aage kya hoyega) */}
            <div className="mb-5 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                Inbound Quality Lifecycle Flow
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {/* Step 1 */}
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                  <div className="font-semibold text-emerald-400 flex items-center justify-center gap-1 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 1. Dock Receipt
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {activeInspection.grnId?.grnNumber || 'GRN Created'}
                  </div>
                </div>

                {/* Step 2 */}
                <div
                  className={`p-2 rounded-lg border ${
                    activeInspection.status === 'PENDING'
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 animate-pulse'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  }`}
                >
                  <div className="font-semibold flex items-center justify-center gap-1 text-[11px]">
                    {activeInspection.status === 'PENDING' ? (
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    2. Parameter Tests
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {activeInspection.status === 'PENDING' ? 'Awaiting QA Run' : 'Inspected (Pass)'}
                  </div>
                </div>

                {/* Step 3 */}
                <div
                  className={`p-2 rounded-lg border ${
                    activeInspection.status === 'DISPOSITIONED'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : activeInspection.status === 'INSPECTED'
                      ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300 animate-pulse'
                      : 'bg-slate-800/40 border-slate-800 text-slate-500'
                  }`}
                >
                  <div className="font-semibold flex items-center justify-center gap-1 text-[11px]">
                    {activeInspection.status === 'DISPOSITIONED' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Warehouse className="w-3.5 h-3.5" />
                    )}
                    3. Stock Disposition
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {activeInspection.status === 'DISPOSITIONED'
                      ? `${activeInspection.acceptedQuantity} Units Released`
                      : 'Pending Approval'}
                  </div>
                </div>
              </div>
            </div>

            {/* Provenance & Item Specs Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 text-xs">
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Inbound Provenance & Origin
                </div>
                <div>
                  <span className="text-slate-500">Supplier:</span>{' '}
                  <span className="font-semibold text-white">
                    {activeInspection.grnId?.supplierId?.name || 'Authorized Supplier'}
                  </span>{' '}
                  {activeInspection.grnId?.supplierId?.supplierCode && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({activeInspection.grnId.supplierId.supplierCode})
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-slate-500">Purchase Order:</span>{' '}
                  <span className="font-mono text-indigo-300 font-semibold">
                    {activeInspection.grnId?.purchaseOrderId?.poNumber || 'PO Reference'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Source GRN:</span>{' '}
                  <span className="font-mono text-emerald-300 font-semibold">
                    {activeInspection.grnId?.grnNumber}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Warehouse Dock:</span>{' '}
                  <span className="font-medium text-slate-200">
                    {activeInspection.grnId?.warehouseId?.name || 'Central Warehouse'}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> Item Specifications & Lot
                </div>
                <div>
                  <span className="text-slate-500">Item Name:</span>{' '}
                  <span className="font-semibold text-white">{activeInspection.itemId?.name}</span>
                </div>
                <div>
                  <span className="text-slate-500">SKU / Code:</span>{' '}
                  <span className="font-mono text-slate-300 font-semibold">
                    {activeInspection.itemId?.sku || activeInspection.itemId?.code || 'SKU'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Lot / Batch #:</span>{' '}
                  <span className="font-mono text-amber-300 font-bold">
                    {activeInspection.batchNumber || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Inspected Qty:</span>{' '}
                  <span className="font-mono text-white font-bold">
                    {activeInspection.inspectedQuantity} units
                  </span>
                </div>
              </div>
            </div>

            {/* Status & Inspector Sign-off Details — Polished Executive Stat Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {/* Tile 1: QC Status */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  QC Status
                </span>
                <div className="flex items-center min-h-[28px]">
                  {getStatusBadge(activeInspection.status)}
                </div>
              </div>

              {/* Tile 2: Overall Result */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Overall Result
                </span>
                <div className="flex items-center min-h-[28px]">
                  {getResultBadge(
                    activeInspection.status === 'DISPOSITIONED' && (activeInspection.overallResult === 'HOLD' || !activeInspection.overallResult)
                      ? (activeInspection.rejectedQuantity > 0 ? 'CONDITIONAL' : 'PASS')
                      : activeInspection.overallResult
                  )}
                </div>
              </div>

              {/* Tile 3: Quality Inspector */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Inspector
                </span>
                <div className="flex items-center gap-2 min-h-[28px]">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <UserCheck className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {activeInspection.inspectorId?.name || (isQCInspector ? user?.name : 'Assigned QA')}
                  </span>
                </div>
              </div>

              {/* Tile 4: Dispositioned By */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Dispositioned By
                </span>
                <div className="flex items-center gap-2 min-h-[28px]">
                  {activeInspection.status === 'DISPOSITIONED' ? (
                    <>
                      <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 truncate">
                        {activeInspection.dispositionedBy?.name || 'QA Supervisor'}
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                        Pending Sign-off
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Checklist Results */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Verified Test Parameters
                </h4>
                <span className="text-[10px] text-slate-500 font-mono">
                  {(activeInspection.results || []).length} parameters checked
                </span>
              </div>

              {(activeInspection.results || []).length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-800/40 border border-dashed border-slate-700 text-center">
                  <ClipboardList className="w-6 h-6 mx-auto mb-1.5 text-amber-400/80" />
                  <p className="text-xs text-slate-300 font-medium">No test parameters recorded yet</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Standard checks (Packaging seals, dimensional tolerance, CoA, and barcode readability) are awaiting inspection.
                  </p>
                  {isQCInspector && activeInspection.status === 'PENDING' && (
                    <button
                      onClick={() => openInspectModal(activeInspection)}
                      className="mt-3 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition shadow"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" /> Start Inspection Checklist Now
                    </button>
                  )}
                </div>
              ) : (
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-800">
                      <tr>
                        <th className="px-3.5 py-2.5">Parameter Specification</th>
                        <th className="px-3.5 py-2.5">Expected Spec</th>
                        <th className="px-3.5 py-2.5">Observed Finding</th>
                        <th className="px-3.5 py-2.5 text-center">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {activeInspection.results.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-800/20">
                          <td className="px-3.5 py-2.5 font-medium text-white">{r.parameter}</td>
                          <td className="px-3.5 py-2.5 text-slate-400">{r.expected || 'Within tolerance'}</td>
                          <td className="px-3.5 py-2.5 text-slate-200 font-mono">{r.actual || 'Verified'}</td>
                          <td className="px-3.5 py-2.5 text-center font-bold">
                            {r.status === 'PASS' ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                PASS
                              </span>
                            ) : r.status === 'FAIL' ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                FAIL
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">N/A</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Post-QC Lifecycle Actions Breakdown */}
            {activeInspection.status === 'DISPOSITIONED' && (
              <div className="mb-4 space-y-2">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Post-QC Lifecycle Execution
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                    <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> {activeInspection.acceptedQuantity} Units Accepted
                    </div>
                    <p className="text-[11px] text-emerald-200/80 mt-1">
                      Posted to live warehouse inventory. Available for manufacturing & order fulfillment.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300">
                    <div className="font-bold text-rose-400 flex items-center gap-1.5">
                      <XCircle className="w-4 h-4" /> {activeInspection.rejectedQuantity} Units Rejected
                    </div>
                    <p className="text-[11px] text-rose-200/80 mt-1">
                      Quarantined for Return to Vendor (RTV) / Debit Note. Locked out of live stock.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300">
                    <div className="font-bold text-purple-400 flex items-center gap-1.5">
                      <Clock className="w-4 h-4" /> {activeInspection.heldQuantity} Units Quarantined
                    </div>
                    <p className="text-[11px] text-purple-200/80 mt-1">
                      Held in quarantine bin pending second-opinion lab assays.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-800 text-xs mt-2">
                  <div className="font-semibold text-white mb-1">Technical Disposition Notes</div>
                  <p className="text-slate-300 leading-relaxed">
                    {activeInspection.dispositionNotes || 'Standard specification acceptance.'}
                  </p>
                  {activeInspection.dispositionedAt && (
                    <div className="mt-2 text-slate-500 font-mono text-[11px]">
                      Authorized on: {new Date(activeInspection.dispositionedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Modal Footer with Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-800 mt-2">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Close Report
              </button>

              <div className="flex items-center gap-2">
                {/* When PENDING: Show Inspect and Quick Approve buttons */}
                {activeInspection.status === 'PENDING' && (
                  <>
                    {isQCInspector ? (
                      <>
                        <button
                          onClick={() => {
                            openInspectModal(activeInspection);
                          }}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-emerald-600/30 flex items-center gap-1.5"
                        >
                          <ClipboardList className="w-3.5 h-3.5" /> Conduct Inspection (Checklist)
                        </button>
                        <button
                          onClick={() => {
                            openQuickApprove(activeInspection);
                          }}
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-indigo-600/30 flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Quick Approve (100% Pass)
                        </button>
                      </>
                    ) : (
                      <div className="text-xs text-amber-400 flex items-center gap-1 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
                        <Lock className="w-3.5 h-3.5" /> QC Inspector login required to inspect & approve
                      </div>
                    )}
                  </>
                )}

                {/* When INSPECTED: Show Approve & Disposition button */}
                {activeInspection.status === 'INSPECTED' && (
                  <>
                    {canApprove ? (
                      <>
                        <button
                          onClick={() => {
                            openInspectModal(activeInspection);
                          }}
                          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors border border-slate-700 flex items-center gap-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Re-inspect Checklist
                        </button>
                        <button
                          onClick={() => {
                            openDispositionModal(activeInspection);
                          }}
                          className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-indigo-600/40 flex items-center gap-1.5 animate-pulse"
                        >
                          <ShieldCheck className="w-4 h-4" /> Approve & Disposition Stock
                        </button>
                      </>
                    ) : (
                      <div className="text-xs text-amber-400 flex items-center gap-1 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
                        <Lock className="w-3.5 h-3.5" /> QC Inspector credentials required to approve disposition
                      </div>
                    )}
                  </>
                )}

                {/* When DISPOSITIONED: Show Completed status */}
                {activeInspection.status === 'DISPOSITIONED' && (
                  <div className="text-xs text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-3.5 py-1.5 rounded-lg border border-emerald-500/30 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Live Inventory Credited & Released
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
