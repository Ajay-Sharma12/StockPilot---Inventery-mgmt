import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Archive,
  Copy,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  X,
  Trash2,
  Info,
  ArrowRight,
  Compass,
} from 'lucide-react';
import { productionApi, BOM, BOMStatus } from '../../api/production.api';
import { itemApi, Item } from '../../api/item.api';
import { masterDataApi, UOM } from '../../api/masterData.api';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../context/ToastContext';
import { Select } from '../../components/ui/Select';

export const BOMListPage: React.FC = () => {
  const { can } = usePermissions();
  const { success, error: toastError, confirmAction } = useToast();
  const [boms, setBoms] = useState<BOM[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [expandedBomId, setExpandedBomId] = useState<string | null>(null);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [uoms, setUoms] = useState<UOM[]>([]);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    finishedItemId: '',
    quantity: 1,
    uomId: '',
    description: '',
    routingNotes: '',
    components: [
      {
        itemId: '',
        quantity: 1,
        uomId: '',
        scrapPercentage: 0,
        sequence: 10,
        operationCode: 'ASSEMBLY',
        remarks: '',
      },
    ],
  });

  useEffect(() => {
    loadBoms();
    loadMasterData();
  }, [statusFilter]);

  const loadBoms = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchTerm.trim()) params.search = searchTerm.trim();
      const res = await productionApi.getBOMs(params);
      const bomsList = Array.isArray(res) ? res : (res?.data || []);
      setBoms(bomsList);
    } catch (err) {
      console.error('Failed to load BOMs', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMasterData = async () => {
    try {
      const [itemsRes, uomsRes] = await Promise.all([
        itemApi.getItems({ limit: 200 }),
        masterDataApi.getUOMs(),
      ]);
      setItems(itemsRes.data || itemsRes || []);
      setUoms(uomsRes || []);
    } catch (err) {
      console.error('Failed to load master items for BOM modal', err);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadBoms();
  };

  const handleActivate = (bomOrId: string | BOM) => {
    const bom = typeof bomOrId === 'string' ? boms.find((b) => b._id === bomOrId) : bomOrId;
    const id = typeof bomOrId === 'string' ? bomOrId : bomOrId._id;
    const label = bom ? `${bom.bomNumber} (${bom.name})` : 'this BOM';

    confirmAction({
      title: 'Activate BOM for Manufacturing?',
      message: `Are you sure you want to activate ${label}? It will become the active version for manufacturing.`,
      confirmLabel: 'Activate BOM',
      cancelLabel: 'Cancel',
      type: 'primary',
      onConfirm: async () => {
        try {
          await productionApi.activateBOM(id);
          success(`BOM ${bom?.bomNumber || ''} activated successfully`);
          loadBoms();
        } catch (err: any) {
          toastError(err.response?.data?.message || 'Failed to activate BOM');
        }
      },
    });
  };

  const handleArchive = (bomOrId: string | BOM) => {
    const bom = typeof bomOrId === 'string' ? boms.find((b) => b._id === bomOrId) : bomOrId;
    const id = typeof bomOrId === 'string' ? bomOrId : bomOrId._id;
    const label = bom ? `${bom.bomNumber}` : 'this BOM';

    confirmAction({
      title: 'Archive BOM Version?',
      message: `Are you sure you want to archive ${label}? It will no longer be available for new production orders.`,
      confirmLabel: 'Archive BOM',
      cancelLabel: 'Cancel',
      type: 'warning',
      onConfirm: async () => {
        try {
          await productionApi.archiveBOM(id);
          success('BOM version archived');
          loadBoms();
        } catch (err: any) {
          toastError(err.response?.data?.message || 'Failed to archive BOM');
        }
      },
    });
  };

  const handleClone = async (id: string) => {
    try {
      const cloned = await productionApi.cloneBOM(id);
      success(`Cloned successfully! New Draft Version: ${cloned.bomNumber} (v${cloned.version})`);
      loadBoms();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to clone BOM');
    }
  };

  const addComponentRow = () => {
    const nextSeq = (formData.components.length + 1) * 10;
    setFormData({
      ...formData,
      components: [
        ...formData.components,
        {
          itemId: '',
          quantity: 1,
          uomId: formData.uomId || (uoms[0]?._id ?? ''),
          scrapPercentage: 0,
          sequence: nextSeq,
          operationCode: 'ASSEMBLY',
          remarks: '',
        },
      ],
    });
  };

  const removeComponentRow = (index: number) => {
    if (formData.components.length === 1) return;
    const updated = formData.components.filter((_, idx) => idx !== index);
    setFormData({ ...formData, components: updated });
  };

  const handleComponentChange = (index: number, field: string, val: any) => {
    const updated = [...formData.components];
    if (field === 'itemId') {
      const selectedItem = items.find((i) => i._id === val);
      const rawUom = (selectedItem?.baseUomId as any)?._id || selectedItem?.baseUomId;
      const derivedUom = (typeof rawUom === 'string' ? rawUom : rawUom?._id) || updated[index].uomId || formData.uomId || (uoms[0]?._id ?? '');
      updated[index] = { ...updated[index], itemId: val, uomId: derivedUom };
    } else {
      updated[index] = { ...updated[index], [field]: val };
    }
    setFormData({ ...formData, components: updated });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    if (!formData.name.trim()) return setModalError('Recipe name is required');
    if (!formData.finishedItemId) return setModalError('Finished Good item is required');

    const finishedItem = items.find((i) => i._id === formData.finishedItemId);
    const rawFinishedUom = (finishedItem?.baseUomId as any)?._id || finishedItem?.baseUomId;
    const resolvedBaseUomId =
      (typeof formData.uomId === 'object' ? (formData.uomId as any)?._id : formData.uomId) ||
      (typeof rawFinishedUom === 'string' ? rawFinishedUom : rawFinishedUom?._id) ||
      (uoms[0]?._id ?? '');

    for (const c of formData.components) {
      if (!c.itemId) return setModalError('All component rows must select an item');
      if (Number(c.quantity) <= 0) return setModalError('Component quantities must be greater than 0');
    }

    try {
      setModalSubmitting(true);
      const finishedItemIdStr = typeof formData.finishedItemId === 'object' ? (formData.finishedItemId as any)?._id : formData.finishedItemId;

      await productionApi.createBOM({
        name: formData.name.trim(),
        finishedItemId: finishedItemIdStr,
        quantity: Number(formData.quantity) || 1,
        uomId: resolvedBaseUomId || undefined,
        description: formData.description?.trim() || undefined,
        routingNotes: formData.routingNotes?.trim() || undefined,
        components: formData.components.map((c) => {
          const compItem = items.find((i) => i._id === c.itemId);
          const rawCompUom = (compItem?.baseUomId as any)?._id || compItem?.baseUomId;
          const compUom =
            (typeof c.uomId === 'object' ? (c.uomId as any)?._id : c.uomId) ||
            (typeof rawCompUom === 'string' ? rawCompUom : rawCompUom?._id) ||
            resolvedBaseUomId ||
            undefined;

          const compItemIdStr = typeof c.itemId === 'object' ? (c.itemId as any)?._id : c.itemId;

          return {
            itemId: compItemIdStr,
            quantity: Number(c.quantity) || 1,
            uomId: compUom || resolvedBaseUomId || undefined,
            scrapPercentage: Number(c.scrapPercentage) || 0,
            sequence: Number(c.sequence) || 10,
            operationCode: c.operationCode || 'ASSEMBLY',
            remarks: c.remarks || undefined,
          };
        }),
      });

      setIsCreateModalOpen(false);
      loadBoms();
      success('BOM recipe created successfully');
    } catch (err: any) {
      const detailsMsg = err.response?.data?.details
        ? err.response.data.details.map((d: any) => `${d.path}: ${d.message}`).join(', ')
        : '';
      const finalMsg = detailsMsg
        ? `${err.response?.data?.message || 'Validation failed'} (${detailsMsg})`
        : (err.response?.data?.message || 'Failed to create BOM');
      setModalError(finalMsg);
    } finally {
      setModalSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Production Control</span>
            <span>&bull;</span>
            <span className="text-indigo-600 dark:text-indigo-400">Engineering Specifications</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">Bill of Materials (BOM) Catalog</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Multi-level product recipes, operation sequences, scrap tolerances, and version lifecycle management
          </p>
        </div>

        {can('bom.create') && (
          <button
            onClick={() => {
              const defaultFinished = items[0]?._id || '';
              const defaultFinishedItem = items.find((i) => i._id === defaultFinished);
              const defaultUom = (defaultFinishedItem?.baseUomId as string) || uoms[0]?._id || '';
              setFormData({
                name: '',
                finishedItemId: defaultFinished,
                quantity: 1,
                uomId: defaultUom,
                description: '',
                routingNotes: '',
                components: [
                  {
                    itemId: '',
                    quantity: 1,
                    uomId: defaultUom,
                    scrapPercentage: 0,
                    sequence: 10,
                    operationCode: 'ASSEMBLY',
                    remarks: '',
                  },
                ],
              });
              setModalError('');
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            Create Bill of Materials
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <form onSubmit={handleSearch} className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search BOM # or recipe name..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-500">Status:</span>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {['ALL', 'ACTIVE', 'DRAFT', 'ARCHIVED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === st
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* BOM Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 uppercase border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4 w-10"></th>
                <th className="py-3.5 px-4">BOM Number</th>
                <th className="py-3.5 px-4">Recipe / Assembly Name</th>
                <th className="py-3.5 px-4">Manufactured Item</th>
                <th className="py-3.5 px-4">Version</th>
                <th className="py-3.5 px-4">Components</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Loading Bill of Materials catalog...
                  </td>
                </tr>
              ) : boms.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No Bill of Materials matching your criteria.
                  </td>
                </tr>
              ) : (
                boms.map((bom) => {
                  const isExpanded = expandedBomId === bom._id;
                  return (
                    <React.Fragment key={bom._id}>
                      <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => setExpandedBomId(isExpanded ? null : bom._id)}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {bom.bomNumber}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-white">{bom.name}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-800 dark:text-slate-200">
                            {bom.finishedItemId?.name || 'Manufactured Assembly'}
                          </div>
                          <div className="text-xs text-slate-500 font-mono">
                            {bom.finishedItemId?.sku || 'SKU-000'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                            v{bom.version}.0
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                          {bom.components?.length || 0} items
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                              bom.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                                : bom.status === 'DRAFT'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {bom.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              to="/production/planning"
                              state={{ prefillBomId: bom._id }}
                              title="Plan in MRP Calculator"
                              className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400 rounded-lg text-xs font-semibold transition-colors"
                            >
                              <Compass className="w-3.5 h-3.5" />
                              <span>Plan</span>
                            </Link>

                            {bom.status === 'DRAFT' && can('bom.activate') && (
                              <button
                                onClick={() => handleActivate(bom._id)}
                                title="Activate BOM"
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 rounded-lg text-xs font-medium transition-colors"
                              >
                                Activate
                              </button>
                            )}
                            {can('bom.create') && (
                              <button
                                onClick={() => handleClone(bom._id)}
                                title="Clone Revision (v+1)"
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg transition-colors"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            )}
                            {bom.status === 'ACTIVE' && can('bom.archive') && (
                              <button
                                onClick={() => handleArchive(bom._id)}
                                title="Archive BOM"
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                              >
                                <Archive className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Components Sub-Table */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 dark:bg-slate-800/30">
                          <td colSpan={8} className="p-4 pl-14">
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                              <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                  BOM Components Breakdown & Scrap Allowances
                                </h3>
                                <span className="text-xs text-slate-400">
                                  Yield Base: {bom.quantity} {bom.uomId?.code || 'Units'}
                                </span>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                  <thead className="text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                    <tr>
                                      <th className="py-2 px-2">Seq</th>
                                      <th className="py-2 px-2">Component Item</th>
                                      <th className="py-2 px-2">Gross Qty / Unit</th>
                                      <th className="py-2 px-2">Scrap Factor</th>
                                      <th className="py-2 px-2">Operation</th>
                                      <th className="py-2 px-2">Notes</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                    {bom.components?.map((c, idx) => (
                                      <tr key={idx}>
                                        <td className="py-2 px-2 font-mono text-slate-500">{c.sequence || (idx + 1) * 10}</td>
                                        <td className="py-2 px-2 font-medium text-slate-800 dark:text-slate-200">
                                          {c.itemId?.name || 'Raw Component'}
                                          <span className="block text-[10px] text-slate-400 font-mono">
                                            {c.itemId?.sku || ''}
                                          </span>
                                        </td>
                                        <td className="py-2 px-2 font-bold text-slate-900 dark:text-white">
                                          {c.quantity} {c.uomId?.code || 'PCS'}
                                        </td>
                                        <td className="py-2 px-2 text-amber-600 dark:text-amber-400 font-semibold">
                                          {c.scrapPercentage || 0}%
                                        </td>
                                        <td className="py-2 px-2">
                                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[10px]">
                                            {c.operationCode || 'ASSEMBLY'}
                                          </span>
                                        </td>
                                        <td className="py-2 px-2 text-slate-500">{c.remarks || '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create BOM Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-4xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Create Engineering Bill of Materials (BOM)
                </h2>
                <p className="text-xs text-slate-500">
                  Specify manufacturing components, scrap factor percentages, and operation routing steps
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    BOM Recipe Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Standard Hydraulic Pump Assembly BOM"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Finished Good Manufactured Item *
                  </label>
                  <Select
                    value={typeof formData.finishedItemId === 'object' ? (formData.finishedItemId as any)?._id : formData.finishedItemId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const selectedItm = items.find((i) => i._id === selectedId);
                      const rawBaseUom = (selectedItm?.baseUomId as any)?._id || selectedItm?.baseUomId;
                      const baseUomIdStr = (typeof rawBaseUom === 'string' ? rawBaseUom : rawBaseUom?._id) || '';
                      setFormData({ ...formData, finishedItemId: selectedId, uomId: baseUomIdStr || formData.uomId });
                    }}
                    placeholder="Select Manufactured Item..."
                    searchable
                    variant="indigo"
                    options={items.map((itm) => ({
                      value: itm._id,
                      label: itm.name,
                      sublabel: itm.sku || itm.code || 'NO-SKU',
                      badge: (itm as any).itemType || (itm as any).type || undefined,
                    }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Batch Output Quantity *
                  </label>
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    required
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Base Output UOM *
                  </label>
                  <Select
                    value={typeof formData.uomId === 'object' ? (formData.uomId as any)?._id : formData.uomId}
                    onChange={(e) => setFormData({ ...formData, uomId: e.target.value })}
                    placeholder="Select UOM..."
                    variant="indigo"
                    options={uoms.map((u) => ({
                      value: u._id,
                      label: `${u.name} (${u.code})`,
                      badge: u.code,
                    }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Cycle Detection Guard
                  </label>
                  <div className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Recursive DFS Cycle Check Active</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Components Row Editor */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Raw Material Components & Sub-Assemblies
                  </span>
                  <button
                    type="button"
                    onClick={addComponentRow}
                    className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Component Row
                  </button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {formData.components.map((comp, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 items-center"
                    >
                      <div className="col-span-1">
                        <label className="block text-[10px] text-slate-400">Seq</label>
                        <input
                          type="number"
                          value={comp.sequence}
                          onChange={(e) => handleComponentChange(idx, 'sequence', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                        />
                      </div>

                      <div className="col-span-4">
                        <label className="block text-[10px] text-slate-400">Component Item *</label>
                        <Select
                          size="sm"
                          value={comp.itemId}
                          onChange={(e) => handleComponentChange(idx, 'itemId', e.target.value)}
                          placeholder="Select component..."
                          searchable
                          variant="indigo"
                          options={items
                            .filter((itm) => itm._id !== formData.finishedItemId)
                            .map((itm) => ({
                              value: itm._id,
                              label: itm.name,
                              sublabel: itm.sku || itm.code || 'ITEM',
                            }))}
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[10px] text-slate-400">Qty / Unit *</label>
                        <input
                          type="number"
                          min="0.001"
                          step="any"
                          required
                          value={comp.quantity}
                          onChange={(e) => handleComponentChange(idx, 'quantity', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[10px] text-slate-400">Scrap %</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={comp.scrapPercentage}
                          onChange={(e) => handleComponentChange(idx, 'scrapPercentage', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[10px] text-slate-400">Operation</label>
                        <Select
                          size="sm"
                          value={comp.operationCode}
                          onChange={(e) => handleComponentChange(idx, 'operationCode', e.target.value)}
                          variant="indigo"
                          options={[
                            { value: 'MACHINING', label: 'MACHINING' },
                            { value: 'CNC_MILLING', label: 'CNC MILLING' },
                            { value: 'ASSEMBLY', label: 'ASSEMBLY' },
                            { value: 'SEALING', label: 'SEALING' },
                            { value: 'ELECTRICAL', label: 'ELECTRICAL' },
                            { value: 'TESTING', label: 'TESTING' },
                          ]}
                        />
                      </div>

                      <div className="col-span-1 flex justify-center pt-3">
                        <button
                          type="button"
                          onClick={() => removeComponentRow(idx)}
                          disabled={formData.components.length === 1}
                          className="text-slate-400 hover:text-rose-500 disabled:opacity-30 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition-colors disabled:opacity-50"
                >
                  {modalSubmitting ? 'Saving BOM...' : 'Save Draft Recipe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
