import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Plus,
  Search,
  CheckCircle2,
  Calendar,
  Building2,
  DollarSign,
  X,
  ArrowLeftRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { procurementApi, SupplierQuote, RFQ } from '../../api/procurement.api';
import { masterDataApi, Supplier } from '../../api/masterData.api';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../context/ToastContext';
import { Select } from '../../components/ui/Select';

export const SupplierQuotesPage: React.FC = () => {
  const { can } = usePermissions();
  const { success, error: toastError } = useToast();

  const [quotes, setQuotes] = useState<SupplierQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Recording Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [rfqs, setRFQs] = useState<RFQ[]>([]);
  const [selectedRFQ, setSelectedRFQ] = useState<RFQ | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [formData, setFormData] = useState({
    rfqId: '',
    supplierId: '',
    validityDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    shippingTerms: 'FOB Facility Dock',
    currency: 'USD',
    discount: 0,
    tax: 0,
    items: [] as { itemId: string; quantity: number; uomId: string; unitPrice: number; discount: number; tax: number; deliveryDays: number }[],
  });

  useEffect(() => {
    loadQuotes();
  }, [statusFilter]);

  const loadQuotes = async () => {
    try {
      setLoading(true);
      const res = await procurementApi.getQuotes({
        status: statusFilter || undefined,
        search: searchTerm || undefined,
      });
      setQuotes(res.data || []);
    } catch (err) {
      console.error('Failed to load supplier quotes', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPrerequisites = async () => {
    try {
      const [rfqsRes, suppsRes] = await Promise.all([
        procurementApi.getRFQs({ limit: 200 }),   // all non-cancelled RFQs
        masterDataApi.getSuppliers({ limit: 200, status: 'active' }),
      ]);
      // getRFQs returns { data: [], total: N } shape
      const rfqList = Array.isArray(rfqsRes.data) ? rfqsRes.data : (Array.isArray(rfqsRes) ? rfqsRes : []);
      // filter out cancelled on client side
      setRFQs(rfqList.filter((r: RFQ) => r.status !== 'CANCELLED' && r.status !== 'CLOSED'));
      // getSuppliers returns { data: [], total: N }
      const supplierList = Array.isArray(suppsRes.data) ? suppsRes.data : (Array.isArray(suppsRes) ? suppsRes : []);
      setSuppliers(supplierList);
    } catch (err) {
      console.error('Failed to load prerequisites', err);
    }
  };

  const openCreateModal = () => {
    loadPrerequisites();
    setShowCreateModal(true);
  };

  const handleRFQSelection = (rfqId: string) => {
    const rfq = rfqs.find((r) => r._id === rfqId);
    setSelectedRFQ(rfq || null);
    if (rfq) {
      const mappedItems = rfq.items.map((it) => ({
        itemId: typeof it.itemId === 'object' ? it.itemId._id : it.itemId,
        quantity: it.quantity,
        uomId: typeof it.uomId === 'object' ? it.uomId._id : it.uomId,
        unitPrice: 0,
        discount: 0,
        tax: 0,
        deliveryDays: 7,
      }));
      setFormData((prev) => ({
        ...prev,
        rfqId,
        items: mappedItems,
      }));
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await procurementApi.createQuote(formData);
      setShowCreateModal(false);
      success(`Quote ${res.quoteNumber || ''} recorded successfully`);
      loadQuotes();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to record supplier quote');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Sliders className="w-6 h-6 text-blue-400" />
            Supplier Quotations
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Record supplier proposals, pricing bids, delivery schedules, and discount terms.
          </p>
        </div>

        {can('purchase:create') && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition shadow-lg shadow-blue-600/25"
          >
            <Plus className="w-4 h-4" />
            Record Supplier Bid
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 rounded-xl p-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Quote #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadQuotes()}
              className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl pl-9 pr-3 py-2 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={loadQuotes}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 font-medium"
          >
            Filter
          </button>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
          {['', 'RECEIVED', 'SELECTED', 'REJECTED', 'EXPIRED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {st === '' ? 'All Quotes' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Quotes Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-sm">Loading quotations...</div>
        ) : quotes.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            No supplier quotes found. Record bids received against issued RFQs.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Quote Number</th>
                  <th className="py-3.5 px-4">RFQ Ref</th>
                  <th className="py-3.5 px-4">Supplier</th>
                  <th className="py-3.5 px-4">Validity Date</th>
                  <th className="py-3.5 px-4">Total Amount</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {quotes.map((q) => (
                  <tr key={q._id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-xs text-blue-400">
                      {q.quoteNumber}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-purple-400 font-mono">
                      {q.rfqId?.rfqNumber || 'RFQ'}
                    </td>
                    <td className="py-3.5 px-4 text-white font-medium">
                      {q.supplierId?.name || 'Supplier'}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400 font-mono">
                      {new Date(q.validityDate).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-sm font-semibold text-white">
                      ${q.total?.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          q.status === 'SELECTED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : q.status === 'REJECTED'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}
                      >
                        {q.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {q.rfqId && (
                        <Link
                          to={`/purchase/quotes/compare/${typeof q.rfqId === 'object' ? q.rfqId._id : q.rfqId}`}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 text-xs font-medium border border-slate-700 inline-flex items-center gap-1"
                        >
                          <ArrowLeftRight className="w-3 h-3" />
                          Compare
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Quote Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-blue-400" />
                Record Supplier Quotation
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  label="Select RFQ"
                  value={formData.rfqId}
                  onChange={(e) => handleRFQSelection(e.target.value)}
                  placeholder="Select an Issued RFQ..."
                  variant="indigo"
                  options={rfqs.map((r) => ({
                    value: r._id,
                    label: `${r.rfqNumber} (${r.suppliers?.length} vendors)`,
                    badge: r.rfqNumber,
                  }))}
                />

                <Select
                  label="Select Bidding Supplier"
                  value={formData.supplierId}
                  onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                  placeholder="Select Supplier..."
                  variant="indigo"
                  options={suppliers.map((s) => ({
                    value: s._id,
                    label: s.name,
                    badge: s.supplierCode || (s as any).code || undefined,
                  }))}
                />

                <div>
                  <label className="block text-slate-400 mb-1">Bid Validity Date</label>
                  <input
                    type="date"
                    value={formData.validityDate}
                    onChange={(e) => setFormData({ ...formData, validityDate: e.target.value })}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Shipping Terms</label>
                  <input
                    type="text"
                    value={formData.shippingTerms}
                    onChange={(e) => setFormData({ ...formData, shippingTerms: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              {/* Items pricing table */}
              {formData.items.length > 0 && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="font-semibold text-slate-300 uppercase tracking-wider text-[11px] block mb-2">
                    Line Item Pricing & Lead Times
                  </span>
                  <div className="space-y-2">
                    {formData.items.map((row, idx) => (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                        <div className="sm:col-span-2">
                          <span className="text-slate-400 text-[11px] block">Qty: {row.quantity} units</span>
                          <span className="text-white font-medium text-xs">Item Line #{idx + 1}</span>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">Unit Price ($)</label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={row.unitPrice}
                            onChange={(e) => {
                              const updated = [...formData.items];
                              updated[idx].unitPrice = Number(e.target.value);
                              setFormData({ ...formData, items: updated });
                            }}
                            required
                            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">Lead Time (Days)</label>
                          <input
                            type="number"
                            min="0"
                            value={row.deliveryDays}
                            onChange={(e) => {
                              const updated = [...formData.items];
                              updated[idx].deliveryDays = Number(e.target.value);
                              setFormData({ ...formData, items: updated });
                            }}
                            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs font-mono"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  Save Supplier Bid
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
