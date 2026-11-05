import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Calendar,
  DollarSign,
  X,
  AlertCircle,
  FileText,
  User,
  CreditCard,
  ArrowUpRight,
  Printer,
  QrCode,
  Download,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { salesApi, Invoice, SalesOrder } from '../../api/sales.api';
import { Select } from '../../components/ui/Select';
import { downloadElementAsPdf } from '../../utils/pdfExport';
import { Skeleton } from '../../components/ui/Skeleton';

export const InvoicesPage: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInv, setSelectedInv] = useState<Invoice | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Creation State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [eligibleOrders, setEligibleOrders] = useState<SalesOrder[]>([]);

  const [formData, setFormData] = useState({
    salesOrderId: '',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    shippingAmount: 0,
    roundOff: 0,
    notes: '',
    items: [] as any[],
  });

  const [actionLoading, setActionLoading] = useState(false);
  const [showPrintInvModal, setShowPrintInvModal] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, [statusFilter]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const res = await salesApi.getInvoices({
        status: statusFilter || undefined,
        limit: 50,
      });
      setInvoices(res.data || []);
    } catch (err) {
      console.error('Failed to load invoices', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = async () => {
    try {
      setFormData({
        salesOrderId: '',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        shippingAmount: 0,
        roundOff: 0,
        notes: '',
        items: [],
      });
      setShowCreateModal(true);
      const res = await salesApi.getSalesOrders({ limit: 50 });
      // Orders that have items eligible to invoice
      const eligible = (res.data || []).filter((o: SalesOrder) => ['CONFIRMED', 'PARTIALLY_FULFILLED', 'FULFILLED'].includes(o.status));
      setEligibleOrders(eligible);
      if (eligible.length > 0) {
        handleSelectSO(eligible[0]);
      }
    } catch (err) {
      console.error('Failed to load orders for invoicing', err);
    }
  };

  const handleSelectSO = (so: SalesOrder) => {
    const invItems = so.items.map((it) => {
      const remaining = Math.max(0, it.orderedQuantity - (it.invoicedQuantity || 0));
      return {
        itemId: it.itemId?._id || it.itemId,
        description: it.description || it.itemId?.name || 'Item',
        quantity: remaining > 0 ? remaining : it.orderedQuantity,
        uomId: it.uomId?._id || it.uomId,
        unitPrice: it.unitPrice,
        discount: it.discount || 0,
        taxRate: it.taxRate || 0,
      };
    });

    setFormData((prev) => ({
      ...prev,
      salesOrderId: so._id,
      shippingAmount: so.shippingAmount || 0,
      items: invItems,
    }));
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.salesOrderId || formData.items.length === 0) return;
    try {
      setActionLoading(true);
      const payload = {
        salesOrderId: formData.salesOrderId,
        dueDate: formData.dueDate,
        shippingAmount: Number(formData.shippingAmount),
        roundOff: Number(formData.roundOff),
        notes: formData.notes,
        items: formData.items.map((i) => ({
          itemId: i.itemId,
          description: i.description,
          quantity: Number(i.quantity),
          uomId: i.uomId,
          unitPrice: Number(i.unitPrice),
          discount: Number(i.discount || 0),
          taxRate: Number(i.taxRate || 0),
        })),
      };

      await salesApi.createInvoice(payload);
      setShowCreateModal(false);
      await loadInvoices();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to generate invoice');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matches =
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customerId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.salesOrderId?.soNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    return matches;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Receipt className="w-6 h-6 text-cyan-400" />
            <span>Customer Invoices</span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Operational billing, tax calculation &amp; receivables ledger tracking
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-cyan-600/20 transition self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Generate Invoice</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl p-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search Invoice #, SO #, Customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 text-white pl-9 pr-3 py-1.5 text-xs rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {st || 'All Invoices'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${selectedInv ? 'lg:col-span-2' : 'lg:col-span-3'} bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl overflow-hidden shadow-sm`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/50 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Grand Total</th>
                  <th className="py-3 px-4 text-right">Outstanding</th>
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
                      <td className="py-3.5 px-4 text-right"><Skeleton className="h-4 w-20 ml-auto bg-slate-800" /></td>
                      <td className="py-3.5 px-4 text-right"><Skeleton className="h-4 w-20 ml-auto bg-slate-800" /></td>
                      <td className="py-3.5 px-4 text-center"><Skeleton className="h-5 w-20 rounded-full mx-auto bg-slate-800" /></td>
                      <td className="py-3.5 px-4 text-right"><Skeleton className="h-7 w-14 rounded ml-auto bg-slate-800" /></td>
                    </tr>
                  ))
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-500">
                      No invoices found.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr
                      key={inv._id}
                      onClick={() => setSelectedInv(inv)}
                      className={`cursor-pointer transition hover:bg-slate-800/40 ${
                        selectedInv?._id === inv._id ? 'bg-cyan-600/10 border-l-2 border-cyan-500' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-bold text-white">{inv.invoiceNumber}</td>
                      <td className="py-3.5 px-4 text-slate-300 font-medium truncate max-w-[150px]">
                        {inv.customerId?.name || 'Customer'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">{new Date(inv.dueDate).toLocaleDateString()}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-white">${(inv.grandTotal ?? 0).toLocaleString()}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-cyan-400">${(inv.outstandingAmount ?? 0).toLocaleString()}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                          inv.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          inv.status === 'PARTIALLY_PAID' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          inv.status === 'ISSUED' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                          inv.status === 'OVERDUE' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          'bg-slate-700/30 text-slate-400 border-slate-700'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInv(inv);
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
        {selectedInv && (
          <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-5 shadow-lg space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Commercial Invoice</div>
                <h3 className="text-lg font-bold text-white mt-0.5">{selectedInv.invoiceNumber}</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowPrintInvModal(true)}
                  title="Print Official Tax Invoice"
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedInv(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Customer:</span>
                <span className="font-semibold text-white">{selectedInv.customerId?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Linked Sales Order:</span>
                <span className="font-semibold text-indigo-400">{selectedInv.salesOrderId?.soNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Due Date:</span>
                <span className="text-slate-200">{new Date(selectedInv.dueDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-800">
                <span className="text-slate-400">Paid Amount:</span>
                <span className="font-bold text-emerald-400">${(selectedInv.paidAmount ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Outstanding Balance:</span>
                <span className="font-bold text-cyan-400 text-sm">${(selectedInv.outstandingAmount ?? 0).toLocaleString()}</span>
              </div>
            </div>

            {/* Line Items */}
            <div>
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Line Items ({selectedInv.items.length})
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {selectedInv.items.map((it, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-950/40 rounded-lg border border-slate-800/60 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white">{it.description || 'Item'}</div>
                      <div className="text-[10px] text-slate-500">
                        {it.quantity} units &bull; ${it.unitPrice} each &bull; Tax: {it.taxRate}%
                      </div>
                    </div>
                    <span className="font-bold text-white">
                      ${(it.lineTotal != null ? it.lineTotal : (it.quantity * it.unitPrice) || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Collect Payment Link */}
            {selectedInv.outstandingAmount > 0 && selectedInv.status !== 'CANCELLED' && (
              <div className="pt-2 border-t border-slate-800">
                <Link
                  to={`/sales/payments?invoiceId=${selectedInv._id}`}
                  className="w-full py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold shadow transition flex items-center justify-center gap-1.5"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Collect Payment / Record Receipt</span>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-cyan-400" />
                <span>Generate Customer Commercial Invoice</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Select Sales Order *</label>
                <Select
                  value={formData.salesOrderId}
                  onChange={(e) => {
                    const so = eligibleOrders.find((o) => o._id === e.target.value);
                    if (so) handleSelectSO(so);
                  }}
                  placeholder="Select Sales Order..."
                  variant="cyan"
                  searchable
                  options={(Array.isArray(eligibleOrders) ? eligibleOrders : []).map((so) => ({
                    value: so._id,
                    label: `${so.soNumber} • ${so.customerId?.name || 'Customer'}`,
                    sublabel: `Total: $${(so.grandTotal ?? 0).toLocaleString()}`,
                    badge: so.soNumber,
                  }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Invoice Due Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Shipping &amp; Handling ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.shippingAmount}
                    onChange={(e) => setFormData({ ...formData, shippingAmount: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Invoice Notes / Remittance Terms</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Payment due Net 30 days. Remit to..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !formData.salesOrderId || formData.items.length === 0}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold shadow transition-all duration-150 flex items-center justify-center gap-1.5 ${
                    actionLoading || !formData.salesOrderId || formData.items.length === 0
                      ? 'bg-slate-200 text-slate-500 border border-slate-300 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700 cursor-not-allowed shadow-none'
                      : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/20 active:scale-[0.98]'
                  }`}
                >
                  {actionLoading ? 'Generating...' : 'Issue Commercial Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Print Tax Invoice Modal */}
      {showPrintInvModal && selectedInv && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div
            id="printable-tax-invoice"
            className="bg-white text-slate-900 rounded-2xl max-w-3xl w-full p-8 shadow-2xl space-y-6 my-auto print:m-0 print:p-4 print:shadow-none printable-document"
          >
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5">
              <div>
                <div className="text-2xl font-black text-slate-900">StockPilot ERP</div>
                <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Tax &bull; Commercial Invoice
                </div>
                <div className="text-xs text-slate-500 mt-1">100 Logistics Blvd, Industrial Zone, USA</div>
                <div className="text-xs text-slate-500">GST/Tax ID: US-EIN-99281720 &bull; billing@stockpilot.corp</div>
              </div>
              <div className="text-right">
                <span
                  className={`text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider ${
                    selectedInv.status === 'PAID'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : selectedInv.status === 'OVERDUE'
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : 'bg-cyan-100 text-cyan-800 border border-cyan-300'
                  }`}
                >
                  {selectedInv.status}
                </span>
                <div className="text-xl font-bold font-mono text-slate-900 mt-2">{selectedInv.invoiceNumber}</div>
                <div className="text-xs text-slate-500">
                  Issue Date: {new Date(selectedInv.invoiceDate).toLocaleDateString()}
                </div>
                <div className="text-xs font-semibold text-rose-600">
                  Due Date: {new Date(selectedInv.dueDate).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Billing details */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-500 uppercase text-[10px] mb-1">Bill To / Buyer:</div>
                <div className="font-bold text-slate-900 text-sm">{selectedInv.customerId?.name}</div>
                <div className="text-slate-600">{selectedInv.customerId?.email}</div>
                <div className="text-slate-600">{selectedInv.customerId?.phone}</div>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-500 uppercase text-[10px] mb-1">Order References:</div>
                <div className="text-slate-700">
                  Sales Order: <span className="font-bold">{selectedInv.salesOrderId?.soNumber}</span>
                </div>
                <div className="text-slate-700">
                  Currency: <span className="font-bold">{selectedInv.currency}</span>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">Item Description</th>
                  <th className="p-2.5 text-center">Qty</th>
                  <th className="p-2.5 text-right">Unit Price</th>
                  <th className="p-2.5 text-center">Tax %</th>
                  <th className="p-2.5 text-right">Tax ($)</th>
                  <th className="p-2.5 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(Array.isArray(selectedInv.items) ? selectedInv.items : []).map((it, idx) => (
                  <tr key={idx}>
                    <td className="p-2.5 text-slate-500">{idx + 1}</td>
                    <td className="p-2.5 font-medium text-slate-900">{it.description || 'Item'}</td>
                    <td className="p-2.5 text-center font-semibold text-slate-800">{it.quantity ?? 0}</td>
                    <td className="p-2.5 text-right">${Number(it.unitPrice || 0).toFixed(2)}</td>
                    <td className="p-2.5 text-center text-slate-600">{it.taxRate ?? 0}%</td>
                    <td className="p-2.5 text-right text-slate-600">${Number(it.taxAmount || 0).toFixed(2)}</td>
                    <td className="p-2.5 text-right font-bold text-slate-900">${Number(it.lineTotal || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Financial Summary & Remittance */}
            <div className="grid grid-cols-2 gap-6 pt-2">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="font-bold text-slate-700 text-[11px] flex items-center justify-between">
                  <span>Electronic Remittance Details</span>
                  <QrCode className="w-6 h-6 text-slate-800" />
                </div>
                <div className="text-[11px] text-slate-600 space-y-0.5">
                  <div>Bank: Industrial Commerce Bank NY</div>
                  <div>Account: 0984-2231-9981-4432</div>
                  <div>Routing / SWIFT: ICBNUS33XXX</div>
                  <div className="text-[10px] text-slate-500 mt-1 italic">{selectedInv.notes}</div>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>${Number(selectedInv.subtotal || 0).toFixed(2)}</span>
                </div>
                {Number(selectedInv.discountAmount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount:</span>
                    <span>-${Number(selectedInv.discountAmount || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Total Tax / VAT:</span>
                  <span>+${Number(selectedInv.taxAmount || 0).toFixed(2)}</span>
                </div>
                {Number(selectedInv.shippingAmount || 0) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Shipping &amp; Handling:</span>
                    <span>+${Number(selectedInv.shippingAmount || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-900 font-extrabold text-sm border-t border-slate-300 pt-1">
                  <span>Grand Total:</span>
                  <span>${Number(selectedInv.grandTotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Paid to Date:</span>
                  <span>-${Number(selectedInv.paidAmount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-rose-600 font-bold text-sm border-t border-slate-200 pt-1">
                  <span>Balance Due:</span>
                  <span>${Number(selectedInv.outstandingAmount || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Authorized Signature */}
            <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-200 text-xs">
              <div>
                <div className="h-8 border-b border-slate-300 w-44"></div>
                <div className="mt-1 font-semibold text-slate-700">Financial Controller Signature</div>
              </div>
              <div className="text-right text-[11px] text-slate-500 self-end">
                This is a computer-generated tax invoice verified under StockPilot ERP.
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 print:hidden">
              <button
                onClick={() => setShowPrintInvModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setDownloadingPdf(true);
                    await downloadElementAsPdf('printable-tax-invoice', `${selectedInv.invoiceNumber}_Tax_Invoice.pdf`);
                  } finally {
                    setDownloadingPdf(false);
                  }
                }}
                disabled={downloadingPdf}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-2 transition"
              >
                <Download className="w-4 h-4" />
                <span>{downloadingPdf ? 'Exporting PDF...' : 'Download PDF'}</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-2 transition"
              >
                <Printer className="w-4 h-4" />
                <span>Print Tax Invoice</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
