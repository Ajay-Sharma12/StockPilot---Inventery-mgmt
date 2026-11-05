import React, { useState, useEffect } from 'react';
import {
  FileCheck,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Warehouse as WarehouseIcon,
  Calendar,
  DollarSign,
  X,
  Printer,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  FileText,
  User,
  Send,
  Sparkles,
  ExternalLink,
  Copy,
  Link2,
  Download,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { downloadElementAsPdf } from '../../utils/pdfExport';
import { salesApi, Quotation, QuotationStatus } from '../../api/sales.api';
import { masterDataApi } from '../../api/masterData.api';
import { warehouseApi, Warehouse } from '../../api/warehouse.api';
import { itemApi, Item } from '../../api/item.api';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../context/ToastContext';

export const QuotationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToast();

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<Quotation | null>(null);

  // Creation State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [itemsCatalog, setItemsCatalog] = useState<Item[]>([]);

  const [formData, setFormData] = useState({
    customerId: '',
    warehouseId: '',
    quotationDate: new Date().toISOString().split('T')[0],
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    currency: 'USD',
    shippingAmount: 50,
    commercialTerms: 'Prices FOB Factory Gate. Payment net 30 days upon invoice. Valid for 30 days from issue.',
    notes: 'Thank you for your business inquiry with StockPilot.',
    items: [
      {
        itemId: '',
        description: '',
        quantity: 1,
        uomId: '',
        unitPrice: 0,
        discount: 0,
        taxRate: 0,
        remarks: '',
      },
    ],
  });

  // Rejection modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Print modal
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadQuotations();
    loadPrerequisites();
  }, [statusFilter]);

  const loadPrerequisites = async () => {
    try {
      const [custData, whData, itemData] = await Promise.all([
        masterDataApi.getCustomers(),
        warehouseApi.getWarehouses(),
        itemApi.getItems({ limit: 100 }),
      ]);
      const custList = Array.isArray(custData)
        ? custData
        : Array.isArray((custData as any)?.data)
        ? (custData as any).data
        : [];
      setCustomers(custList);
      setWarehouses(Array.isArray(whData) ? whData : (whData as any)?.data || []);
      setItemsCatalog(Array.isArray(itemData?.data) ? itemData.data : Array.isArray(itemData) ? itemData : []);
    } catch (err) {
      console.error('Failed to load prerequisites', err);
    }
  };

  const loadQuotations = async () => {
    try {
      setLoading(true);
      const res = await salesApi.getQuotations({
        status: statusFilter || undefined,
        limit: 50,
      });
      setQuotations(res.data || []);
      if (res.data && res.data.length > 0 && !selectedQuote) {
        setSelectedQuote(res.data[0]);
      }
    } catch (err) {
      console.error('Failed to load quotations', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          itemId: '',
          description: '',
          quantity: 1,
          uomId: '',
          unitPrice: 0,
          discount: 0,
          taxRate: 0,
          remarks: '',
        },
      ],
    }));
  };

  const handleRemoveItem = (index: number) => {
    if (formData.items.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleItemSelect = (index: number, itemId: string) => {
    const item = itemsCatalog.find((i) => i._id === itemId);
    const updated = [...formData.items];
    const uom =
      (item as any)?.baseUomId?._id ||
      (item as any)?.baseUomId ||
      (item as any)?.uomId?._id ||
      (item as any)?.uomId ||
      '';
    updated[index] = {
      ...updated[index],
      itemId,
      description: item ? item.description || item.name : '',
      uomId: uom,
      unitPrice: (item as any)?.sellingPrice || (item as any)?.standardPrice || (item as any)?.costPrice || 100,
    };
    setFormData((prev) => ({ ...prev, items: updated }));
  };

  const handleItemChange = (index: number, field: string, val: any) => {
    const updated = [...formData.items];
    updated[index] = { ...updated[index], [field]: val };
    setFormData((prev) => ({ ...prev, items: updated }));
  };

  const calculateFormTotals = () => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    formData.items.forEach((it) => {
      const lineSubtotal = (it.quantity || 0) * (it.unitPrice || 0);
      const discAmt = lineSubtotal * ((it.discount || 0) / 100);
      const afterDisc = lineSubtotal - discAmt;
      const taxAmt = afterDisc * ((it.taxRate || 0) / 100);

      subtotal += lineSubtotal;
      totalDiscount += discAmt;
      totalTax += taxAmt;
    });

    const grandTotal = subtotal - totalDiscount + totalTax + (formData.shippingAmount || 0);
    return { subtotal, totalDiscount, totalTax, grandTotal };
  };

  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId) {
      toastError('Please select a Customer / Client.');
      return;
    }
    if (!formData.warehouseId) {
      toastError('Please select a Dispatching Warehouse.');
      return;
    }

    // Filter out empty rows where itemId is not selected
    const validItems = formData.items.filter((it) => it.itemId && it.itemId.trim() !== '');

    if (validItems.length === 0) {
      toastError('Please select at least one item for the quotation.');
      return;
    }

    // Ensure valid quantity, price, and UOM
    for (let i = 0; i < validItems.length; i++) {
      const line = validItems[i];
      if (Number(line.quantity) <= 0) {
        toastError(`Quantity for line item ${i + 1} must be greater than zero.`);
        return;
      }
      if (Number(line.unitPrice) < 0) {
        toastError(`Unit price for line item ${i + 1} cannot be negative.`);
        return;
      }
      if (!line.uomId) {
        const itemObj = itemsCatalog.find((it) => it._id === line.itemId);
        line.uomId = (itemObj as any)?.baseUomId?._id || (itemObj as any)?.baseUomId || '';
      }
    }

    try {
      setActionLoading(true);
      const created = await salesApi.createQuotation({
        ...formData,
        items: validItems,
      });
      setShowCreateModal(false);
      toastSuccess(`Sales Quotation ${created.quotationNumber || ''} created successfully!`);
      await loadQuotations();
      setSelectedQuote(created);
    } catch (err: any) {
      const msg =
        err.response?.data?.errors?.[0]?.message ||
        err.response?.data?.message ||
        'Failed to create quotation';
      toastError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendQuotation = async (id: string) => {
    try {
      setActionLoading(true);
      const updated = await salesApi.sendQuotation(id, {
        portalBaseUrl: window.location.origin,
      });
      setSelectedQuote(updated);
      const recipientEmail = updated.customerId?.email || (selectedQuote?.customerId as any)?.email;
      toastSuccess(
        recipientEmail
          ? `Proposal emailed to ${recipientEmail} successfully!`
          : 'Proposal sent to customer successfully!'
      );
      await loadQuotations();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to send quotation');
    } finally {
      setActionLoading(false);
    }
  };

  const copyPortalLink = () => {
    if (!selectedQuote) return;
    const url = `${window.location.origin}/portal/quotation/${selectedQuote._id}${
      selectedQuote.publicToken ? `?token=${selectedQuote.publicToken}` : ''
    }`;
    navigator.clipboard.writeText(url);
    toastSuccess('Customer approval portal link copied to clipboard!');
  };

  const handleAcceptQuotation = async (id: string) => {
    try {
      setActionLoading(true);
      const updated = await salesApi.acceptQuotation(id);
      setSelectedQuote(updated);
      toastSuccess('Quotation marked as ACCEPTED by client!');
      await loadQuotations();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to accept quotation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectQuotation = async () => {
    if (!selectedQuote) return;
    try {
      setActionLoading(true);
      const updated = await salesApi.rejectQuotation(selectedQuote._id, rejectionReason || 'Commercial terms declined');
      setSelectedQuote(updated);
      setShowRejectModal(false);
      setRejectionReason('');
      toastSuccess('Client rejection recorded.');
      await loadQuotations();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to reject quotation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConvertToSalesOrder = async (id: string) => {
    try {
      setActionLoading(true);
      const res = await salesApi.convertQuotationToSalesOrder(id);
      toastSuccess('Quotation successfully converted to Sales Order!');
      await loadQuotations();
      if (res.salesOrder) {
        navigate(`/sales/orders?id=${res.salesOrder._id}`);
      }
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to convert quotation to sales order');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered list
  const filteredQuotes = quotations.filter((q) => {
    const matchesSearch =
      q.quotationNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.customerId?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // KPIs
  const totalCount = quotations.length;
  const draftCount = quotations.filter((q) => q.status === 'DRAFT').length;
  const sentCount = quotations.filter((q) => q.status === 'SENT').length;
  const acceptedCount = quotations.filter((q) => q.status === 'ACCEPTED').length;
  const convertedCount = quotations.filter((q) => q.status === 'CONVERTED').length;

  const getStatusBadge = (status: QuotationStatus, size: 'sm' | 'md' = 'sm') => {
    switch (status) {
      case 'DRAFT':
        return <Badge size={size} variant="warning">Draft</Badge>;
      case 'SENT':
        return <Badge size={size} variant="info">Sent to Customer</Badge>;
      case 'ACCEPTED':
        return <Badge size={size} variant="success">Accepted</Badge>;
      case 'REJECTED':
        return <Badge size={size} variant="danger">Rejected</Badge>;
      case 'CONVERTED':
        return <Badge size={size} variant="purple">Converted to SO</Badge>;
      case 'EXPIRED':
        return <Badge size={size} variant="secondary">Expired</Badge>;
      default:
        return <Badge size={size}>{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6 bg-slate-950 min-h-screen text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-gradient-to-tr from-sky-600 to-indigo-500 rounded-lg text-white shadow-lg shadow-sky-500/20">
              <FileCheck className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Sales Quotations (QT)
                <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-medium">
                  Pre-Sales
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Generate customer pricing quotes, lock commercial terms, and seamlessly convert accepted bids into Sales Orders.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-sky-600/30 transition flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Sales Quotation</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 backdrop-blur-sm">
          <div className="text-[11px] font-medium text-slate-400">Total Quotes</div>
          <div className="text-xl font-bold text-white mt-1">
            {loading ? <Skeleton className="h-6 w-12 bg-slate-800" /> : totalCount}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">All pre-sales bids</div>
        </div>
        <div className="bg-slate-900/60 border border-amber-500/20 rounded-xl p-3.5 backdrop-blur-sm">
          <div className="text-[11px] font-medium text-amber-400">Draft Proposals</div>
          <div className="text-xl font-bold text-amber-300 mt-1">
            {loading ? <Skeleton className="h-6 w-12 bg-slate-800" /> : draftCount}
          </div>
          <div className="text-[10px] text-amber-500/70 mt-0.5">In preparation</div>
        </div>
        <div className="bg-slate-900/60 border border-sky-500/20 rounded-xl p-3.5 backdrop-blur-sm">
          <div className="text-[11px] font-medium text-sky-400">Awaiting Client</div>
          <div className="text-xl font-bold text-sky-300 mt-1">
            {loading ? <Skeleton className="h-6 w-12 bg-slate-800" /> : sentCount}
          </div>
          <div className="text-[10px] text-sky-500/70 mt-0.5">Sent &amp; under review</div>
        </div>
        <div className="bg-slate-900/60 border border-emerald-500/20 rounded-xl p-3.5 backdrop-blur-sm">
          <div className="text-[11px] font-medium text-emerald-400">Accepted (Ready)</div>
          <div className="text-xl font-bold text-emerald-300 mt-1">
            {loading ? <Skeleton className="h-6 w-12 bg-slate-800" /> : acceptedCount}
          </div>
          <div className="text-[10px] text-emerald-500/70 mt-0.5">Ready for 1-click SO</div>
        </div>
        <div className="bg-slate-900/60 border border-purple-500/20 rounded-xl p-3.5 backdrop-blur-sm">
          <div className="text-[11px] font-medium text-purple-400">Converted Orders</div>
          <div className="text-xl font-bold text-purple-300 mt-1">
            {loading ? <Skeleton className="h-6 w-12 bg-slate-800" /> : convertedCount}
          </div>
          <div className="text-[10px] text-purple-500/70 mt-0.5">Active fulfillment</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800/80">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search QT-2026-..., Customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-700/60 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {['', 'DRAFT', 'SENT', 'ACCEPTED', 'CONVERTED', 'REJECTED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                statusFilter === st
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {st === '' ? 'All Status' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Quotations Table + Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table list (2 cols) */}
        <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Quotation #</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Valid Until</th>
                  <th className="p-3">Grand Total</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="hover:bg-slate-800/20">
                      <td className="p-3"><Skeleton className="h-4 w-28 bg-slate-800" /></td>
                      <td className="p-3">
                        <Skeleton className="h-4 w-36 bg-slate-800 mb-1" />
                        <Skeleton className="h-3 w-24 bg-slate-800/60" />
                      </td>
                      <td className="p-3"><Skeleton className="h-4 w-24 bg-slate-800" /></td>
                      <td className="p-3"><Skeleton className="h-4 w-20 bg-slate-800" /></td>
                      <td className="p-3"><Skeleton className="h-5 w-20 rounded-full bg-slate-800" /></td>
                      <td className="p-3 text-right"><Skeleton className="h-7 w-14 rounded ml-auto bg-slate-800" /></td>
                    </tr>
                  ))
                ) : filteredQuotes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No sales quotations found. Click "New Sales Quotation" to create one.
                    </td>
                  </tr>
                ) : (
                  filteredQuotes.map((q) => {
                    const isSelected = selectedQuote?._id === q._id;
                    return (
                      <tr
                        key={q._id}
                        onClick={() => setSelectedQuote(q)}
                        className={`cursor-pointer transition ${
                          isSelected ? 'bg-sky-950/30 border-l-2 border-l-sky-500' : 'hover:bg-slate-800/30'
                        }`}
                      >
                        <td className="p-3 font-semibold text-white whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            <span className="font-mono">{q.quotationNumber}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-medium text-slate-200">{q.customerId?.name || 'Customer'}</div>
                          <div className="text-[10px] text-slate-500">{q.customerId?.email || ''}</div>
                        </td>
                        <td className="p-3 text-slate-400">
                          {q.validUntil ? new Date(q.validUntil).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="p-3 font-bold text-white">
                          ${q.grandTotal?.toLocaleString() || '0'}
                        </td>
                        <td className="p-3">{getStatusBadge(q.status)}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedQuote(q);
                              setShowPrintModal(true);
                            }}
                            title="Print Quotation"
                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Quotation Details (1 col) */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-5">
          {selectedQuote ? (
            <>
              {/* Top Banner */}
              <div className="border-b border-slate-800 pb-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2.5 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg font-black text-white font-mono tracking-tight whitespace-nowrap">
                      {selectedQuote.quotationNumber}
                    </span>
                    {getStatusBadge(selectedQuote.status, 'sm')}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowPrintModal(true)}
                    className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold border border-slate-700/80 transition-all shadow-xs active:scale-[0.98]"
                    title="Print Quotation Slip"
                  >
                    <Printer className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>Print Slip</span>
                  </button>
                </div>

                <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-slate-400 font-medium">
                  <span className="inline-flex items-center gap-1 shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Issued: {new Date(selectedQuote.quotationDate).toLocaleDateString()}</span>
                  </span>
                  <span className="text-slate-600">&bull;</span>
                  <span className="shrink-0">
                    Valid Until: {new Date(selectedQuote.validUntil).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Customer & Commercial Terms */}
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800/60 space-y-1">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3 h-3 text-sky-400" />
                    <span>Client Details</span>
                  </div>
                  <div className="font-semibold text-white">{selectedQuote.customerId?.name}</div>
                  <div className="text-slate-400 text-[11px]">{selectedQuote.customerId?.email || 'No email provided'}</div>
                </div>

                {selectedQuote.commercialTerms && (
                  <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800/60 space-y-1">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Commercial Terms
                    </div>
                    <div className="text-slate-300 text-[11px] leading-relaxed">
                      {selectedQuote.commercialTerms}
                    </div>
                  </div>
                )}
              </div>

              {/* Line Items */}
              <div>
                <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Line Items ({selectedQuote.items?.length || 0})
                </div>
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {selectedQuote.items?.map((it, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-slate-950/40 rounded-lg border border-slate-800/60 text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium text-white">{it.description || it.itemId?.name || 'Item'}</div>
                        <div className="text-[10px] text-slate-500">
                          Qty: {it.quantity} &bull; ${it.unitPrice} each &bull; Disc: {it.discount}% &bull; Tax: {it.taxRate}%
                        </div>
                      </div>
                      <span className="font-bold text-white">${it.lineTotal?.toLocaleString() || '0'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span>${selectedQuote.subtotal?.toLocaleString()}</span>
                </div>
                {selectedQuote.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Discount:</span>
                    <span>-${selectedQuote.discountAmount?.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400">
                  <span>Taxes:</span>
                  <span>+${selectedQuote.taxAmount?.toLocaleString()}</span>
                </div>
                {selectedQuote.shippingAmount > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Shipping:</span>
                    <span>+${selectedQuote.shippingAmount?.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-white font-bold text-sm pt-1.5 border-t border-slate-800">
                  <span>Grand Total:</span>
                  <span className="text-sky-400">${selectedQuote.grandTotal?.toLocaleString()}</span>
                </div>
              </div>

              {/* Action Buttons based on status */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                {selectedQuote.status === 'DRAFT' && (
                  <button
                    onClick={() => handleSendQuotation(selectedQuote._id)}
                    disabled={actionLoading}
                    className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-sky-600/30 transition flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Send Proposal to Customer</span>
                  </button>
                )}

                {selectedQuote.status === 'SENT' && (
                  <div className="space-y-2.5">
                    <div className="p-2.5 bg-sky-500/10 border border-sky-500/20 rounded-lg text-xs text-sky-300 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                        <span className="truncate">
                          Proposal emailed to: <strong className="text-white">{selectedQuote.customerId?.email || 'Customer'}</strong>
                        </span>
                      </div>
                      <button
                        onClick={() => handleSendQuotation(selectedQuote._id)}
                        disabled={actionLoading}
                        className="px-2.5 py-1 bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 border border-sky-500/30 rounded text-[11px] font-semibold shrink-0 transition"
                        title="Resend email proposal to customer"
                      >
                        Resend
                      </button>
                    </div>

                    {/* Copy Public Customer Portal Link */}
                    <button
                      type="button"
                      onClick={copyPortalLink}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5"
                      title="Copy customer review and approval portal link"
                    >
                      <Link2 className="w-3.5 h-3.5 text-sky-400" />
                      <span>Copy Customer Approval Link</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleAcceptQuotation(selectedQuote._id)}
                        disabled={actionLoading}
                        className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Accept Quote</span>
                      </button>
                      <button
                        onClick={() => setShowRejectModal(true)}
                        disabled={actionLoading}
                        className="py-2.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                )}

                {selectedQuote.status === 'ACCEPTED' && (
                  <div className="space-y-2.5">
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-1 text-xs text-emerald-300">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Proposal Approved by Client!</span>
                      </div>
                      {selectedQuote.clientFeedback && (
                        <p className="text-[11px] text-emerald-200/90 italic bg-emerald-950/40 p-2 rounded border border-emerald-500/20">
                          &ldquo;{selectedQuote.clientFeedback}&rdquo;
                        </p>
                      )}
                      <div className="text-[10px] text-emerald-400/80">
                        Ready to convert into official Sales Order for warehouse fulfillment.
                      </div>
                    </div>

                    <button
                      onClick={() => handleConvertToSalesOrder(selectedQuote._id)}
                      disabled={actionLoading}
                      className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>⚡ Convert to Confirmed Sales Order</span>
                    </button>
                  </div>
                )}

                {selectedQuote.status === 'CONVERTED' && (
                  (() => {
                    const linkedSo = selectedQuote.convertedSalesOrderId || selectedQuote.salesOrderId;
                    const soId = typeof linkedSo === 'object' && linkedSo ? linkedSo._id : linkedSo;
                    const soNumber = typeof linkedSo === 'object' && linkedSo ? linkedSo.soNumber : 'SO';
                    return (
                      <button
                        onClick={() => navigate(soId ? `/sales/orders?id=${soId}` : '/sales/orders')}
                        className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-purple-600/30 transition flex items-center justify-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>View Linked Sales Order ({soNumber || 'SO'})</span>
                      </button>
                    );
                  })()
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs">
              Select a sales quotation to view commercial breakdown and actions
            </div>
          )}
        </div>
      </div>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-3xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-sky-400" />
                <span>Create New Sales Quotation (QT)</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateQuotation} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Customer / Client *</label>
                  <Select
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                    placeholder="Select Customer..."
                    variant="sky"
                    searchable
                    options={(Array.isArray(customers) ? customers : []).map((c) => ({
                      value: c._id,
                      label: c.name,
                      badge: c.customerCode || undefined,
                    }))}
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Dispatching Warehouse</label>
                  <Select
                    value={formData.warehouseId}
                    onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                    placeholder="Select Warehouse (Optional)..."
                    variant="sky"
                    searchable
                    options={(Array.isArray(warehouses) ? warehouses : []).map((w) => ({
                      value: w._id,
                      label: w.name,
                      badge: w.code,
                    }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Quotation Date</label>
                  <input
                    type="date"
                    value={formData.quotationDate}
                    onChange={(e) => setFormData({ ...formData, quotationDate: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Valid Until *</label>
                  <input
                    type="date"
                    required
                    value={formData.validUntil}
                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Currency</label>
                  <Select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    variant="sky"
                    options={[
                      { value: 'USD', label: 'USD ($)', badge: 'USD' },
                      { value: 'EUR', label: 'EUR (€)', badge: 'EUR' },
                      { value: 'INR', label: 'INR (₹)', badge: 'INR' },
                      { value: 'GBP', label: 'GBP (£)', badge: 'GBP' },
                    ]}
                  />
                </div>
              </div>

              {/* Line items table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300">Quote Line Items</span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded text-xs flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 px-3 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-100/80 dark:bg-slate-800/60 rounded-md">
                    <div className="col-span-4">Product / Item *</div>
                    <div className="col-span-2">Quantity</div>
                    <div className="col-span-2">Unit Price ($)</div>
                    <div className="col-span-2">Discount (%)</div>
                    <div className="col-span-1">Tax (%)</div>
                    <div className="col-span-1 text-center">Action</div>
                  </div>

                  {formData.items.map((line, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 p-2.5 bg-slate-800/40 border border-slate-700/60 rounded-lg items-center"
                    >
                      <div className="col-span-4">
                        <Select
                          size="sm"
                          variant="sky"
                          searchable
                          value={line.itemId}
                          onChange={(e) => handleItemSelect(idx, e.target.value)}
                          placeholder="Select Item..."
                          options={(Array.isArray(itemsCatalog) ? itemsCatalog : []).map((it) => ({
                            value: it._id,
                            label: it.name,
                            badge: it.sku,
                          }))}
                        />
                      </div>

                      <div className="col-span-2">
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={line.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value))}
                          className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white outline-none"
                        />
                      </div>

                      <div className="col-span-2">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Price"
                          value={line.unitPrice}
                          onChange={(e) => handleItemChange(idx, 'unitPrice', Number(e.target.value))}
                          className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white outline-none"
                        />
                      </div>

                      <div className="col-span-2">
                        <input
                          type="number"
                          placeholder="Disc %"
                          value={line.discount}
                          onChange={(e) => handleItemChange(idx, 'discount', Number(e.target.value))}
                          className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white outline-none"
                        />
                      </div>

                      <div className="col-span-1">
                        <input
                          type="number"
                          placeholder="Tax %"
                          value={line.taxRate}
                          onChange={(e) => handleItemChange(idx, 'taxRate', Number(e.target.value))}
                          className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white outline-none"
                        />
                      </div>

                      <div className="col-span-1 flex justify-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-500 hover:text-rose-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals Summary */}
              {(() => {
                const totals = calculateFormTotals();
                return (
                  <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-slate-400">Est. Subtotal: </span>
                      <span className="font-semibold text-white">${totals.subtotal.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Discount: </span>
                      <span className="font-semibold text-emerald-400">-${totals.totalDiscount.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Tax: </span>
                      <span className="font-semibold text-slate-300">+${totals.totalTax.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Estimated Total: </span>
                      <span className="text-base font-bold text-sky-400">${totals.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block text-slate-400 font-medium mb-1">Commercial &amp; Delivery Terms</label>
                <textarea
                  rows={2}
                  value={formData.commercialTerms}
                  onChange={(e) => setFormData({ ...formData, commercialTerms: e.target.value })}
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
                  disabled={actionLoading || !formData.customerId || formData.items.length === 0}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold shadow transition-all duration-150 flex items-center justify-center gap-1.5 ${
                    actionLoading || !formData.customerId || formData.items.length === 0
                      ? 'bg-slate-200 text-slate-500 border border-slate-300 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700 cursor-not-allowed shadow-none'
                      : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/20 active:scale-[0.98]'
                  }`}
                >
                  {actionLoading ? 'Saving...' : 'Create Sales Quotation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-400" />
              <span>Record Client Rejection</span>
            </h3>
            <textarea
              rows={3}
              placeholder="Specify client feedback / reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-400 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectQuotation}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE QUOTATION MODAL */}
      {showPrintModal && selectedQuote && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div
            id="printable-quotation"
            className="bg-white text-slate-900 rounded-2xl max-w-3xl w-full p-8 shadow-2xl space-y-6 my-auto print:m-0 print:p-4 print:shadow-none printable-document"
          >
            {/* Header / Brand */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-5">
              <div>
                <div className="text-2xl font-black text-slate-900 tracking-tight">StockPilot ERP</div>
                <div className="text-xs text-slate-500 mt-0.5">Enterprise Supply Chain &amp; Order-to-Cash</div>
                <div className="text-xs text-slate-500">100 Logistics Blvd, Industrial Area, USA</div>
                <div className="text-xs text-slate-500">tax@stockpilot.corp &bull; +1 (800) 555-0199</div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold px-2 py-1 bg-sky-100 text-sky-800 rounded uppercase tracking-wider">
                  Commercial Quotation
                </span>
                <div className="text-xl font-bold text-slate-900 mt-2">{selectedQuote.quotationNumber}</div>
                <div className="text-xs text-slate-500">Date: {new Date(selectedQuote.quotationDate).toLocaleDateString()}</div>
                <div className="text-xs font-semibold text-rose-600">
                  Valid Until: {new Date(selectedQuote.validUntil).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Recipient */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-1">
                  Prepared For / Buyer:
                </div>
                <div className="font-bold text-slate-900 text-sm">{selectedQuote.customerId?.name}</div>
                <div className="text-slate-600">{selectedQuote.customerId?.email}</div>
                <div className="text-slate-600">{selectedQuote.customerId?.phone}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-1">
                  Quotation Metadata:
                </div>
                <div className="text-slate-700">Currency: <span className="font-semibold">{selectedQuote.currency}</span></div>
                <div className="text-slate-700">Status: <span className="font-semibold">{selectedQuote.status}</span></div>
                <div className="text-slate-700">Dispatch Hub: <span className="font-semibold">{selectedQuote.warehouseId?.name || 'Central Facility'}</span></div>
              </div>
            </div>

            {/* Table */}
            <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">Item Description</th>
                  <th className="p-2.5 text-center">Qty</th>
                  <th className="p-2.5 text-right">Unit Price</th>
                  <th className="p-2.5 text-center">Disc %</th>
                  <th className="p-2.5 text-center">Tax %</th>
                  <th className="p-2.5 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {selectedQuote.items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="p-2.5 text-slate-500">{idx + 1}</td>
                    <td className="p-2.5 font-medium text-slate-900">{it.description || it.itemId?.name || 'Item'}</td>
                    <td className="p-2.5 text-center font-semibold text-slate-800">{it.quantity}</td>
                    <td className="p-2.5 text-right">${it.unitPrice.toFixed(2)}</td>
                    <td className="p-2.5 text-center text-slate-600">{it.discount}%</td>
                    <td className="p-2.5 text-center text-slate-600">{it.taxRate}%</td>
                    <td className="p-2.5 text-right font-bold text-slate-900">${it.lineTotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Financial Summary */}
            <div className="flex justify-end">
              <div className="w-64 space-y-1 text-xs border-t border-slate-200 pt-2">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>${selectedQuote.subtotal.toFixed(2)}</span>
                </div>
                {selectedQuote.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount:</span>
                    <span>-${selectedQuote.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Taxes:</span>
                  <span>+${selectedQuote.taxAmount.toFixed(2)}</span>
                </div>
                {selectedQuote.shippingAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Shipping &amp; Handling:</span>
                    <span>+${selectedQuote.shippingAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-900 font-extrabold text-sm border-t border-slate-300 pt-1">
                  <span>Total Amount:</span>
                  <span>${selectedQuote.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Commercial terms */}
            {selectedQuote.commercialTerms && (
              <div className="text-[11px] text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="font-bold text-slate-800 mb-0.5">Commercial Conditions:</div>
                <p>{selectedQuote.commercialTerms}</p>
              </div>
            )}

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-xs">
              <div>
                <div className="h-10 border-b border-slate-300"></div>
                <div className="mt-1 font-semibold text-slate-700">Authorized Signatory (StockPilot)</div>
              </div>
              <div>
                <div className="h-10 border-b border-slate-300"></div>
                <div className="mt-1 font-semibold text-slate-700">Customer Acceptance &amp; Stamp</div>
              </div>
            </div>

            {/* Print action footer */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 print:hidden">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setDownloadingPdf(true);
                    await downloadElementAsPdf('printable-quotation', `${selectedQuote.quotationNumber}_Quotation.pdf`);
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
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-2 transition"
              >
                <Printer className="w-4 h-4" />
                <span>Print Document</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
