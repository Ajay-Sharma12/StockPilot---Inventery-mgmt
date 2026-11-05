import React, { useState, useEffect, useMemo } from 'react';
import {
  Database,
  Plus,
  RefreshCw,
  Folder,
  Ruler,
  Truck,
  Users,
  Building,
  Percent,
  Calendar,
  AlertCircle,
  DollarSign,
  Search,
  X,
  Layers,
  CheckCircle2,
  Tag,
  FileText,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { masterDataApi } from '../../api/masterData.api';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../context/ToastContext';

type MasterDataTab =
  | 'categories'
  | 'uoms'
  | 'conversions'
  | 'currencies'
  | 'suppliers'
  | 'customers'
  | 'departments'
  | 'taxes'
  | 'terms'
  | 'reasons';

export const MasterDataPage: React.FC = () => {
  const { can, isSuperAdmin } = usePermissions();
  const { success, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState<MasterDataTab>('categories');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryViewMode, setCategoryViewMode] = useState<'categories' | 'subcategories'>('categories');

  // Data sets
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [conversions, setConversions] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [wastageReasons, setWastageReasons] = useState<any[]>([]);
  const [adjustmentReasons, setAdjustmentReasons] = useState<any[]>([]);

  // Creation Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formExtra, setFormExtra] = useState<any>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const loadAll = async () => {
    try {
      setLoading(true);
      let [cats, uomList] = await Promise.all([
        masterDataApi.getCategories(),
        masterDataApi.getUOMs(),
      ]);

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

      const [
        subCats,
        convs,
        currs,
        supps,
        custs,
        depts,
        txs,
        tms,
        wReasons,
        aReasons,
      ] = await Promise.all([
        masterDataApi.getSubCategories(),
        masterDataApi.getUOMConversions(),
        masterDataApi.getCurrencies(),
        masterDataApi.getSuppliers({ limit: 100 }),
        masterDataApi.getCustomers({ limit: 100 }),
        masterDataApi.getDepartments(),
        masterDataApi.getTaxCodes(),
        masterDataApi.getPaymentTerms(),
        masterDataApi.getWastageReasons(),
        masterDataApi.getStockAdjustmentReasons(),
      ]);

      setCategories(cats || []);
      setSubcategories(subCats || []);
      setUoms(uomList || []);
      setConversions(convs || []);
      setCurrencies(currs || []);
      setSuppliers(supps.data || []);
      setCustomers(custs.data || []);
      setDepartments(depts || []);
      setTaxes(txs || []);
      setTerms(tms || []);
      setWastageReasons(wReasons || []);
      setAdjustmentReasons(aReasons || []);
    } catch (err: any) {
      console.error('Failed to load master data', err);
      toastError(err.response?.data?.message || 'Failed to load master data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadAll();
      success('Master Data synchronized successfully');
    } catch (err: any) {
      toastError('Failed to refresh master data');
    } finally {
      setTimeout(() => setRefreshing(false), 300);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Reset search on tab switch
  useEffect(() => {
    setSearchQuery('');
  }, [activeTab]);

  const openCreateModal = () => {
    setFormName('');
    setFormCode('');
    setFormDesc('');
    setFormExtra({
      isSubCategory: categoryViewMode === 'subcategories',
      symbol: '$',
      decimalPrecision: 2,
      rate: 18,
      days: 30,
      reasonType: 'WASTAGE',
    });
    setActionError('');
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (activeTab === 'conversions') {
      if (!formExtra.fromUomId) errors.fromUomId = 'Please select source UOM';
      if (!formExtra.toUomId) errors.toUomId = 'Please select target UOM';
      if (formExtra.fromUomId && formExtra.toUomId && formExtra.fromUomId === formExtra.toUomId) {
        errors.toUomId = 'Target UOM must be different from source UOM';
      }
      if (!formExtra.factor || isNaN(Number(formExtra.factor)) || Number(formExtra.factor) <= 0) {
        errors.factor = 'Please enter a valid positive multiplier';
      }
    } else {
      if (!formCode.trim()) errors.code = 'Code is required';
      if (!formName.trim()) errors.name = 'Name / Title is required';

      if (activeTab === 'categories' && formExtra.isSubCategory && !formExtra.parentCategoryId) {
        errors.parentCategoryId = 'Parent category is required for subcategory';
      }
      if (activeTab === 'currencies' && (!formExtra.symbol || !formExtra.symbol.trim())) {
        errors.symbol = 'Currency symbol is required';
      }
      if ((activeTab === 'suppliers' || activeTab === 'customers') && (!formExtra.email || !formExtra.email.trim())) {
        errors.email = 'Contact email is required';
      }
      if (activeTab === 'taxes' && (formExtra.rate === undefined || formExtra.rate === '' || isNaN(Number(formExtra.rate)))) {
        errors.rate = 'Tax rate (%) is required';
      }
      if (activeTab === 'terms' && (formExtra.days === undefined || formExtra.days === '' || isNaN(Number(formExtra.days)))) {
        errors.days = 'Credit days is required';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    try {
      setActionLoading(true);
      setActionError('');

      if (activeTab === 'categories') {
        if (formExtra.isSubCategory) {
          await masterDataApi.createSubCategory({
            categoryId: formExtra.parentCategoryId,
            name: formName.trim(),
            code: formCode.trim().toUpperCase(),
            description: formDesc.trim() || undefined,
          });
          success(`Subcategory ${formCode.toUpperCase()} registered successfully`);
        } else {
          await masterDataApi.createCategory({
            name: formName.trim(),
            code: formCode.trim().toUpperCase(),
            description: formDesc.trim() || undefined,
          });
          success(`Category ${formCode.toUpperCase()} registered successfully`);
        }
      } else if (activeTab === 'uoms') {
        await masterDataApi.createUOM({
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          symbol: formExtra.symbol?.trim() || formCode.toLowerCase(),
          type: formExtra.type || 'COUNT',
          decimalPrecision: Number(formExtra.decimalPrecision) || 0,
        });
        success(`Unit of measure ${formCode.toUpperCase()} created successfully`);
      } else if (activeTab === 'conversions') {
        await masterDataApi.createUOMConversion({
          fromUomId: formExtra.fromUomId,
          toUomId: formExtra.toUomId,
          conversionFactor: Number(formExtra.factor),
        });
        success(`UOM conversion multiplier rule configured`);
      } else if (activeTab === 'currencies') {
        await masterDataApi.createCurrency({
          code: formCode.trim().toUpperCase(),
          name: formName.trim(),
          symbol: formExtra.symbol?.trim() || '$',
          decimalPrecision: Number(formExtra.decimalPrecision) || 2,
        });
        success(`Currency ${formCode.toUpperCase()} registered in system`);
      } else if (activeTab === 'suppliers') {
        await masterDataApi.createSupplier({
          name: formName.trim(),
          supplierCode: formCode.trim().toUpperCase(),
          email: formExtra.email?.trim() || 'vendor@example.com',
          contactPerson: formExtra.contactPerson?.trim() || undefined,
          phone: formExtra.phone?.trim() || undefined,
        });
        success(`Supplier ${formName} added to vendor register`);
      } else if (activeTab === 'customers') {
        await masterDataApi.createCustomer({
          name: formName.trim(),
          customerCode: formCode.trim().toUpperCase(),
          email: formExtra.email?.trim() || 'customer@example.com',
          contactPerson: formExtra.contactPerson?.trim() || undefined,
          creditLimit: Number(formExtra.creditLimit) || 0,
        });
        success(`Customer ${formName} registered successfully`);
      } else if (activeTab === 'departments') {
        await masterDataApi.createDepartment({
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          description: formDesc.trim() || undefined,
        });
        success(`Department ${formName} created`);
      } else if (activeTab === 'taxes') {
        await masterDataApi.createTaxCode({
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          rate: Number(formExtra.rate) || 0,
          type: formExtra.type || 'GST',
        });
        success(`Tax code ${formCode.toUpperCase()} (${formExtra.rate}%) configured`);
      } else if (activeTab === 'terms') {
        await masterDataApi.createPaymentTerm({
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          days: Number(formExtra.days) || 0,
        });
        success(`Payment term ${formName} configured`);
      } else if (activeTab === 'reasons') {
        if (formExtra.reasonType === 'WASTAGE') {
          await masterDataApi.createWastageReason({
            name: formName.trim(),
            code: formCode.trim().toUpperCase(),
            description: formDesc.trim() || undefined,
          });
          success(`Wastage reason ${formName} added`);
        } else {
          await masterDataApi.createStockAdjustmentReason({
            name: formName.trim(),
            code: formCode.trim().toUpperCase(),
            description: formDesc.trim() || undefined,
          });
          success(`Adjustment reason ${formName} added`);
        }
      }

      setIsModalOpen(false);
      setFormErrors({});
      loadAll();
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || 'Creation failed';
      setActionError(errMsg);
      toastError(errMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const tabs = [
    { id: 'categories', label: 'Categories & Subcategories', icon: Folder, count: categories.length + subcategories.length },
    { id: 'uoms', label: 'Units of Measure', icon: Ruler, count: uoms.length },
    { id: 'conversions', label: 'UOM Conversions', icon: RefreshCw, count: conversions.length },
    { id: 'currencies', label: 'Currencies', icon: DollarSign, count: currencies.length },
    { id: 'suppliers', label: 'Suppliers', icon: Truck, count: suppliers.length },
    { id: 'customers', label: 'Customers', icon: Users, count: customers.length },
    { id: 'departments', label: 'Departments', icon: Building, count: departments.length },
    { id: 'taxes', label: 'Tax Codes', icon: Percent, count: taxes.length },
    { id: 'terms', label: 'Payment Terms', icon: Calendar, count: terms.length },
    { id: 'reasons', label: 'Reason Codes', icon: AlertCircle, count: wastageReasons.length + adjustmentReasons.length },
  ];

  // Search filter helper
  const matchesSearch = (item: any, fields: string[]) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return fields.some((f) => {
      const val = item[f];
      return val && String(val).toLowerCase().includes(q);
    });
  };

  const filteredCategories = useMemo(
    () => categories.filter((c) => matchesSearch(c, ['code', 'name', 'description'])),
    [categories, searchQuery]
  );
  const filteredSubcategories = useMemo(
    () => subcategories.filter((s) => matchesSearch(s, ['code', 'name', 'description']) || s.categoryId?.name?.toLowerCase().includes(searchQuery.toLowerCase())),
    [subcategories, searchQuery]
  );
  const filteredUoms = useMemo(
    () => uoms.filter((u) => matchesSearch(u, ['code', 'name', 'symbol', 'type'])),
    [uoms, searchQuery]
  );
  const filteredConversions = useMemo(
    () => conversions.filter((c) => c.fromUomId?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || c.toUomId?.name?.toLowerCase().includes(searchQuery.toLowerCase())),
    [conversions, searchQuery]
  );
  const filteredCurrencies = useMemo(
    () => currencies.filter((c) => matchesSearch(c, ['code', 'name', 'symbol'])),
    [currencies, searchQuery]
  );
  const filteredSuppliers = useMemo(
    () => suppliers.filter((s) => matchesSearch(s, ['supplierCode', 'name', 'email', 'contactPerson'])),
    [suppliers, searchQuery]
  );
  const filteredCustomers = useMemo(
    () => customers.filter((c) => matchesSearch(c, ['customerCode', 'name', 'email', 'contactPerson'])),
    [customers, searchQuery]
  );
  const filteredDepartments = useMemo(
    () => departments.filter((d) => matchesSearch(d, ['code', 'name'])),
    [departments, searchQuery]
  );
  const filteredTaxes = useMemo(
    () => taxes.filter((t) => matchesSearch(t, ['code', 'name', 'type'])),
    [taxes, searchQuery]
  );
  const filteredTerms = useMemo(
    () => terms.filter((t) => matchesSearch(t, ['code', 'name'])),
    [terms, searchQuery]
  );
  const filteredWastageReasons = useMemo(
    () => wastageReasons.filter((r) => matchesSearch(r, ['code', 'name', 'description'])),
    [wastageReasons, searchQuery]
  );
  const filteredAdjustmentReasons = useMemo(
    () => adjustmentReasons.filter((r) => matchesSearch(r, ['code', 'name', 'description'])),
    [adjustmentReasons, searchQuery]
  );

  const canCreate = isSuperAdmin || can('inventory:create');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Database className="w-7 h-7 text-emerald-400" />
            Master Data Command Center
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Global catalog parameters, multi-UOM conversions, currencies, trading partners, tax rules, and reason codes
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

          {canCreate && (
            <Button
              variant="primary"
              size="sm"
              onClick={openCreateModal}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Record
            </Button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Card className="bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Catalog Hierarchy</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/80 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Folder className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-mono">
              {categories.length} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">/ {subcategories.length} subs</span>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Categories & Subcategories</p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">UOM & Formulas</span>
              <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-500/10 border border-sky-200/80 dark:border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
                <Ruler className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-sky-600 dark:text-sky-400 mt-1 font-mono">
              {uoms.length} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">units</span>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{conversions.length} conversion multipliers</p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Financial Masters</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono">
              {currencies.length} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">currencies</span>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{taxes.length} taxes &bull; {terms.length} payment terms</p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Trading Partners</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/80 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1 font-mono">
              {suppliers.length + customers.length}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{suppliers.length} vendors &bull; {customers.length} clients</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as MasterDataTab)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 font-mono text-slate-400">
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <Card className="bg-slate-900/80 border-slate-800 shadow-md">
        {/* Table Toolbar Search */}
        <div className="p-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/40">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {activeTab === 'categories' && (
            <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setCategoryViewMode('categories')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  categoryViewMode === 'categories'
                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Categories ({categories.length})
              </button>
              <button
                onClick={() => setCategoryViewMode('subcategories')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  categoryViewMode === 'subcategories'
                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Subcategories ({subcategories.length})
              </button>
            </div>
          )}
        </div>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {/* 1. Categories & Subcategories */}
            {activeTab === 'categories' && categoryViewMode === 'categories' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Category Name</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredCategories.length === 0 ? (
                    <tr><td colSpan={4} className="py-8 text-center text-slate-500">No categories found</td></tr>
                  ) : (
                    filteredCategories.map((c) => (
                      <tr key={c._id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">{c.code}</td>
                        <td className="py-3 px-4 font-semibold text-white">{c.name}</td>
                        <td className="py-3 px-4 text-slate-400">{c.description || '—'}</td>
                        <td className="py-3 px-4">
                          <Badge variant="success" size="sm">{c.status || 'ACTIVE'}</Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'categories' && categoryViewMode === 'subcategories' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Subcategory Name</th>
                    <th className="py-3 px-4">Parent Category</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredSubcategories.length === 0 ? (
                    <tr><td colSpan={5} className="py-8 text-center text-slate-500">No subcategories registered yet</td></tr>
                  ) : (
                    filteredSubcategories.map((s) => (
                      <tr key={s._id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">{s.code}</td>
                        <td className="py-3 px-4 font-semibold text-white">{s.name}</td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                            {s.categoryId?.name || s.categoryId?.code || 'Parent Category'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">{s.description || '—'}</td>
                        <td className="py-3 px-4">
                          <Badge variant="success" size="sm">{s.status || 'ACTIVE'}</Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 2. UOMs */}
            {activeTab === 'uoms' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">UOM Name</th>
                    <th className="py-3 px-4">Symbol</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-right">Decimals</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUoms.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-slate-500">No UOM units found</td></tr>
                  ) : (
                    filteredUoms.map((u) => (
                      <tr key={u._id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">{u.code}</td>
                        <td className="py-3 px-4 font-semibold text-white">{u.name}</td>
                        <td className="py-3 px-4 font-mono text-slate-300">{u.symbol}</td>
                        <td className="py-3 px-4 font-mono text-slate-400">{u.type}</td>
                        <td className="py-3 px-4 font-mono text-slate-400 text-right">{u.decimalPrecision}</td>
                        <td className="py-3 px-4"><Badge variant="success" size="sm">{u.status || 'ACTIVE'}</Badge></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 3. UOM Conversions */}
            {activeTab === 'conversions' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">From Unit</th>
                    <th className="py-3 px-4">To Unit</th>
                    <th className="py-3 px-4">Conversion Factor</th>
                    <th className="py-3 px-4">Formula Rule</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredConversions.length === 0 ? (
                    <tr><td colSpan={4} className="py-8 text-center text-slate-500">No conversions configured</td></tr>
                  ) : (
                    filteredConversions.map((conv) => (
                      <tr key={conv._id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-bold text-white">1 {conv.fromUomId?.name} ({conv.fromUomId?.code})</td>
                        <td className="py-3 px-4 font-bold text-emerald-400">{conv.toUomId?.name} ({conv.toUomId?.code})</td>
                        <td className="py-3 px-4 font-mono text-white font-bold">&times; {conv.conversionFactor}</td>
                        <td className="py-3 px-4 font-mono text-slate-400">1 {conv.fromUomId?.code} = {conv.conversionFactor} {conv.toUomId?.code}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 4. Currencies (Document Phase 2 Requirement) */}
            {activeTab === 'currencies' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Currency Code</th>
                    <th className="py-3 px-4">Currency Name</th>
                    <th className="py-3 px-4">Symbol</th>
                    <th className="py-3 px-4 text-right">Decimal Precision</th>
                    <th className="py-3 px-4">Default Currency</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredCurrencies.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-slate-500">No currencies registered</td></tr>
                  ) : (
                    filteredCurrencies.map((curr) => (
                      <tr key={curr._id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                          <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                          <span>{curr.code}</span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-white">{curr.name}</td>
                        <td className="py-3 px-4 font-mono font-bold text-amber-300 text-sm">{curr.symbol}</td>
                        <td className="py-3 px-4 font-mono text-slate-400 text-right">{curr.decimalPrecision ?? 2}</td>
                        <td className="py-3 px-4">
                          {curr.isDefault ? (
                            <Badge variant="success" size="sm">Primary Base</Badge>
                          ) : (
                            <span className="text-slate-500">Secondary</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="success" size="sm">{curr.status || 'ACTIVE'}</Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 5. Suppliers */}
            {activeTab === 'suppliers' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Supplier Name</th>
                    <th className="py-3 px-4">Contact Person</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredSuppliers.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-slate-500">No suppliers found</td></tr>
                  ) : (
                    filteredSuppliers.map((s) => (
                      <tr key={s._id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">{s.supplierCode || s.code}</td>
                        <td className="py-3 px-4 font-semibold text-white">{s.name}</td>
                        <td className="py-3 px-4 text-slate-300">{s.contactPerson || '—'}</td>
                        <td className="py-3 px-4 text-slate-400 font-mono">{s.email || '—'}</td>
                        <td className="py-3 px-4 text-slate-400 font-mono">{s.phone || '—'}</td>
                        <td className="py-3 px-4"><Badge variant="success" size="sm">{s.status || 'ACTIVE'}</Badge></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 6. Customers */}
            {activeTab === 'customers' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4 text-right">Credit Limit</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredCustomers.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-slate-500">No customers found</td></tr>
                  ) : (
                    filteredCustomers.map((c) => (
                      <tr key={c._id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">{c.customerCode || c.code}</td>
                        <td className="py-3 px-4 font-semibold text-white">{c.name}</td>
                        <td className="py-3 px-4 text-slate-300">{c.contactPerson || '—'}</td>
                        <td className="py-3 px-4 text-slate-400 font-mono">{c.email || '—'}</td>
                        <td className="py-3 px-4 font-mono font-bold text-white text-right">${c.creditLimit?.toLocaleString() || 0}</td>
                        <td className="py-3 px-4"><Badge variant="success" size="sm">{c.status || 'ACTIVE'}</Badge></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 7. Departments */}
            {activeTab === 'departments' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Department Name</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredDepartments.length === 0 ? (
                    <tr><td colSpan={3} className="py-8 text-center text-slate-500">No departments configured</td></tr>
                  ) : (
                    filteredDepartments.map((d) => (
                      <tr key={d._id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">{d.code}</td>
                        <td className="py-3 px-4 font-semibold text-white">{d.name}</td>
                        <td className="py-3 px-4"><Badge variant="success" size="sm">{d.status || 'ACTIVE'}</Badge></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 8. Tax Codes */}
            {activeTab === 'taxes' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Tax Code Name</th>
                    <th className="py-3 px-4 text-right">Tax Rate</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredTaxes.length === 0 ? (
                    <tr><td colSpan={5} className="py-8 text-center text-slate-500">No tax codes found</td></tr>
                  ) : (
                    filteredTaxes.map((t) => (
                      <tr key={t._id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">{t.code}</td>
                        <td className="py-3 px-4 font-semibold text-white">{t.name}</td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400 text-right">{t.rate}%</td>
                        <td className="py-3 px-4 font-mono text-slate-400">{t.type || 'Standard'}</td>
                        <td className="py-3 px-4"><Badge variant="success" size="sm">{t.status || 'ACTIVE'}</Badge></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 9. Payment Terms */}
            {activeTab === 'terms' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Payment Term</th>
                    <th className="py-3 px-4 text-right">Credit Days</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredTerms.length === 0 ? (
                    <tr><td colSpan={4} className="py-8 text-center text-slate-500">No payment terms found</td></tr>
                  ) : (
                    filteredTerms.map((term) => (
                      <tr key={term._id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">{term.code}</td>
                        <td className="py-3 px-4 font-semibold text-white">{term.name}</td>
                        <td className="py-3 px-4 font-mono font-bold text-white text-right">{term.days} days</td>
                        <td className="py-3 px-4"><Badge variant="success" size="sm">{term.status || 'ACTIVE'}</Badge></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 10. Reasons */}
            {activeTab === 'reasons' && (
              <div className="p-4 space-y-6">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-400 mb-2.5 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    Wastage / Scrap Reasons ({filteredWastageReasons.length})
                  </h4>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Code</th>
                        <th className="py-2.5 px-3">Reason</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredWastageReasons.map((r) => (
                        <tr key={r._id} className="hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 font-mono font-bold text-rose-400">{r.code}</td>
                          <td className="py-2.5 px-3 font-semibold text-white">{r.name}</td>
                          <td className="py-2.5 px-3 text-slate-400">{r.description || '—'}</td>
                          <td className="py-2.5 px-3"><Badge variant="success" size="sm">{r.status || 'ACTIVE'}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pt-3 border-t border-slate-800">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-2.5 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    Stock Adjustment Reasons ({filteredAdjustmentReasons.length})
                  </h4>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Code</th>
                        <th className="py-2.5 px-3">Reason</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredAdjustmentReasons.map((r) => (
                        <tr key={r._id} className="hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">{r.code}</td>
                          <td className="py-2.5 px-3 font-semibold text-white">{r.name}</td>
                          <td className="py-2.5 px-3 text-slate-400">{r.description || '—'}</td>
                          <td className="py-2.5 px-3"><Badge variant="success" size="sm">{r.status || 'ACTIVE'}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Creation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setFormErrors({});
        }}
        title={`Add ${
          activeTab === 'categories' && formExtra.isSubCategory
            ? 'Subcategory'
            : activeTab.toUpperCase()
        } Entry`}
        description="Add a new master data parameter to your organization"
      >
        <form onSubmit={handleCreateSubmit} noValidate className="space-y-4 text-xs">
          {actionError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
              {actionError}
            </div>
          )}

          {activeTab === 'conversions' ? (
            <div className="space-y-4">
              <div>
                <Select
                  label="From UOM *"
                  value={formExtra.fromUomId || ''}
                  onChange={(e) => {
                    setFormExtra({ ...formExtra, fromUomId: e.target.value });
                    if (formErrors.fromUomId) setFormErrors((prev) => ({ ...prev, fromUomId: '' }));
                  }}
                  options={[
                    { value: '', label: 'Select source UOM...' },
                    ...uoms.map((u) => ({ value: u._id, label: `${u.name} (${u.code})` })),
                  ]}
                  placeholder="Select source UOM..."
                  error={formErrors.fromUomId}
                />
              </div>
              <div>
                <Select
                  label="To UOM *"
                  value={formExtra.toUomId || ''}
                  onChange={(e) => {
                    setFormExtra({ ...formExtra, toUomId: e.target.value });
                    if (formErrors.toUomId) setFormErrors((prev) => ({ ...prev, toUomId: '' }));
                  }}
                  options={[
                    { value: '', label: 'Select target UOM...' },
                    ...uoms.map((u) => ({ value: u._id, label: `${u.name} (${u.code})` })),
                  ]}
                  placeholder="Select target UOM..."
                  error={formErrors.toUomId}
                />
              </div>
              <div>
                <Input
                  label="Conversion Factor (Multiplier) *"
                  type="number"
                  step="any"
                  value={formExtra.factor || ''}
                  onChange={(e) => {
                    setFormExtra({ ...formExtra, factor: e.target.value });
                    if (formErrors.factor) setFormErrors((prev) => ({ ...prev, factor: '' }));
                  }}
                  placeholder="e.g. 24 for 1 Box = 24 Pieces"
                  error={formErrors.factor}
                />
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'categories' && (
                <div className="flex items-center gap-4 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="radio"
                      name="catType"
                      checked={!formExtra.isSubCategory}
                      onChange={() => setFormExtra({ ...formExtra, isSubCategory: false })}
                      className="accent-emerald-500"
                    />
                    <span>Top-Level Category</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="radio"
                      name="catType"
                      checked={!!formExtra.isSubCategory}
                      onChange={() => setFormExtra({ ...formExtra, isSubCategory: true })}
                      className="accent-emerald-500"
                    />
                    <span>Subcategory (Child)</span>
                  </label>
                </div>
              )}

              {activeTab === 'categories' && formExtra.isSubCategory && (
                <div>
                  <Select
                    label="Parent Category *"
                    value={formExtra.parentCategoryId || ''}
                    onChange={(e) => {
                      setFormExtra({ ...formExtra, parentCategoryId: e.target.value });
                      if (formErrors.parentCategoryId) setFormErrors((prev) => ({ ...prev, parentCategoryId: '' }));
                    }}
                    options={[
                      { value: '', label: 'Select parent category...' },
                      ...categories.map((c) => ({ value: c._id, label: `${c.code} - ${c.name}` })),
                    ]}
                    error={formErrors.parentCategoryId}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Input
                    label="Code *"
                    value={formCode}
                    onChange={(e) => {
                      setFormCode(e.target.value.toUpperCase());
                      if (formErrors.code) setFormErrors((prev) => ({ ...prev, code: '' }));
                    }}
                    placeholder={activeTab === 'currencies' ? 'e.g. USD' : 'e.g. RAW_MAT'}
                    error={formErrors.code}
                  />
                </div>
                <div>
                  <Input
                    label="Name / Title *"
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value);
                      if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: '' }));
                    }}
                    placeholder={activeTab === 'currencies' ? 'e.g. US Dollar' : 'e.g. Raw Materials'}
                    error={formErrors.name}
                  />
                </div>
              </div>

              {activeTab === 'currencies' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Input
                      label="Currency Symbol *"
                      value={formExtra.symbol || ''}
                      onChange={(e) => {
                        setFormExtra({ ...formExtra, symbol: e.target.value });
                        if (formErrors.symbol) setFormErrors((prev) => ({ ...prev, symbol: '' }));
                      }}
                      placeholder="e.g. $, €, £, ₹"
                      error={formErrors.symbol}
                    />
                  </div>
                  <div>
                    <Input
                      label="Decimal Precision"
                      type="number"
                      min="0"
                      max="4"
                      value={formExtra.decimalPrecision ?? 2}
                      onChange={(e) => setFormExtra({ ...formExtra, decimalPrecision: e.target.value })}
                      placeholder="e.g. 2"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'uoms' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Input
                      label="Symbol"
                      value={formExtra.symbol || ''}
                      onChange={(e) => setFormExtra({ ...formExtra, symbol: e.target.value })}
                      placeholder="e.g. kg, pc, L"
                    />
                  </div>
                  <div>
                    <Select
                      label="UOM Type"
                      value={formExtra.type || 'COUNT'}
                      onChange={(e) => setFormExtra({ ...formExtra, type: e.target.value })}
                      options={[
                        { value: 'COUNT', label: 'Count (Pieces, Units)' },
                        { value: 'WEIGHT', label: 'Weight (Kilograms, Grams)' },
                        { value: 'VOLUME', label: 'Volume (Liters, Gallons)' },
                        { value: 'LENGTH', label: 'Length (Meters, Feet)' },
                        { value: 'PACKAGING', label: 'Packaging (Boxes, Cartons)' },
                      ]}
                    />
                  </div>
                </div>
              )}

              {(activeTab === 'suppliers' || activeTab === 'customers') && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Input
                      label="Contact Email *"
                      type="email"
                      value={formExtra.email || ''}
                      onChange={(e) => {
                        setFormExtra({ ...formExtra, email: e.target.value });
                        if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: '' }));
                      }}
                      placeholder="contact@company.com"
                      error={formErrors.email}
                    />
                  </div>
                  <div>
                    <Input
                      label="Contact Person"
                      value={formExtra.contactPerson || ''}
                      onChange={(e) => setFormExtra({ ...formExtra, contactPerson: e.target.value })}
                      placeholder="e.g. John Doe"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'customers' && (
                <div>
                  <Input
                    label="Credit Limit ($)"
                    type="number"
                    value={formExtra.creditLimit || ''}
                    onChange={(e) => setFormExtra({ ...formExtra, creditLimit: e.target.value })}
                    placeholder="e.g. 50000"
                  />
                </div>
              )}

              {activeTab === 'taxes' && (
                <div>
                  <Input
                    label="Rate (%) *"
                    type="number"
                    value={formExtra.rate || ''}
                    onChange={(e) => {
                      setFormExtra({ ...formExtra, rate: e.target.value });
                      if (formErrors.rate) setFormErrors((prev) => ({ ...prev, rate: '' }));
                    }}
                    placeholder="e.g. 18"
                    error={formErrors.rate}
                  />
                </div>
              )}

              {activeTab === 'terms' && (
                <div>
                  <Input
                    label="Credit Days *"
                    type="number"
                    value={formExtra.days || ''}
                    onChange={(e) => {
                      setFormExtra({ ...formExtra, days: e.target.value });
                      if (formErrors.days) setFormErrors((prev) => ({ ...prev, days: '' }));
                    }}
                    placeholder="e.g. 30"
                    error={formErrors.days}
                  />
                </div>
              )}

              {activeTab === 'reasons' && (
                <div>
                  <Select
                    label="Reason Target Type *"
                    value={formExtra.reasonType || 'WASTAGE'}
                    onChange={(e) => setFormExtra({ ...formExtra, reasonType: e.target.value })}
                    options={[
                      { value: 'WASTAGE', label: 'Wastage / Scrap' },
                      { value: 'ADJUSTMENT', label: 'Stock Adjustment' },
                    ]}
                  />
                </div>
              )}

              <div>
                <Input
                  label="Description / Notes"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Optional details..."
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsModalOpen(false);
                setFormErrors({});
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-500 shadow-sm"
            >
              Save Record
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
