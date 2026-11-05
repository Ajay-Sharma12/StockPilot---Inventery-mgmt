import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Layers,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  X,
  Trash2,
  Warehouse as WarehouseIcon,
  Boxes,
  CheckCircle2,
  ArrowUpRight,
  FileText,
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { itemApi } from '../../api/item.api';
import { masterDataApi } from '../../api/masterData.api';
import { warehouseApi, Warehouse } from '../../api/warehouse.api';
import { inventoryApi } from '../../api/inventory.api';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../context/ToastContext';

export const ItemMasterPage: React.FC = () => {
  const { can, hasRole, isSuperAdmin } = usePermissions();
  const { success, error: toastError } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedItemType, setSelectedItemType] = useState('');

  // Quick Add Category State
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatCode, setNewCatCode] = useState('');
  const [catSaving, setCatSaving] = useState(false);

  // Quick Add UOM State
  const [showAddUom, setShowAddUom] = useState(false);
  const [newUomName, setNewUomName] = useState('');
  const [newUomCode, setNewUomCode] = useState('');
  const [newUomSymbol, setNewUomSymbol] = useState('');
  const [uomSaving, setUomSaving] = useState(false);

  // Clean Sample Data Action State
  const [sampleActionLoading, setSampleActionLoading] = useState(false);

  // Details Drawer
  const [activeItemDetails, setActiveItemDetails] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Quick Add Stock Modal State
  const [stockModalItem, setStockModalItem] = useState<any | null>(null);
  const [stockQuantity, setStockQuantity] = useState<number>(50);
  const [stockWarehouseId, setStockWarehouseId] = useState<string>('');
  const [stockUnitCost, setStockUnitCost] = useState<number>(0);
  const [stockBatchNumber, setStockBatchNumber] = useState<string>('');
  const [stockNotes, setStockNotes] = useState<string>('');
  const [stockSubmitting, setStockSubmitting] = useState<boolean>(false);
  const [stockError, setStockError] = useState<string>('');
  const [stockErrors, setStockErrors] = useState<Record<string, string>>({});

  // Stock History state (per-item ledger inside Details modal)
  const [stockHistory, setStockHistory] = useState<any[]>([]);
  const [stockHistoryTotal, setStockHistoryTotal] = useState(0);
  const [stockHistoryPage, setStockHistoryPage] = useState(1);
  const [stockHistoryLoading, setStockHistoryLoading] = useState(false);
  const [stockHistoryCurrentStock, setStockHistoryCurrentStock] = useState(0);;

  // Create Item Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    categoryId: '',
    itemType: 'RAW_MATERIAL',
    baseUomId: '',
    standardCost: 0,
    sellingPrice: 0,
    reorderLevel: 0,
    minimumStock: 0,
    maximumStock: 0,
    batchManaged: false,
    serialManaged: false,
    openingStock: 0,
    warehouseId: '',
  });

  const loadItems = async () => {
    try {
      setLoading(true);
      const res = await itemApi.getItems({
        search: search || undefined,
        categoryId: selectedCategory || undefined,
        itemType: selectedItemType || undefined,
        limit: 50,
      });
      setItems(res.data || []);
    } catch (err: any) {
      console.error('Failed to load items', err);
      toastError(err.response?.data?.message || 'Failed to load items catalog');
    } finally {
      setLoading(false);
    }
  };

  const loadReferenceData = async () => {
    try {
      let [cats, uomList, whList] = await Promise.all([
        masterDataApi.getCategories(),
        masterDataApi.getUOMs(),
        warehouseApi.getWarehouses().catch(() => []),
      ]);

      // If tenant has no categories or UOMs yet, automatically initialize standard starter master data
      if ((!cats || cats.length === 0) && (!uomList || uomList.length === 0)) {
        try {
          await masterDataApi.initializeStarterData();
          [cats, uomList] = await Promise.all([
            masterDataApi.getCategories(),
            masterDataApi.getUOMs(),
          ]);
        } catch (initErr) {
          console.warn('Auto starter data initialization skipped:', initErr);
        }
      }

      setCategories(cats || []);
      setUoms(uomList || []);
      setWarehouses(whList || []);
      if (whList && whList.length > 0) {
        setFormData((prev) => ({
          ...prev,
          warehouseId: prev.warehouseId || whList[0]._id,
        }));
      }
    } catch (err) {
      console.error('Failed to load categories/uoms/warehouses', err);
    }
  };

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await Promise.all([loadReferenceData(), loadItems()]);
    } finally {
      setTimeout(() => setRefreshing(false), 300);
    }
  };

  // Immediate fetch on mount without 300ms delay to eliminate screen blink
  const isInitialMount = useRef(true);
  useEffect(() => {
    loadReferenceData();
    loadItems();
  }, []);

  // Debounced fetch only when search or filter controls are actively changed by user
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      loadItems();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, selectedCategory, selectedItemType]);

  const openAddStockModal = (item: any) => {
    setStockModalItem(item);
    const suggestedQty = item.reorderLevel > 0 ? item.reorderLevel : 50;
    setStockQuantity(suggestedQty);
    setStockWarehouseId(warehouses.length > 0 ? warehouses[0]._id : '');
    setStockUnitCost(item.standardCost || 0);
    setStockBatchNumber(`LOT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setStockNotes('Initial stock inward');
    setStockError('');
    setStockErrors({});
  };

  const handleAddStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockModalItem) return;
    const errors: Record<string, string> = {};
    const qty = Number(stockQuantity);
    if (!qty || isNaN(qty) || qty <= 0) {
      errors.quantity = 'Please enter a quantity greater than zero';
    }
    if (!stockWarehouseId) {
      errors.warehouseId = 'Please select a target warehouse facility';
    }

    if (Object.keys(errors).length > 0) {
      setStockErrors(errors);
      return;
    }
    setStockErrors({});

    try {
      setStockSubmitting(true);
      setStockError('');
      await itemApi.addStock(stockModalItem._id, {
        quantity: qty,
        warehouseId: stockWarehouseId || undefined,
        unitCost: Number(stockUnitCost || 0),
        batchNumber: stockBatchNumber || undefined,
        notes: stockNotes || undefined,
      });

      success(`Successfully added ${qty} ${stockModalItem.baseUomId?.code || 'units'} to ${stockModalItem.sku}!`);
      setStockModalItem(null);
      setStockErrors({});
      await loadItems();
      if (activeItemDetails && activeItemDetails.item?._id === stockModalItem._id) {
        await viewItemDetails(stockModalItem._id);
      }
    } catch (err: any) {
      setStockError(err.response?.data?.message || err.message || 'Failed to add stock');
    } finally {
      setStockSubmitting(false);
    }
  };

  const handleQuickAddCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      setCatSaving(true);
      const code = newCatCode.trim().toUpperCase() || newCatName.trim().substring(0, 4).toUpperCase();
      const created = await masterDataApi.createCategory({ name: newCatName.trim(), code });
      setCategories((prev) => [...prev, created]);
      setFormData((prev) => ({ ...prev, categoryId: created._id }));
      setNewCatName('');
      setNewCatCode('');
      setShowAddCategory(false);
      success(`Category "${created.name}" created`);
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to create category');
    } finally {
      setCatSaving(false);
    }
  };

  const handleQuickAddUom = async () => {
    if (!newUomName.trim()) return;
    try {
      setUomSaving(true);
      const code = newUomCode.trim().toUpperCase() || newUomName.trim().substring(0, 3).toUpperCase();
      const symbol = newUomSymbol.trim() || code.toLowerCase();
      const created = await masterDataApi.createUOM({ name: newUomName.trim(), code, symbol });
      setUoms((prev) => [...prev, created]);
      setFormData((prev) => ({ ...prev, baseUomId: created._id }));
      setNewUomName('');
      setNewUomCode('');
      setNewUomSymbol('');
      setShowAddUom(false);
      success(`UOM "${created.name}" created`);
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to create UOM');
    } finally {
      setUomSaving(false);
    }
  };

  const handleClearSampleData = async () => {
    try {
      setSampleActionLoading(true);
      await masterDataApi.clearSampleData();
      await loadReferenceData();
      await loadItems();
      success('Sample data cleared successfully');
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to clear sample data');
    } finally {
      setSampleActionLoading(false);
    }
  };

  const viewItemDetails = async (itemId: string) => {
    try {
      setDetailsLoading(true);
      const data = await itemApi.getItemById(itemId);
      setActiveItemDetails(data);
    } catch (err) {
      console.error('Failed to fetch item details', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!formData.sku.trim()) errors.sku = 'SKU code is required';
    if (!formData.name.trim()) errors.name = 'Item name is required';
    if (!formData.categoryId) errors.categoryId = 'Please select an item category';
    if (!formData.baseUomId) errors.baseUomId = 'Please select a base unit of measurement';
    if (formData.openingStock > 0 && !formData.warehouseId) {
      errors.warehouseId = 'Target warehouse is required when specifying opening stock';
    }

    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      return;
    }
    setCreateErrors({});

    try {
      setCreateLoading(true);
      setCreateError('');
      await itemApi.createItem({
        ...formData,
        standardCost: Number(formData.standardCost),
        sellingPrice: Number(formData.sellingPrice),
        reorderLevel: Number(formData.reorderLevel),
        minimumStock: Number(formData.minimumStock),
        maximumStock: Number(formData.maximumStock),
        openingStock: Number(formData.openingStock || 0),
        warehouseId: formData.warehouseId || undefined,
      });

      success(`SKU '${formData.sku}' created successfully!`);
      setIsCreateModalOpen(false);
      setCreateErrors({});
      setFormData({
        sku: '',
        name: '',
        description: '',
        categoryId: '',
        itemType: 'RAW_MATERIAL',
        baseUomId: '',
        standardCost: 0,
        sellingPrice: 0,
        reorderLevel: 0,
        minimumStock: 0,
        maximumStock: 0,
        batchManaged: false,
        serialManaged: false,
        openingStock: 0,
        warehouseId: warehouses.length > 0 ? warehouses[0]._id : '',
      });
      loadItems();
    } catch (err: any) {
      setCreateError(err.response?.data?.message || err.message || 'Failed to create item');
    } finally {
      setCreateLoading(false);
    }
  };

  const canCreate = isSuperAdmin || can('inventory:create');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Package className="w-7 h-7 text-emerald-400" />
            Item Master Registry
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Complete enterprise SKU catalog with reorder points, categorization, and facility breakdown
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="text-xs border-slate-700 hover:bg-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing || loading ? 'animate-spin text-emerald-400' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>

          {hasRole('tenant-admin') && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearSampleData}
              isLoading={sampleActionLoading}
              className="text-xs border-slate-700 text-slate-300 hover:text-rose-400 hover:border-rose-500/40"
              title="Remove sample/demo items to start with your own data"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Clear Sample Data
            </Button>
          )}

          {canCreate && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setCreateError('');
                setIsCreateModalOpen(true);
              }}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              New Item
            </Button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="bg-slate-900/60 border-slate-800 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by SKU, code or name..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <Select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              options={[
                { value: '', label: 'All Categories' },
                ...categories.map((c) => ({ value: c._id, label: `${c.name} (${c.code})` })),
              ]}
              placeholder="All Categories"
            />
          </div>

          <div>
            <Select
              value={selectedItemType}
              onChange={(e) => setSelectedItemType(e.target.value)}
              options={[
                { value: '', label: 'All Types' },
                { value: 'RAW_MATERIAL', label: 'Raw Material' },
                { value: 'FINISHED_GOOD', label: 'Finished Good' },
                { value: 'SEMI_FINISHED', label: 'Semi Finished' },
                { value: 'PACKAGING', label: 'Packaging' },
                { value: 'CONSUMABLE', label: 'Consumable' },
                { value: 'SERVICE', label: 'Service' },
              ]}
              placeholder="All Types"
            />
          </div>
        </div>
      </Card>

      {/* Item Table */}
      <Card className="bg-slate-900/80 border-slate-800 shadow-md">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">SKU / Code</th>
                  <th className="py-3 px-4 font-semibold">Item Name</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold">UOM</th>
                  <th className="py-3 px-4 font-semibold">Standard Cost</th>
                  <th className="py-3 px-4 font-semibold">Available Stock</th>
                  <th className="py-3 px-4 font-semibold">Reorder Pt</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {/* 1. Loading Skeleton: renders when initially loading and items not yet fetched */}
                {loading && items.length === 0 ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <tr key={`skel-row-${idx}`} className="animate-pulse border-b border-slate-800/40">
                      <td className="py-3.5 px-4">
                        <div className="h-3.5 bg-slate-800 rounded w-24 mb-1.5"></div>
                        <div className="h-2.5 bg-slate-800/50 rounded w-16"></div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="h-3.5 bg-slate-800 rounded w-28 mb-1.5"></div>
                        <div className="h-2.5 bg-slate-800/50 rounded w-16"></div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="h-3.5 bg-slate-800 rounded w-24"></div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="h-3.5 bg-slate-800 rounded w-12"></div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="h-3.5 bg-slate-800 rounded w-16"></div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="h-4 bg-slate-800 rounded w-12"></div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="h-3.5 bg-slate-800 rounded w-10"></div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="h-5 bg-slate-800 rounded-full w-20"></div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="h-6 bg-slate-800 rounded w-28 ml-auto"></div>
                      </td>
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  /* 2. Empty State: Only shown when fetch is genuinely complete and 0 items exist */
                  <tr>
                    <td colSpan={9} className="py-12 text-center">
                      <div className="max-w-md mx-auto space-y-3">
                        <Package className="w-10 h-10 text-slate-600 mx-auto" />
                        <h4 className="text-sm font-semibold text-white">No items in your catalog</h4>
                        <p className="text-xs text-slate-400">
                          {search || selectedCategory || selectedItemType
                            ? 'No items match your active filters.'
                            : 'Start registering your company’s inventory items with custom SKUs, categories, and units.'}
                        </p>
                        {!search && !selectedCategory && !selectedItemType && canCreate && (
                          <div className="pt-2">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                setCreateError('');
                                setIsCreateModalOpen(true);
                              }}
                              className="text-xs bg-emerald-600 hover:bg-emerald-500 shadow-sm"
                            >
                              <Plus className="w-3.5 h-3.5 mr-1" />
                              Add Your First Item
                            </Button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  /* 3. Real Items Rows */
                  items.map((item) => (
                    <tr
                      key={item._id}
                      onClick={() => viewItemDetails(item._id)}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 font-mono">
                        <span className="font-bold text-emerald-400 group-hover:underline">
                          {item.sku}
                        </span>
                        <span className="block text-[11px] text-slate-500">{item.itemCode}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-200">{item.name}</span>
                        <span className="block text-[10px] text-slate-500 uppercase">{item.itemType}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {item.categoryId?.name || 'Unassigned'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {item.baseUomId?.code || item.baseUomId?.symbol || 'PCS'}
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-mono">
                        ${(item.standardCost || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">
                        <span className={item.totalAvailable > 0 ? 'text-emerald-400 text-sm' : 'text-slate-400 text-sm'}>
                          {item.totalAvailable ?? 0}
                        </span>
                        <span className="text-[10px] text-slate-500 font-normal ml-1">
                          {item.baseUomId?.code || item.baseUomId?.symbol || ''}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono">
                        {item.reorderLevel || 0}
                      </td>
                      <td className="py-3 px-4">
                        {item.stockStatus === 'OUT_OF_STOCK' && (
                          <Badge variant="error" size="sm">Out of Stock</Badge>
                        )}
                        {item.stockStatus === 'CRITICAL' && (
                          <Badge variant="error" size="sm">Critical</Badge>
                        )}
                        {item.stockStatus === 'LOW' && (
                          <Badge variant="warning" size="sm">Low Stock</Badge>
                        )}
                        {item.stockStatus === 'NORMAL' && (
                          <Badge variant="success" size="sm">Adequate</Badge>
                        )}
                        {item.stockStatus === 'UNSTOCKED' && (
                          <Badge variant="outline" size="sm" className="text-slate-400 border-slate-700 bg-slate-800/40">
                            0 in Stock
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openAddStockModal(item)}
                            className="text-[11px] h-7 px-2.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500 font-medium"
                            title="Add stock to this item"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Stock
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              await viewItemDetails(item._id);
                              // Load stock history for this item
                              setStockHistoryPage(1);
                              setStockHistoryLoading(true);
                              try {
                                const res = await inventoryApi.getItemTransactions(item._id, { page: 1, limit: 20 });
                                setStockHistory(res?.items || []);
                                setStockHistoryTotal(res?.total || 0);
                                setStockHistoryCurrentStock(res?.currentStock || 0);
                              } catch { /* ignore */ }
                              finally { setStockHistoryLoading(false); }
                            }}
                            className="text-[11px] h-7 px-2.5 border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500 font-medium"
                            title="View stock movement history"
                          >
                            <FileText className="w-3 h-3 mr-1" />
                            History
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewItemDetails(item._id)}
                            className="text-[11px] h-7 px-2 text-slate-400 hover:text-white"
                          >
                            Details &rarr;
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Item Details Slideover Modal */}
      {activeItemDetails && (
        <Modal
          isOpen={!!activeItemDetails}
          onClose={() => setActiveItemDetails(null)}
          title={`SKU: ${activeItemDetails.item.sku} - ${activeItemDetails.item.name}`}
          maxWidth="2xl"
        >
          <div className="space-y-6 text-xs">
            {/* Quick Specs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-500 uppercase text-[10px] font-semibold">Item Code</span>
                <p className="font-mono font-bold text-white text-sm">{activeItemDetails.item.itemCode}</p>
              </div>
              <div>
                <span className="text-slate-500 uppercase text-[10px] font-semibold">Category</span>
                <p className="font-semibold text-slate-200 text-sm">{activeItemDetails.item.categoryId?.name}</p>
              </div>
              <div>
                <span className="text-slate-500 uppercase text-[10px] font-semibold">Standard Cost</span>
                <p className="font-mono font-bold text-emerald-400 text-sm">${activeItemDetails.item.standardCost?.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-slate-500 uppercase text-[10px] font-semibold">Selling Price</span>
                <p className="font-mono font-bold text-white text-sm">${activeItemDetails.item.sellingPrice?.toFixed(2)}</p>
              </div>
            </div>

            {/* Thresholds & Inventory Configuration */}
            <div className="grid grid-cols-3 gap-3 bg-slate-800/40 p-3 rounded-lg">
              <div>
                <span className="text-slate-400">Reorder Level:</span>
                <span className="font-bold text-white ml-2">{activeItemDetails.item.reorderLevel}</span>
              </div>
              <div>
                <span className="text-slate-400">Min Safety Stock:</span>
                <span className="font-bold text-white ml-2">{activeItemDetails.item.minimumStock}</span>
              </div>
              <div>
                <span className="text-slate-400">Max Capacity:</span>
                <span className="font-bold text-white ml-2">{activeItemDetails.item.maximumStock}</span>
              </div>
            </div>

            {/* Warehouse Stock Breakdown */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <WarehouseIcon className="w-4 h-4 text-emerald-400" />
                  Physical Stock Breakdown by Warehouse
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openAddStockModal(activeItemDetails.item)}
                  className="text-xs h-7 px-2.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Stock
                </Button>
              </div>

              {activeItemDetails.warehouseStock?.length === 0 ? (
                <div className="p-4 bg-slate-950/40 rounded-lg text-slate-500 text-center">
                  No inventory currently recorded in any facility for this SKU.
                </div>
              ) : (
                <div className="border border-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Warehouse</th>
                        <th className="py-2.5 px-3">Bin Location</th>
                        <th className="py-2.5 px-3">Batch Number</th>
                        <th className="py-2.5 px-3">On Hand</th>
                        <th className="py-2.5 px-3">Available</th>
                        <th className="py-2.5 px-3">Total Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {activeItemDetails.warehouseStock.map((b: any) => (
                        <tr key={b.id}>
                          <td className="py-2 px-3 font-semibold text-slate-200">
                            {b.warehouse?.code} - {b.warehouse?.name}
                          </td>
                          <td className="py-2 px-3 text-slate-400 font-mono">
                            {b.location?.code || 'General'}
                          </td>
                          <td className="py-2 px-3 text-slate-400 font-mono">
                            {b.batchNumber || '—'}
                          </td>
                          <td className="py-2 px-3 font-bold text-white">
                            {b.quantity}
                          </td>
                          <td className="py-2 px-3 font-bold text-emerald-400">
                            {b.availableQuantity}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-300">
                            ${b.totalValue?.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Stock Movement History Section */}
            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-950/60 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span className="font-semibold text-white text-sm">Stock Transaction History</span>
                  <span className="text-[11px] text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded">
                    {stockHistoryTotal} records
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">Current Stock:</span>
                  <span className="font-bold text-emerald-400 font-mono">{stockHistoryCurrentStock}</span>
                  <button
                    onClick={async () => {
                      if (!activeItemDetails) return;
                      setStockHistoryLoading(true);
                      try {
                        const res = await inventoryApi.getItemTransactions(activeItemDetails.item._id, { page: stockHistoryPage, limit: 20 });
                        setStockHistory(res?.items || []);
                        setStockHistoryTotal(res?.total || 0);
                        setStockHistoryCurrentStock(res?.currentStock || 0);
                      } catch { /* ignore */ }
                      finally { setStockHistoryLoading(false); }
                    }}
                    className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-emerald-400 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${stockHistoryLoading ? 'animate-spin text-emerald-400' : ''}`} />
                  </button>
                </div>
              </div>

              {stockHistoryLoading ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
                  Loading transaction history...
                </div>
              ) : stockHistory.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No transaction history found for this item.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2 px-3">Txn #</th>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Type</th>
                        <th className="py-2 px-3">Warehouse</th>
                        <th className="py-2 px-3 text-right">Qty In</th>
                        <th className="py-2 px-3 text-right">Qty Out</th>
                        <th className="py-2 px-3 text-right text-amber-400/80">Before</th>
                        <th className="py-2 px-3 text-right text-white">After</th>
                        <th className="py-2 px-3">By / Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {stockHistory.map((t: any) => {
                        const isIn = Number(t.quantityIn) > 0;
                        return (
                          <tr key={t.id} className="hover:bg-slate-800/30">
                            <td className="py-2 px-3 font-mono text-emerald-400 whitespace-nowrap">{t.transactionNumber}</td>
                            <td className="py-2 px-3 text-slate-400 whitespace-nowrap font-mono">
                              {new Date(t.transactionDate).toLocaleDateString()}
                            </td>
                            <td className="py-2 px-3">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                                isIn ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30' : 'bg-rose-950/40 text-rose-300 border-rose-500/30'
                              }`}>{t.transactionType}</span>
                            </td>
                            <td className="py-2 px-3 text-slate-300">{t.warehouse?.code}</td>
                            <td className="py-2 px-3 text-right font-mono">
                              {isIn ? <span className="text-emerald-400">+{t.quantityIn}</span> : <span className="text-slate-600">—</span>}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              {!isIn && Number(t.quantityOut) > 0 ? <span className="text-rose-400">-{t.quantityOut}</span> : <span className="text-slate-600">—</span>}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-amber-300/80">
                              {t.balanceBefore !== null && t.balanceBefore !== undefined ? t.balanceBefore : '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-white">{t.balanceAfter}</td>
                            <td className="py-2 px-3 text-slate-400 max-w-[140px]">
                              <span className="text-slate-200 truncate block">{t.user?.name || 'System'}</span>
                              <span className="text-slate-500 truncate block text-[10px]">{t.reason}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination for stock history */}
              {Math.ceil(stockHistoryTotal / 20) > 1 && (
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-800 bg-slate-950/40">
                  <span className="text-[11px] text-slate-500">Page {stockHistoryPage} of {Math.ceil(stockHistoryTotal / 20)}</span>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={stockHistoryPage <= 1 || stockHistoryLoading}
                      onClick={async () => {
                        const newPage = stockHistoryPage - 1;
                        setStockHistoryPage(newPage);
                        setStockHistoryLoading(true);
                        try {
                          const res = await inventoryApi.getItemTransactions(activeItemDetails.item._id, { page: newPage, limit: 20 });
                          setStockHistory(res?.items || []);
                        } catch { /* ignore */ } finally { setStockHistoryLoading(false); }
                      }}
                      className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 hover:bg-slate-800 transition-colors"
                    ><ChevronLeft className="w-4 h-4" /></button>
                    <button
                      disabled={stockHistoryPage >= Math.ceil(stockHistoryTotal / 20) || stockHistoryLoading}
                      onClick={async () => {
                        const newPage = stockHistoryPage + 1;
                        setStockHistoryPage(newPage);
                        setStockHistoryLoading(true);
                        try {
                          const res = await inventoryApi.getItemTransactions(activeItemDetails.item._id, { page: newPage, limit: 20 });
                          setStockHistory(res?.items || []);
                        } catch { /* ignore */ } finally { setStockHistoryLoading(false); }
                      }}
                      className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 hover:bg-slate-800 transition-colors"
                    ><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <Button variant="outline" size="sm" onClick={() => setActiveItemDetails(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Item Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setCreateErrors({});
        }}
        title="Register New Item (SKU)"
        description="Add a new catalog item with unit measurements, costing, and inventory parameters"
        maxWidth="xl"
      >
        <form onSubmit={handleCreateItem} noValidate className="space-y-4 text-xs">
          {createError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
              {createError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1">SKU (Unique Code) *</label>
              <Input
                value={formData.sku}
                onChange={(e) => {
                  setFormData({ ...formData, sku: e.target.value.toUpperCase() });
                  if (createErrors.sku) setCreateErrors((prev) => ({ ...prev, sku: '' }));
                }}
                placeholder="e.g. RM-STEEL-01"
                error={createErrors.sku}
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Item Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (createErrors.name) setCreateErrors((prev) => ({ ...prev, name: '' }));
                }}
                placeholder="e.g. Structural Alloy Rod 10mm"
                error={createErrors.name}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-slate-300 font-medium text-xs">Category *</label>
                <button
                  type="button"
                  onClick={() => setShowAddCategory(!showAddCategory)}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium transition-colors"
                >
                  <Plus className="w-3 h-3" /> {showAddCategory ? 'Cancel' : '+ Quick Add'}
                </button>
              </div>

              {showAddCategory ? (
                <div className="p-2.5 rounded-lg bg-slate-800/90 border border-emerald-500/40 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Category Name (e.g. Steel)"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="text-xs"
                    />
                    <Input
                      placeholder="Code (e.g. STL)"
                      value={newCatCode}
                      onChange={(e) => setNewCatCode(e.target.value.toUpperCase())}
                      className="text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAddCategory(false)}
                      className="text-[11px] h-7 px-2"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleQuickAddCategory}
                      isLoading={catSaving}
                      className="text-[11px] h-7 px-2.5 bg-emerald-600 hover:bg-emerald-500"
                    >
                      Save Category
                    </Button>
                  </div>
                </div>
              ) : (
                <Select
                  value={formData.categoryId}
                  onChange={(e) => {
                    setFormData({ ...formData, categoryId: e.target.value });
                    if (createErrors.categoryId) setCreateErrors((prev) => ({ ...prev, categoryId: '' }));
                  }}
                  options={[
                    { value: '', label: 'Select Category...' },
                    ...categories.map((c) => ({ value: c._id, label: `${c.name} (${c.code})` })),
                  ]}
                  placeholder="Select Category..."
                  error={createErrors.categoryId}
                />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-slate-300 font-medium text-xs">Base UOM *</label>
                <button
                  type="button"
                  onClick={() => setShowAddUom(!showAddUom)}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium transition-colors"
                >
                  <Plus className="w-3 h-3" /> {showAddUom ? 'Cancel' : '+ Quick Add'}
                </button>
              </div>

              {showAddUom ? (
                <div className="p-2.5 rounded-lg bg-slate-800/90 border border-emerald-500/40 space-y-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    <Input
                      placeholder="Unit Name (e.g. Roll)"
                      value={newUomName}
                      onChange={(e) => setNewUomName(e.target.value)}
                      className="text-xs col-span-1"
                    />
                    <Input
                      placeholder="Code (RL)"
                      value={newUomCode}
                      onChange={(e) => setNewUomCode(e.target.value.toUpperCase())}
                      className="text-xs col-span-1"
                    />
                    <Input
                      placeholder="Symbol (rl)"
                      value={newUomSymbol}
                      onChange={(e) => setNewUomSymbol(e.target.value)}
                      className="text-xs col-span-1"
                    />
                  </div>
                  <div className="flex justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAddUom(false)}
                      className="text-[11px] h-7 px-2"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleQuickAddUom}
                      isLoading={uomSaving}
                      className="text-[11px] h-7 px-2.5 bg-emerald-600 hover:bg-emerald-500"
                    >
                      Save UOM
                    </Button>
                  </div>
                </div>
              ) : (
                <Select
                  value={formData.baseUomId}
                  onChange={(e) => {
                    setFormData({ ...formData, baseUomId: e.target.value });
                    if (createErrors.baseUomId) setCreateErrors((prev) => ({ ...prev, baseUomId: '' }));
                  }}
                  options={[
                    { value: '', label: 'Select UOM...' },
                    ...uoms.map((u) => ({ value: u._id, label: `${u.name} (${u.symbol || u.code})` })),
                  ]}
                  placeholder="Select UOM..."
                  error={createErrors.baseUomId}
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1 text-xs">Item Type</label>
              <Select
                value={formData.itemType}
                onChange={(e) => setFormData({ ...formData, itemType: e.target.value })}
                options={[
                  { value: 'RAW_MATERIAL', label: 'Raw Material' },
                  { value: 'FINISHED_GOOD', label: 'Finished Good' },
                  { value: 'SEMI_FINISHED', label: 'Semi Finished' },
                  { value: 'PACKAGING', label: 'Packaging' },
                  { value: 'CONSUMABLE', label: 'Consumable' },
                  { value: 'SERVICE', label: 'Service' },
                ]}
                placeholder="Item Type"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Standard Cost ($)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.standardCost}
                onChange={(e) => setFormData({ ...formData, standardCost: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Selling Price ($)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.sellingPrice}
                onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Reorder Point</label>
              <Input
                type="number"
                min="0"
                value={formData.reorderLevel}
                onChange={(e) => setFormData({ ...formData, reorderLevel: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Min Stock Level</label>
              <Input
                type="number"
                min="0"
                value={formData.minimumStock}
                onChange={(e) => setFormData({ ...formData, minimumStock: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Max Stock Level</label>
              <Input
                type="number"
                min="0"
                value={formData.maximumStock}
                onChange={(e) => setFormData({ ...formData, maximumStock: Number(e.target.value) })}
              />
            </div>
          </div>

          {/* Initial Opening Stock & Warehouse Facility */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-emerald-500/25 space-y-2.5">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
              <Boxes className="w-4 h-4" />
              <span>Initial Opening Stock (Optional)</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Specify starting stock to immediately activate available inventory upon SKU registration.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1 text-xs">Opening Quantity</label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={formData.openingStock}
                  onChange={(e) => setFormData({ ...formData, openingStock: Number(e.target.value) })}
                  placeholder="e.g. 100"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1 text-xs">Target Warehouse</label>
                <Select
                  value={formData.warehouseId}
                  onChange={(e) => {
                    setFormData({ ...formData, warehouseId: e.target.value });
                    if (createErrors.warehouseId) setCreateErrors((prev) => ({ ...prev, warehouseId: '' }));
                  }}
                  options={[
                    { value: '', label: 'Select Facility...' },
                    ...warehouses.map((w) => ({ value: w._id, label: `${w.name} (${w.code})` })),
                  ]}
                  placeholder="Select Facility..."
                  error={createErrors.warehouseId}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsCreateModalOpen(false);
                setCreateErrors({});
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={createLoading}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              Create Item
            </Button>
          </div>
        </form>
      </Modal>

      {/* Quick Add Stock Modal */}
      {stockModalItem && (
        <Modal
          isOpen={!!stockModalItem}
          onClose={() => {
            setStockModalItem(null);
            setStockErrors({});
          }}
          title={`Add Stock: ${stockModalItem.sku}`}
          description={`Receive initial or supplemental stock for "${stockModalItem.name}"`}
          maxWidth="md"
        >
          <form onSubmit={handleAddStockSubmit} noValidate className="space-y-4 text-xs">
            {stockError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
                {stockError}
              </div>
            )}

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Current Available:</span>
                <span className="font-mono font-bold text-white">
                  {stockModalItem.totalAvailable ?? 0} {stockModalItem.baseUomId?.code || 'units'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Standard Cost:</span>
                <span className="font-mono text-emerald-400 font-bold">
                  ${(stockModalItem.standardCost || 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Quantity to Inward ({stockModalItem.baseUomId?.code || 'Units'}) *
                </label>
                <Input
                  type="number"
                  min="0.01"
                  step="any"
                  value={stockQuantity}
                  onChange={(e) => {
                    setStockQuantity(Number(e.target.value));
                    if (stockErrors.quantity) setStockErrors((prev) => ({ ...prev, quantity: '' }));
                  }}
                  error={stockErrors.quantity}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1">Warehouse Facility *</label>
                <Select
                  value={stockWarehouseId}
                  onChange={(e) => {
                    setStockWarehouseId(e.target.value);
                    if (stockErrors.warehouseId) setStockErrors((prev) => ({ ...prev, warehouseId: '' }));
                  }}
                  options={warehouses.map((w) => ({ value: w._id, label: `${w.name} (${w.code})` }))}
                  placeholder="Select Warehouse..."
                  error={stockErrors.warehouseId}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Unit Cost ($)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={stockUnitCost}
                  onChange={(e) => setStockUnitCost(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1">Batch / Lot Number</label>
                <Input
                  value={stockBatchNumber}
                  onChange={(e) => setStockBatchNumber(e.target.value)}
                  placeholder="e.g. LOT-2026-01"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Notes / Inward Reason</label>
              <Input
                value={stockNotes}
                onChange={(e) => setStockNotes(e.target.value)}
                placeholder="e.g. Opening balance or direct facility stock inward"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setStockModalItem(null);
                  setStockErrors({});
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={stockSubmitting}
                className="bg-emerald-600 hover:bg-emerald-500"
              >
                Confirm & Add Stock
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
