import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  Printer,
  Calendar,
  Building2,
  Mail,
  Phone,
  ShieldCheck,
  Clock,
  Sparkles,
  ArrowRight,
  FileCheck,
  AlertTriangle,
  Download,
} from 'lucide-react';
import { salesApi } from '../../api/sales.api';
import { downloadElementAsPdf } from '../../utils/pdfExport';
import { Skeleton } from '../../components/ui/Skeleton';

export const PublicQuotationReviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || undefined;

  const [quotation, setQuotation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Interaction State
  const [actionLoading, setActionLoading] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [clientFeedback, setClientFeedback] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    if (id) {
      loadQuotation();
    }
  }, [id, token]);

  const loadQuotation = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await salesApi.getPublicQuotation(id!, token);
      setQuotation(data);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'Unable to load proposal. The link may be invalid or expired.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    try {
      setActionLoading(true);
      const updated = await salesApi.publicAcceptQuotation(id!, token, clientFeedback);
      setQuotation(updated);
      setShowAcceptModal(false);
      setActionSuccessMessage(
        'Thank you! You have successfully approved this quotation proposal. Our sales operations team has been notified and will process your order shortly.'
      );
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to approve quotation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    try {
      setActionLoading(true);
      const updated = await salesApi.publicRejectQuotation(id!, token, rejectReason);
      setQuotation(updated);
      setShowRejectModal(false);
      setActionSuccessMessage(
        'Your feedback has been recorded. Our representative will contact you with updated terms.'
      );
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to submit decline response');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 md:p-8 flex justify-center">
        <div className="max-w-4xl w-full space-y-6 animate-pulse">
          {/* Header Action Bar Skeleton */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl bg-slate-800" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-36 bg-slate-800" />
                <Skeleton className="h-3 w-48 bg-slate-800/60" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-24 rounded-lg bg-slate-800" />
              <Skeleton className="h-9 w-28 rounded-lg bg-slate-800" />
            </div>
          </div>

          {/* Proposal Document Card Skeleton */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between gap-4 pb-6 border-b border-slate-800">
              <div className="space-y-2">
                <Skeleton className="h-7 w-48 bg-slate-800" />
                <Skeleton className="h-4 w-32 bg-slate-800/60" />
              </div>
              <div className="space-y-2 text-right">
                <Skeleton className="h-5 w-28 rounded-full ml-auto bg-slate-800" />
                <Skeleton className="h-4 w-36 ml-auto bg-slate-800/60" />
              </div>
            </div>

            {/* Counterparty Cards Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <Skeleton className="h-3.5 w-24 bg-slate-800" />
                <Skeleton className="h-5 w-40 bg-slate-800" />
                <Skeleton className="h-3.5 w-52 bg-slate-800/60" />
              </div>
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <Skeleton className="h-3.5 w-24 bg-slate-800" />
                <Skeleton className="h-5 w-40 bg-slate-800" />
                <Skeleton className="h-3.5 w-52 bg-slate-800/60" />
              </div>
            </div>

            {/* Items Table Skeleton */}
            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex justify-between">
                <Skeleton className="h-3.5 w-32 bg-slate-800" />
                <Skeleton className="h-3.5 w-20 bg-slate-800" />
              </div>
              <div className="divide-y divide-slate-800/60">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-3.5 flex items-center justify-between">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-44 bg-slate-800" />
                      <Skeleton className="h-3 w-28 bg-slate-800/60" />
                    </div>
                    <Skeleton className="h-4 w-20 bg-slate-800" />
                  </div>
                ))}
              </div>
            </div>

            {/* Total Block Skeleton */}
            <div className="flex justify-end pt-2">
              <div className="w-64 space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-3.5 w-20 bg-slate-800/60" />
                  <Skeleton className="h-3.5 w-16 bg-slate-800" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-3.5 w-16 bg-slate-800/60" />
                  <Skeleton className="h-3.5 w-14 bg-slate-800" />
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-800">
                  <Skeleton className="h-5 w-24 bg-slate-800" />
                  <Skeleton className="h-6 w-24 bg-slate-800" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto text-rose-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Proposal Not Accessible</h2>
          <p className="text-slate-400 text-sm leading-relaxed">{error || 'Quotation not found'}</p>
          <div className="pt-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition"
            >
              Retry Loading
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currency = quotation.currency || 'USD';
  const sym = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : `${currency} `;
  const isAccepted = quotation.status === 'ACCEPTED' || quotation.status === 'CONVERTED';
  const isRejected = quotation.status === 'REJECTED';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 print:p-0 print:bg-white">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Floating Notification if just accepted */}
        {actionSuccessMessage && (
          <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-2xl p-5 flex items-start gap-4 shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Proposal Officially Approved</h3>
              <p className="text-xs text-emerald-200/90 leading-relaxed">{actionSuccessMessage}</p>
            </div>
          </div>
        )}

        {/* Main Document Card */}
        <div
          id="printable-public-quote"
          className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden print:border-none print:shadow-none print:bg-white printable-document"
        >
          {/* Header Banner */}
          <div className="border-b border-slate-800 bg-slate-900/50 p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:border-slate-300">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black text-white tracking-tight print:text-slate-900">
                  {quotation.tenantId?.name || 'StockPilot ERP'}
                </span>
                <span className="px-2.5 py-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-full text-[11px] font-bold uppercase tracking-wider">
                  Official Proposal
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 print:text-slate-600">
                Sales &amp; Order-to-Cash Quotation Slip
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap print:hidden">
              <button
                type="button"
                onClick={async () => {
                  try {
                    setDownloadingPdf(true);
                    await downloadElementAsPdf('printable-public-quote', `${quotation.quotationNumber}_Official_Proposal.pdf`);
                  } finally {
                    setDownloadingPdf(false);
                  }
                }}
                disabled={downloadingPdf}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600/90 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow transition disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{downloadingPdf ? 'Exporting PDF...' : 'Download PDF'}</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition"
              >
                <Printer className="w-4 h-4 text-sky-400" />
                <span>Print Proposal</span>
              </button>

              {/* Status Badge */}
              {isAccepted && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approved &amp; Confirmed</span>
                </span>
              )}
              {isRejected && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/15 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-bold">
                  <XCircle className="w-4 h-4" />
                  <span>Proposal Declined</span>
                </span>
              )}
              {!isAccepted && !isRejected && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-xl text-xs font-bold">
                  <Clock className="w-4 h-4" />
                  <span>Pending Your Review</span>
                </span>
              )}
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-8">
            {/* Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
              {/* Buyer Information */}
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 space-y-2 print:border-slate-300 print:bg-slate-50">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block print:text-slate-600">
                  Prepared For / Buyer
                </span>
                <p className="text-base font-bold text-white print:text-slate-900">
                  {quotation.customerId?.name || 'Valued Customer'}
                </p>
                {quotation.customerId?.email && (
                  <p className="text-slate-400 flex items-center gap-1.5 print:text-slate-600">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span>{quotation.customerId.email}</span>
                  </p>
                )}
                {quotation.customerId?.phone && (
                  <p className="text-slate-400 flex items-center gap-1.5 print:text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span>{quotation.customerId.phone}</span>
                  </p>
                )}
              </div>

              {/* Quotation Specs */}
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 space-y-2 print:border-slate-300 print:bg-slate-50">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block print:text-slate-600">
                  Quotation Details
                </span>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 print:text-slate-600">Quotation Ref:</span>
                  <span className="font-mono font-bold text-sky-400 text-sm print:text-slate-900">
                    #{quotation.quotationNumber}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 print:text-slate-600">Issued On:</span>
                  <span className="font-medium text-slate-200 print:text-slate-800">
                    {new Date(quotation.quotationDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 print:text-slate-600">Valid Until:</span>
                  <span className="font-bold text-rose-400">
                    {new Date(quotation.validUntil).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <h3 className="text-sm font-bold text-white mb-3 uppercase tracking-wider print:text-slate-900">
                Line Items
              </h3>
              <div className="border border-slate-800 rounded-xl overflow-x-auto print:border-slate-300">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/60 text-slate-300 font-bold uppercase text-[10px] print:bg-slate-100 print:text-slate-700">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Item Description</th>
                      <th className="p-3 text-center">Qty</th>
                      <th className="p-3 text-right">Unit Price</th>
                      <th className="p-3 text-center">Disc %</th>
                      <th className="p-3 text-center">Tax %</th>
                      <th className="p-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300 print:divide-slate-300 print:text-slate-800">
                    {quotation.items?.map((it: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-800/30 print:hover:bg-transparent">
                        <td className="p-3 text-slate-500">{idx + 1}</td>
                        <td className="p-3">
                          <div className="font-semibold text-white print:text-slate-900">
                            {it.itemId?.name || it.description || 'Quoted Item'}
                          </div>
                          {it.itemId?.sku && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              SKU: {it.itemId.sku}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-100 print:text-slate-900">
                          {it.quantity} {it.uomId?.symbol || it.uomId?.code || 'pcs'}
                        </td>
                        <td className="p-3 text-right font-medium">
                          {sym}{Number(it.unitPrice).toLocaleString()}
                        </td>
                        <td className="p-3 text-center text-slate-400">
                          {it.discount ? `${it.discount}%` : '-'}
                        </td>
                        <td className="p-3 text-center text-slate-400">
                          {it.taxRate ? `${it.taxRate}%` : '-'}
                        </td>
                        <td className="p-3 text-right font-bold text-white print:text-slate-900">
                          {sym}{Number(it.lineTotal).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="flex justify-end">
              <div className="w-full sm:max-w-xs space-y-2 text-xs">
                <div className="flex justify-between text-slate-400 print:text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-slate-200 print:text-slate-900">
                    {sym}{Number(quotation.subtotal).toLocaleString()}
                  </span>
                </div>
                {quotation.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-400 font-medium">
                    <span>Discount:</span>
                    <span>-{sym}{Number(quotation.discountAmount).toLocaleString()}</span>
                  </div>
                )}
                {quotation.taxAmount > 0 && (
                  <div className="flex justify-between text-slate-400 print:text-slate-600">
                    <span>Estimated Taxes:</span>
                    <span>+{sym}{Number(quotation.taxAmount).toLocaleString()}</span>
                  </div>
                )}
                {quotation.shippingAmount > 0 && (
                  <div className="flex justify-between text-slate-400 print:text-slate-600">
                    <span>Shipping:</span>
                    <span>+{sym}{Number(quotation.shippingAmount).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-black text-white pt-3 border-t border-slate-800 print:border-slate-300 print:text-slate-900">
                  <span>Grand Total:</span>
                  <span className="text-sky-400 print:text-indigo-600">
                    {sym}{Number(quotation.grandTotal).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Commercial Terms & Notes */}
            {(quotation.termsAndConditions || quotation.notes) && (
              <div className="space-y-4 pt-4 border-t border-slate-800 text-xs print:border-slate-300">
                {quotation.termsAndConditions && (
                  <div className="bg-slate-800/30 border border-slate-800 rounded-xl p-4 print:bg-slate-50 print:border-slate-300">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Commercial Terms &amp; Conditions
                    </span>
                    <p className="text-slate-300 leading-relaxed print:text-slate-700">
                      {quotation.termsAndConditions}
                    </p>
                  </div>
                )}
                {quotation.notes && (
                  <div className="bg-slate-800/30 border border-slate-800 rounded-xl p-4 print:bg-slate-50 print:border-slate-300">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Special Notes
                    </span>
                    <p className="text-slate-300 leading-relaxed print:text-slate-700">{quotation.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* INTERACTIVE CUSTOMER ACTION BAR */}
            {!isAccepted && !isRejected && (
              <div className="bg-gradient-to-r from-slate-900 via-sky-950/40 to-slate-900 border-2 border-sky-500/30 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-xl print:hidden">
                <div className="max-w-md mx-auto space-y-2">
                  <h3 className="text-lg font-bold text-white flex items-center justify-center gap-2">
                    <Sparkles className="w-5 h-5 text-sky-400" />
                    <span>Approve Proposal Online</span>
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    By accepting, you confirm your acceptance of the line items and terms above. Our team will immediately initiate order fulfillment.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAcceptModal(true)}
                    disabled={actionLoading}
                    className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Accept &amp; Approve Quotation</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowRejectModal(true)}
                    disabled={actionLoading}
                    className="w-full sm:w-auto px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/20 rounded-xl text-xs font-semibold transition"
                  >
                    <span>Request Changes / Decline</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-500 print:hidden">
          StockPilot Digital Procurement &amp; Order-to-Cash &bull; Secured with SHA-256 Token
        </div>
      </div>

      {/* ACCEPT MODAL */}
      {showAcceptModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Confirm Proposal Acceptance</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Please enter any purchase order notes or delivery instructions (optional):
            </p>
            <textarea
              rows={3}
              value={clientFeedback}
              onChange={(e) => setClientFeedback(e.target.value)}
              placeholder="e.g. Approved. Please deliver to Warehouse Dock 4 next week."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white outline-none focus:border-emerald-500 transition"
            />
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowAcceptModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAccept}
                disabled={actionLoading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition"
              >
                {actionLoading ? 'Processing...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DECLINE MODAL */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-400" />
              <span>Request Revisions / Decline</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Please let our team know the reason or requested changes:
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Please provide a 5% higher discount or change delivery date."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white outline-none focus:border-rose-500 transition"
            />
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={actionLoading}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md transition"
              >
                {actionLoading ? 'Submitting...' : 'Submit Decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
