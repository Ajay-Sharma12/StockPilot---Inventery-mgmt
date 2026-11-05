import React, { useState, useEffect } from 'react';
import {
  ArrowLeftRight,
  Plus,
  Search,
  Send,
  Sliders,
  CheckCircle2,
  Clock,
  Building2,
  Calendar,
  X,
  ExternalLink,
  Mail,
  Phone,
  Server,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { procurementApi, RFQ, PurchaseRequisition } from '../../api/procurement.api';
import { masterDataApi, Supplier, UOM } from '../../api/masterData.api';
import { itemApi, Item } from '../../api/item.api';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../context/ToastContext';
import { Select } from '../../components/ui/Select';
import { NotificationGatewayModal } from '../../components/common/NotificationGatewayModal';

export const RFQsPage: React.FC = () => {
  const { can } = usePermissions();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  const [rfqs, setRFQs] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRFQ, setSelectedRFQ] = useState<RFQ | null>(null);

  // Creation State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [approvedPRs, setApprovedPRs] = useState<PurchaseRequisition[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [itemsCatalog, setItemsCatalog] = useState<Item[]>([]);
  const [uoms, setUOMs] = useState<UOM[]>([]);

  const [createSource, setCreateSource] = useState<'MANUAL' | 'PURCHASE_REQUISITION'>('MANUAL');
  const [selectedPRId, setSelectedPRId] = useState('');
  const [formData, setFormData] = useState({
    responseDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    requestedDeliveryDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    terms: 'Net 30 payment terms upon inspection approval.',
    notes: '',
    selectedSupplierIds: [] as string[],
    items: [{ itemId: '', quantity: 1, uomId: '', specifications: '' }],
  });

  useEffect(() => {
    loadRFQs();
  }, [statusFilter]);

  const loadRFQs = async () => {
    try {
      setLoading(true);
      const res = await procurementApi.getRFQs({
        status: statusFilter || undefined,
        search: searchTerm || undefined,
      });
      setRFQs(res.data || []);
    } catch (err) {
      console.error('Failed to load RFQs', err);
    } finally {
      setLoading(false);
    }
  };

  const normalizeList = (res: any): any[] => {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.items)) return res.items;
    return [];
  };

  const loadPrerequisites = async () => {
    try {
      const [prsRes, suppsRes, itemsRes, uomsRes] = await Promise.all([
        procurementApi.getPRs({
          status: 'APPROVED,PARTIALLY_APPROVED,PURCHASE_REQUIRED,PARTIALLY_AVAILABLE',
          limit: 100,
        }),
        masterDataApi.getSuppliers(),
        itemApi.getItems({ limit: 200 }),
        masterDataApi.getUOMs(),
      ]);
      setApprovedPRs(normalizeList(prsRes));
      setSuppliers(normalizeList(suppsRes));
      setItemsCatalog(normalizeList(itemsRes));
      setUOMs(normalizeList(uomsRes));
    } catch (err) {
      console.error('Failed to load prerequisites', err);
    }
  };

  const openCreateModal = () => {
    setSelectedPRId('');
    setFormData({
      responseDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      requestedDeliveryDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      terms: 'Net 30 payment terms upon inspection approval.',
      notes: '',
      selectedSupplierIds: [],
      items: [{ itemId: '', quantity: 1, uomId: '', specifications: '' }],
    });
    loadPrerequisites();
    setShowCreateModal(true);
  };

  const handleSourceChange = (src: 'MANUAL' | 'PURCHASE_REQUISITION') => {
    setCreateSource(src);
    if (src === 'PURCHASE_REQUISITION') {
      if (selectedPRId) {
        handlePRSelection(selectedPRId);
      } else {
        setFormData((prev) => ({ ...prev, items: [] }));
      }
    } else {
      if (formData.items.length === 0 || !formData.items[0]?.itemId) {
        setFormData((prev) => ({
          ...prev,
          items: [
            {
              itemId: itemsCatalog[0]?._id || '',
              quantity: 1,
              uomId: uoms[0]?._id || '',
              specifications: '',
            },
          ],
        }));
      }
    }
  };

  const handlePRSelection = (prId: string) => {
    setSelectedPRId(prId);
    const pr = approvedPRs.find((p) => p._id === prId);
    if (pr) {
      // Prioritize shortage items if stock availability check was run and detected shortages
      const hasShortages = pr.items.some((it) => it.shortageQuantity !== undefined && it.shortageQuantity > 0);
      const itemsToProcure = hasShortages
        ? pr.items.filter((it) => it.shortageQuantity !== undefined && it.shortageQuantity > 0)
        : pr.items;

      const mappedItems = itemsToProcure.map((it) => {
        const qty =
          it.shortageQuantity !== undefined && it.shortageQuantity > 0
            ? it.shortageQuantity
            : it.remainingQuantity !== undefined && it.remainingQuantity > 0
            ? it.remainingQuantity
            : it.approvedQuantity || it.requestedQuantity || 1;

        return {
          itemId: typeof it.itemId === 'object' ? it.itemId._id : it.itemId,
          prLineId: it._id,
          quantity: qty,
          uomId: typeof it.uomId === 'object' ? it.uomId._id : it.uomId,
          specifications: it.remarks || '',
        };
      });

      setFormData((prev) => ({
        ...prev,
        items: mappedItems.length > 0 ? mappedItems : [{ itemId: '', quantity: 1, uomId: '', specifications: '' }],
      }));
    }
  };

  const toggleSupplier = (supplierId: string) => {
    const list = [...formData.selectedSupplierIds];
    const index = list.indexOf(supplierId);
    if (index > -1) {
      list.splice(index, 1);
    } else {
      list.push(supplierId);
    }
    setFormData({ ...formData, selectedSupplierIds: list });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.selectedSupplierIds.length === 0) {
      toastError('Please invite at least one supplier to bid on this RFQ');
      return;
    }

    if (createSource === 'PURCHASE_REQUISITION' && !selectedPRId) {
      toastError('Please select an Approved Purchase Requisition');
      return;
    }

    const validItems = formData.items.filter((it) => it.itemId && it.uomId && it.quantity > 0);
    if (validItems.length === 0) {
      toastError('Please specify at least one valid line item with positive quantity and UOM');
      return;
    }

    try {
      const payload: any = {
        sourceType: createSource,
        sourceId: createSource === 'PURCHASE_REQUISITION' ? selectedPRId : undefined,
        responseDeadline: formData.responseDeadline,
        requestedDeliveryDate: formData.requestedDeliveryDate || undefined,
        terms: formData.terms || undefined,
        notes: formData.notes || undefined,
        suppliers: formData.selectedSupplierIds.map((id) => ({ supplierId: id })),
        items: validItems,
      };

      const res = await procurementApi.createRFQ(payload);
      setShowCreateModal(false);
      success(`RFQ ${res.rfqNumber || ''} created successfully`);
      loadRFQs();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to create RFQ');
    }
  };

  // Gateway Configuration & Status
  const [gatewayStatus, setGatewayStatus] = useState<any>(null);
  const [showGatewayModal, setShowGatewayModal] = useState(false);

  const loadGatewayStatus = async () => {
    try {
      const data = await procurementApi.getNotificationGatewayStatus();
      setGatewayStatus(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadGatewayStatus();
  }, []);

  // Issue Confirmation State with Supplier Contact Overrides
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [supplierContacts, setSupplierContacts] = useState<
    Record<string, { email: string; phone: string; updateSupplier: boolean }>
  >({});

  const openIssueModal = () => {
    if (!selectedRFQ) return;
    const initialContacts: Record<string, { email: string; phone: string; updateSupplier: boolean }> = {};
    selectedRFQ.suppliers.forEach((s) => {
      const sId = (s.supplierId?._id || s.supplierId)?.toString();
      initialContacts[sId] = {
        email: s.supplierId?.email || s.contact || '',
        phone: s.supplierId?.phone || '',
        updateSupplier: true,
      };
    });
    setSupplierContacts(initialContacts);
    setShowIssueModal(true);
  };

  const handleConfirmIssueRFQ = async () => {
    if (!selectedRFQ) return;
    try {
      setIssuing(true);
      const supplierOverrides = Object.entries(supplierContacts).map(([supplierId, c]) => ({
        supplierId,
        email: c.email.trim(),
        phone: c.phone.trim(),
        updateSupplier: c.updateSupplier,
      }));

      await procurementApi.issueRFQ(selectedRFQ._id, { supplierOverrides });
      success(`RFQ ${selectedRFQ.rfqNumber} issued & real Email and SMS invitations dispatched`);
      setShowIssueModal(false);
      loadRFQs();
      const updated = await procurementApi.getRFQById(selectedRFQ._id);
      setSelectedRFQ(updated);
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to issue RFQ');
    } finally {
      setIssuing(false);
    }
  };

  // Resend Invite State
  const [resendingSupplier, setResendingSupplier] = useState<any>(null);
  const [resendEmail, setResendEmail] = useState('');
  const [resendPhone, setResendPhone] = useState('');
  const [resendUpdateSupplier, setResendUpdateSupplier] = useState(true);
  const [resending, setResending] = useState(false);

  const openResendModal = (supplierEntry: any) => {
    setResendingSupplier(supplierEntry);
    setResendEmail(supplierEntry.supplierId?.email || supplierEntry.contact || '');
    setResendPhone(supplierEntry.supplierId?.phone || '');
    setResendUpdateSupplier(true);
  };

  const handleConfirmResend = async () => {
    if (!selectedRFQ || !resendingSupplier) return;
    const sId = (resendingSupplier.supplierId?._id || resendingSupplier.supplierId)?.toString();
    try {
      setResending(true);
      const updated = await procurementApi.resendRFQInvite(selectedRFQ._id, sId, {
        email: resendEmail,
        phone: resendPhone,
        updateSupplier: resendUpdateSupplier,
      });
      setSelectedRFQ(updated);
      loadRFQs();
      success(`RFQ invitation successfully resent to ${resendingSupplier.supplierId?.name || 'supplier'}!`);
      setResendingSupplier(null);
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to resend RFQ invitation');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ArrowLeftRight className="w-6 h-6 text-purple-400" />
            Requests for Quotation (RFQ)
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Solicit formal bids from suppliers, track response deadlines, and compare quotes.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {can('purchase:create') && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition shadow-lg shadow-purple-600/25"
            >
              <Plus className="w-4 h-4" />
              Create RFQ
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 rounded-xl p-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search RFQ number or terms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadRFQs()}
              className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl pl-9 pr-3 py-2 placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
          <button
            onClick={loadRFQs}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 font-medium"
          >
            Filter
          </button>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
          {['', 'DRAFT', 'ISSUED', 'PARTIALLY_RESPONDED', 'FULLY_RESPONDED', 'CLOSED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {st === '' ? 'All RFQs' : st}
            </button>
          ))}
        </div>
      </div>

      {/* RFQ Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-sm">Loading RFQs...</div>
        ) : rfqs.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            No Requests for Quotation found. Click "Create RFQ" to invite suppliers.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">RFQ Number</th>
                  <th className="py-3.5 px-4">Source</th>
                  <th className="py-3.5 px-4">Response Deadline</th>
                  <th className="py-3.5 px-4">Invited Suppliers</th>
                  <th className="py-3.5 px-4">Response Progress</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {rfqs.map((rfq) => {
                  const totalSuppliers = rfq.suppliers?.length || 0;
                  const quotedSuppliers = rfq.suppliers?.filter((s) => s.status === 'QUOTED').length || 0;

                  return (
                    <tr
                      key={rfq._id}
                      onClick={() => setSelectedRFQ(rfq)}
                      className="hover:bg-slate-800/40 cursor-pointer transition"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-xs text-purple-400">
                        {rfq.rfqNumber}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-300">
                        {rfq.sourceType === 'PURCHASE_REQUISITION' ? (
                          <span className="text-indigo-400 font-mono">PR-Backed</span>
                        ) : (
                          <span className="text-slate-500">Manual / Direct</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400 font-mono">
                        {new Date(rfq.responseDeadline).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-xs text-white">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {rfq.suppliers?.slice(0, 2).map((s, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] border border-slate-700"
                            >
                              {s.supplierId?.name || 'Vendor'}
                            </span>
                          ))}
                          {totalSuppliers > 2 && (
                            <span className="text-[11px] text-slate-500">+{totalSuppliers - 2} more</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <span className="font-semibold text-slate-200">
                          {quotedSuppliers}/{totalSuppliers}
                        </span>{' '}
                        <span className="text-slate-500 text-[11px]">bids received</span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            rfq.status === 'FULLY_RESPONDED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : rfq.status === 'PARTIALLY_RESPONDED'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : rfq.status === 'ISSUED'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {rfq.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          to={`/purchase/quotes/compare/${rfq._id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-600/20 hover:bg-indigo-100 dark:hover:bg-indigo-600/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 text-xs font-semibold mr-2 transition"
                        >
                          Compare Quotes
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RFQ Details Modal */}
      {selectedRFQ && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs text-purple-400 font-mono font-semibold">RFQ Solicitation Details</span>
                <h2 className="text-xl font-bold text-white">{selectedRFQ.rfqNumber}</h2>
              </div>
              <button onClick={() => setSelectedRFQ(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400">Status</span>
                <p className="font-semibold text-purple-400 mt-0.5">{selectedRFQ.status}</p>
              </div>
              <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400">Response Deadline</span>
                <p className="font-semibold text-white mt-0.5">
                  {new Date(selectedRFQ.responseDeadline).toLocaleDateString()}
                </p>
              </div>
              <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400">Invited Vendors</span>
                <p className="font-semibold text-white mt-0.5">{selectedRFQ.suppliers?.length || 0} suppliers</p>
              </div>
              <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400">Line Items</span>
                <p className="font-semibold text-white mt-0.5">{selectedRFQ.items?.length || 0} items</p>
              </div>
            </div>

            {/* Invited Suppliers Table */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Invited Suppliers & Notification Status
              </h3>
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="p-2.5">Supplier Name</th>
                      <th className="p-2.5">Email Status</th>
                      <th className="p-2.5">SMS Status</th>
                      <th className="p-2.5">Quote Status</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {selectedRFQ.suppliers.map((s, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-medium text-white">
                          <div>{s.supplierId?.name || 'Supplier'}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{s.supplierId?.supplierCode || ''}</div>
                        </td>
                        <td className="p-2.5 text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span className="truncate max-w-[120px]">{s.supplierId?.email || s.contact || 'No Email'}</span>
                            {s.emailSent ? (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-semibold">Sent</span>
                            ) : selectedRFQ.status !== 'DRAFT' ? (
                              <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">Pending</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="p-2.5 text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="font-mono">{s.supplierId?.phone || 'No Phone'}</span>
                            {s.smsSent ? (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-semibold">Sent</span>
                            ) : selectedRFQ.status !== 'DRAFT' ? (
                              <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">Pending</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                              s.status === 'QUOTED'
                                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => openResendModal(s)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-600/20 dark:hover:bg-indigo-600/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 text-[11px] font-semibold inline-flex items-center gap-1 transition shadow-sm"
                            title="Resend invitation email & SMS with custom contacts"
                          >
                            <RefreshCw className="w-3 h-3 text-indigo-700 dark:text-indigo-300" />
                            <span className="text-indigo-700 dark:text-indigo-300">Resend</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-800">
              {selectedRFQ.status === 'DRAFT' && can('purchase:create') && (
                <button
                  onClick={openIssueModal}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-purple-600/25"
                >
                  <Send className="w-3.5 h-3.5" />
                  Issue RFQ & Send Email/SMS
                </button>
              )}

              <Link
                to={`/purchase/quotes/compare/${selectedRFQ._id}`}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/25"
              >
                <Sliders className="w-3.5 h-3.5" />
                Compare Vendor Quotations
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Issue RFQ Confirmation Modal */}
      {showIssueModal && selectedRFQ && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-purple-400" />
                Dispatch RFQ Invitations
              </h3>
              <button onClick={() => setShowIssueModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              You are about to formally issue <strong className="text-purple-400">RFQ #{selectedRFQ.rfqNumber}</strong>. Verify or update each supplier's contact details below to guarantee live delivery:
            </p>

            {/* Gateway Warning if not configured */}
            {gatewayStatus?.email?.status !== 'CONFIGURED' && (
              <div className="bg-rose-950/30 border border-rose-500/40 p-3 rounded-xl flex items-center justify-between gap-3 text-xs text-rose-300">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Live Email Gateway is not configured. Connect your Gmail to deliver real emails to inboxes.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGatewayModal(true)}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[11px] font-semibold shrink-0"
                >
                  Configure
                </button>
              </div>
            )}

            {/* Editable Suppliers List */}
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {selectedRFQ.suppliers.map((s, idx) => {
                const sId = (s.supplierId?._id || s.supplierId)?.toString();
                const contact = supplierContacts[sId] || { email: '', phone: '', updateSupplier: true };

                return (
                  <div key={idx} className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60 text-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-white">{s.supplierId?.name || 'Supplier'}</div>
                      <span className="text-[10px] text-slate-400 font-mono">{s.supplierId?.supplierCode || ''}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-0.5 flex items-center gap-1">
                          <Mail className="w-3 h-3 text-blue-400" />
                          Recipient Email
                        </label>
                        <input
                          type="email"
                          value={contact.email}
                          onChange={(e) =>
                            setSupplierContacts({
                              ...supplierContacts,
                              [sId]: { ...contact, email: e.target.value },
                            })
                          }
                          placeholder="e.g. supplier@gmail.com"
                          className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-0.5 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-emerald-400" />
                          Recipient Phone (SMS)
                        </label>
                        <input
                          type="text"
                          value={contact.phone}
                          onChange={(e) =>
                            setSupplierContacts({
                              ...supplierContacts,
                              [sId]: { ...contact, phone: e.target.value },
                            })
                          }
                          placeholder="e.g. +91 98765 43210"
                          className={`w-full bg-slate-900 border text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-purple-500 ${
                            !contact.phone ? 'border-amber-500/50' : 'border-slate-700'
                          }`}
                        />
                      </div>
                    </div>

                    {!contact.phone && (
                      <p className="text-[10px] text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        No phone number specified: SMS invite will be skipped for this supplier.
                      </p>
                    )}

                    <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer pt-0.5">
                      <input
                        type="checkbox"
                        checked={contact.updateSupplier}
                        onChange={(e) =>
                          setSupplierContacts({
                            ...supplierContacts,
                            [sId]: { ...contact, updateSupplier: e.target.checked },
                          })
                        }
                        className="rounded border-slate-700 bg-slate-900 text-purple-600"
                      />
                      Save updated contact to supplier profile
                    </label>
                  </div>
                );
              })}
            </div>

            <div className="bg-purple-950/30 border border-purple-800/40 p-2.5 rounded-xl text-[11px] text-purple-300">
              ℹ️ Deadline: <strong>{new Date(selectedRFQ.responseDeadline).toLocaleDateString()}</strong>. Technical specifications and commercial terms are attached in the dispatch.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowIssueModal(false)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmIssueRFQ}
                disabled={issuing}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-purple-600/30"
              >
                <Send className="w-3.5 h-3.5" />
                {issuing ? 'Sending Emails & SMS...' : `Confirm & Dispatch to ${selectedRFQ.suppliers.length} Supplier(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Creation Wizard */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-purple-400" />
                Create Request for Quotation (RFQ)
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="flex items-center gap-4 bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 font-semibold">RFQ Source:</span>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-200">
                  <input
                    type="radio"
                    name="source"
                    value="MANUAL"
                    checked={createSource === 'MANUAL'}
                    onChange={() => handleSourceChange('MANUAL')}
                  />
                  Manual / Direct Entry
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-200">
                  <input
                    type="radio"
                    name="source"
                    value="PURCHASE_REQUISITION"
                    checked={createSource === 'PURCHASE_REQUISITION'}
                    onChange={() => handleSourceChange('PURCHASE_REQUISITION')}
                  />
                  From Approved PR
                </label>
              </div>

              {createSource === 'PURCHASE_REQUISITION' && (
                <div className="space-y-2">
                  <Select
                    label="Select Approved Purchase Requisition"
                    value={selectedPRId}
                    onChange={(e) => handlePRSelection(e.target.value)}
                    placeholder="Select an Approved PR..."
                    variant="indigo"
                    options={approvedPRs.map((pr) => ({
                      value: pr._id,
                      label: `${pr.prNumber} - ${pr.purpose || 'Requisition'} (${pr.status.replace(/_/g, ' ')})`,
                      badge: pr.prNumber,
                      sublabel: `Status: ${pr.status.replace(/_/g, ' ')} | Items: ${pr.items?.length || 0} | Est: $${(pr.estimatedTotal || 0).toLocaleString()}`,
                    }))}
                  />
                  {approvedPRs.length === 0 && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>No approved purchase requisitions available. Ensure your Purchase Requisition has been approved or select <strong>Manual / Direct Entry</strong>.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Line Items Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-300 font-semibold text-xs uppercase tracking-wider">
                    {createSource === 'PURCHASE_REQUISITION' ? 'Requisition Line Items (Auto-loaded)' : 'RFQ Line Items'}
                  </label>
                  {createSource === 'MANUAL' && (
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          items: [
                            ...prev.items,
                            { itemId: itemsCatalog[0]?._id || '', quantity: 1, uomId: uoms[0]?._id || '', specifications: '' },
                          ],
                        }))
                      }
                      className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 rounded-lg flex items-center gap-1 transition"
                    >
                      <Plus className="w-3 h-3 text-indigo-700 dark:text-indigo-300" />
                      Add Item
                    </button>
                  )}
                </div>

                {createSource === 'PURCHASE_REQUISITION' && !selectedPRId ? (
                  <div className="p-3 text-center bg-slate-800/30 border border-dashed border-slate-700/60 rounded-xl text-slate-400 text-xs">
                    Please select an approved requisition above to populate procurement line items.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formData.items.map((item, idx) => {
                      const selectedItemObj = itemsCatalog.find(
                        (cat) => cat._id === item.itemId || cat.name === item.itemId
                      );

                      return (
                        <div
                          key={idx}
                          className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/70 flex flex-wrap sm:flex-nowrap items-center gap-2.5 transition-all"
                          style={{ position: 'relative', zIndex: 40 - idx }}
                        >
                          <div className="flex-1 min-w-[180px]">
                            {createSource === 'PURCHASE_REQUISITION' ? (
                              <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700/60 rounded-lg px-2.5 py-1.5 min-h-[36px]">
                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-purple-300 shrink-0">
                                  {selectedItemObj?.sku || 'ITEM'}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <span className="font-semibold text-white block truncate text-xs">
                                    {selectedItemObj?.name || (typeof item.itemId === 'object' ? (item.itemId as any)?.name : 'Requisition Item')}
                                  </span>
                                  {item.specifications && (
                                    <span className="text-[10px] text-slate-400 block truncate">
                                      {item.specifications}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <Select
                                size="sm"
                                variant="indigo"
                                placeholder="Select Item..."
                                value={item.itemId}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const itm = itemsCatalog.find((c) => c._id === val);
                                  const newItems = [...formData.items];
                                  const uId =
                                    (typeof itm?.uomId === 'object' ? (itm.uomId as any)?._id : itm?.uomId) ||
                                    (typeof itm?.baseUomId === 'object' ? (itm.baseUomId as any)?._id : itm?.baseUomId) ||
                                    newItems[idx].uomId ||
                                    uoms[0]?._id ||
                                    '';
                                  newItems[idx] = {
                                    ...newItems[idx],
                                    itemId: val,
                                    uomId: uId,
                                  };
                                  setFormData({ ...formData, items: newItems });
                                }}
                                options={itemsCatalog.map((c) => ({
                                  value: c._id,
                                  label: `${c.name} (${c.sku || c.code || 'ITEM'})`,
                                  badge: c.sku || c.code,
                                  sublabel: c.description || undefined,
                                }))}
                              />
                            )}
                          </div>

                          <div className="w-24 shrink-0">
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              value={item.quantity}
                              onChange={(e) => {
                                const newItems = [...formData.items];
                                newItems[idx].quantity = Math.max(0, parseFloat(e.target.value) || 0);
                                setFormData({ ...formData, items: newItems });
                              }}
                              placeholder="Qty"
                              required
                              className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 text-white rounded-lg px-2.5 py-1.5 text-xs text-right font-mono min-h-[36px] outline-none transition"
                            />
                          </div>

                          <div className="w-28 shrink-0">
                            {createSource === 'PURCHASE_REQUISITION' ? (
                              <div className="bg-slate-900/80 border border-slate-700/60 rounded-lg px-2.5 py-1.5 min-h-[36px] flex items-center justify-center font-mono text-xs text-slate-300">
                                {uoms.find((u) => u._id === item.uomId)?.symbol ||
                                  uoms.find((u) => u._id === item.uomId)?.code ||
                                  'Unit'}
                              </div>
                            ) : (
                              <Select
                                size="sm"
                                variant="indigo"
                                placeholder="UOM"
                                value={item.uomId}
                                onChange={(e) => {
                                  const newItems = [...formData.items];
                                  newItems[idx].uomId = e.target.value;
                                  setFormData({ ...formData, items: newItems });
                                }}
                                options={uoms.map((u) => ({
                                  value: u._id,
                                  label: `${u.symbol || u.code || u.name} (${u.name})`,
                                  badge: u.symbol || u.code,
                                }))}
                              />
                            )}
                          </div>

                          {formData.items.length > 1 && createSource === 'MANUAL' && (
                            <button
                              type="button"
                              onClick={() => {
                                const newItems = formData.items.filter((_, i) => i !== idx);
                                setFormData({ ...formData, items: newItems });
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition shrink-0"
                              title="Remove item"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Response Deadline</label>
                  <input
                    type="date"
                    value={formData.responseDeadline}
                    onChange={(e) => setFormData({ ...formData, responseDeadline: e.target.value })}
                    required
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Target Delivery Date</label>
                  <input
                    type="date"
                    value={formData.requestedDeliveryDate}
                    onChange={(e) => setFormData({ ...formData, requestedDeliveryDate: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              {/* Suppliers Multi-Select */}
              <div>
                <label className="block text-slate-400 mb-1.5">Invite Suppliers to Bid (Select All that Apply)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                  {suppliers.map((s) => {
                    const isSelected = formData.selectedSupplierIds.includes(s._id);
                    return (
                      <div
                        key={s._id}
                        onClick={() => toggleSupplier(s._id)}
                        className={`p-2 rounded-lg cursor-pointer border text-xs flex items-center justify-between transition ${
                          isSelected
                            ? 'bg-purple-50 dark:bg-purple-600/20 border-purple-300 dark:border-purple-500 text-purple-900 dark:text-white'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <div>
                          <p className="font-semibold">{s.name}</p>
                          <span className="text-[10px] text-slate-400 font-mono">{s.supplierCode}</span>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-purple-400" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Terms and Notes */}
              <div>
                <label className="block text-slate-400 mb-1">Commercial Terms & Conditions</label>
                <input
                  type="text"
                  value={formData.terms}
                  onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-700 dark:text-slate-400 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm shadow-md shadow-purple-600/30 transition-all cursor-pointer"
                >
                  Create & Save RFQ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resend Invitation Modal */}
      {resendingSupplier && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-indigo-400" />
                Resend RFQ Invitation
              </h3>
              <button onClick={() => setResendingSupplier(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Resend RFQ <strong className="text-purple-400">#{selectedRFQ?.rfqNumber}</strong> invitation to{' '}
              <strong className="text-white">{resendingSupplier.supplierId?.name || 'Supplier'}</strong>:
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-blue-400" />
                  Recipient Email Address
                </label>
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="e.g. supplier@gmail.com"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  Recipient Phone Number (SMS)
                </label>
                <input
                  type="text"
                  value={resendPhone}
                  onChange={(e) => setResendPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <label className="flex items-center gap-2 text-slate-400 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={resendUpdateSupplier}
                  onChange={(e) => setResendUpdateSupplier(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-indigo-600"
                />
                Save phone & email permanently to supplier profile
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setResendingSupplier(null)}
                className="px-4 py-2 text-slate-400 hover:bg-slate-800 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResend}
                disabled={resending}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
              >
                <Send className="w-3.5 h-3.5" />
                {resending ? 'Sending...' : 'Send Live Invite Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Gateway Settings Modal */}
      <NotificationGatewayModal
        isOpen={showGatewayModal}
        onClose={() => setShowGatewayModal(false)}
        onSaved={loadGatewayStatus}
      />
    </div>
  );
};
