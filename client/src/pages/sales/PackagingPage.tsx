import React, { useState, useEffect } from 'react';
import {
  Boxes,
  PackageCheck,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Warehouse as WarehouseIcon,
  Calendar,
  X,
  AlertCircle,
  Scale,
  Ruler,
  FileText,
  Printer,
  MapPin,
  QrCode,
} from 'lucide-react';
import { salesApi, Package, SalesOrder, PickListResponse } from '../../api/sales.api';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';

export const PackagingPage: React.FC = () => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null);

  // Creation State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [eligibleOrders, setEligibleOrders] = useState<SalesOrder[]>([]);
  const [selectedSO, setSelectedSO] = useState<SalesOrder | null>(null);

  const [formData, setFormData] = useState({
    salesOrderId: '',
    packingMaterial: '',
    totalWeight: 0,
    length: 0,
    width: 0,
    height: 0,
    notes: '',
    items: [] as { itemId: string; name: string; quantity: number; maxAllowed: number; uomId: string; batchNumber: string; weight: number }[],
  });

  const [actionLoading, setActionLoading] = useState(false);

  // Pick-List & Print Slip Modals
  const [pickListData, setPickListData] = useState<PickListResponse | null>(null);
  const [loadingPickList, setLoadingPickList] = useState(false);
  const [showPrintSlipModal, setShowPrintSlipModal] = useState(false);

  const handleViewPickList = async (orderId: string) => {
    try {
      setLoadingPickList(true);
      const data = await salesApi.getPickList(orderId);
      setPickListData(data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to fetch warehouse pick list coordinates');
    } finally {
      setLoadingPickList(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, [statusFilter]);

  const loadPackages = async () => {
    try {
      setLoading(true);
      const res = await salesApi.getPackages({
        status: statusFilter || undefined,
        limit: 50,
      });
      setPackages(res.data || []);
    } catch (err) {
      console.error('Failed to load packages', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = async () => {
    try {
      setShowCreateModal(true);
      // Fetch CONFIRMED orders eligible for packing
      const res = await salesApi.getSalesOrders({ status: 'CONFIRMED', limit: 30 });
      setEligibleOrders(res.data || []);
      if (res.data && res.data.length > 0) {
        handleSelectSO(res.data[0]);
      }
    } catch (err) {
      console.error('Failed to load confirmed orders for packing', err);
    }
  };

  const handleSelectSO = async (so: SalesOrder) => {
    setSelectedSO(so);
    let pickItems: any[] = [];
    try {
      const pData = await salesApi.getPickList(so._id);
      pickItems = pData?.pickList || [];
    } catch {
      // Pick list fallback
    }

    const packingLines = so.items
      .map((it) => {
        const remaining = Math.max(0, it.orderedQuantity - (it.packedQuantity || 0));
        const itemIdStr = (it.itemId?._id || it.itemId)?.toString();
        const pickItem = pickItems.find((p: any) => p.itemId === itemIdStr);
        const suggestedLot = pickItem?.locationDetails?.[0]?.lotNumber;
        const validLot = suggestedLot && suggestedLot !== 'STANDARD' ? suggestedLot : '';

        return {
          itemId: it.itemId?._id || it.itemId,
          name: it.itemId?.name || it.description || 'Item',
          quantity: remaining,
          maxAllowed: remaining,
          uomId: it.uomId?._id || it.uomId,
          batchNumber: validLot,
          weight: 10,
        };
      })
      .filter((l) => l.maxAllowed > 0);

    setFormData((prev) => ({
      ...prev,
      salesOrderId: so._id,
      items: packingLines,
    }));
  };

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.salesOrderId || formData.items.length === 0) return;
    try {
      setActionLoading(true);
      const payload = {
        salesOrderId: formData.salesOrderId,
        packingMaterial: formData.packingMaterial,
        totalWeight: Number(formData.totalWeight),
        dimensions: {
          length: Number(formData.length),
          width: Number(formData.width),
          height: Number(formData.height),
        },
        notes: formData.notes,
        items: formData.items.map((i) => ({
          itemId: i.itemId,
          quantity: Number(i.quantity),
          uomId: i.uomId,
          batchNumber: i.batchNumber || undefined,
          weight: Number(i.weight || 0),
        })),
      };

      await salesApi.createPackage(payload);
      setShowCreateModal(false);
      await loadPackages();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create package');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePackOrder = async (pkgId: string) => {
    try {
      setActionLoading(true);
      await salesApi.packOrder(pkgId);
      await loadPackages();
      if (selectedPkg?._id === pkgId) {
        const updated = await salesApi.getPackageById(pkgId);
        setSelectedPkg(updated);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to pack package');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredPackages = packages.filter((p) => {
    const matches =
      p.packageNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.salesOrderId?.soNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.customerId?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matches;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Boxes className="w-6 h-6 text-sky-400" />
            <span>Packaging Station</span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Package consolidation, batch assignment &amp; shipping container preparation
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-sky-600/20 transition self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Pack Sales Order</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl p-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search Package #, SO # or Customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 text-white pl-9 pr-3 py-1.5 text-xs rounded-lg focus:ring-2 focus:ring-sky-500 outline-none placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['', 'DRAFT', 'PACKED', 'DISPATCHED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {st || 'All Packages'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${selectedPkg ? 'lg:col-span-2' : 'lg:col-span-3'} bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl overflow-hidden shadow-sm`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/50 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Package #</th>
                  <th className="py-3 px-4">Sales Order</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Container</th>
                  <th className="py-3 px-4 text-right">Weight</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="hover:bg-slate-800/20">
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-24 bg-slate-800" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-20 bg-slate-800" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-32 bg-slate-800" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-28 bg-slate-800" /></td>
                      <td className="py-3.5 px-4 text-right"><Skeleton className="h-4 w-16 ml-auto bg-slate-800" /></td>
                      <td className="py-3.5 px-4 text-center"><Skeleton className="h-5 w-20 rounded-full mx-auto bg-slate-800" /></td>
                      <td className="py-3.5 px-4 text-right"><Skeleton className="h-7 w-14 rounded ml-auto bg-slate-800" /></td>
                    </tr>
                  ))
                ) : filteredPackages.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-500">
                      No packaging containers found.
                    </td>
                  </tr>
                ) : (
                  filteredPackages.map((pkg) => (
                    <tr
                      key={pkg._id}
                      onClick={() => setSelectedPkg(pkg)}
                      className={`cursor-pointer transition hover:bg-slate-800/40 ${
                        selectedPkg?._id === pkg._id ? 'bg-sky-600/10 border-l-2 border-sky-500' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-bold text-white">{pkg.packageNumber}</td>
                      <td className="py-3.5 px-4 text-indigo-400 font-semibold">{pkg.salesOrderId?.soNumber || 'SO'}</td>
                      <td className="py-3.5 px-4 text-slate-300 font-medium truncate max-w-[150px]">
                        {pkg.customerId?.name || 'Customer'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 truncate max-w-[140px]">{pkg.packingMaterial || 'Standard Box'}</td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-200">
                        {pkg.totalWeight ? `${pkg.totalWeight} kg` : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                          pkg.status === 'PACKED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          pkg.status === 'DISPATCHED' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                          pkg.status === 'DRAFT' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                          'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {pkg.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPkg(pkg);
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

        {/* Selected Package Details */}
        {selectedPkg && (
          <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-5 shadow-lg space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Container Info</div>
                <h3 className="text-lg font-bold text-white mt-0.5">{selectedPkg.packageNumber}</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowPrintSlipModal(true)}
                  title="Print Container Packing Slip"
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedPkg(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Linked Sales Order:</span>
                <span className="font-semibold text-indigo-400">{selectedPkg.salesOrderId?.soNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Customer:</span>
                <span className="font-semibold text-white">{selectedPkg.customerId?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Packing Material:</span>
                <span className="text-slate-200">{selectedPkg.packingMaterial || 'Standard Container'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Gross Weight:</span>
                <span className="font-bold text-sky-400">{selectedPkg.totalWeight ? `${selectedPkg.totalWeight} kg` : '-'}</span>
              </div>
              {selectedPkg.dimensions && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Dimensions (L x W x H):</span>
                  <span className="text-slate-300 font-mono">
                    {selectedPkg.dimensions.length} x {selectedPkg.dimensions.width} x {selectedPkg.dimensions.height} cm
                  </span>
                </div>
              )}
            </div>

            {/* Packed Items */}
            <div>
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Contents ({selectedPkg.items.length} items)
              </div>
              <div className="space-y-2">
                {selectedPkg.items.map((it, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-950/40 rounded-lg border border-slate-800/60 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white">{it.itemId?.name || 'Item'}</div>
                      <div className="text-[10px] text-slate-500">Batch: {it.batchNumber || 'Unbatched'}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sky-400">{it.quantity} units</div>
                      <div className="text-[10px] text-slate-500">{it.weight ? `${it.weight} kg` : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              {selectedPkg.salesOrderId && (
                <button
                  type="button"
                  onClick={() => handleViewPickList(selectedPkg.salesOrderId?._id || selectedPkg.salesOrderId)}
                  disabled={loadingPickList}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5 text-teal-400" />
                  <span>{loadingPickList ? 'Fetching Locations...' : 'Floor Bin Pick Coordinates'}</span>
                </button>
              )}

              {selectedPkg.status === 'DRAFT' && (
                <button
                  onClick={() => handlePackOrder(selectedPkg._id)}
                  disabled={actionLoading}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition flex items-center justify-center gap-1.5"
                >
                  <PackageCheck className="w-4 h-4" />
                  <span>Mark Container as Packed</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Package Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Boxes className="w-5 h-5 text-sky-400" />
                <span>Pack Confirmed Sales Order</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePackage} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Select Confirmed Sales Order *</label>
                <Select
                  value={formData.salesOrderId}
                  onChange={(e) => {
                    const so = eligibleOrders.find((o) => o._id === e.target.value);
                    if (so) handleSelectSO(so);
                  }}
                  placeholder="Select Confirmed SO..."
                  variant="sky"
                  searchable
                  options={(Array.isArray(eligibleOrders) ? eligibleOrders : []).map((so) => ({
                    value: so._id,
                    label: `${so.soNumber} • ${so.customerId?.name || 'Customer'}`,
                    sublabel: `Total: $${(so.grandTotal ?? 0).toLocaleString()}`,
                    badge: so.soNumber,
                  }))}
                />
                {selectedSO && (
                  <div className="mt-1.5 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleViewPickList(selectedSO._id)}
                      className="text-teal-400 hover:text-teal-300 text-[11px] font-semibold flex items-center gap-1"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>View Warehouse Bins for {selectedSO.soNumber}</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Container / Packing Material</label>
                  <input
                    type="text"
                    value={formData.packingMaterial}
                    onChange={(e) => setFormData({ ...formData, packingMaterial: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                    placeholder="e.g. Rigid Wooden Crate #CR-12"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Total Weight (kg)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.totalWeight}
                    onChange={(e) => setFormData({ ...formData, totalWeight: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Length (cm)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.length}
                    onChange={(e) => setFormData({ ...formData, length: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Width (cm)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.width}
                    onChange={(e) => setFormData({ ...formData, width: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Height (cm)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.height}
                    onChange={(e) => setFormData({ ...formData, height: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>

              {/* Items in Package */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <span className="font-semibold text-white">Select Line Items to Pack</span>
                {formData.items.length === 0 ? (
                  <p className="text-slate-500 italic">No remaining eligible line items in this order.</p>
                ) : (
                  formData.items.map((it, idx) => (
                    <div key={idx} className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-6">
                        <div className="font-bold text-white">{it.name}</div>
                        <div className="text-[10px] text-slate-400">Max eligible to pack: {it.maxAllowed}</div>
                      </div>
                      <div className="col-span-3">
                        <label className="text-[10px] text-slate-500 block mb-0.5">Quantity to Pack</label>
                        <input
                          type="number"
                          min="1"
                          max={it.maxAllowed}
                          value={it.quantity}
                          onChange={(e) => {
                            const updated = [...formData.items];
                            updated[idx].quantity = Number(e.target.value);
                            setFormData({ ...formData, items: updated });
                          }}
                          className="w-full bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 text-xs text-right"
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="text-[10px] text-slate-500 block mb-0.5">Batch # (Optional)</label>
                        <input
                          type="text"
                          value={it.batchNumber}
                          placeholder="BATCH-..."
                          onChange={(e) => {
                            const updated = [...formData.items];
                            updated[idx].batchNumber = e.target.value;
                            setFormData({ ...formData, items: updated });
                          }}
                          className="w-full bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 text-xs"
                        />
                      </div>
                    </div>
                  ))
                )}
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
                      : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/20 active:scale-[0.98]'
                  }`}
                >
                  {actionLoading ? 'Creating...' : 'Create Packaging Container'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Pick-List Modal */}
      {pickListData && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-teal-400" />
                  <span>Warehouse Floor Pick-List &bull; {pickListData.soNumber}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Physical storage locations and bin coordinates for material collection.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Pick Slip</span>
                </button>
                <button
                  onClick={() => setPickListData(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {(pickListData.pickList || []).map((item, idx) => (
                <div key={idx} className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-sm">{item.itemName}</div>
                      <div className="text-xs text-slate-400">SKU: {item.itemSku}</div>
                    </div>
                    <div className="flex gap-4 text-xs">
                      <div className="text-right">
                        <span className="text-slate-500 block text-[10px]">Ordered</span>
                        <span className="font-bold text-slate-300">{item.orderedQuantity}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 block text-[10px]">Packed</span>
                        <span className="font-bold text-slate-400">{item.packedQuantity}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 block text-[10px]">To Pick</span>
                        <span className="font-bold text-teal-400 text-sm">{item.toPickQuantity}</span>
                      </div>
                    </div>
                  </div>

                  {(!item.locationDetails || item.locationDetails.length === 0) ? (
                    <div className="p-2.5 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-lg text-xs">
                      No stock balances registered in specific warehouse bins for this item.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px]">
                          <tr>
                            <th className="p-2">Location Code</th>
                            <th className="p-2">Zone</th>
                            <th className="p-2">Aisle / Rack / Shelf</th>
                            <th className="p-2">Bin Code</th>
                            <th className="p-2">Lot #</th>
                            <th className="p-2 text-right">Available</th>
                            <th className="p-2 text-right font-bold text-teal-300">Pick Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-300">
                          {item.locationDetails?.map((loc, lIdx) => (
                            <tr key={lIdx} className="hover:bg-slate-900/40">
                              <td className="p-2 font-mono text-slate-300">{loc.locationCode}</td>
                              <td className="p-2 text-slate-400">{loc.zone}</td>
                              <td className="p-2 text-slate-400">
                                {loc.aisle} &bull; {loc.rack} &bull; {loc.shelf}
                              </td>
                              <td className="p-2 font-mono font-bold text-emerald-400 bg-emerald-950/20 px-2 rounded">
                                {loc.bin}
                              </td>
                              <td className="p-2 text-slate-400">{loc.lotNumber || 'N/A'}</td>
                              <td className="p-2 text-right">{loc.availableQuantity}</td>
                              <td className="p-2 text-right font-bold text-teal-400">{loc.pickSuggestQty}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setPickListData(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Packing Slip Modal */}
      {showPrintSlipModal && selectedPkg && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-2xl max-w-2xl w-full p-8 shadow-2xl space-y-6 my-auto print:m-0 print:p-4 print:shadow-none">
            <div className="flex justify-between items-start border-b border-slate-200 pb-4">
              <div>
                <div className="text-2xl font-black text-slate-900">StockPilot ERP</div>
                <div className="text-xs text-slate-500">Warehouse Outbound Packing Slip</div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold px-2 py-1 bg-amber-100 text-amber-800 rounded uppercase">
                  Packing Slip
                </span>
                <div className="text-xl font-bold text-slate-900 mt-2">{selectedPkg.packageNumber}</div>
                <div className="text-xs text-slate-500">Order: {selectedPkg.salesOrderId?.soNumber}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="font-semibold text-slate-500 uppercase text-[10px] mb-1">Customer / Consignee:</div>
                <div className="font-bold text-slate-900 text-sm">{selectedPkg.customerId?.name}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="font-semibold text-slate-500 uppercase text-[10px] mb-1">Package Specs:</div>
                <div className="text-slate-700">Gross Weight: <span className="font-bold">{selectedPkg.totalWeight} kg</span></div>
                <div className="text-slate-700">Packaging: {selectedPkg.packingMaterial || 'Standard Box'}</div>
              </div>
            </div>

            <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">Item Name</th>
                  <th className="p-2.5">Batch #</th>
                  <th className="p-2.5 text-center">Packed Qty</th>
                  <th className="p-2.5 text-right">Weight (kg)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {selectedPkg.items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="p-2.5 text-slate-500">{idx + 1}</td>
                    <td className="p-2.5 font-medium text-slate-900">{it.itemId?.name || 'Item'}</td>
                    <td className="p-2.5 font-mono text-slate-600">{it.batchNumber || 'N/A'}</td>
                    <td className="p-2.5 text-center font-bold text-slate-800">{it.quantity}</td>
                    <td className="p-2.5 text-right text-slate-600">{it.weight || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pt-6 border-t border-slate-200 flex justify-between items-end text-xs">
              <div>
                <div className="h-8 border-b border-slate-300 w-44"></div>
                <div className="mt-1 font-semibold text-slate-700">Packed By (Signature)</div>
              </div>
              <div className="text-right text-[11px] text-slate-500">
                Date: {selectedPkg.packedAt ? new Date(selectedPkg.packedAt).toLocaleDateString() : new Date().toLocaleDateString()}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 print:hidden">
              <button
                onClick={() => setShowPrintSlipModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Close Preview
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Print Packing Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
