import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Send,
  Calendar,
  AlertTriangle,
  Building2,
  Warehouse as WarehouseIcon,
  X,
  ExternalLink,
  Printer,
  Download,
  RefreshCw,
  PackageCheck,
  AlertCircle,
  Truck,
  ArrowRight,
  Ban,
  Clock,
  Layers,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { procurementApi, PurchaseRequisition, PRItem } from '../../api/procurement.api';
import { itemApi, Item } from '../../api/item.api';
import { warehouseApi, Warehouse } from '../../api/warehouse.api';
import { masterDataApi, Department, UOM } from '../../api/masterData.api';
import { inventoryApi } from '../../api/inventory.api';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../context/ToastContext';
import { Select } from '../../components/ui/Select';

export const PurchaseRequisitionsPage: React.FC = () => {
  const { can } = usePermissions();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  const [prs, setPRs] = useState<PurchaseRequisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPR, setSelectedPR] = useState<PurchaseRequisition | null>(null);

  // Creation Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [itemsCatalog, setItemsCatalog] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [uoms, setUOMs] = useState<UOM[]>([]);
  const [itemStocks, setItemStocks] = useState<Record<string, number>>({});
  const [prereqLoading, setPrereqLoading] = useState(false);
  const [isSubmittingPR, setIsSubmittingPR] = useState(false);

  // Approval Modal State (Supports Partial Approval & Comments)
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');
  const [approvedQuantities, setApprovedQuantities] = useState<Record<string, number>>({});
  const [isApproving, setIsApproving] = useState(false);

  // Stock Issue Modal State
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueQuantities, setIssueQuantities] = useState<Record<string, number>>({});
  const [issueRemarks, setIssueRemarks] = useState('');
  const [isIssuingStock, setIsIssuingStock] = useState(false);

  // Stock Availability Checking State
  const [isCheckingStock, setIsCheckingStock] = useState(false);

  // Rejection Modal State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Cancellation Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // PDF Print Modal State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printPR, setPrintPR] = useState<PurchaseRequisition | null>(null);

  const [attachmentUrl, setAttachmentUrl] = useState('');

  const [formData, setFormData] = useState({
    warehouseId: '',
    departmentId: '',
    requiredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    priority: 'MEDIUM',
    purpose: '',
    notes: '',
    items: [{ itemId: '', requestedQuantity: 1, uomId: '', estimatedUnitPrice: 0, remarks: '' }],
  });

  useEffect(() => {
    loadPRs();
  }, [statusFilter, priorityFilter, warehouseFilter]);

  useEffect(() => {
    loadPrerequisites();
  }, []);

  useEffect(() => {
    if (formData.warehouseId) {
      loadWarehouseStocks(formData.warehouseId);
    }
  }, [formData.warehouseId]);

  const loadPRs = async () => {
    try {
      setLoading(true);
      const res = await procurementApi.getPRs({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        warehouseId: warehouseFilter || undefined,
        search: searchTerm || undefined,
      });
      setPRs(res.data || []);
    } catch (err) {
      console.error('Failed to load PRs', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPrerequisites = async () => {
    try {
      setPrereqLoading(true);
      const [itemsRes, whsRes, deptsRes, uomsRes] = await Promise.all([
        itemApi.getItems({ limit: 200 }),
        warehouseApi.getWarehouses(),
        masterDataApi.getDepartments(),
        masterDataApi.getUOMs(),
      ]);

      const itemsList = Array.isArray(itemsRes) ? itemsRes : (itemsRes as any)?.data || [];
      const whList = Array.isArray(whsRes) ? whsRes : (whsRes as any)?.data || [];
      const deptList = Array.isArray(deptsRes) ? deptsRes : (deptsRes as any)?.data || [];
      const uomList = Array.isArray(uomsRes) ? uomsRes : (uomsRes as any)?.data || [];

      setItemsCatalog(itemsList);
      setWarehouses(whList);
      setDepartments(deptList);
      setUOMs(uomList);

      const defaultWh = whList[0]?._id || '';
      const defaultDept = deptList[0]?._id || '';
      const defaultUom = uomList[0]?._id || '';

      setFormData((prev) => ({
        ...prev,
        warehouseId: prev.warehouseId || defaultWh,
        departmentId: prev.departmentId || defaultDept,
        items: prev.items.map((it) => ({
          ...it,
          uomId: it.uomId || defaultUom,
        })),
      }));

      if (defaultWh) {
        loadWarehouseStocks(defaultWh);
      }
    } catch (err) {
      console.error('Failed to load prerequisites', err);
    } finally {
      setPrereqLoading(false);
    }
  };

  const loadWarehouseStocks = async (whId: string) => {
    if (!whId) {
      setItemStocks({});
      return;
    }
    try {
      const res = await inventoryApi.getBalances({ warehouseId: whId, limit: 500 });
      const balances = Array.isArray(res) ? res : (res as any)?.data || [];
      const stocks: Record<string, number> = {};
      balances.forEach((b: any) => {
        const itmId =
          b.item?.id ||
          b.item?._id ||
          (typeof b.itemId === 'object' ? (b.itemId?._id || b.itemId?.id) : b.itemId);
        if (itmId) {
          const idStr = String(itmId);
          const avail = Number(b.availableQuantity ?? b.quantity ?? 0);
          stocks[idStr] = (stocks[idStr] || 0) + avail;
        }
      });
      setItemStocks(stocks);
    } catch (err) {
      console.error('Failed to load warehouse stocks', err);
    }
  };

  const handleWarehouseChange = (whId: string) => {
    setFormData((prev) => ({ ...prev, warehouseId: whId }));
    if (whId) {
      loadWarehouseStocks(whId);
    }
  };

  const openCreateModal = () => {
    loadPrerequisites();
    setShowCreateModal(true);
    if (formData.warehouseId) {
      loadWarehouseStocks(formData.warehouseId);
    }
  };

  const handleOpenPrint = (pr: PurchaseRequisition) => {
    setPrintPR(pr);
    setShowPrintModal(true);
  };

  const handleAddItemRow = () => {
    const defaultUom = uoms[0]?._id || (uoms[0] as any)?.id || '';
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { itemId: '', requestedQuantity: 1, uomId: defaultUom, estimatedUnitPrice: 0, remarks: '' },
      ],
    }));
  };

  const handleRemoveItemRow = (index: number) => {
    if (formData.items.length === 1) return;
    const updated = [...formData.items];
    updated.splice(index, 1);
    setFormData({ ...formData, items: updated });
  };

  const handleItemSelect = (index: number, itemId: string) => {
    if (!itemId) {
      const updated = [...formData.items];
      updated[index].itemId = '';
      setFormData({ ...formData, items: updated });
      return;
    }

    // Check duplicate
    const isDuplicate = formData.items.some((it, i) => i !== index && String(it.itemId) === String(itemId));
    if (isDuplicate) {
      toastError('This item is already added to the requisition. Please adjust the quantity on the existing line.');
      return;
    }

    const selected = itemsCatalog.find((i) => String(i._id || (i as any).id) === String(itemId));
    const updated = [...formData.items];
    updated[index].itemId = itemId;
    if (selected) {
      updated[index].estimatedUnitPrice = selected.standardCost ?? (selected as any).purchasePrice ?? 0;
      updated[index].remarks = selected.description || '';
      const baseUomId = typeof selected.baseUomId === 'object' ? (selected.baseUomId as any)?._id || (selected.baseUomId as any)?.id : selected.baseUomId;
      if (baseUomId && uoms.some((u) => String(u._id || (u as any).id) === String(baseUomId))) {
        updated[index].uomId = String(baseUomId);
      } else if (uoms.length > 0) {
        updated[index].uomId = String(uoms[0]._id || (uoms[0] as any).id);
      }
    }
    setFormData({ ...formData, items: updated });
  };

  const handleCreateSubmit = async (e: React.FormEvent, submitDirectly = false) => {
    e.preventDefault();
    if (isSubmittingPR) return;

    if (!formData.warehouseId) {
      toastError('Please select a destination warehouse');
      return;
    }

    const preparedItems = formData.items.map((it) => {
      let uomId = it.uomId;
      if (!uomId && uoms.length > 0) {
        uomId = uoms[0]._id;
      }
      return {
        ...it,
        uomId: uomId || undefined,
        requestedQuantity: Number(it.requestedQuantity) || 1,
        estimatedUnitPrice: Number(it.estimatedUnitPrice) || 0,
      };
    });

    const hasInvalidItem = preparedItems.some((it) => !it.itemId);
    if (hasInvalidItem) {
      toastError('Please select a valid catalog item for each line');
      return;
    }

    const hasInvalidQty = preparedItems.some((it) => it.requestedQuantity <= 0);
    if (hasInvalidQty) {
      toastError('Quantity must be greater than 0 for all items');
      return;
    }

    try {
      setIsSubmittingPR(true);
      const payload: any = {
        ...formData,
        items: preparedItems,
        notes: formData.notes || formData.purpose,
        attachments: attachmentUrl.trim() ? [attachmentUrl.trim()] : undefined,
      };

      const res = await procurementApi.createPR(payload);

      if (submitDirectly && res?._id) {
        try {
          await procurementApi.submitPR(res._id);
          success(`Requisition ${res.prNumber || ''} created and submitted for approval! Stock is unaffected.`);
        } catch (subErr) {
          success(`Requisition ${res.prNumber || ''} saved as draft. Stock is unaffected.`);
        }
      } else {
        success(`Requisition ${res.prNumber || ''} saved as draft. Stock is unaffected.`);
      }

      setShowCreateModal(false);
      setFormData({
        warehouseId: warehouses[0]?._id || '',
        departmentId: departments[0]?._id || '',
        requiredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        priority: 'MEDIUM',
        purpose: '',
        notes: '',
        items: [{ itemId: '', requestedQuantity: 1, uomId: uoms[0]?._id || '', estimatedUnitPrice: 0, remarks: '' }],
      });
      setAttachmentUrl('');
      loadPRs();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to create requisition');
    } finally {
      setIsSubmittingPR(false);
    }
  };

  const handleSubmitPR = async (id: string) => {
    try {
      await procurementApi.submitPR(id);
      success('Requisition submitted for approval. Stock balance is unchanged.');
      loadPRs();
      if (selectedPR?._id === id) {
        const updated = await procurementApi.getPRById(id);
        setSelectedPR(updated);
      }
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to submit PR');
    }
  };

  const openApproveModal = (pr: PurchaseRequisition) => {
    setSelectedPR(pr);
    setApprovalComment('');
    const initialApproved: Record<string, number> = {};
    pr.items.forEach((it) => {
      const itmId = typeof it.itemId === 'object' ? it.itemId?._id : it.itemId;
      initialApproved[itmId] = it.approvedQuantity && it.approvedQuantity > 0 ? it.approvedQuantity : it.requestedQuantity;
    });
    setApprovedQuantities(initialApproved);
    setShowApproveModal(true);
  };

  const handleConfirmApproval = async () => {
    if (!selectedPR) return;
    try {
      setIsApproving(true);
      const itemsPayload = selectedPR.items.map((it) => {
        const itmId = typeof it.itemId === 'object' ? it.itemId?._id : it.itemId;
        return {
          itemId: itmId,
          approvedQuantity: approvedQuantities[itmId] !== undefined ? approvedQuantities[itmId] : it.requestedQuantity,
        };
      });

      await procurementApi.approvePR(selectedPR._id, {
        approvalComment: approvalComment.trim() || undefined,
        items: itemsPayload,
      });

      success('Requisition approved! Inventory stock remains unchanged until stock is issued.');
      setShowApproveModal(false);
      loadPRs();
      const updated = await procurementApi.getPRById(selectedPR._id);
      setSelectedPR(updated);
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to approve requisition');
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectPR = async () => {
    if (!selectedPR || !rejectionReason.trim()) {
      toastError('Rejection reason is mandatory');
      return;
    }
    try {
      setIsRejecting(true);
      await procurementApi.rejectPR(selectedPR._id, rejectionReason.trim());
      setShowRejectModal(false);
      setRejectionReason('');
      success('Requisition rejected. No inventory stock was touched.');
      loadPRs();
      const updated = await procurementApi.getPRById(selectedPR._id);
      setSelectedPR(updated);
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to reject PR');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleCancelPR = async () => {
    if (!selectedPR || !cancellationReason.trim()) {
      toastError('Cancellation reason is mandatory');
      return;
    }
    try {
      setIsCancelling(true);
      await procurementApi.cancelPR(selectedPR._id, cancellationReason.trim());
      setShowCancelModal(false);
      setCancellationReason('');
      success('Requisition cancelled.');
      loadPRs();
      const updated = await procurementApi.getPRById(selectedPR._id);
      setSelectedPR(updated);
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to cancel requisition');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCheckAvailability = async (id: string) => {
    try {
      setIsCheckingStock(true);
      const res = await procurementApi.checkPRAvailability(id);
      if (res?.isFullyAvailable) {
        success('Stock Availability Check: 100% stock available in warehouse! Ready for Stock Issue.');
      } else {
        toastError('Stock Availability Check: Shortage detected for some items. Purchase replenishment may be required.');
      }
      setSelectedPR(res.pr);
      loadPRs();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to check stock availability');
    } finally {
      setIsCheckingStock(false);
    }
  };

  const openStockIssueModal = (pr: PurchaseRequisition) => {
    setSelectedPR(pr);
    setIssueRemarks('');
    const initialIssues: Record<string, number> = {};
    pr.items.forEach((it) => {
      const itmId = typeof it.itemId === 'object' ? it.itemId?._id : it.itemId;
      const targetQty = it.approvedQuantity && it.approvedQuantity > 0 ? it.approvedQuantity : it.requestedQuantity;
      const remainingNeeded = Math.max(0, targetQty - (it.issuedQuantity || 0));
      const avail = it.availableQuantityAtCheck !== undefined ? it.availableQuantityAtCheck : (itemStocks[itmId] || 0);
      initialIssues[itmId] = Math.min(remainingNeeded, avail);
    });
    setIssueQuantities(initialIssues);
    setShowIssueModal(true);
  };

  const handleConfirmStockIssue = async () => {
    if (!selectedPR) return;

    const itemsToIssue = Object.entries(issueQuantities)
      .filter(([_, qty]) => Number(qty) > 0)
      .map(([itemId, quantity]) => ({
        itemId,
        quantity: Number(quantity),
      }));

    if (itemsToIssue.length === 0) {
      toastError('Please enter a valid quantity greater than zero for at least one item');
      return;
    }

    try {
      setIsIssuingStock(true);
      const updatedPr = await procurementApi.issuePRStock(selectedPR._id, {
        itemsToIssue,
        remarks: issueRemarks.trim() || undefined,
      });

      success(`Stock issued successfully! Warehouse balance decremented and recorded in Transaction Ledger.`);
      setShowIssueModal(false);
      loadPRs();
      setSelectedPR(updatedPr);
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to issue stock');
    } finally {
      setIsIssuingStock(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">Draft</span>;
      case 'SUBMITTED':
      case 'PENDING_APPROVAL':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">Pending Approval</span>;
      case 'APPROVED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Approved</span>;
      case 'PARTIALLY_APPROVED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500/15 text-teal-400 border border-teal-500/30">Partially Approved</span>;
      case 'PARTIALLY_AVAILABLE':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">Partially Available</span>;
      case 'PURCHASE_REQUIRED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/30">Purchase Required</span>;
      case 'PARTIALLY_ISSUED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">Partially Issued</span>;
      case 'ISSUED':
      case 'FULFILLED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">Fulfilled</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">Rejected</span>;
      case 'CANCELLED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700/50 text-slate-400 border border-slate-700">Cancelled</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">{status}</span>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">Urgent</span>;
      case 'HIGH':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">High</span>;
      case 'LOW':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">Low</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Normal</span>;
    }
  };

  // Metrics counts
  const totalCount = prs.length;
  const pendingCount = prs.filter((p) => p.status === 'SUBMITTED' || p.status === 'PENDING_APPROVAL').length;
  const approvedCount = prs.filter((p) => p.status === 'APPROVED' || p.status === 'PARTIALLY_APPROVED').length;
  const shortageCount = prs.filter((p) => p.status === 'PARTIALLY_AVAILABLE' || p.status === 'PURCHASE_REQUIRED').length;
  const fulfilledCount = prs.filter((p) => p.status === 'FULFILLED' || p.status === 'ISSUED').length;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-indigo-400" />
            Requisition Management Module
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Internal material requests, multi-tier approvals, live stock checks, atomic warehouse issue & ledger tracing.
          </p>
        </div>

        {can('purchase:create') && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-lg shadow-indigo-600/25 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Create Requisition
          </button>
        )}
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
          <div className="text-xs text-slate-400 font-medium">Total Requisitions</div>
          <div className="text-2xl font-bold text-white mt-1">{totalCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">All time records</div>
        </div>

        <div className="bg-slate-900/80 border border-blue-500/20 p-3.5 rounded-xl">
          <div className="text-xs text-blue-400 font-medium flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Pending Approval
          </div>
          <div className="text-2xl font-bold text-blue-300 mt-1">{pendingCount}</div>
          <div className="text-[11px] text-blue-400/70 mt-0.5">Awaiting manager review</div>
        </div>

        <div className="bg-slate-900/80 border border-emerald-500/20 p-3.5 rounded-xl">
          <div className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approved
          </div>
          <div className="text-2xl font-bold text-emerald-300 mt-1">{approvedCount}</div>
          <div className="text-[11px] text-emerald-400/70 mt-0.5">Stock untouched (Ready)</div>
        </div>

        <div className="bg-slate-900/80 border border-orange-500/20 p-3.5 rounded-xl">
          <div className="text-xs text-orange-400 font-medium flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Shortage / Purchase
          </div>
          <div className="text-2xl font-bold text-orange-300 mt-1">{shortageCount}</div>
          <div className="text-[11px] text-orange-400/70 mt-0.5">Procurement needed</div>
        </div>

        <div className="bg-slate-900/80 border border-cyan-500/20 p-3.5 rounded-xl">
          <div className="text-xs text-cyan-400 font-medium flex items-center gap-1.5">
            <PackageCheck className="w-3.5 h-3.5" />
            Fulfilled & Issued
          </div>
          <div className="text-2xl font-bold text-cyan-300 mt-1">{fulfilledCount}</div>
          <div className="text-[11px] text-cyan-400/70 mt-0.5">Ledger movements posted</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search REQ number, product, purpose..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadPRs()}
              className="w-full bg-slate-800/90 border border-slate-700 text-white text-xs rounded-xl pl-9 pr-3 py-2 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Warehouse and Priority Filters */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="w-48">
              <Select
                size="sm"
                variant="indigo"
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
                placeholder="All Warehouses"
                options={[
                  { value: '', label: 'All Warehouses' },
                  ...warehouses.map((wh) => ({
                    value: wh._id,
                    label: `${wh.name} (${wh.code})`,
                    badge: wh.code,
                  })),
                ]}
              />
            </div>

            <div className="w-44">
              <Select
                size="sm"
                variant="indigo"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                placeholder="All Priorities"
                options={[
                  { value: '', label: 'All Priorities' },
                  { value: 'URGENT', label: 'Urgent', badge: 'URGENT' },
                  { value: 'HIGH', label: 'High', badge: 'HIGH' },
                  { value: 'MEDIUM', label: 'Medium / Normal', badge: 'MEDIUM' },
                  { value: 'LOW', label: 'Low', badge: 'LOW' },
                ]}
              />
            </div>

            <button
              onClick={loadPRs}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-xl font-medium transition flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {/* Status Horizontal Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 border-t border-slate-800/60 scrollbar-none">
          {[
            { key: '', label: 'All' },
            { key: 'DRAFT', label: 'Drafts' },
            { key: 'PENDING_APPROVAL', label: 'Pending Approval' },
            { key: 'APPROVED', label: 'Approved' },
            { key: 'PARTIALLY_AVAILABLE', label: 'Partially Available' },
            { key: 'PURCHASE_REQUIRED', label: 'Purchase Required' },
            { key: 'PARTIALLY_ISSUED', label: 'Partially Issued' },
            { key: 'FULFILLED', label: 'Fulfilled' },
            { key: 'REJECTED', label: 'Rejected' },
            { key: 'CANCELLED', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                statusFilter === tab.key
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Requisitions Main Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-20 text-center text-slate-500 text-sm flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
            Loading real requisition records...
          </div>
        ) : prs.length === 0 ? (
          <div className="py-20 text-center text-slate-500 text-sm space-y-2">
            <FileText className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-white font-medium">No requisitions found</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Create a new requisition to officially request inventory items from a warehouse without decreasing stock.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Requisition No.</th>
                  <th className="py-3.5 px-4">Requested By</th>
                  <th className="py-3.5 px-4">Warehouse</th>
                  <th className="py-3.5 px-4">Items</th>
                  <th className="py-3.5 px-4">Required Date</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {prs.map((pr) => {
                  const itemCount = pr.items?.length || 0;
                  const totalRequested = pr.items?.reduce((s, it) => s + (it.requestedQuantity || 0), 0) || 0;
                  const totalIssued = pr.items?.reduce((s, it) => s + (it.issuedQuantity || 0), 0) || 0;

                  return (
                    <tr
                      key={pr._id}
                      onClick={() => setSelectedPR(pr)}
                      className="hover:bg-slate-800/40 cursor-pointer transition"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-xs text-indigo-400 flex items-center gap-1.5">
                          {pr.prNumber}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(pr.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-white">
                        <div className="font-medium text-xs">{pr.requesterId?.name || 'Staff User'}</div>
                        <div className="text-[11px] text-slate-500">{pr.departmentId?.name || 'General Dept'}</div>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-300">
                        <div className="flex items-center gap-1">
                          <WarehouseIcon className="w-3.5 h-3.5 text-slate-500" />
                          <span>{pr.warehouseId?.name || 'Warehouse'}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">Code: {pr.warehouseId?.code || 'WH'}</span>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-300">
                        <div className="font-medium text-slate-200">
                          {itemCount} {itemCount === 1 ? 'Product' : 'Products'} ({totalRequested} units)
                        </div>
                        {totalIssued > 0 && (
                          <div className="text-[11px] text-cyan-400">
                            Issued: {totalIssued} / {totalRequested}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {new Date(pr.requiredDate).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4">
                        {getPriorityBadge(pr.priority)}
                      </td>

                      <td className="py-3.5 px-4">
                        {getStatusBadge(pr.status)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {/* Stock Issue Action Shortcut if approved */}
                          {['APPROVED', 'PARTIALLY_APPROVED', 'PARTIALLY_AVAILABLE', 'PARTIALLY_ISSUED', 'PURCHASE_REQUIRED'].includes(pr.status) && can('inventory:issue') && (
                            <button
                              type="button"
                              onClick={() => openStockIssueModal(pr)}
                              title="Issue Stock from Warehouse"
                              className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold border border-emerald-500/30 flex items-center gap-1 transition"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              Issue
                            </button>
                          )}

                          {/* Approval shortcut if submitted */}
                          {(pr.status === 'SUBMITTED' || pr.status === 'PENDING_APPROVAL') && can('purchase:approve') && (
                            <button
                              type="button"
                              onClick={() => openApproveModal(pr)}
                              title="Review & Approve"
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 transition"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Approve
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenPrint(pr)}
                            title="Print / Save PDF"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition"
                          >
                            <Printer className="w-3.5 h-3.5 text-indigo-400" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedPR(pr)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
                          >
                            Inspect
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 28. REQUISITION DETAILS DRAWER / MODAL                         */}
      {/* ============================================================== */}
      {selectedPR && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xl font-bold font-mono text-indigo-400">{selectedPR.prNumber}</span>
                  {getStatusBadge(selectedPR.status)}
                  {getPriorityBadge(selectedPR.priority)}
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                  <span>Created: {new Date(selectedPR.createdAt).toLocaleString()}</span>
                  <span>&bull;</span>
                  <span>Required Delivery: {new Date(selectedPR.requiredDate).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedPR(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Visual Lifecycle Stepper */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                Requisition Lifecycle
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                <div className={`p-2 rounded-lg border ${
                  selectedPR.status === 'DRAFT'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-bold'
                    : 'bg-slate-800/50 border-slate-700/60 text-slate-300'
                }`}>
                  1. Draft
                </div>

                <div className={`p-2 rounded-lg border ${
                  selectedPR.status === 'SUBMITTED' || selectedPR.status === 'PENDING_APPROVAL'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-bold'
                    : selectedPR.submittedAt
                    ? 'bg-slate-800/50 border-slate-700/60 text-slate-300'
                    : 'bg-slate-900 border-slate-800 text-slate-600'
                }`}>
                  2. Pending Review
                </div>

                <div className={`p-2 rounded-lg border ${
                  selectedPR.status === 'APPROVED' || selectedPR.status === 'PARTIALLY_APPROVED'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 font-bold'
                    : selectedPR.approvedAt
                    ? 'bg-slate-800/50 border-slate-700/60 text-slate-300'
                    : 'bg-slate-900 border-slate-800 text-slate-600'
                }`}>
                  3. Approved
                </div>

                <div className={`p-2 rounded-lg border ${
                  selectedPR.status === 'PARTIALLY_AVAILABLE' || selectedPR.status === 'PURCHASE_REQUIRED'
                    ? 'bg-orange-600/20 border-orange-500 text-orange-300 font-bold'
                    : selectedPR.items.some((it) => (it.availableQuantityAtCheck || 0) > 0)
                    ? 'bg-slate-800/50 border-slate-700/60 text-slate-300'
                    : 'bg-slate-900 border-slate-800 text-slate-600'
                }`}>
                  4. Stock Check
                </div>

                <div className={`p-2 rounded-lg border ${
                  selectedPR.status === 'FULFILLED' || selectedPR.status === 'ISSUED'
                    ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300 font-bold'
                    : selectedPR.status === 'PARTIALLY_ISSUED'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-600'
                }`}>
                  5. Stock Issued
                </div>
              </div>
            </div>

            {/* Request Information Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400">Requester</span>
                <p className="font-semibold text-white mt-1">{selectedPR.requesterId?.name || 'Staff User'}</p>
                <p className="text-[11px] text-slate-500">{selectedPR.requesterId?.email || ''}</p>
              </div>

              <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400">Requesting Department</span>
                <p className="font-semibold text-white mt-1">{selectedPR.departmentId?.name || 'General Operations'}</p>
                <p className="text-[11px] text-slate-500">Code: {selectedPR.departmentId?.code || 'DEPT'}</p>
              </div>

              <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400">Destination Facility</span>
                <p className="font-semibold text-white mt-1">{selectedPR.warehouseId?.name || 'Warehouse'}</p>
                <p className="text-[11px] text-slate-500">Code: {selectedPR.warehouseId?.code || 'WH'}</p>
              </div>

              <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400">Required Date</span>
                <p className="font-semibold text-white mt-1">{new Date(selectedPR.requiredDate).toLocaleDateString()}</p>
                <p className="text-[11px] text-amber-400">Priority: {selectedPR.priority}</p>
              </div>
            </div>

            {/* Business Purpose and Notes */}
            {(selectedPR.purpose || selectedPR.notes) && (
              <div className="bg-slate-800/30 p-3.5 rounded-xl border border-slate-800/60 text-xs space-y-1">
                <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  Purpose & Operational Reason:
                </span>
                <p className="text-slate-200">{selectedPR.purpose || selectedPR.notes}</p>
              </div>
            )}

            {/* Rejection / Cancellation Info Banners */}
            {selectedPR.status === 'REJECTED' && (
              <div className="bg-rose-500/10 border border-rose-500/30 p-3.5 rounded-xl text-xs space-y-1">
                <div className="text-rose-400 font-bold flex items-center gap-1.5">
                  <XCircle className="w-4 h-4" />
                  Requisition Rejected
                </div>
                <div className="text-slate-300">
                  <span className="text-slate-400">Reason: </span>
                  {selectedPR.rejectionReason}
                </div>
                {selectedPR.rejectedBy && (
                  <div className="text-[11px] text-slate-500">
                    By: {selectedPR.rejectedBy.name || 'Manager'} on {selectedPR.rejectedAt ? new Date(selectedPR.rejectedAt).toLocaleString() : ''}
                  </div>
                )}
              </div>
            )}

            {selectedPR.status === 'CANCELLED' && (
              <div className="bg-slate-800 border border-slate-700 p-3.5 rounded-xl text-xs space-y-1">
                <div className="text-slate-300 font-bold flex items-center gap-1.5">
                  <Ban className="w-4 h-4 text-slate-400" />
                  Requisition Cancelled
                </div>
                <div className="text-slate-400">
                  <span className="text-slate-500">Reason: </span>
                  {selectedPR.cancellationReason || 'User requested cancellation'}
                </div>
              </div>
            )}

            {/* Approval Comment */}
            {selectedPR.approvalComment && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-xs">
                <span className="text-emerald-400 font-semibold">Approver Remarks: </span>
                <span className="text-slate-200">{selectedPR.approvalComment}</span>
                {selectedPR.approvedBy && (
                  <span className="text-slate-500 block text-[11px] mt-0.5">
                    Authorized by: {selectedPR.approvedBy.name} on {selectedPR.approvedAt ? new Date(selectedPR.approvedAt).toLocaleString() : ''}
                  </span>
                )}
              </div>
            )}

            {/* Product Table with Quantity Tracking */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Product Item Breakdown ({selectedPR.items?.length || 0})
                </h3>

                {/* Live Stock Check Button */}
                <button
                  type="button"
                  onClick={() => handleCheckAvailability(selectedPR._id)}
                  disabled={isCheckingStock}
                  className="px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-600/20 dark:hover:bg-indigo-600/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-indigo-700 dark:text-indigo-300 ${isCheckingStock ? 'animate-spin' : ''}`} />
                  {isCheckingStock ? 'Checking Stock...' : 'Check Warehouse Availability'}
                </button>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[760px]">
                  <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold">
                    <tr>
                      <th className="p-3 min-w-[160px]">Product (SKU)</th>
                      <th className="p-3 text-right whitespace-nowrap min-w-[90px]">Requested</th>
                      <th className="p-3 text-right whitespace-nowrap min-w-[90px]">Approved</th>
                      <th className="p-3 text-right whitespace-nowrap min-w-[110px] text-emerald-400">In Warehouse</th>
                      <th className="p-3 text-right whitespace-nowrap min-w-[80px] text-cyan-400">Issued</th>
                      <th
                        className="p-3 text-right whitespace-nowrap min-w-[130px] text-indigo-400 cursor-help"
                        title="Quantity remaining to be issued from warehouse to fulfill this requisition (Approved - Issued)"
                      >
                        Remaining to Issue
                      </th>
                      <th className="p-3 text-right whitespace-nowrap min-w-[90px] text-orange-400">Shortage</th>
                      <th className="p-3 text-center whitespace-nowrap min-w-[90px]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {selectedPR.items.map((it, idx) => {
                      const approvedQty = it.approvedQuantity && it.approvedQuantity > 0 ? it.approvedQuantity : it.requestedQuantity;
                      const issuedQty = it.issuedQuantity || 0;
                      const remainingQty = Math.max(0, approvedQty - issuedQty);
                      const avail = it.availableQuantityAtCheck !== undefined ? it.availableQuantityAtCheck : '-';
                      const shortage = it.shortageQuantity || 0;

                      return (
                        <tr key={idx} className="hover:bg-slate-800/30 transition">
                          <td className="p-3 font-sans min-w-[160px]">
                            <div className="font-semibold text-white">{it.itemId?.name || it.description}</div>
                            <div className="text-[11px] font-mono text-slate-500">
                              SKU: {it.itemId?.sku || (it.itemId as any)?.itemCode || 'SKU'}
                            </div>
                          </td>
                          <td className="p-3 text-right whitespace-nowrap text-slate-200">{it.requestedQuantity}</td>
                          <td className="p-3 text-right whitespace-nowrap text-slate-200">{it.approvedQuantity || (selectedPR.status === 'APPROVED' ? it.requestedQuantity : '-')}</td>
                          <td className="p-3 text-right whitespace-nowrap text-emerald-400 font-bold">{avail}</td>
                          <td className="p-3 text-right whitespace-nowrap text-cyan-400 font-bold">{issuedQty}</td>
                          <td className="p-3 text-right whitespace-nowrap text-indigo-400 font-bold">{remainingQty}</td>
                          <td className="p-3 text-right whitespace-nowrap text-orange-400 font-bold">{shortage > 0 ? shortage : 0}</td>
                          <td className="p-3 text-center whitespace-nowrap font-sans">
                            {remainingQty === 0 && issuedQty > 0 ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                Issued
                              </span>
                            ) : shortage > 0 ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30">
                                Shortage
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Ready
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Stock Movement & Transaction Ledger Traceability */}
            {selectedPR.stockIssueTransactionIds && selectedPR.stockIssueTransactionIds.length > 0 && (
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <Truck className="w-4 h-4 text-cyan-400" />
                    Transaction Ledger Traceability & Stock Movements
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/inventory/ledger?search=${selectedPR.prNumber}`)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                  >
                    Open in Transaction Ledger <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2">
                  {selectedPR.stockIssueTransactionIds.map((txn: any, idx: number) => (
                    <div
                      key={idx}
                      className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-xs flex items-center justify-between font-mono"
                    >
                      <div>
                        <span className="text-indigo-400 font-bold">{txn.transactionNumber || `TXN-${idx + 1}`}</span>
                        <span className="text-slate-500 ml-2">Type: {txn.transactionType || 'STOCK_ISSUE'}</span>
                      </div>
                      <div className="flex items-center gap-4 text-slate-300">
                        <span>Quantity OUT: <strong className="text-rose-400">-{txn.quantityOut}</strong></span>
                        <span>Balance: {txn.balanceBefore} &rarr; <strong className="text-emerald-400">{txn.balanceAfter}</strong></span>
                        <span className="text-slate-500 text-[11px] font-sans">
                          {txn.createdAt ? new Date(txn.createdAt).toLocaleTimeString() : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handleOpenPrint(selectedPR)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Printer className="w-4 h-4 text-indigo-400" />
                Print / Save PDF
              </button>

              <div className="flex items-center gap-2">
                {/* Draft Actions */}
                {selectedPR.status === 'DRAFT' && can('purchase:create') && (
                  <button
                    onClick={() => handleSubmitPR(selectedPR._id)}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Submit Requisition
                  </button>
                )}

                {/* Pending Approval Actions */}
                {(selectedPR.status === 'SUBMITTED' || selectedPR.status === 'PENDING_APPROVAL') && can('purchase:approve') && (
                  <>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-600/20 dark:hover:bg-rose-600/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-600/30 text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-700 dark:text-rose-300" />
                      Reject
                    </button>
                    <button
                      onClick={() => openApproveModal(selectedPR)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-600/25"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve Requisition
                    </button>
                  </>
                )}

                {/* Approved / Partially Available Actions */}
                {['APPROVED', 'PARTIALLY_APPROVED', 'PARTIALLY_AVAILABLE', 'PURCHASE_REQUIRED', 'PARTIALLY_ISSUED'].includes(selectedPR.status) && can('inventory:issue') && (
                  <button
                    onClick={() => openStockIssueModal(selectedPR)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-600/25"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    Issue Stock Now
                  </button>
                )}

                {/* Cancellation Button */}
                {!['ISSUED', 'FULFILLED', 'CANCELLED'].includes(selectedPR.status) && (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium"
                  >
                    Cancel Request
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* APPROVAL & PARTIAL APPROVAL MODAL                              */}
      {/* ============================================================== */}
      {showApproveModal && selectedPR && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              Approve Requisition ({selectedPR.prNumber})
            </h3>
            <p className="text-xs text-slate-400">
              Review requested quantities. You can adjust approved quantities for partial authorization. 
              <strong className="text-emerald-400 block mt-1">Approval authorizes the request but DOES NOT decrease inventory stock.</strong>
            </p>

            <div className="border border-slate-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 font-semibold">
                  <tr>
                    <th className="p-2.5">Item</th>
                    <th className="p-2.5 text-right">Requested</th>
                    <th className="p-2.5 text-right">Approve Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {selectedPR.items.map((it) => {
                    const itmId = typeof it.itemId === 'object' ? it.itemId?._id : it.itemId;
                    return (
                      <tr key={itmId}>
                        <td className="p-2.5 text-white font-sans">{it.itemId?.name || it.description}</td>
                        <td className="p-2.5 text-right text-slate-400">{it.requestedQuantity}</td>
                        <td className="p-2.5 text-right">
                          <input
                            type="number"
                            min="0"
                            max={it.requestedQuantity}
                            value={approvedQuantities[itmId] ?? it.requestedQuantity}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(it.requestedQuantity, Number(e.target.value)));
                              setApprovedQuantities({ ...approvedQuantities, [itmId]: val });
                            }}
                            className="w-20 bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 text-right focus:outline-none focus:border-emerald-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div>
              <label className="block text-slate-300 mb-1 text-xs font-semibold">Approval Remarks (Optional)</label>
              <textarea
                rows={2}
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                placeholder="e.g. Approved for operations, proceed with warehouse fulfillment"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                className="px-3.5 py-2 rounded-xl text-slate-400 text-xs hover:bg-slate-800"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirmApproval}
                disabled={isApproving}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow"
              >
                {isApproving ? 'Authorizing...' : 'Authorize Requisition'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 22. STOCK ISSUE MODAL (ATOMIC STOCK DEDUCTION)                 */}
      {/* ============================================================== */}
      {showIssueModal && selectedPR && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Truck className="w-5 h-5 text-emerald-400" />
                  Issue Stock from Warehouse ({selectedPR.warehouseId?.name})
                </h3>
                <span className="text-xs text-indigo-400 font-mono">Reference: {selectedPR.prNumber}</span>
              </div>
              <button onClick={() => setShowIssueModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Warning banner about inventory deduction */}
            <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl text-xs text-amber-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <strong>CRITICAL INVENTORY ACTION:</strong> Submitting this stock issue will physically decrement warehouse
                stock balances and record an official <strong>STOCK_ISSUE</strong> entry in the immutable Transaction Ledger.
              </div>
            </div>

            {/* Issue Quantity Inputs Table */}
            <div className="border border-slate-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 font-semibold">
                  <tr>
                    <th className="p-2.5">Product</th>
                    <th className="p-2.5 text-right">Approved</th>
                    <th className="p-2.5 text-right text-emerald-400">Warehouse Stock</th>
                    <th className="p-2.5 text-right">Already Issued</th>
                    <th className="p-2.5 text-right text-indigo-400">Issue Now</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {selectedPR.items.map((it) => {
                    const itmId = typeof it.itemId === 'object' ? it.itemId?._id : it.itemId;
                    const approvedLimit = it.approvedQuantity && it.approvedQuantity > 0 ? it.approvedQuantity : it.requestedQuantity;
                    const remainingNeeded = Math.max(0, approvedLimit - (it.issuedQuantity || 0));
                    const avail = it.availableQuantityAtCheck !== undefined ? it.availableQuantityAtCheck : (itemStocks[itmId] || 0);

                    return (
                      <tr key={itmId}>
                        <td className="p-2.5 text-white font-sans">
                          <div>{it.itemId?.name || it.description}</div>
                          <div className="text-[10px] text-slate-500 font-mono">SKU: {it.itemId?.sku || 'SKU'}</div>
                        </td>
                        <td className="p-2.5 text-right text-slate-300">{approvedLimit}</td>
                        <td className="p-2.5 text-right text-emerald-400 font-bold">{avail}</td>
                        <td className="p-2.5 text-right text-slate-400">{it.issuedQuantity || 0}</td>
                        <td className="p-2.5 text-right">
                          <input
                            type="number"
                            min="0"
                            max={Math.min(remainingNeeded, avail)}
                            value={issueQuantities[itmId] ?? 0}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(Math.min(remainingNeeded, avail), Number(e.target.value)));
                              setIssueQuantities({ ...issueQuantities, [itmId]: val });
                            }}
                            className="w-20 bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 text-right focus:outline-none focus:border-indigo-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div>
              <label className="block text-slate-300 mb-1 text-xs font-semibold">Issue Remarks / Delivery Pass Notes</label>
              <input
                type="text"
                value={issueRemarks}
                onChange={(e) => setIssueRemarks(e.target.value)}
                placeholder="e.g. Dispatched via Loading Bay 2, Gate Pass GP-091"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowIssueModal(false)}
                className="px-3.5 py-2 rounded-xl text-slate-400 text-xs hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStockIssue}
                disabled={isIssuingStock}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow"
              >
                {isIssuingStock ? 'Executing Stock Movement...' : 'Confirm & Issue Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* REJECTION MODAL                                                */}
      {/* ============================================================== */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-400" />
              Reject Requisition
            </h3>
            <p className="text-xs text-slate-400">
              Please provide a mandatory audit explanation for rejecting this request. Stock will remain unchanged.
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Insufficient budget justification / Duplicate request"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-rose-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-3 py-1.5 rounded-lg text-slate-400 text-xs hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectPR}
                disabled={isRejecting}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
              >
                {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* CANCELLATION MODAL                                             */}
      {/* ============================================================== */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Ban className="w-5 h-5 text-slate-400" />
              Cancel Requisition
            </h3>
            <p className="text-xs text-slate-400">
              Are you sure you want to cancel this requisition? This action is permanent and recorded in the audit trail.
            </p>
            <textarea
              rows={3}
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="Reason for cancellation..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-indigo-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-3 py-1.5 rounded-lg text-slate-400 text-xs hover:bg-slate-800"
              >
                Close
              </button>
              <button
                onClick={handleCancelPR}
                disabled={isCancelling}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* CREATION WIZARD MODAL                                          */}
      {/* ============================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  Create Requisition
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Request items from a warehouse. Requisition creation does NOT decrease inventory stock.
                </p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => handleCreateSubmit(e, false)} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  label="Destination Warehouse *"
                  value={formData.warehouseId}
                  onChange={(e) => handleWarehouseChange(e.target.value)}
                  placeholder="Select Destination Warehouse..."
                  variant="indigo"
                  options={warehouses.map((wh) => ({
                    value: wh._id,
                    label: `${wh.name} (${wh.code})`,
                    badge: wh.code,
                  }))}
                />

                <Select
                  label="Requesting Department *"
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                  placeholder="Select Department..."
                  variant="indigo"
                  options={departments.map((d) => ({
                    value: d._id,
                    label: `${d.name} ${d.code ? `(${d.code})` : ''}`,
                    badge: d.code,
                  }))}
                />

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Required Delivery Date *
                  </label>
                  <input
                    type="date"
                    value={formData.requiredDate}
                    onChange={(e) => setFormData({ ...formData, requiredDate: e.target.value })}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 min-h-[38px] [color-scheme:dark]"
                  />
                </div>

                <Select
                  label="Requisition Priority *"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  placeholder="Select Priority..."
                  variant="indigo"
                  options={[
                    { value: 'LOW', label: 'LOW — Routine replenishment', badge: 'LOW' },
                    { value: 'MEDIUM', label: 'MEDIUM — Standard departmental request', badge: 'MEDIUM' },
                    { value: 'HIGH', label: 'HIGH — Urgent requirement', badge: 'HIGH' },
                    { value: 'URGENT', label: 'URGENT — Critical / Line stoppage risk', badge: 'URGENT' },
                  ]}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Purpose / Reason *</label>
                  <input
                    type="text"
                    placeholder="e.g. IT Department laptops for engineering team"
                    value={formData.purpose}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Notes / Reference (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Approved budget ref Q3-IT-004"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                    Requested Products
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-indigo-400 hover:text-indigo-300 text-xs flex items-center gap-1 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Product
                  </button>
                </div>

                {/* Column Headers */}
                <div className="grid grid-cols-12 gap-2 px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  <div className="col-span-5">Product (SKU) *</div>
                  <div className="col-span-2">UOM *</div>
                  <div className="col-span-2 text-right">Warehouse Stock</div>
                  <div className="col-span-2 text-right">Requested Qty *</div>
                  <div className="col-span-1 text-center">Action</div>
                </div>

                <div className="space-y-2">
                  {formData.items.map((row, idx) => {
                    const itmKey = row.itemId ? String(row.itemId) : '';
                    const currentWhStock = itmKey ? (itemStocks[itmKey] ?? 0) : null;

                    return (
                      <div
                        key={idx}
                        className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-800 space-y-2 relative"
                        style={{ zIndex: (formData.items.length - idx) * 10 }}
                      >
                        <div className="grid grid-cols-12 gap-2 items-center relative z-20">
                          {/* Item Selector */}
                          <div className="col-span-5">
                            <Select
                              size="sm"
                              variant="indigo"
                              value={row.itemId}
                              onChange={(e) => handleItemSelect(idx, e.target.value)}
                              placeholder="Select Catalog Item..."
                              options={itemsCatalog.map((i) => ({
                                value: String(i._id || (i as any).id),
                                label: i.name,
                                badge: i.sku || (i as any).code,
                                sublabel: i.description || undefined,
                              }))}
                            />
                          </div>

                          {/* UOM Selector */}
                          <div className="col-span-2">
                            <Select
                              size="sm"
                              variant="indigo"
                              value={row.uomId}
                              onChange={(e) => {
                                const updated = [...formData.items];
                                updated[idx].uomId = e.target.value;
                                setFormData({ ...formData, items: updated });
                              }}
                              placeholder="UOM"
                              options={uoms.map((u) => ({
                                value: String(u._id || (u as any).id),
                                label: u.name,
                                badge: u.symbol || u.code,
                              }))}
                            />
                          </div>

                          {/* Live Warehouse Stock */}
                          <div className="col-span-2 text-right">
                            {currentWhStock !== null ? (
                              currentWhStock > 0 ? (
                                <span className="font-mono text-emerald-400 font-bold text-xs bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-lg inline-flex items-center gap-1.5 shadow-sm">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                  {currentWhStock} avail
                                </span>
                              ) : (
                                <span
                                  className="font-mono text-amber-400 font-semibold text-xs bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-lg inline-flex items-center gap-1.5"
                                  title="Out of stock in destination warehouse"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                  0 avail
                                </span>
                              )
                            ) : (
                              <span className="text-slate-500 text-xs italic">-</span>
                            )}
                          </div>

                          {/* Requested Quantity */}
                          <div className="col-span-2">
                            <input
                              type="number"
                              placeholder="Qty"
                              min="0.001"
                              step="any"
                              value={row.requestedQuantity}
                              onChange={(e) => {
                                const updated = [...formData.items];
                                updated[idx].requestedQuantity = Number(e.target.value);
                                setFormData({ ...formData, items: updated });
                              }}
                              required
                              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1.5 text-xs font-mono text-right focus:outline-none focus:border-indigo-500 min-h-[32px]"
                            />
                          </div>

                          {/* Delete Button */}
                          <div className="col-span-1 flex justify-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              disabled={formData.items.length === 1}
                              className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800/80 disabled:opacity-30 transition"
                              title="Remove item line"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Line remarks */}
                        <div className="pt-1 border-t border-slate-800/60 relative z-10">
                          <input
                            type="text"
                            placeholder="Optional line remarks (e.g. 16GB RAM, Dell Latitude 5420)"
                            value={row.remarks || ''}
                            onChange={(e) => {
                              const updated = [...formData.items];
                              updated[idx].remarks = e.target.value;
                              setFormData({ ...formData, items: updated });
                            }}
                            className="w-full bg-transparent text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 text-xs hover:bg-slate-800"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={isSubmittingPR}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
                  >
                    Save as Draft
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleCreateSubmit(e, true)}
                    disabled={isSubmittingPR}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Submit Requisition
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* PRINTABLE REQUISITION PDF DOCUMENT                             */}
      {/* ============================================================== */}
      {showPrintModal && printPR && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 no-print">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Purchase Requisition PDF Document</h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-500/30 text-indigo-300">
                  {printPR.prNumber}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow transition-all"
                >
                  <Printer className="w-4 h-4" />
                  Print / Save as PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div id="printable-requisition" className="bg-white text-slate-900 p-8 rounded-xl shadow-lg border border-slate-200 text-xs space-y-6">
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
                <div>
                  <div className="text-2xl font-black tracking-tight text-slate-900">STOCKPILOT</div>
                  <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase mt-0.5">
                    Multi-Tenant Operations & Inventory Platform
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1">Requisition Management Module &bull; Official Request</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-extrabold text-indigo-950 uppercase tracking-tight">
                    Requisition Document
                  </div>
                  <div className="text-sm font-mono font-bold text-indigo-600 mt-0.5">
                    {printPR.prNumber}
                  </div>
                  <div className="inline-block mt-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-slate-300 bg-slate-100 text-slate-800">
                    Status: {printPR.status}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Requester</span>
                  <div className="font-semibold text-slate-900 text-xs mt-0.5">{printPR.requesterId?.name || 'Staff User'}</div>
                  <div className="text-[11px] text-slate-500">{printPR.requesterId?.email || ''}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Department</span>
                  <div className="font-semibold text-slate-900 text-xs mt-0.5">{printPR.departmentId?.name || 'Operations'}</div>
                  <div className="text-[11px] text-slate-500">Code: {printPR.departmentId?.code || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Destination Facility</span>
                  <div className="font-semibold text-slate-900 text-xs mt-0.5">{printPR.warehouseId?.name || 'Main Facility'}</div>
                  <div className="text-[11px] text-slate-500">Code: {printPR.warehouseId?.code || 'WH'}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Required Date</span>
                  <div className="font-semibold text-slate-900 text-xs mt-0.5">
                    {new Date(printPR.requiredDate).toLocaleDateString()}
                  </div>
                  <div className="text-[11px] font-bold text-indigo-700">Priority: {printPR.priority}</div>
                </div>
              </div>

              {printPR.purpose && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Business Purpose:</span>
                  <p className="text-slate-800 text-xs mt-1">{printPR.purpose}</p>
                </div>
              )}

              <div>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b-2 border-slate-800 bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-3 w-10">#</th>
                      <th className="py-2.5 px-3">Item / SKU</th>
                      <th className="py-2.5 px-3">Remarks</th>
                      <th className="py-2.5 px-3 text-center">UOM</th>
                      <th className="py-2.5 px-3 text-right">Requested</th>
                      <th className="py-2.5 px-3 text-right">Approved</th>
                      <th className="py-2.5 px-3 text-right">Issued</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {printPR.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono text-slate-500">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          <div>{it.itemId?.name || it.description || 'Catalog Item'}</div>
                          <div className="text-[10px] font-mono text-slate-500 font-normal">
                            SKU: {it.itemId?.sku || 'N/A'}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                          {it.remarks || 'Standard'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-medium">
                          {it.uomId?.symbol || it.uomId?.code || 'PCS'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold font-mono">
                          {it.requestedQuantity}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          {it.approvedQuantity || (printPR.status === 'APPROVED' ? it.requestedQuantity : '-')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {it.issuedQuantity || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-6 border-t border-slate-300">
                <div className="grid grid-cols-3 gap-6 text-center text-[10px] text-slate-600">
                  <div className="space-y-8">
                    <div className="h-10 border-b border-dashed border-slate-400 flex items-end justify-center pb-1">
                      <span className="font-semibold text-slate-800 text-xs">{printPR.requesterId?.name || 'Requester'}</span>
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 uppercase">1. Requested By</div>
                      <div>Staff Signature & Date</div>
                    </div>
                  </div>
                  <div className="space-y-8">
                    <div className="h-10 border-b border-dashed border-slate-400 flex items-end justify-center pb-1">
                      {printPR.approvedBy?.name && (
                        <span className="font-semibold text-emerald-700 text-xs">Approved: {printPR.approvedBy.name}</span>
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 uppercase">2. Approver / Department Head</div>
                      <div>Authorization Signature</div>
                    </div>
                  </div>
                  <div className="space-y-8">
                    <div className="h-10 border-b border-dashed border-slate-400 flex items-end justify-center pb-1"></div>
                    <div>
                      <div className="font-bold text-slate-800 uppercase">3. Store Manager / Issue Clerk</div>
                      <div>Physical Goods Handover</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
