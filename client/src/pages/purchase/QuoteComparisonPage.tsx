import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  CheckCircle2,
  Trophy,
  Clock,
  DollarSign,
  ShieldCheck,
  ChevronLeft,
  Package,
  AlertCircle,
  Award,
} from 'lucide-react';
import { procurementApi } from '../../api/procurement.api';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../context/ToastContext';

export const QuoteComparisonPage: React.FC = () => {
  const { rfqId } = useParams<{ rfqId: string }>();
  const { can } = usePermissions();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  const [matrixData, setMatrixData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Finalization Dialog State
  const [selectedQuoteToFinalize, setSelectedQuoteToFinalize] = useState<any>(null);
  const [selectionReason, setSelectionReason] = useState('');
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    if (rfqId) {
      loadComparison();
    }
  }, [rfqId]);

  const loadComparison = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await procurementApi.getQuoteComparison(rfqId!);
      setMatrixData(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate quote comparison matrix');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuoteToFinalize || !selectionReason.trim()) return;

    try {
      setFinalizing(true);
      await procurementApi.finalizeQuote(selectedQuoteToFinalize.quoteId, selectionReason.trim());
      success(`Quote awarded to ${selectedQuoteToFinalize.supplierName || 'supplier'}! Real Email & SMS award notice dispatched.`);
      setSelectedQuoteToFinalize(null);
      setSelectionReason('');
      await loadComparison();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to finalize quotation');
    } finally {
      setFinalizing(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400 text-sm">
        Generating multi-vendor quotation comparison matrix...
      </div>
    );
  }

  if (error || !matrixData) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-white">Comparison Matrix Unavailable</h2>
        <p className="text-slate-400 text-sm">{error || 'No quotations found for this RFQ.'}</p>
        <Link
          to="/purchase/rfqs"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700"
        >
          <ChevronLeft className="w-4 h-4" /> Return to RFQs
        </Link>
      </div>
    );
  }

  const { rfq, suppliers, itemsMatrix, bestOptions } = matrixData;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/purchase/rfqs"
            className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium mb-1.5"
          >
            <ChevronLeft className="w-4 h-4" /> Back to RFQs
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ArrowLeftRight className="w-6 h-6 text-indigo-400" />
            Quote Comparison: {rfq.rfqNumber}
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Side-by-side commercial comparison across {suppliers.length} bidding suppliers.
          </p>
        </div>

        {bestOptions.selectedQuoteId && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <Award className="w-4 h-4" />
            Winning Bid Awarded: {bestOptions.selectedSupplierName}
          </div>
        )}
      </div>

      {/* Comparison Matrix Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              {/* Header row with Supplier Info */}
              <tr className="border-b border-slate-800 bg-slate-950/60">
                <th className="p-4 w-72 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-r border-slate-800/80">
                  Item Specifications
                </th>
                {suppliers.map((s: any) => {
                  const isLowest = s.quoteId === bestOptions.lowestPriceQuoteId;
                  const isSelected = s.status === 'SELECTED';

                  return (
                    <th
                      key={s.quoteId}
                      className={`p-4 min-w-[240px] border-r border-slate-800/80 align-top ${
                        isSelected
                          ? 'bg-emerald-950/20'
                          : isLowest
                          ? 'bg-indigo-950/20'
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-indigo-400 text-xs font-bold">{s.quoteNumber}</span>
                        {isSelected ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold text-[10px] flex items-center gap-1 border border-emerald-500/30">
                            <Award className="w-3 h-3" /> Awarded
                          </span>
                        ) : isLowest ? (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold text-[10px] flex items-center gap-1 border border-indigo-500/30">
                            <Trophy className="w-3 h-3" /> Best Price
                          </span>
                        ) : null}
                      </div>

                      <h4 className="text-white font-bold text-sm tracking-tight">{s.supplierName}</h4>
                      <p className="text-slate-500 text-[10px] font-mono">{s.supplierCode}</p>

                      <div className="mt-3 pt-2 border-t border-slate-800/80 space-y-1">
                        <div className="flex justify-between text-slate-300">
                          <span className="text-slate-500">Commercial Total:</span>
                          <span className="font-mono font-bold text-sm text-white">
                            ${s.total?.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400 text-[11px]">
                          <span>Terms:</span>
                          <span>{s.paymentTerms}</span>
                        </div>
                        <div className="flex justify-between text-slate-400 text-[11px]">
                          <span>Shipping:</span>
                          <span>{s.shippingTerms || 'Standard Dock'}</span>
                        </div>
                      </div>

                      {/* Finalize button */}
                      {s.status !== 'SELECTED' && !bestOptions.selectedQuoteId && can('purchase:approve') && (
                        <button
                          onClick={() => setSelectedQuoteToFinalize(s)}
                          className="mt-3 w-full py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-md shadow-indigo-600/20"
                        >
                          Select & Award Bid
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60">
              {itemsMatrix.map((itemRow: any, rowIdx: number) => (
                <tr key={rowIdx} className="hover:bg-slate-800/20 transition">
                  <td className="p-4 border-r border-slate-800/80 align-top">
                    <span className="font-semibold text-white text-xs block">{itemRow.itemName}</span>
                    <span className="text-slate-400 font-mono text-[11px] block mt-0.5">
                      SKU: {itemRow.itemSku}
                    </span>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                      Target: {itemRow.requestedQuantity} {itemRow.uomSymbol}
                    </span>
                  </td>

                  {itemRow.quotes.map((qCol: any, colIdx: number) => (
                    <td key={colIdx} className="p-4 border-r border-slate-800/80 align-top text-slate-300">
                      <div className="space-y-1 font-mono">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Unit Price:</span>
                          <span className="text-white font-bold">${qCol.unitPrice}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500">Line Total:</span>
                          <span className="text-indigo-400">${qCol.lineTotal?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500">Lead Time:</span>
                          <span>{qCol.deliveryDays} days</span>
                        </div>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Award & Finalize Modal */}
      {selectedQuoteToFinalize && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
              <Award className="w-4 h-4" />
              Award Procurement Bid
            </div>
            <h3 className="text-lg font-bold text-white">
              Award to {selectedQuoteToFinalize.supplierName} ({selectedQuoteToFinalize.quoteNumber})
            </h3>
            <p className="text-xs text-slate-400">
              Finalizing this quotation marks it as <span className="text-emerald-400 font-semibold">SELECTED</span>, automatically dispatches an acceptance notice via <strong className="text-white">Email & Phone SMS</strong> to the supplier, and marks all other competitor proposals as <span className="text-rose-400 font-semibold">REJECTED</span>.
            </p>

            <form onSubmit={handleFinalizeQuote} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">
                  Mandatory Selection Justification / Reason:
                </label>
                <textarea
                  rows={3}
                  value={selectionReason}
                  onChange={(e) => setSelectionReason(e.target.value)}
                  placeholder="e.g. Best overall value proposition with compliant aerospace certifications and shortest delivery lead time."
                  required
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-3 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedQuoteToFinalize(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={finalizing}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/25"
                >
                  {finalizing ? 'Awarding Bid...' : 'Confirm & Award Bid'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
