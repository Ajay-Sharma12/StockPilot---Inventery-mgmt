import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  X,
  Search,
  Filter,
  Layers,
  ClipboardList,
  Plus,
  ArrowRight,
  Boxes,
  FileText,
  Eye,
  XCircle,
  Clock,
  RotateCcw,
  Factory,
  UserCheck,
} from 'lucide-react';
import {
  productionApi,
  ProductionQCInspection,
  ProductionQCStatus,
  ProductionQCOverallResult,
  ProductionQCDisposition,
} from '../../api/production.api';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../context/ToastContext';
import { Select } from '../../components/ui/Select';

export const ProductionQCPage: React.FC = () => {
  const { can } = usePermissions();
  const { success, error: toastError } = useToast();
  const [inspections, setInspections] = useState<ProductionQCInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Details Modal State
  const [detailModalQC, setDetailModalQC] = useState<ProductionQCInspection | null>(null);

  // Inspect Modal State
  const [inspectModalQC, setInspectModalQC] = useState<ProductionQCInspection | null>(null);
  const [inspectResults, setInspectResults] = useState<
    Array<{ parameter: string; expected?: string; actual?: string; status: 'PASS' | 'FAIL' | 'NA' }>
  >([]);
  const [inspectOverall, setInspectOverall] = useState<ProductionQCOverallResult>('PASS');
  const [inspectRemarks, setInspectRemarks] = useState('');
  const [inspectSubmitting, setInspectSubmitting] = useState(false);

  // Disposition Modal State
  const [dispModalQC, setDispModalQC] = useState<ProductionQCInspection | null>(null);
  const [dispAccepted, setDispAccepted] = useState(0);
  const [dispRejected, setDispRejected] = useState(0);
  const [dispHeld, setDispHeld] = useState(0);
  const [dispRework, setDispRework] = useState(0);
  const [dispType, setDispType] = useState<ProductionQCDisposition>('ACCEPT');
  const [dispNotes, setDispNotes] = useState('');
  const [dispSubmitting, setDispSubmitting] = useState(false);
  const [dispError, setDispError] = useState('');

  // Override Verdict Modal State (Admin / QC Supervisor)
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideVerdict, setOverrideVerdict] = useState<ProductionQCOverallResult>('PASS');
  const [overrideRemarks, setOverrideRemarks] = useState('');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  const handleOverrideVerdictSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailModalQC) return;
    try {
      setOverrideSubmitting(true);
      const updated = await productionApi.overrideQCVerdict(detailModalQC._id, {
        overallResult: overrideVerdict,
        remarks: overrideRemarks,
      });
      setDetailModalQC(updated);
      success(`QC Inspection verdict updated to ${overrideVerdict} successfully!`);
      setShowOverrideModal(false);
      await loadQCInspections();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to update QC verdict');
    } finally {
      setOverrideSubmitting(false);
    }
  };

  useEffect(() => {
    loadQCInspections();
  }, [statusFilter]);

  const loadQCInspections = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;
      const res = await productionApi.getQCInspections(params);
      const qcList = Array.isArray(res) ? res : (res?.data || []);
      setInspections(qcList);
    } catch (err) {
      console.error('Failed to load QC inspections', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadQCInspections();
  };

  const handleInspectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectModalQC) return;

    try {
      setInspectSubmitting(true);
      await productionApi.inspectQC(inspectModalQC._id, {
        results: inspectResults,
        overallResult: inspectOverall,
        remarks: inspectRemarks,
      });

      setInspectModalQC(null);
      success('QC inspection completed successfully');
      loadQCInspections();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to complete QC inspection');
    } finally {
      setInspectSubmitting(false);
    }
  };

  const handleDispositionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispModalQC) return;
    setDispError('');

    const total = Number(dispAccepted) + Number(dispRejected) + Number(dispHeld) + Number(dispRework);
    if (total !== dispModalQC.inspectedQuantity) {
      return setDispError(
        `Sum of allocated quantities (${total}) must match inspected quantity (${dispModalQC.inspectedQuantity})`
      );
    }
    if (!dispNotes.trim()) return setDispError('Disposition notes are required');

    try {
      setDispSubmitting(true);
      await productionApi.dispositionQC(dispModalQC._id, {
        disposition: dispType,
        acceptedQuantity: Number(dispAccepted),
        rejectedQuantity: Number(dispRejected),
        heldQuantity: Number(dispHeld),
        reworkQuantity: Number(dispRework),
        dispositionNotes: dispNotes,
      });

      setDispModalQC(null);
      success(
        `Disposition completed! Exactly ${dispAccepted} accepted finished goods credited into live inventory. Rejected units quarantined.`
      );
      loadQCInspections();
    } catch (err: any) {
      setDispError(err.response?.data?.message || 'Failed to disposition QC inspection');
    } finally {
      setDispSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <span>Quality Assurance</span>
          <span>&bull;</span>
          <span className="text-indigo-600 dark:text-indigo-400">Production QC Gating</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">Production Quality Inspections</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Execute test checklists and disposition manufactured batches. Only QC-accepted units enter live inventory.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <form onSubmit={handleSearch} className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search QC #, batch #..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </form>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs">
          {['ALL', 'PENDING', 'INSPECTED', 'DISPOSITIONED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                statusFilter === st
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 uppercase border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4">QC Inspection #</th>
                <th className="py-3.5 px-4">Batch & Order</th>
                <th className="py-3.5 px-4">Manufactured Item</th>
                <th className="py-3.5 px-4">Inspected Qty</th>
                <th className="py-3.5 px-4">Disposition Breakdown</th>
                <th className="py-3.5 px-4">Result</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Loading QC queue...
                  </td>
                </tr>
              ) : inspections.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No production QC inspections found matching criteria.
                  </td>
                </tr>
              ) : (
                inspections.map((qc) => (
                  <tr key={qc._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {qc.qcNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {qc.batchNumber || 'Unassigned Batch'}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {qc.productionOrderId?.productionOrderNumber || 'Work Order'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {qc.itemId?.name || 'Hydraulic Pump Assembly'}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">{qc.itemId?.sku || 'SKU-001'}</div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                      {qc.inspectedQuantity} units
                    </td>
                    <td className="py-3.5 px-4">
                      {qc.status === 'DISPOSITIONED' ? (
                        <div className="text-xs space-y-0.5">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {qc.acceptedQuantity} Accept
                          </span>{' '}
                          &bull;{' '}
                          <span className="text-rose-600 dark:text-rose-400 font-semibold">
                            {qc.rejectedQuantity} Reject
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Awaiting Disposition</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                          qc.overallResult === 'PASS'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                            : qc.overallResult === 'FAIL'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                        }`}
                      >
                        {qc.overallResult}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap min-w-[130px]">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap shadow-xs ${
                          qc.status === 'DISPOSITIONED'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : qc.status === 'INSPECTED'
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {qc.status === 'DISPOSITIONED' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                        {qc.status === 'INSPECTED' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                        {qc.status === 'PENDING' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />}
                        {qc.status === 'DISPOSITIONED' ? 'Stock Released' : qc.status === 'INSPECTED' ? 'Ready for Approval' : 'Awaiting Inspection'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setDetailModalQC(qc)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="View Traceability & Inspection Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>

                        {qc.status === 'PENDING' && can('production-qc.inspect') && (
                          <button
                            onClick={() => {
                              setInspectModalQC(qc);
                              const defaultList =
                                qc.results && qc.results.length > 0
                                  ? qc.results.map((r) => ({
                                      parameter: r.parameter,
                                      expected: r.expected || '',
                                      actual: r.actual || '',
                                      status: r.status,
                                    }))
                                  : [
                                      {
                                        parameter: 'Operational Hydraulic Burst Pressure (Bar)',
                                        expected: '350 Bar minimum',
                                        actual: '360 Bar',
                                        status: 'PASS' as const,
                                      },
                                      {
                                        parameter: 'Flange Acoustic Decibels (< 65 dB)',
                                        expected: '< 65 dB at 2000 RPM',
                                        actual: '59 dB',
                                        status: 'PASS' as const,
                                      },
                                      {
                                        parameter: 'Zero-Leakage Seal Integrity',
                                        expected: '0.00 ml leakage',
                                        actual: '0.00 ml',
                                        status: 'PASS' as const,
                                      },
                                    ];
                              setInspectResults(defaultList);
                              const anyFailed = defaultList.some((r) => r.status === 'FAIL');
                              setInspectOverall(anyFailed ? 'FAIL' : 'PASS');
                              setInspectRemarks(qc.remarks || '');
                            }}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm"
                          >
                            Inspect Checklist
                          </button>
                        )}

                        {qc.status === 'INSPECTED' && can('production-qc.approve') && (
                          <button
                            onClick={() => {
                              setDispModalQC(qc);
                              setDispAccepted(qc.inspectedQuantity);
                              setDispRejected(0);
                              setDispHeld(0);
                              setDispRework(0);
                              setDispType('ACCEPT');
                              setDispNotes('Passed all engineering tolerances. Signed off for inventory release.');
                              setDispError('');
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm"
                          >
                            Disposition Batch
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Checklist Modal */}
      {inspectModalQC && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Execute Production QC Checklist</h3>
                <p className="text-xs text-slate-500">
                  Inspection {inspectModalQC.qcNumber} &bull; Batch {inspectModalQC.batchNumber} (
                  {inspectModalQC.inspectedQuantity} units)
                </p>
              </div>
              <button onClick={() => setInspectModalQC(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInspectSubmit} className="space-y-4">
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {inspectResults.map((res, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-12 gap-2 items-center"
                  >
                    <div className="col-span-5">
                      <span className="block text-xs font-semibold text-slate-900 dark:text-white">{res.parameter}</span>
                      <span className="block text-[10px] text-slate-400">Spec: {res.expected}</span>
                    </div>
                    <div className="col-span-4">
                      <input
                        type="text"
                        value={res.actual}
                        onChange={(e) => {
                          const updated = [...inspectResults];
                          updated[idx].actual = e.target.value;
                          setInspectResults(updated);
                        }}
                        placeholder="Observed value"
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                      />
                    </div>
                    <div className="col-span-3">
                      <Select
                        size="sm"
                        value={res.status}
                        onChange={(e) => {
                          const updated = [...inspectResults];
                          updated[idx].status = e.target.value as any;
                          setInspectResults(updated);
                          const anyFailed = updated.some((r) => r.status === 'FAIL');
                          setInspectOverall(anyFailed ? 'FAIL' : 'PASS');
                        }}
                        variant={res.status === 'PASS' ? 'emerald' : res.status === 'FAIL' ? 'rose' : 'slate'}
                        options={[
                          { value: 'PASS', label: 'PASS' },
                          { value: 'FAIL', label: 'FAIL' },
                          { value: 'NA', label: 'NA' },
                        ]}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Overall Inspection Verdict *
                  </label>
                  <Select
                    value={inspectOverall}
                    onChange={(e) => setInspectOverall(e.target.value as any)}
                    variant={inspectOverall === 'PASS' ? 'emerald' : inspectOverall === 'FAIL' ? 'rose' : 'slate'}
                    options={[
                      { value: 'PASS', label: 'PASS (Compliant Release)' },
                      { value: 'FAIL', label: 'FAIL (Defect Non-Conformance)' },
                      { value: 'HOLD', label: 'HOLD / QUARANTINE' },
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Inspector Remarks
                  </label>
                  <input
                    type="text"
                    value={inspectRemarks}
                    onChange={(e) => setInspectRemarks(e.target.value)}
                    placeholder="All parameters verified..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setInspectModalQC(null)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inspectSubmitting}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                  {inspectSubmitting ? 'Recording...' : 'Submit Inspection Results'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disposition Modal */}
      {dispModalQC && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Batch Quality Dispositioning</h3>
                <p className="text-xs text-slate-500">
                  Total Inspected Quantity: <span className="font-bold">{dispModalQC.inspectedQuantity} units</span>
                </p>
              </div>
              <button onClick={() => setDispModalQC(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {dispError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{dispError}</span>
              </div>
            )}

            <form onSubmit={handleDispositionSubmit} className="space-y-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/80 text-xs text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="w-4 h-4 inline mr-1" />
                <strong>Strict Inventory Gating Invariant:</strong> Only units allocated to Accepted Quantity will be
                automatically credited into warehouse active stock balances via the Inventory Ledger.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Accepted Quantity (Posted to Stock) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={dispAccepted}
                    onChange={(e) => setDispAccepted(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-emerald-600 dark:text-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Rejected Quantity (Quarantined)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={dispRejected}
                    onChange={(e) => setDispRejected(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-rose-600 dark:text-rose-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Held / Investigation Qty
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={dispHeld}
                    onChange={(e) => setDispHeld(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Disposition Sign-off Action
                  </label>
                  <Select
                    value={dispType}
                    onChange={(e) => setDispType(e.target.value as any)}
                    variant="indigo"
                    options={[
                      { value: 'ACCEPT', label: 'ACCEPT (Full Release)' },
                      { value: 'REJECT', label: 'REJECT (Scrap / Hold)' },
                      { value: 'HOLD', label: 'HOLD (Quarantine)' },
                      { value: 'REWORK', label: 'REWORK (Secondary Run)' },
                    ]}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Compliance Disposition Notes *
                </label>
                <textarea
                  rows={2}
                  required
                  value={dispNotes}
                  onChange={(e) => setDispNotes(e.target.value)}
                  placeholder="Passed acoustic and burst pressure certification..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDispModalQC(null)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dispSubmitting}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                  {dispSubmitting ? 'Posting Ledger Receipt...' : 'Authorize Disposition & Credit Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Production QC Inspection Details & Traceability Report Modal */}
      {detailModalQC && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                  Production QC Inspection Report: {detailModalQC.qcNumber}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Item: {detailModalQC.itemId?.name || 'Manufactured Item'} &bull; Batch: {detailModalQC.batchNumber || 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setDetailModalQC(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Provenance & Manufactured Item Specification Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 text-xs">
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Factory className="w-3.5 h-3.5" /> Production Provenance & Recipe
                </div>
                <div>
                  <span className="text-slate-500">Work Order:</span>{' '}
                  <span className="font-mono text-indigo-300 font-semibold">
                    {detailModalQC.productionOrderId?.productionOrderNumber || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">BOM Reference:</span>{' '}
                  <span className="font-semibold text-white">
                    {detailModalQC.productionOrderId?.bomId?.bomNumber || 'Standard BOM'}
                    {detailModalQC.productionOrderId?.bomId?.version ? ` (v${detailModalQC.productionOrderId.bomId.version})` : ''}
                  </span>
                  {detailModalQC.productionOrderId?.bomId?.name && (
                    <span className="text-[11px] text-slate-400 block ml-0 truncate">
                      {detailModalQC.productionOrderId.bomId.name}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-slate-500">Target Warehouse:</span>{' '}
                  <span className="font-medium text-slate-200">
                    {detailModalQC.productionOrderId?.warehouseId?.name || 'Main Warehouse'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Order Progress:</span>{' '}
                  <span className="font-mono text-slate-300">
                    Yield: {detailModalQC.productionOrderId?.yieldQuantity ?? 0} / Plan: {detailModalQC.productionOrderId?.plannedQuantity ?? detailModalQC.inspectedQuantity}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5" /> Manufactured Item & Lot
                </div>
                <div>
                  <span className="text-slate-500">Item Name:</span>{' '}
                  <span className="font-semibold text-white">{detailModalQC.itemId?.name || 'Item'}</span>
                </div>
                <div>
                  <span className="text-slate-500">SKU / Code:</span>{' '}
                  <span className="font-mono text-slate-300 font-semibold">
                    {detailModalQC.itemId?.sku || detailModalQC.itemId?.itemCode || 'SKU'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Lot / Batch #:</span>{' '}
                  <span className="font-mono text-amber-300 font-bold">{detailModalQC.batchNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Mfg / Expiry:</span>{' '}
                  <span className="text-slate-300 font-mono text-[11px]">
                    {detailModalQC.batchId?.manufacturingDate
                      ? new Date(detailModalQC.batchId.manufacturingDate).toLocaleDateString()
                      : 'N/A'}{' '}
                    &bull;{' '}
                    {detailModalQC.batchId?.expiryDate
                      ? new Date(detailModalQC.batchId.expiryDate).toLocaleDateString()
                      : 'No Expiry'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Inspected Qty:</span>{' '}
                  <span className="font-mono text-white font-bold">{detailModalQC.inspectedQuantity} units</span>
                </div>
              </div>
            </div>

            {/* Status & Inspector Summary — Polished Executive Stat Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">QC Status</span>
                <div className="flex items-center min-h-[28px]">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap shadow-xs ${
                      detailModalQC.status === 'DISPOSITIONED'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : detailModalQC.status === 'INSPECTED'
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {detailModalQC.status === 'DISPOSITIONED' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                    {detailModalQC.status === 'INSPECTED' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                    {detailModalQC.status === 'PENDING' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />}
                    {detailModalQC.status === 'DISPOSITIONED' ? 'Stock Released' : detailModalQC.status === 'INSPECTED' ? 'Ready for Approval' : 'Awaiting Inspection'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Overall Verdict</span>
                  {can('production-qc.approve') && (
                    <button
                      type="button"
                      onClick={() => {
                        setOverrideVerdict(detailModalQC.overallResult === 'HOLD' ? 'PASS' : detailModalQC.overallResult);
                        setOverrideRemarks('');
                        setShowOverrideModal(true);
                      }}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold underline"
                      title="Update Verdict as Admin / QA Manager"
                    >
                      Update
                    </button>
                  )}
                </div>
                <div className="flex items-center min-h-[28px]">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap shadow-xs ${
                      detailModalQC.overallResult === 'PASS'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : detailModalQC.overallResult === 'FAIL'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {detailModalQC.overallResult === 'PASS' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                    {detailModalQC.overallResult === 'FAIL' && <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                    {detailModalQC.overallResult || 'PASS'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Quality Inspector</span>
                <div className="flex items-center gap-2 min-h-[28px]">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <UserCheck className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {detailModalQC.inspectorId?.name || 'Assigned QA'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Dispositioned By</span>
                <div className="flex items-center gap-2 min-h-[28px]">
                  {detailModalQC.status === 'DISPOSITIONED' ? (
                    <>
                      <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 truncate">
                        {detailModalQC.dispositionedBy?.name || 'Authorized QA'}
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

            {/* Checklist Results Table */}
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Verified Test Parameters</span>
              <span className="text-[10px] text-slate-500 font-mono">
                {(detailModalQC.results || []).length} parameters checked
              </span>
            </h4>
            <div className="border border-slate-800 rounded-xl overflow-hidden mb-4">
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
                  {(detailModalQC.results || []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3.5 py-4 text-center text-slate-500">
                        Checklist pending execution.
                      </td>
                    </tr>
                  ) : (
                    detailModalQC.results.map((r, i) => (
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
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Post-QC Lifecycle Actions Breakdown */}
            {detailModalQC.status === 'DISPOSITIONED' && (
              <div className="mb-4 space-y-2">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Post-QC Lifecycle Execution
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                    <div className="font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> {detailModalQC.acceptedQuantity} Accepted
                    </div>
                    <p className="text-[10px] text-emerald-200/80 mt-1 leading-tight">
                      Credited to live inventory. Batch marked RELEASED.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300">
                    <div className="font-bold text-rose-400 flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5 flex-shrink-0" /> {detailModalQC.rejectedQuantity} Rejected
                    </div>
                    <p className="text-[10px] text-rose-200/80 mt-1 leading-tight">
                      Material Scrap ledger logged against order reject count.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300">
                    <div className="font-bold text-purple-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 flex-shrink-0" /> {detailModalQC.heldQuantity} Quarantined
                    </div>
                    <p className="text-[10px] text-purple-200/80 mt-1 leading-tight">
                      Segregated in quarantine bin pending lab re-inspection.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                    <div className="font-bold text-amber-400 flex items-center gap-1">
                      <RotateCcw className="w-3.5 h-3.5 flex-shrink-0" /> {detailModalQC.reworkQuantity} Rework
                    </div>
                    <p className="text-[10px] text-amber-200/80 mt-1 leading-tight">
                      Dispatched for shop floor reprocessing & calibration.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-800 text-xs mt-2">
                  <div className="font-semibold text-white mb-1">Technical Disposition Notes</div>
                  <p className="text-slate-300 leading-relaxed">
                    {detailModalQC.dispositionNotes || 'Standard specification clearance.'}
                  </p>
                  {detailModalQC.dispositionedAt && (
                    <div className="mt-2 text-slate-500 font-mono text-[11px]">
                      Authorized on: {new Date(detailModalQC.dispositionedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              {can('production-qc.approve') ? (
                <button
                  type="button"
                  onClick={() => {
                    setOverrideVerdict(detailModalQC.overallResult === 'HOLD' ? 'PASS' : detailModalQC.overallResult);
                    setOverrideRemarks('');
                    setShowOverrideModal(true);
                  }}
                  className="px-3.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  Override Verdict (Admin)
                </button>
              ) : (
                <div />
              )}
              <button
                onClick={() => setDetailModalQC(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Override Verdict Modal (Admin / QA Authority) */}
      {showOverrideModal && detailModalQC && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                  Update Inspection Verdict
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Report: {detailModalQC.qcNumber} &bull; Batch {detailModalQC.batchNumber}
                </p>
              </div>
              <button
                onClick={() => setShowOverrideModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOverrideVerdictSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Overall Verdict *
                </label>
                <Select
                  value={overrideVerdict}
                  onChange={(e) => setOverrideVerdict(e.target.value as any)}
                  variant={overrideVerdict === 'PASS' ? 'emerald' : overrideVerdict === 'FAIL' ? 'rose' : 'slate'}
                  options={[
                    { value: 'PASS', label: 'PASS (Compliant Release)' },
                    { value: 'CONDITIONAL', label: 'CONDITIONAL (Partial / Conditional Clearance)' },
                    { value: 'HOLD', label: 'HOLD (Quarantine / Further Lab Testing)' },
                    { value: 'FAIL', label: 'FAIL (Defect / Non-Conformance)' },
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Reason for Update / Sign-off Remarks *
                </label>
                <textarea
                  required
                  rows={3}
                  value={overrideRemarks}
                  onChange={(e) => setOverrideRemarks(e.target.value)}
                  placeholder="e.g. All engineering tolerances verified and signed off by QA Head. Reclassified as PASS."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={overrideSubmitting}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                >
                  {overrideSubmitting ? 'Updating...' : 'Save & Update Verdict'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
