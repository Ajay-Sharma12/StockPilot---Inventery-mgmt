import React, { useState, useEffect } from 'react';
import {
  Warehouse as WarehouseIcon,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Package,
  Calendar,
  Layers,
  X,
  ArrowRight,
  ExternalLink,
  ClipboardList,
  Printer,
  Truck,
  Mail,
  Phone,
  RotateCcw,
  Ban,
  FileText,
  Radio,
  Send,
  User,
  MapPin,
  Check,
  Hash,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { procurementApi, GoodsReceiptNote, PurchaseOrder } from '../../api/procurement.api';
import { warehouseApi } from '../../api/warehouse.api';
import { usePermissions } from '../../hooks/usePermissions';
import { Skeleton } from '../../components/ui/Skeleton';
import { Select } from '../../components/ui/Select';
import { NotificationGatewayModal } from '../../components/common/NotificationGatewayModal';

interface ReceivingLineState {
  itemId: string;
  poLineId: string;
  description: string;
  itemCode: string;
  orderedQty: number;
  alreadyReceivedQty: number;
  pendingQty: number;
  receiveQty: number;
  batchNumber: string;
  expiryDate: string;
  qcRequired: boolean;
  uomId: string;
  uomName: string;
}

export const GoodsReceiptsPage: React.FC = () => {
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [grns, setGrns] = useState<GoodsReceiptNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGRN, setSelectedGRN] = useState<GoodsReceiptNote | null>(null);

  // Modals state
  const [showGatewayModal, setShowGatewayModal] = useState(false);
  const [printGRN, setPrintGRN] = useState<GoodsReceiptNote | null>(null);

  // Inbound Dock Receive Modal State
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [eligiblePOs, setEligiblePOs] = useState<PurchaseOrder[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedPOId, setSelectedPOId] = useState('');
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [receiptWarehouseId, setReceiptWarehouseId] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiptRemarks, setReceiptRemarks] = useState('');

  // Logistics & Notification metadata
  const [deliveryChallanNumber, setDeliveryChallanNumber] = useState('');
  const [deliveryChallanDate, setDeliveryChallanDate] = useState(new Date().toISOString().split('T')[0]);
  const [transporterName, setTransporterName] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [lrNumber, setLrNumber] = useState('');
  const [packageCount, setPackageCount] = useState<number>(1);
  const [notifySupplier, setNotifySupplier] = useState<boolean>(true);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');

  // Line receiving entries
  const [receivingLines, setReceivingLines] = useState<ReceivingLineState[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Cancellation Modal State
  const [cancellingGRN, setCancellingGRN] = useState<GoodsReceiptNote | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [resendingNotification, setResendingNotification] = useState(false);
  const [sendingToQC, setSendingToQC] = useState(false);

  const handleSendToQC = async (grnId: string) => {
    try {
      setSendingToQC(true);
      await procurementApi.sendGRNToQC(grnId);
      setActionSuccessMsg('GRN successfully dispatched to Quality Control queue!');
      setTimeout(() => setActionSuccessMsg(null), 6000);
      setSelectedGRN(null);
      await loadGRNs();
      navigate('/purchase/qc');
    } catch (err: any) {
      setReceiveError(err.response?.data?.message || 'Failed to dispatch GRN to QC.');
    } finally {
      setSendingToQC(false);
    }
  };

  useEffect(() => {
    loadGRNs();
  }, [statusFilter]);

  // Handle URL query parameter ?poId=... to auto-open receipt modal
  useEffect(() => {
    const poIdParam = searchParams.get('poId');
    if (poIdParam) {
      handleAutoOpenPO(poIdParam);
    }
  }, [searchParams]);

  const loadGRNs = async () => {
    try {
      setLoading(true);
      const res = await procurementApi.getGRNs({
        status: statusFilter || undefined,
        search: searchTerm || undefined,
      });
      setGrns(res.data || []);
    } catch (err) {
      console.error('Failed to load GRNs', err);
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

  const handleAutoOpenPO = async (poId: string) => {
    try {
      const [posRes, whsRes] = await Promise.all([
        procurementApi.getPOs({ limit: 100 }),
        warehouseApi.getWarehouses(),
      ]);

      const candidatePOs = normalizeList(posRes).filter((po: PurchaseOrder) =>
        ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'].includes(po.status)
      );

      setEligiblePOs(candidatePOs);
      setWarehouses(normalizeList(whsRes));
      setShowReceiveModal(true);

      if (searchParams.get('challan')) setDeliveryChallanNumber(searchParams.get('challan')!);
      if (searchParams.get('carrier')) setTransporterName(searchParams.get('carrier')!);
      if (searchParams.get('vehicle')) setVehicleNumber(searchParams.get('vehicle')!);

      // Select target PO
      setTimeout(() => {
        applyPOSelection(poId, candidatePOs);
      }, 50);
    } catch (err) {
      console.error('Failed to auto-select PO for GRN', err);
    }
  };

  const openReceiveModal = async () => {
    try {
      setReceiveError(null);
      setSelectedPOId('');
      setSelectedPO(null);
      setReceivingLines([]);
      setDeliveryChallanNumber('');
      setDeliveryChallanDate(new Date().toISOString().split('T')[0]);
      setTransporterName('');
      setVehicleNumber('');
      setLrNumber('');
      setPackageCount(1);
      setNotifySupplier(true);
      setRecipientEmail('');
      setRecipientPhone('');
      setReceiptRemarks('');

      const [posRes, whsRes] = await Promise.all([
        procurementApi.getPOs({ limit: 100 }),
        warehouseApi.getWarehouses(),
      ]);

      const candidatePOs = normalizeList(posRes).filter((po: PurchaseOrder) =>
        ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'].includes(po.status)
      );

      setEligiblePOs(candidatePOs);
      setWarehouses(normalizeList(whsRes));
      setShowReceiveModal(true);
    } catch (err) {
      console.error('Failed to prepare inbound dock receipt', err);
    }
  };

  const applyPOSelection = (poId: string, poList: PurchaseOrder[]) => {
    setSelectedPOId(poId);
    const po = poList.find((p) => p._id === poId);
    if (!po) {
      setSelectedPO(null);
      setReceivingLines([]);
      return;
    }

    setSelectedPO(po);
    setReceiptWarehouseId(po.warehouseId?._id || po.warehouseId || '');
    setRecipientEmail(po.supplierId?.email || '');
    setRecipientPhone(po.supplierId?.phone || '');

    // Generate line item receiving state
    const lines: ReceivingLineState[] = (po.items || []).map((item) => {
      const remaining = Math.max(0, (item.quantity || 0) - (item.receivedQuantity || 0));
      return {
        itemId: item.itemId?._id || item.itemId,
        poLineId: item._id || '',
        description: item.itemId?.name || item.description || 'Inventory Item',
        itemCode: item.itemId?.code || item.itemId?.sku || '',
        orderedQty: item.quantity,
        alreadyReceivedQty: item.receivedQuantity || 0,
        pendingQty: remaining,
        receiveQty: remaining, // default to receive remaining
        batchNumber: `LOT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        expiryDate: '',
        qcRequired: true, // Default to true so inbound goods mandate quality inspection at dock
        uomId: item.uomId?._id || item.uomId,
        uomName: item.uomId?.symbol || item.uomId?.name || 'Unit',
      };
    });

    setReceivingLines(lines);
  };

  const handlePOSelection = (poId: string) => {
    applyPOSelection(poId, eligiblePOs);
  };

  const updateLine = (idx: number, patch: Partial<ReceivingLineState>) => {
    setReceivingLines((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  };

  const handleSubmitGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPO) return;

    // Filter lines that have receiveQty > 0
    const activeLines = receivingLines.filter((l) => l.receiveQty > 0);
    if (activeLines.length === 0) {
      setReceiveError('Please enter a receive quantity greater than 0 for at least one line.');
      return;
    }

    // Check for exceeding pending quantity
    for (const line of activeLines) {
      if (line.receiveQty > line.pendingQty) {
        setReceiveError(`Cannot receive more than remaining ${line.pendingQty} units for ${line.description}.`);
        return;
      }
    }

    try {
      setSubmitting(true);
      setReceiveError(null);

      const payload = {
        purchaseOrderId: selectedPO._id,
        warehouseId: receiptWarehouseId,
        receiptDate,
        deliveryChallanNumber: deliveryChallanNumber.trim() || undefined,
        deliveryChallanDate: deliveryChallanDate || undefined,
        transporterName: transporterName.trim() || undefined,
        vehicleNumber: vehicleNumber.trim() || undefined,
        lrNumber: lrNumber.trim() || undefined,
        packageCount: packageCount || undefined,
        notifySupplier,
        recipientEmail: recipientEmail.trim() || undefined,
        recipientPhone: recipientPhone.trim() || undefined,
        remarks: receiptRemarks,
        items: activeLines.map((line) => ({
          itemId: line.itemId,
          poLineId: line.poLineId,
          orderedQuantity: line.orderedQty,
          receivedQuantity: line.receiveQty,
          uomId: line.uomId,
          batchNumber: line.batchNumber || undefined,
          expiryDate: line.expiryDate ? new Date(line.expiryDate).toISOString() : undefined,
          qcRequired: line.qcRequired,
        })),
      };

      const res = await procurementApi.createGRN(payload);
      setShowReceiveModal(false);
      setActionSuccessMsg(`GRN ${res.grnNumber} generated successfully! ${notifySupplier ? 'Supplier receipt acknowledgment dispatched.' : ''}`);
      setTimeout(() => setActionSuccessMsg(null), 6000);
      loadGRNs();
    } catch (err: any) {
      setReceiveError(err.response?.data?.message || err.message || 'Failed to submit Goods Receipt Note.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingGRN) return;
    if (cancellationReason.trim().length < 3) {
      setCancelError('Please specify a valid reason (min 3 characters).');
      return;
    }

    try {
      setCancelling(true);
      setCancelError(null);
      await procurementApi.cancelGRN(cancellingGRN._id, cancellationReason);
      setCancellingGRN(null);
      setSelectedGRN(null);
      setCancellationReason('');
      setActionSuccessMsg(`GRN ${cancellingGRN.grnNumber} has been successfully cancelled and inventory restored.`);
      setTimeout(() => setActionSuccessMsg(null), 6000);
      loadGRNs();
    } catch (err: any) {
      setCancelError(err.response?.data?.message || err.message || 'Failed to cancel GRN.');
    } finally {
      setCancelling(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RECEIVED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Stock Accepted
          </span>
        );
      case 'QC_PENDING':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/25">
            <Clock className="w-3.5 h-3.5 mr-1 text-amber-500" /> QC Pending
          </span>
        );
      case 'PARTIALLY_ACCEPTED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Partial Acceptance
          </span>
        );
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> QC Passed
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
            <ShieldAlert className="w-3.5 h-3.5 mr-1" /> QC Rejected
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Completed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-600/40">
            <Ban className="w-3.5 h-3.5 mr-1 text-rose-500" /> Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-500/10 text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-slate-500/20">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <WarehouseIcon className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
            Goods Receipt Notes (GRN)
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            Log inbound shipments against Purchase Orders, capture delivery challan & carrier info, notify suppliers, and route QC-mandated items to quarantine.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {can('grn:create') && (
            <button
              onClick={openReceiveModal}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl shadow-md shadow-indigo-600/20 text-sm font-semibold transition-all"
            >
              <Plus className="w-4 h-4" />
              Receive Inbound PO
            </button>
          )}
        </div>
      </div>

      {/* Success Notification Alert */}
      {actionSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-sm text-emerald-600 dark:text-emerald-400 shadow-md">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="font-medium">{actionSuccessMsg}</span>
        </div>
      )}

      {/* Info Banner on QC Isolation & Logistics Receipt */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-indigo-200 dark:border-indigo-500/20 shadow-xs flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-white">Automated QC Isolation Protocol:</span> Items requiring inspection are quarantined with zero live stock credited until QC sign-off. Direct stock items are immediately posted to the designated warehouse.
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-emerald-200 dark:border-emerald-500/20 shadow-xs flex items-start gap-3">
          <Mail className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-white">Live Supplier Acknowledgment:</span> On dock receive, an automated email & SMS receipt slip is dispatched with delivery challan, transporter, and quantity received to prevent vendor reconciliation disputes.
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by GRN #, PO #, Challan #, Transporter, or Supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadGRNs()}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="w-full sm:w-56">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="All Statuses"
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'QC_PENDING', label: 'QC Pending' },
              { value: 'RECEIVED', label: 'Received (Direct)' },
              { value: 'ACCEPTED', label: 'Accepted (QC Passed)' },
              { value: 'PARTIALLY_ACCEPTED', label: 'Partially Accepted' },
              { value: 'REJECTED', label: 'QC Rejected' },
              { value: 'CANCELLED', label: 'Cancelled' },
            ]}
          />
        </div>
      </div>

      {/* GRN Data Table */}
      <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-3.5">GRN Document</th>
                <th className="px-6 py-3.5">Source PO</th>
                <th className="px-6 py-3.5">Supplier</th>
                <th className="px-6 py-3.5">Logistics & Challan</th>
                <th className="px-6 py-3.5">Warehouse</th>
                <th className="px-6 py-3.5">Receipt Date</th>
                <th className="px-6 py-3.5">Items Summary</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="px-6 py-4"><Skeleton className="h-4 w-28 bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-32 bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-24 bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-24 bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-20 bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-20 bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-36 bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-20 rounded-full bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-6 py-4 text-right"><Skeleton className="h-8 w-24 rounded ml-auto bg-slate-200 dark:bg-slate-800" /></td>
                  </tr>
                ))
              ) : grns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                    <WarehouseIcon className="w-8 h-8 mx-auto mb-2 text-slate-400 dark:text-slate-600" />
                    No Goods Receipt Notes found. Receive an approved PO to record your first GRN.
                  </td>
                </tr>
              ) : (
                grns.map((grn) => {
                  const totalRcvd = (grn.items || []).reduce((acc, i) => acc + (i.receivedQuantity || 0), 0);
                  const hasQC = (grn.items || []).some((i) => i.qcRequired);

                  return (
                    <tr key={grn._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <WarehouseIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <div>
                          <div className="font-semibold">{grn.grnNumber}</div>
                          {grn.supplierNotifiedEmail && (
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-sans">
                              <Mail className="w-2.5 h-2.5" /> Supplier Notified
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                        {grn.purchaseOrderId?.poNumber || 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {grn.supplierId?.name || 'N/A'}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{grn.supplierId?.code}</div>
                      </td>
                      <td className="px-6 py-4">
                        {grn.deliveryChallanNumber ? (
                          <div>
                            <div className="text-slate-900 dark:text-white text-xs font-mono font-semibold">
                              DC: {grn.deliveryChallanNumber}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {grn.transporterName || 'Direct Carrier'} {grn.vehicleNumber ? `· ${grn.vehicleNumber}` : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No Challan Info</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-900 dark:text-white font-medium">{grn.warehouseId?.name || 'Main Warehouse'}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{grn.warehouseId?.code}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-xs">
                        {new Date(grn.receiptDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-900 dark:text-white font-medium">
                          {grn.items?.length || 0} line(s) · {totalRcvd} units
                        </div>
                        {hasQC && (
                          <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5 font-medium">
                            <ShieldAlert className="w-3 h-3" /> QC Mandated
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(grn.status)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setPrintGRN(grn)}
                            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg text-xs font-medium transition-colors"
                            title="Print Voucher / PDF Slip"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setSelectedGRN(grn)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg text-xs font-medium transition-colors"
                          >
                            Details
                          </button>
                          {grn.status === 'QC_PENDING' ? (
                            <button
                              onClick={() => navigate('/purchase/qc')}
                              className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                            >
                              QC <ArrowRight className="w-3 h-3" />
                            </button>
                          ) : (
                            <button
                              onClick={() => navigate('/purchase/qc')}
                              className="px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                              title="View Linked Quality Inspection"
                            >
                              <ShieldCheck className="w-3 h-3" /> Report
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* GRN Detail Modal */}
      {selectedGRN && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl p-6">
            <div className="flex justify-between items-start border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <WarehouseIcon className="w-5 h-5 text-indigo-400" />
                  Goods Receipt: {selectedGRN.grnNumber}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Received on {new Date(selectedGRN.receiptDate).toLocaleString()} · Linked PO:{' '}
                  <span className="font-mono text-indigo-400 font-semibold">
                    {selectedGRN.purchaseOrderId?.poNumber || 'N/A'}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPrintGRN(selectedGRN)}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-600/20 dark:hover:bg-indigo-600/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-300" /> Print Slip
                </button>
                <button
                  onClick={() => setSelectedGRN(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Cancelled Banner */}
            {selectedGRN.status === 'CANCELLED' && (
              <div className="mb-4 p-3.5 rounded-xl bg-rose-950/40 border border-rose-600/50 text-rose-300 text-xs space-y-1">
                <div className="font-bold flex items-center gap-2 text-rose-200">
                  <Ban className="w-4 h-4 text-rose-400" /> This Goods Receipt Note is CANCELLED
                </div>
                <div className="text-slate-300">
                  Reason: <span className="font-semibold text-white">{selectedGRN.cancellationReason || 'Reversed by dock supervisor'}</span>
                </div>
                {selectedGRN.cancelledAt && (
                  <div className="text-slate-400 text-[11px]">
                    Cancelled At: {new Date(selectedGRN.cancelledAt).toLocaleString()}
                  </div>
                )}
              </div>
            )}

            {/* Logistics & Supplier Meta Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 p-4 rounded-lg bg-slate-800/40 border border-slate-800">
              <div>
                <div className="text-xs text-slate-500">Supplier</div>
                <div className="text-sm font-semibold text-white">
                  {selectedGRN.supplierId?.name || 'N/A'}
                </div>
                <div className="text-[11px] text-slate-400">{selectedGRN.supplierId?.code}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Destination Warehouse</div>
                <div className="text-sm font-semibold text-white">
                  {selectedGRN.warehouseId?.name || 'N/A'}
                </div>
                <div className="text-[11px] text-slate-400">{selectedGRN.warehouseId?.code}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Receipt Status</div>
                <div className="mt-1">{getStatusBadge(selectedGRN.status)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Received By</div>
                <div className="text-sm font-semibold text-white">
                  {selectedGRN.receivedBy?.firstName
                    ? `${selectedGRN.receivedBy.firstName} ${selectedGRN.receivedBy.lastName}`
                    : 'Dock Clerk'}
                </div>
              </div>
            </div>

            {/* Inbound Freight & Courier Logistics Card */}
            <div className="mb-5 p-3.5 rounded-lg bg-slate-950/50 border border-slate-800">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-indigo-400" /> Inbound Logistics & Delivery Challan
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Challan #</span>
                  <span className="font-mono font-medium text-white">{selectedGRN.deliveryChallanNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Challan Date</span>
                  <span className="text-slate-200">
                    {selectedGRN.deliveryChallanDate ? new Date(selectedGRN.deliveryChallanDate).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Carrier / Transporter</span>
                  <span className="text-slate-200">{selectedGRN.transporterName || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Vehicle #</span>
                  <span className="font-mono text-slate-200">{selectedGRN.vehicleNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">LR / AWB #</span>
                  <span className="font-mono text-slate-200">{selectedGRN.lrNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Packages</span>
                  <span className="font-bold text-slate-200">{selectedGRN.packageCount || 1} Cartons</span>
                </div>
              </div>

              {/* Notification Dispatch status */}
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-4 flex-wrap text-xs text-slate-400">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-slate-500 font-medium">Supplier Acknowledgment:</span>
                  <span className={`inline-flex items-center gap-1 font-semibold ${selectedGRN.supplierNotifiedEmail ? 'text-emerald-400' : 'text-slate-500'}`}>
                    <Mail className="w-3 h-3" /> {selectedGRN.supplierNotifiedEmail ? 'Email Dispatched' : 'Email Not Sent'}
                  </span>
                  <span className={`inline-flex items-center gap-1 font-semibold ${selectedGRN.supplierNotifiedSMS ? 'text-emerald-400' : 'text-slate-500'}`}>
                    <Phone className="w-3 h-3" /> {selectedGRN.supplierNotifiedSMS ? 'SMS Dispatched' : 'SMS Not Sent'}
                  </span>
                  {selectedGRN.notifiedAt && (
                    <span className="text-slate-500 text-[11px]">
                      Notified At: {new Date(selectedGRN.notifiedAt).toLocaleString()}
                    </span>
                  )}
                </div>

                {selectedGRN.status !== 'CANCELLED' && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setResendingNotification(true);
                        const updated = await procurementApi.resendGRNNotification(selectedGRN._id);
                        setSelectedGRN(updated);
                        setActionSuccessMsg(`Live supplier acknowledgment email & SMS resent for GRN ${selectedGRN.grnNumber}!`);
                        setTimeout(() => setActionSuccessMsg(null), 6000);
                        loadGRNs();
                      } catch (err: any) {
                        setReceiveError(err.response?.data?.message || 'Failed to resend acknowledgment notification.');
                      } finally {
                        setResendingNotification(false);
                      }
                    }}
                    disabled={resendingNotification}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-700 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200 border border-indigo-200 dark:border-indigo-500/30 rounded-md text-xs font-semibold transition-all disabled:opacity-50"
                    title="Resend live email and SMS acknowledgment slip to supplier"
                  >
                    <Send className={`w-3.5 h-3.5 text-indigo-700 dark:text-indigo-300 ${resendingNotification ? 'animate-spin' : ''}`} />
                    {resendingNotification ? 'Resending...' : 'Resend Receipt Email / SMS'}
                  </button>
                )}
              </div>
            </div>

            <h4 className="text-sm font-semibold text-white mb-3">Received Line Items</h4>
            <div className="border border-slate-800 rounded-lg overflow-hidden mb-5">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/70 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-2.5">Item / SKU</th>
                    <th className="px-4 py-2.5">Lot / Batch</th>
                    <th className="px-4 py-2.5 text-right">Ordered</th>
                    <th className="px-4 py-2.5 text-right">Received</th>
                    <th className="px-4 py-2.5 text-right">Accepted</th>
                    <th className="px-4 py-2.5 text-right">Rejected</th>
                    <th className="px-4 py-2.5">QC Mandate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {selectedGRN.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 font-medium text-white">
                        <div>{item.itemId?.name || 'Item'}</div>
                        <div className="text-slate-500 font-mono text-[11px]">{item.itemId?.code || item.itemId?.sku}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-400">
                        {item.batchNumber || 'N/A'}
                        {item.expiryDate && (
                          <div className="text-[10px] text-slate-500">
                            Exp: {new Date(item.expiryDate).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{item.orderedQuantity}</td>
                      <td className="px-4 py-3 text-right font-mono text-white font-bold">
                        {item.receivedQuantity}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-400 font-bold">
                        {item.acceptedQuantity}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-rose-400 font-bold">
                        {item.rejectedQuantity}
                      </td>
                      <td className="px-4 py-3">
                        {item.qcRequired ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            QC Mandated
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Direct Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedGRN.remarks && (
              <div className="text-xs text-slate-400 bg-slate-800/30 p-3 rounded border border-slate-800/50 mb-5">
                <span className="font-semibold text-slate-300">Dock Remarks: </span>
                {selectedGRN.remarks}
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-slate-800">
              <div className="flex items-center gap-2">
                {selectedGRN.status !== 'CANCELLED' && can('grn:cancel') && (
                  <button
                    onClick={() => {
                      setCancellingGRN(selectedGRN);
                      setCancellationReason('');
                      setCancelError(null);
                    }}
                    className="px-3 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-700/50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Ban className="w-3.5 h-3.5" /> Cancel / Reverse GRN
                  </button>
                )}

                {selectedGRN.status === 'QC_PENDING' ? (
                  <button
                    onClick={() => {
                      setSelectedGRN(null);
                      navigate('/purchase/qc');
                    }}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" /> Open QC Inspection Worksheet
                  </button>
                ) : selectedGRN.status !== 'CANCELLED' ? (
                  <button
                    onClick={() => handleSendToQC(selectedGRN._id)}
                    disabled={sendingToQC}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                    title="Dispatch this Goods Receipt to the Quality Control Inspection queue"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    {sendingToQC ? 'Dispatching to QC...' : 'Send to QC Inspection'}
                  </button>
                ) : null}
              </div>

              <button
                onClick={() => setSelectedGRN(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      {cancellingGRN && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-rose-900/60 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400 border-b border-slate-800 pb-3">
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Cancel Goods Receipt Note</h3>
                <p className="text-xs text-slate-400">Reversal for {cancellingGRN.grnNumber}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Cancelling this GRN will deduct any uninspected/received stock from the warehouse inventory and rollback the received quantities on Purchase Order <span className="font-mono text-indigo-400 font-semibold">{cancellingGRN.purchaseOrderId?.poNumber || ''}</span>.
            </p>

            {cancelError && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{cancelError}</span>
              </div>
            )}

            <form onSubmit={handleCancelGRN} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Reason for Cancellation *
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="e.g. Wrong shipment received, damaged in transit rejected before QC, duplicate entry..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCancellingGRN(null)}
                  disabled={cancelling}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-rose-600/30 disabled:opacity-50"
                >
                  <Ban className="w-3.5 h-3.5" />
                  {cancelling ? 'Reversing Stock...' : 'Confirm Reversal & Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable / PDF Goods Receipt Voucher Modal */}
      {printGRN && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white text-slate-900 rounded-2xl max-w-4xl w-full max-h-[94vh] overflow-y-auto shadow-2xl p-8 print:p-0 print:m-0 print:max-w-none print:shadow-none">
            {/* Action Bar (hidden on print) */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200 print:hidden">
              <div className="flex items-center gap-2 text-slate-600">
                <Printer className="w-5 h-5 text-indigo-600" />
                <span className="text-sm font-semibold">Printable Goods Receipt Note (GRN) Voucher</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
                >
                  <Printer className="w-4 h-4" /> Print Document
                </button>
                <button
                  onClick={() => setPrintGRN(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Official Voucher Printable Area */}
            <div className="space-y-6 text-slate-800">
              {/* Company & Document Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5">
                <div>
                  <div className="text-2xl font-black tracking-tight text-slate-950 flex items-center gap-2">
                    <WarehouseIcon className="w-7 h-7 text-indigo-600 inline" /> STOCKPILOT ENTERPRISE
                  </div>
                  <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold">
                    Supply Chain Operations & Inbound Receiving Dock
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Warehouse Facility: {printGRN.warehouseId?.name || 'Main Fulfillment Hub'} ({printGRN.warehouseId?.code || 'WH-MAIN'})
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-slate-900 text-white font-mono text-sm font-bold rounded">
                    GOODS RECEIPT NOTE
                  </span>
                  <div className="font-mono text-base font-bold text-slate-900 mt-2">
                    {printGRN.grnNumber}
                  </div>
                  <div className="text-xs text-slate-500">
                    Receipt Date: {new Date(printGRN.receiptDate).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Two Column Document Reference Grid */}
              <div className="grid grid-cols-2 gap-6 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <div className="font-bold text-slate-900 uppercase tracking-wide text-[11px] mb-2 border-b border-slate-200 pb-1">
                    Vendor / Supplier Information
                  </div>
                  <div className="font-semibold text-sm text-slate-900">{printGRN.supplierId?.name || 'N/A'}</div>
                  <div className="text-slate-600">Vendor Code: <span className="font-mono">{printGRN.supplierId?.code || 'N/A'}</span></div>
                  {printGRN.supplierId?.email && <div className="text-slate-600">Email: {printGRN.supplierId.email}</div>}
                  {printGRN.supplierId?.phone && <div className="text-slate-600">Phone: {printGRN.supplierId.phone}</div>}
                </div>

                <div>
                  <div className="font-bold text-slate-900 uppercase tracking-wide text-[11px] mb-2 border-b border-slate-200 pb-1">
                    Order & Docket Information
                  </div>
                  <div className="text-slate-700">
                    Purchase Order #: <span className="font-mono font-bold text-slate-900">{printGRN.purchaseOrderId?.poNumber || 'N/A'}</span>
                  </div>
                  <div className="text-slate-700">
                    Delivery Challan #: <span className="font-mono font-semibold text-slate-900">{printGRN.deliveryChallanNumber || 'N/A'}</span>
                    {printGRN.deliveryChallanDate && (
                      <span className="text-slate-500"> ({new Date(printGRN.deliveryChallanDate).toLocaleDateString()})</span>
                    )}
                  </div>
                  <div className="text-slate-700">
                    Carrier / Transporter: <span className="font-medium text-slate-900">{printGRN.transporterName || 'Direct Delivery'}</span>
                  </div>
                  <div className="text-slate-700">
                    Vehicle #: <span className="font-mono font-medium text-slate-900">{printGRN.vehicleNumber || 'N/A'}</span>
                    {printGRN.lrNumber ? ` · LR/AWB: ${printGRN.lrNumber}` : ''}
                  </div>
                  <div className="text-slate-700">
                    Total Packages / Cartons: <span className="font-bold text-slate-900">{printGRN.packageCount || 1}</span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Itemized Inbound Receipts</h4>
                <div className="border border-slate-300 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                      <tr>
                        <th className="p-2.5">#</th>
                        <th className="p-2.5">Item Description & SKU</th>
                        <th className="p-2.5">Batch / Lot #</th>
                        <th className="p-2.5">Expiry Date</th>
                        <th className="p-2.5 text-right">Ordered</th>
                        <th className="p-2.5 text-right">Received</th>
                        <th className="p-2.5 text-right">Accepted</th>
                        <th className="p-2.5 text-right">Rejected</th>
                        <th className="p-2.5 text-center">QC Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      {printGRN.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 text-slate-500 font-mono">{idx + 1}</td>
                          <td className="p-2.5">
                            <span className="font-semibold text-slate-900">{item.itemId?.name || 'Item'}</span>
                            <span className="text-[10px] text-slate-500 block font-mono">{item.itemId?.code || item.itemId?.sku}</span>
                          </td>
                          <td className="p-2.5 font-mono text-slate-700">{item.batchNumber || 'N/A'}</td>
                          <td className="p-2.5 text-slate-600">
                            {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="p-2.5 text-right font-mono">{item.orderedQuantity}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900">{item.receivedQuantity}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald-700">{item.acceptedQuantity}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-rose-700">{item.rejectedQuantity}</td>
                          <td className="p-2.5 text-center">
                            {item.qcRequired ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                                Quarantined QC
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                Direct In Stock
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Calculation Strip */}
              <div className="flex justify-between items-center bg-slate-100 p-3 rounded-lg text-xs font-semibold border border-slate-200">
                <div>Total Lines: <span className="font-bold text-slate-950">{printGRN.items?.length || 0}</span></div>
                <div>
                  Total Units Received: <span className="font-bold font-mono text-slate-950 text-sm">
                    {(printGRN.items || []).reduce((acc, i) => acc + (i.receivedQuantity || 0), 0)}
                  </span>
                </div>
                <div>Status: <span className="font-bold text-slate-950">{printGRN.status}</span></div>
              </div>

              {printGRN.remarks && (
                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded border border-slate-200">
                  <span className="font-bold text-slate-800">Dock Supervisor Remarks: </span>
                  {printGRN.remarks}
                </div>
              )}

              {/* Signature & Verification Blocks */}
              <div className="grid grid-cols-3 gap-6 pt-10 border-t border-slate-300 text-xs">
                <div className="text-center space-y-8">
                  <div className="h-10 border-b border-dashed border-slate-400"></div>
                  <div>
                    <div className="font-bold text-slate-900">Received By (Dock Clerk)</div>
                    <div className="text-[11px] text-slate-500">
                      {printGRN.receivedBy?.firstName
                        ? `${printGRN.receivedBy.firstName} ${printGRN.receivedBy.lastName}`
                        : 'Warehouse Dock Agent'}
                    </div>
                  </div>
                </div>

                <div className="text-center space-y-8">
                  <div className="h-10 border-b border-dashed border-slate-400"></div>
                  <div>
                    <div className="font-bold text-slate-900">Quality Control Inspector</div>
                    <div className="text-[11px] text-slate-500">Sign & Stamp</div>
                  </div>
                </div>

                <div className="text-center space-y-8">
                  <div className="h-10 border-b border-dashed border-slate-400"></div>
                  <div>
                    <div className="font-bold text-slate-900">Store / Inventory Manager</div>
                    <div className="text-[11px] text-slate-500">Authorized Release</div>
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="text-[10px] text-slate-400 text-center pt-2">
                This is a computer-generated Goods Receipt Note issued via StockPilot WMS/Procurement Engine. Generated on {new Date().toLocaleString()}.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inbound Dock Receive Modal */}
      {showReceiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl p-6">
            <div className="flex justify-between items-start border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <WarehouseIcon className="w-5 h-5 text-indigo-400" />
                  Inbound Receiving Dock — Log GRN
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Record incoming shipments against approved POs, capture carrier & delivery challan, and notify suppliers automatically.
                </p>
              </div>
              <button
                onClick={() => setShowReceiveModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {receiveError && (
              <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{receiveError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitGRN} className="space-y-5">
              {/* Header Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Select
                  label="Select Purchase Order *"
                  value={selectedPOId}
                  onChange={(e) => handlePOSelection(e.target.value)}
                  placeholder="-- Choose PO --"
                  options={eligiblePOs.map((po) => ({
                    value: po._id,
                    label: `${po.poNumber} — ${po.supplierId?.name || 'Supplier'} (${po.status})`,
                  }))}
                />

                <Select
                  label="Destination Warehouse *"
                  value={receiptWarehouseId}
                  onChange={(e) => setReceiptWarehouseId(e.target.value)}
                  placeholder="-- Choose Warehouse --"
                  options={warehouses.map((wh) => ({
                    value: wh._id,
                    label: `${wh.name} (${wh.code})`,
                  }))}
                />

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Receipt Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={receiptDate}
                    onChange={(e) => setReceiptDate(e.target.value)}
                    aria-label="Receipt Date"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Logistics & Delivery Challan Section */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                  <Truck className="w-4 h-4" /> Logistics & Carrier Information
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Delivery Challan #</label>
                    <input
                      type="text"
                      placeholder="e.g. DC-98421"
                      value={deliveryChallanNumber}
                      onChange={(e) => setDeliveryChallanNumber(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Challan Date</label>
                    <input
                      type="date"
                      value={deliveryChallanDate}
                      onChange={(e) => setDeliveryChallanDate(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Transporter / Courier Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Blue Dart, DHL, FedEx, Safexpress..."
                      value={transporterName}
                      onChange={(e) => setTransporterName(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Vehicle / Truck Number</label>
                    <input
                      type="text"
                      placeholder="e.g. MH-12-AB-1234"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">LR / AWB Tracking #</label>
                    <input
                      type="text"
                      placeholder="e.g. LR-4920492"
                      value={lrNumber}
                      onChange={(e) => setLrNumber(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Total Packages / Cartons</label>
                    <input
                      type="number"
                      min={1}
                      value={packageCount}
                      onChange={(e) => setPackageCount(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Real-time Supplier Notification Strip */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-950/30 border border-indigo-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-white">
                    <input
                      type="checkbox"
                      checked={notifySupplier}
                      onChange={(e) => setNotifySupplier(e.target.checked)}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span className="flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-emerald-400" />
                      Notify Supplier via Live Email & SMS acknowledgment upon receipt
                    </span>
                  </label>
                  <span className="text-[11px] text-indigo-300 font-mono">Real-time Dispatch</span>
                </div>

                {notifySupplier && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Supplier Email Address</label>
                      <input
                        type="email"
                        placeholder="vendor.contact@example.com"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Supplier Phone / WhatsApp Number</label>
                      <input
                        type="tel"
                        placeholder="+1234567890 or +919876543210"
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Line Items Table */}
              {selectedPO && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Purchase Order Line Items to Receive
                    </label>
                    <span className="text-xs text-slate-500 font-mono">
                      PO Total: ${selectedPO.total?.toLocaleString() || 0}
                    </span>
                  </div>

                  <div className="border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-800">
                        <tr>
                          <th className="px-4 py-3">Item Details</th>
                          <th className="px-3 py-3 text-center">Ordered / Prev Rcvd</th>
                          <th className="px-3 py-3 text-center">Remaining</th>
                          <th className="px-3 py-3">Receive Qty *</th>
                          <th className="px-3 py-3">Lot / Batch Number</th>
                          <th className="px-3 py-3">Expiry Date</th>
                          <th className="px-3 py-3 text-center">Workflow</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {receivingLines.map((line, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/30">
                            <td className="px-4 py-3 font-medium text-white">
                              <div>{line.description}</div>
                              <div className="text-slate-500 font-mono text-[11px]">
                                {line.itemCode}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center font-mono">
                              <span className="text-slate-400">{line.orderedQty}</span>
                              <span className="text-slate-600"> / </span>
                              <span className="text-emerald-400">{line.alreadyReceivedQty}</span>
                            </td>
                            <td className="px-3 py-3 text-center font-mono font-bold text-amber-400">
                              {line.pendingQty} {line.uomName}
                            </td>
                            <td className="px-3 py-3">
                              <input
                                type="number"
                                min={0}
                                max={line.pendingQty}
                                value={line.receiveQty}
                                onChange={(e) =>
                                  updateLine(idx, { receiveQty: Number(e.target.value) })
                                }
                                aria-label={`Receive quantity for ${line.description}`}
                                className="w-24 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm font-bold text-white text-center focus:outline-none focus:border-indigo-500"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <input
                                type="text"
                                placeholder="Lot/Batch #"
                                value={line.batchNumber}
                                onChange={(e) => updateLine(idx, { batchNumber: e.target.value })}
                                aria-label={`Lot or batch number for ${line.description}`}
                                className="w-32 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <input
                                type="date"
                                value={line.expiryDate}
                                onChange={(e) => updateLine(idx, { expiryDate: e.target.value })}
                                aria-label={`Expiry date for ${line.description}`}
                                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                              />
                            </td>
                            <td className="px-3 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => updateLine(idx, { qcRequired: !line.qcRequired })}
                                className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition shadow-sm cursor-pointer ${
                                  line.qcRequired
                                    ? 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/30'
                                    : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30'
                                }`}
                                title="Click to toggle: Quarantined for QC Inspection vs Direct Stock to Warehouse"
                              >
                                {line.qcRequired ? (
                                  <>
                                    <ShieldAlert className="w-3.5 h-3.5 mr-1 text-amber-600 dark:text-amber-400" />
                                    Quarantined QC
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                                    Direct Stock
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Remarks */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Receiving Dock Notes / Inspection Observations
                </label>
                <textarea
                  rows={2}
                  value={receiptRemarks}
                  onChange={(e) => setReceiptRemarks(e.target.value)}
                  placeholder="Carrier tracking observations, package seal status, damaged cartons noticed at dock..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowReceiveModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedPO}
                  className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-lg text-sm font-medium shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all"
                >
                  <WarehouseIcon className="w-4 h-4" />
                  {submitting ? 'Recording Inbound...' : 'Confirm Goods Receipt (GRN)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Gateway Configuration Modal */}
      <NotificationGatewayModal
        isOpen={showGatewayModal}
        onClose={() => setShowGatewayModal(false)}
        onSaved={() => {
          setShowGatewayModal(false);
          setActionSuccessMsg('Notification gateway settings updated successfully.');
          setTimeout(() => setActionSuccessMsg(null), 4000);
        }}
      />
    </div>
  );
};
