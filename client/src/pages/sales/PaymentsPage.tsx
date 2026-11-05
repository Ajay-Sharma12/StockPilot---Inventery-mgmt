import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Calendar,
  X,
  AlertCircle,
  RotateCcw,
  CreditCard,
  Building,
  User,
  ArrowDownLeft,
  Receipt,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { salesApi, Payment, Invoice, ReceivablesSummary } from '../../api/sales.api';
import { Select } from '../../components/ui/Select';
import { useToast } from '../../context/ToastContext';
import { Skeleton } from '../../components/ui/Skeleton';

export const PaymentsPage: React.FC = () => {
  const { success: toastSuccess, error: toastError } = useToast();
  const [searchParams] = useSearchParams();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [receivables, setReceivables] = useState<ReceivablesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  // Record Payment Modal
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    invoiceId: '',
    amount: 0,
    paymentMethod: 'BANK_TRANSFER' as any,
    paymentReference: '',
    notes: '',
  });

  // Reversal Modal
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [reversalReason, setReversalReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [paysRes, recRes, invsRes] = await Promise.all([
        salesApi.getPayments({ limit: 50 }),
        salesApi.getReceivablesSummary(),
        salesApi.getInvoices({ limit: 50 }),
      ]);
      setPayments(paysRes.data || []);
      setReceivables(recRes);
      
      const unpaidInvs = (invsRes.data || []).filter((i: Invoice) => i.outstandingAmount > 0 && i.status !== 'CANCELLED');
      setInvoices(unpaidInvs);

      // Check URL query for ?invoiceId=
      const urlInvoiceId = searchParams.get('invoiceId');
      if (urlInvoiceId) {
        const found = (invsRes.data || []).find((i: Invoice) => i._id === urlInvoiceId);
        if (found) {
          setShowRecordModal(true);
          handleSelectInvoice(found);
        }
      }
    } catch (err) {
      console.error('Failed to load payments data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectInvoice = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setModalError(null);
    setFormData((prev) => ({
      ...prev,
      invoiceId: inv._id,
      amount: inv.outstandingAmount > 0 ? inv.outstandingAmount : 0,
    }));
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!formData.invoiceId) {
      setModalError('Please select an open commercial invoice.');
      return;
    }

    const remaining = selectedInvoice?.outstandingAmount ?? 0;
    if (selectedInvoice && remaining <= 0) {
      setModalError('This invoice is already fully settled ($0 remaining balance). No additional collection can be recorded.');
      return;
    }

    if (formData.amount <= 0) {
      setModalError('Payment amount must be greater than $0.00.');
      return;
    }

    if (selectedInvoice && formData.amount > remaining) {
      setModalError(`Payment amount cannot exceed the remaining balance ($${remaining.toLocaleString()}).`);
      return;
    }

    try {
      setActionLoading(true);
      await salesApi.recordPayment(formData);
      toastSuccess(`Payment of $${Number(formData.amount).toLocaleString()} recorded successfully!`);
      setShowRecordModal(false);
      setSelectedInvoice(null);
      setFormData({
        invoiceId: '',
        amount: 0,
        paymentMethod: 'BANK_TRANSFER',
        paymentReference: '',
        notes: '',
      });
      await loadData();
    } catch (err: any) {
      const errMsg = err.response?.data?.message || 'Failed to record payment';
      setModalError(errMsg);
      toastError(errMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReversePayment = async () => {
    if (!selectedPayment || !reversalReason.trim()) return;
    try {
      setActionLoading(true);
      await salesApi.reversePayment(selectedPayment._id, reversalReason.trim());
      toastSuccess(`Receipt ${selectedPayment.paymentNumber} reversed successfully. Outstanding balance restored.`);
      setShowReverseModal(false);
      setReversalReason('');
      await loadData();
      const updated = await salesApi.getPaymentById(selectedPayment._id);
      setSelectedPayment(updated);
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to reverse payment');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredPayments = payments.filter((p) => {
    const matches =
      p.paymentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.paymentReference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.customerId?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matches;
  });

  const remainingDue = selectedInvoice ? (selectedInvoice.outstandingAmount ?? 0) : 0;
  const isZeroDue = Boolean(selectedInvoice && remainingDue <= 0);
  const isOverdueAmount = Boolean(selectedInvoice && formData.amount > remainingDue);
  const isInvalidAmount = formData.amount <= 0;

  let amountError = '';
  if (selectedInvoice) {
    if (isZeroDue) {
      amountError = 'Invoice is already settled in full ($0 remaining balance).';
    } else if (isOverdueAmount) {
      amountError = `Amount cannot exceed remaining balance of $${remainingDue.toLocaleString()}`;
    } else if (formData.amount < 0) {
      amountError = 'Payment amount cannot be negative.';
    } else if (isInvalidAmount && formData.amount === 0) {
      amountError = 'Please enter an amount greater than $0.00';
    }
  } else if (formData.amount < 0) {
    amountError = 'Payment amount cannot be negative.';
  }

  const isSubmitDisabled =
    actionLoading ||
    !formData.invoiceId ||
    isZeroDue ||
    isOverdueAmount ||
    isInvalidAmount ||
    Boolean(amountError);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <DollarSign className="w-6 h-6 text-teal-400" />
            <span>Payments &amp; Collections</span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Customer collections, anti-overpayment enforcement &amp; ledger settlement
          </p>
        </div>

        <button
          onClick={() => setShowRecordModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-teal-600/20 transition self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Record Collection</span>
        </button>
      </div>

      {/* Receivables Summary Banner */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl p-4 space-y-2">
              <Skeleton className="h-3.5 w-36 bg-slate-800/80" />
              <Skeleton className="h-7 w-28 bg-slate-800" />
              <Skeleton className="h-3 w-44 bg-slate-800/50" />
            </div>
          ))}
        </div>
      ) : receivables ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Receivables Outstanding</div>
            <div className="text-2xl font-bold text-white mt-1">
              ${(receivables?.totalOutstanding ?? 0).toLocaleString()}
            </div>
            <div className="text-xs text-teal-400 mt-0.5">Across all active commercial invoices</div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Overdue Balance</div>
            <div className={`text-2xl font-bold mt-1 ${(receivables?.totalOverdue || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              ${(receivables?.totalOverdue ?? 0).toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Past contractual payment terms</div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Active Debtor Accounts</div>
            <div className="text-2xl font-bold text-indigo-400 mt-1">
              {receivables?.customers?.length || 0}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Customers with open balances</div>
          </div>
        </div>
      ) : null}

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl p-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search Payment #, Reference, Customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 text-white pl-9 pr-3 py-1.5 text-xs rounded-lg focus:ring-2 focus:ring-teal-500 outline-none placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${selectedPayment ? 'lg:col-span-2' : 'lg:col-span-3'} bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl overflow-hidden shadow-sm`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/50 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="hover:bg-slate-800/20">
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-24 bg-slate-800" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-32 bg-slate-800" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-20 bg-slate-800" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-24 bg-slate-800" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-20 bg-slate-800" /></td>
                      <td className="py-3.5 px-4 text-right"><Skeleton className="h-4 w-16 ml-auto bg-slate-800" /></td>
                      <td className="py-3.5 px-4 text-center"><Skeleton className="h-5 w-20 rounded-full mx-auto bg-slate-800" /></td>
                      <td className="py-3.5 px-4 text-right"><Skeleton className="h-7 w-14 rounded ml-auto bg-slate-800" /></td>
                    </tr>
                  ))
                ) : filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-slate-500">
                      No payment records found.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p) => (
                    <tr
                      key={p._id}
                      onClick={() => setSelectedPayment(p)}
                      className={`cursor-pointer transition hover:bg-slate-800/40 ${
                        selectedPayment?._id === p._id ? 'bg-teal-600/10 border-l-2 border-teal-500' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-bold text-white">{p.paymentNumber}</td>
                      <td className="py-3.5 px-4 text-slate-300 font-medium truncate max-w-[150px]">
                        {p.customerId?.name || 'Customer'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">{new Date(p.paymentDate).toLocaleDateString()}</td>
                      <td className="py-3.5 px-4 text-slate-300 font-mono text-[11px]">{p.paymentMethod}</td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">{p.paymentReference || '-'}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-400">
                        ${p.amount.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                          p.status === 'RECORDED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPayment(p);
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Details */}
        {selectedPayment && (
          <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-5 shadow-lg space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Payment Receipt</div>
                <h3 className="text-lg font-bold text-white mt-0.5">{selectedPayment.paymentNumber}</h3>
              </div>
              <button
                onClick={() => setSelectedPayment(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Customer:</span>
                <span className="font-semibold text-white">{selectedPayment.customerId?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Linked Invoice:</span>
                <span className="font-semibold text-cyan-400">{selectedPayment.invoiceId?.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment Date:</span>
                <span className="text-slate-200">{new Date(selectedPayment.paymentDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Method:</span>
                <span className="text-slate-200 font-mono">{selectedPayment.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Reference / Check #:</span>
                <span className="text-slate-200 font-mono">{selectedPayment.paymentReference || '-'}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-800">
                <span className="text-slate-400 font-bold">Collected Amount:</span>
                <span className="font-bold text-emerald-400 text-sm">${selectedPayment.amount.toLocaleString()}</span>
              </div>
            </div>

            {selectedPayment.status === 'REVERSED' && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs space-y-1">
                <div className="font-bold text-rose-400">Payment Reversed</div>
                <div className="text-slate-400 text-[11px]">{selectedPayment.reversalReason}</div>
              </div>
            )}

            {/* Reversal Action */}
            {selectedPayment.status === 'RECORDED' && (
              <div className="pt-2 border-t border-slate-800">
                <button
                  onClick={() => setShowReverseModal(true)}
                  disabled={actionLoading}
                  className="w-full py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-600/40 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reverse Collection &amp; Restore Balance</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {showRecordModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-teal-400" />
                <span>Record Customer Collection</span>
              </h3>
              <button onClick={() => setShowRecordModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} noValidate className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Select Open Commercial Invoice *</label>
                <Select
                  value={formData.invoiceId}
                  onChange={(e) => {
                    const inv = (invoices || []).find((i) => i._id === e.target.value);
                    if (inv) handleSelectInvoice(inv);
                  }}
                  placeholder="Select Unpaid Invoice..."
                  variant="teal"
                  searchable
                  options={(Array.isArray(invoices) ? invoices : []).map((inv) => ({
                    value: inv._id,
                    label: `${inv.invoiceNumber} • ${inv.customerId?.name || 'Customer'}`,
                    sublabel: inv.outstandingAmount <= 0 ? 'Fully Paid ($0 Due)' : `Due: $${((inv.outstandingAmount ?? 0)).toLocaleString()}`,
                    badge: inv.invoiceNumber,
                  }))}
                />
              </div>

              {selectedInvoice && (
                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-[11px] space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Customer:</span>
                    <span className="font-semibold text-white">{selectedInvoice.customerId?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Invoiced:</span>
                    <span className="text-white">${(selectedInvoice.grandTotal ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-400">Remaining Outstanding:</span>
                    <span className={isZeroDue ? 'text-emerald-400 font-extrabold' : 'text-teal-400'}>
                      ${remainingDue.toLocaleString()} {isZeroDue ? '(PAID IN FULL)' : ''}
                    </span>
                  </div>

                  {isZeroDue && (
                    <div className="flex items-center gap-2 pt-1.5 border-t border-slate-800/80 text-amber-400 text-[11px]">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>This commercial invoice has already been fully paid ($0 remaining).</span>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Payment Amount ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    disabled={isZeroDue}
                    value={formData.amount === 0 && !selectedInvoice ? '' : formData.amount}
                    onChange={(e) => {
                      setModalError(null);
                      setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 });
                    }}
                    className={`w-full bg-slate-800 border rounded-lg px-3 py-2 text-white outline-none font-bold text-right transition-colors ${
                      amountError
                        ? 'border-rose-500/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                        : 'border-slate-700 focus:border-teal-500'
                    } ${isZeroDue ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                  {/* Inline Error Message right below input */}
                  {amountError ? (
                    <div className="flex items-center gap-1.5 text-rose-400 text-[11px] mt-1.5 font-medium animate-fadeIn">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                      <span>{amountError}</span>
                    </div>
                  ) : selectedInvoice && remainingDue > 0 ? (
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Max allowed: ${remainingDue.toLocaleString()}
                    </span>
                  ) : null}
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Payment Method *</label>
                  <Select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
                    variant="teal"
                    options={[
                      { value: 'BANK_TRANSFER', label: 'Bank Wire / ACH', badge: 'ACH' },
                      { value: 'ONLINE_PAYMENT', label: 'Credit / Debit Card', badge: 'CARD' },
                      { value: 'CASH', label: 'Cash Deposit', badge: 'CASH' },
                      { value: 'OTHER', label: 'Corporate Check / Other', badge: 'CHECK' },
                    ]}
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Reference / Wire Confirmation #</label>
                <input
                  type="text"
                  value={formData.paymentReference}
                  onChange={(e) => setFormData({ ...formData, paymentReference: e.target.value })}
                  placeholder="e.g. WIRE-VTX-099418 or CHK-4421"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none font-mono"
                />
              </div>

              {/* Modal-level server error banner if any */}
              {modalError && (
                <div className="flex items-start gap-2 p-2.5 bg-rose-950/50 border border-rose-800/60 rounded-lg text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitDisabled}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold shadow transition-all duration-150 flex items-center justify-center gap-1.5 ${
                    isSubmitDisabled
                      ? 'bg-slate-200 text-slate-500 border border-slate-300 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700 cursor-not-allowed shadow-none'
                      : 'bg-teal-600 hover:bg-teal-500 text-white shadow-teal-600/20 active:scale-[0.98]'
                  }`}
                >
                  {actionLoading ? 'Recording...' : 'Record Collection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reverse Modal */}
      {showReverseModal && selectedPayment && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-rose-400" />
              <span>Reverse Collection Entry</span>
            </h3>
            <p className="text-xs text-slate-300">
              Reversing receipt <strong className="text-white">{selectedPayment.paymentNumber}</strong> (${selectedPayment.amount.toLocaleString()}) will restore the customer invoice outstanding balance immediately.
            </p>
            <textarea
              rows={3}
              required
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white text-xs outline-none focus:ring-2 focus:ring-rose-500"
              placeholder="e.g. Bank chargeback, clerical misposting, check bounced..."
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowReverseModal(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleReversePayment}
                disabled={actionLoading || !reversalReason.trim()}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded text-xs font-semibold"
              >
                {actionLoading ? 'Reversing...' : 'Confirm Reversal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
