import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Plus,
  Search,
  RefreshCw,
  Eye,
  Edit2,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  Package,
  Star,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
  Save,
  Phone,
  Mail,
  Globe,
  MapPin,
  DollarSign,
  FileText,
  Truck,
  BarChart2,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  BadgeCheck,
  XCircle,
  User,
} from 'lucide-react';
import { masterDataApi } from '../../api/masterData.api';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../context/ToastContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { Select } from '../../components/ui/Select';

const CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR - Indian Rupee', badge: '₹' },
  { value: 'USD', label: 'USD - US Dollar', badge: '$' },
  { value: 'EUR', label: 'EUR - Euro', badge: '€' },
  { value: 'GBP', label: 'GBP - British Pound', badge: '£' },
  { value: 'AED', label: 'AED - UAE Dirham', badge: 'د.إ' },
  { value: 'JPY', label: 'JPY - Japanese Yen', badge: '¥' },
  { value: 'CNY', label: 'CNY - Chinese Yuan', badge: '¥' },
  { value: 'SGD', label: 'SGD - Singapore Dollar', badge: 'S$' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active Only' },
  { value: 'INACTIVE', label: 'Inactive Only' },
];

interface Supplier {
  _id: string;
  supplierCode?: string;
  code?: string;
  name: string;
  contactPerson?: string;
  contactEmail?: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  website?: string;
  currency?: string;
  paymentTermsId?: any;
  taxId?: string;
  taxNumber?: string;
  bankDetails?: { bankName?: string; accountNumber?: string; ifsc?: string };
  leadTimeDays?: number;
  minOrderValue?: number;
  status?: 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | string;
  isActive?: boolean;
  rating?: number;
  notes?: string;
  createdAt: string;
}

interface SupplierPerformance {
  totalOrders: number;
  totalValue: number;
  onTimeDeliveryRate: number;
  avgLeadTimeDays: number;
  qualityPassRate: number;
  lastOrderDate?: string;
  recentOrders?: any[];
}

const EMPTY_FORM = {
  name: '',
  contactPerson: '',
  contactEmail: '',
  phone: '',
  website: '',
  currency: 'INR',
  taxId: '',
  leadTimeDays: 7,
  minOrderValue: 0,
  rating: 3,
  notes: '',
  address: { street: '', city: '', state: '', country: 'India', postalCode: '' },
};

const isSupplierActive = (s: any): boolean => {
  if (!s) return false;
  if (typeof s === 'boolean') return s;
  const st = String(s.status || '').toUpperCase();
  if (st === 'ACTIVE') return true;
  if (st === 'INACTIVE' || st === 'BLOCKED') return false;
  if (typeof s.isActive === 'boolean') return s.isActive;
  return false;
};

const statusBadge = (sOrActive: any) => {
  const active = isSupplierActive(sOrActive);
  return active ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 shadow-xs">
      <BadgeCheck className="w-3.5 h-3.5 text-emerald-500" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 shadow-xs">
      <XCircle className="w-3.5 h-3.5 text-rose-400" /> Inactive
    </span>
  );
};

const StarRating: React.FC<{ rating: number; max?: number }> = ({ rating, max = 5 }) => (
  <div className="flex items-center gap-0.5">
    {Array.from({ length: max }).map((_, i) => (
      <Star
        key={i}
        className={`w-3 h-3 ${i < Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-700'}`}
      />
    ))}
  </div>
);

export const SupplierManagementPage: React.FC = () => {
  const { can } = usePermissions();
  const { success, error: toastError } = useToast();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 15;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Detail / Performance panel & View Modal
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);
  const [performance, setPerformance] = useState<SupplierPerformance | null>(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'performance' | 'history'>('info');
  const [history, setHistory] = useState<any[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  // Create / Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Load list
  const loadSuppliers = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const res = await masterDataApi.getSuppliers({
        page,
        limit,
        search: search || undefined,
        status: statusFilter || undefined,
      });
      const list = Array.isArray(res.data) ? res.data : [];
      setSuppliers(list);
      setTotal(res.total ?? list.length);
    } catch (err: any) {
      toastError(err?.response?.data?.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  // Load performance for selected supplier
  const loadPerformance = async (id: string) => {
    try {
      setPerfLoading(true);
      const data = await masterDataApi.getSupplierPerformance(id);
      setPerformance(data);
    } catch {
      setPerformance(null);
    } finally {
      setPerfLoading(false);
    }
  };

  const loadHistory = async (id: string) => {
    try {
      setHistLoading(true);
      const res = await masterDataApi.getSupplierHistory(id, { limit: 20 });
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch {
      setHistory([]);
    } finally {
      setHistLoading(false);
    }
  };

  const selectSupplier = async (s: Supplier) => {
    setSelectedSupplier(s);
    setActiveTab('info');
    setPerformance(null);
    setHistory([]);
    await loadPerformance(s._id);
  };

  const openView = async (s: Supplier) => {
    setViewingSupplier(s);
    setSelectedSupplier(s);
    setActiveTab('info');
    setPerformance(null);
    setHistory([]);
    loadPerformance(s._id);
    loadHistory(s._id);
  };

  const handleTabChange = async (tab: 'info' | 'performance' | 'history') => {
    setActiveTab(tab);
    const target = viewingSupplier || selectedSupplier;
    if (!target) return;
    if (tab === 'performance' && !performance) await loadPerformance(target._id);
    if (tab === 'history' && history.length === 0) await loadHistory(target._id);
  };

  // Toggle status
  const handleToggleStatus = async (s: Supplier) => {
    const currentActive = isSupplierActive(s);
    const nextStatus = currentActive ? 'INACTIVE' : 'ACTIVE';
    const nextActiveBool = !currentActive;

    // Optimistically update lists and viewing targets immediately
    setSuppliers((prev) =>
      prev.map((item) =>
        item._id === s._id ? { ...item, status: nextStatus, isActive: nextActiveBool } : item
      )
    );
    if (selectedSupplier?._id === s._id) {
      setSelectedSupplier((prev) => (prev ? { ...prev, status: nextStatus, isActive: nextActiveBool } : prev));
    }
    if (viewingSupplier?._id === s._id) {
      setViewingSupplier((prev) => (prev ? { ...prev, status: nextStatus, isActive: nextActiveBool } : prev));
    }

    try {
      await masterDataApi.toggleSupplierStatus(s._id, nextStatus);
      success(`Supplier "${s.name}" is now marked as ${nextStatus === 'ACTIVE' ? 'Active' : 'Inactive'}`);
      loadSuppliers(true);
    } catch (err: any) {
      // Revert if error occurs
      setSuppliers((prev) =>
        prev.map((item) =>
          item._id === s._id ? { ...item, status: currentActive ? 'ACTIVE' : 'INACTIVE', isActive: currentActive } : item
        )
      );
      if (selectedSupplier?._id === s._id) {
        setSelectedSupplier((prev) => (prev ? { ...prev, status: currentActive ? 'ACTIVE' : 'INACTIVE', isActive: currentActive } : prev));
      }
      if (viewingSupplier?._id === s._id) {
        setViewingSupplier((prev) => (prev ? { ...prev, status: currentActive ? 'ACTIVE' : 'INACTIVE', isActive: currentActive } : prev));
      }
      toastError(err?.response?.data?.message || 'Status update failed');
    }
  };

  // Open create modal
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  // Open edit modal
  const openEdit = (s: Supplier) => {
    setEditingId(s._id);
    setForm({
      name: s.name || '',
      contactPerson: s.contactPerson || '',
      contactEmail: s.contactEmail || '',
      phone: s.phone || '',
      website: s.website || '',
      currency: s.currency || 'INR',
      taxId: s.taxId || '',
      leadTimeDays: s.leadTimeDays ?? 7,
      minOrderValue: s.minOrderValue ?? 0,
      rating: s.rating ?? 3,
      notes: s.notes || '',
      address: {
        street: s.address?.street || '',
        city: s.address?.city || '',
        state: s.address?.state || '',
        country: s.address?.country || 'India',
        postalCode: s.address?.postalCode || '',
      },
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toastError('Supplier name is required');
    try {
      setSaving(true);
      const emailVal = (form.contactEmail || form.email || '').trim() || undefined;
      const taxVal = (form.taxId || form.taxNumber || '').trim() || undefined;

      const payload: any = {
        name: form.name.trim(),
        contactPerson: form.contactPerson?.trim() || undefined,
        email: emailVal,
        contactEmail: emailVal,
        phone: form.phone?.trim() || undefined,
        taxNumber: taxVal,
        taxId: taxVal,
        currency: form.currency || 'INR',
        leadTimeDays: Number(form.leadTimeDays) || 7,
        minOrderValue: Number(form.minOrderValue) || 0,
        rating: Number(form.rating) || 3,
        notes: form.notes?.trim() || undefined,
        address: {
          street: form.address?.street?.trim() || undefined,
          city: form.address?.city?.trim() || undefined,
          state: form.address?.state?.trim() || undefined,
          country: form.address?.country?.trim() || 'India',
          postalCode: form.address?.postalCode?.trim() || undefined,
        },
      };

      if (editingId) {
        await masterDataApi.updateSupplier(editingId, payload);
        success('Supplier updated successfully');
      } else {
        await masterDataApi.createSupplier(payload);
        success('Supplier created successfully');
      }
      setShowModal(false);
      loadSuppliers(true);
    } catch (err: any) {
      const details = err?.response?.data?.details;
      const detailMsg = Array.isArray(details)
        ? details.map((d: any) => `${d.path || 'Field'}: ${d.message}`).join(', ')
        : null;
      toastError(detailMsg || err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const formField = (label: string, key: string, type = 'text', opts?: { min?: number; max?: number }) => (
    <div>
      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">{label}</label>
      <input
        type={type}
        value={form[key] ?? ''}
        onChange={(e) => setForm((p: any) => ({ ...p, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
        {...(opts || {})}
      />
    </div>
  );

  const addrField = (label: string, key: string) => (
    <div>
      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">{label}</label>
      <input
        type="text"
        value={form.address?.[key] ?? ''}
        onChange={(e) => setForm((p: any) => ({ ...p, address: { ...p.address, [key]: e.target.value } }))}
        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
      />
    </div>
  );

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-2xl shadow-xl border border-slate-800 text-white">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-400">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Supplier Management</h1>
            <p className="text-sm text-slate-300">Manage vendors, track performance metrics, and monitor order history</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadSuppliers(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-medium transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : 'text-slate-300'}`} />
            Refresh
          </button>
          {can('purchase:create') && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-600/30"
            >
              <Plus className="w-4 h-4" />
              New Supplier
            </button>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Suppliers', value: total, icon: Building2, iconBg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400' },
          { label: 'Active', value: suppliers.filter(s => isSupplierActive(s)).length, icon: BadgeCheck, iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' },
          { label: 'Inactive', value: suppliers.filter(s => !isSupplierActive(s)).length, icon: XCircle, iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' },
          { label: 'Avg Rating', value: suppliers.length ? (suppliers.reduce((a, s) => a + (s.rating || 0), 0) / suppliers.length).toFixed(1) : '—', icon: Star, iconBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400' },
        ].map(({ label, value, icon: Icon, iconBg }) => (
          <div key={label} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</span>
              <div className={`p-2 rounded-xl ${iconBg}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{loading ? '...' : value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Suppliers Table */}
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-3 p-4 border-b border-slate-100 dark:border-slate-800">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search suppliers by name or code..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
              />
            </div>
            <div className="w-full sm:w-44 shrink-0">
              <Select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                variant="indigo"
                searchable={false}
                options={STATUS_OPTIONS}
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 uppercase border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Currency</th>
                  <th className="py-3 px-4">Rating</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400 dark:text-slate-600">
                      <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No suppliers found</p>
                      <p className="text-xs mt-1">Add your first supplier to get started</p>
                    </td>
                  </tr>
                ) : (
                  suppliers.map((s) => (
                    <tr
                      key={s._id}
                      onClick={() => openView(s)}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer ${
                        selectedSupplier?._id === s._id ? 'bg-indigo-50/60 dark:bg-indigo-950/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center text-xs font-bold">
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                          {s.name}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{s.supplierCode || s.code || '—'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-700 dark:text-slate-300 text-xs">{s.contactPerson || '—'}</div>
                        <div className="text-slate-400 text-xs">{s.contactEmail || s.email || '—'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-slate-700 dark:text-slate-300 font-semibold">
                          {s.currency || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <StarRating rating={s.rating || 0} />
                      </td>
                      <td className="py-3 px-4">{statusBadge(s)}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {can('purchase:update') && (
                            <>
                              <button
                                onClick={() => openEdit(s)}
                                title="Edit Supplier"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleToggleStatus(s)}
                                title={isSupplierActive(s) ? 'Active — Click to Deactivate' : 'Inactive — Click to Activate'}
                                className={`p-1 rounded-lg border transition-all flex items-center justify-center ${
                                  isSupplierActive(s)
                                    ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20'
                                    : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                              >
                                {isSupplierActive(s) ? (
                                  <ToggleRight className="w-5 h-5 text-emerald-500 transition-transform hover:scale-105" />
                                ) : (
                                  <ToggleLeft className="w-5 h-5 text-slate-400 transition-transform hover:scale-105" />
                                )}
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => openView(s)}
                            title="View Supplier Details"
                            className="p-1.5 rounded-lg text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
              <span>Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition">Prev</button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition">Next</button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Detail Panel */}
        {selectedSupplier && (
          <div className="w-full lg:w-96 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
            {/* Panel Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50 to-slate-50 dark:from-indigo-950/30 dark:to-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-base font-bold shadow-md">
                  {selectedSupplier.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{selectedSupplier.name}</h3>
                  <p className="text-xs text-slate-500">{selectedSupplier.supplierCode || selectedSupplier.code || 'No Code'}</p>
                </div>
              </div>
              <button onClick={() => setSelectedSupplier(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status Bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                {statusBadge(selectedSupplier)}
                <StarRating rating={selectedSupplier.rating || 0} />
              </div>
              {can('purchase:update') && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleStatus(selectedSupplier)}
                    title={isSupplierActive(selectedSupplier) ? 'Click to Deactivate' : 'Click to Activate'}
                    className="p-1 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    {isSupplierActive(selectedSupplier) ? (
                      <ToggleRight className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                  <button onClick={() => openEdit(selectedSupplier)} className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100 dark:border-slate-800">
              {(['info', 'performance', 'history'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`flex-1 py-2.5 text-xs font-semibold capitalize transition-colors ${activeTab === tab ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  {tab === 'info' ? 'Info' : tab === 'performance' ? 'Performance' : 'PO History'}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
              {/* Info Tab */}
              {activeTab === 'info' && (
                <div className="space-y-3">
                  {selectedSupplier.contactPerson && (
                    <DetailRow icon={<Building2 className="w-4 h-4 text-indigo-400" />} label="Contact Person" value={selectedSupplier.contactPerson} />
                  )}
                  {selectedSupplier.contactEmail && (
                    <DetailRow icon={<Mail className="w-4 h-4 text-sky-400" />} label="Email" value={selectedSupplier.contactEmail} />
                  )}
                  {selectedSupplier.phone && (
                    <DetailRow icon={<Phone className="w-4 h-4 text-emerald-400" />} label="Phone" value={selectedSupplier.phone} />
                  )}
                  {selectedSupplier.website && (
                    <DetailRow icon={<Globe className="w-4 h-4 text-purple-400" />} label="Website" value={selectedSupplier.website} />
                  )}
                  {selectedSupplier.currency && (
                    <DetailRow icon={<DollarSign className="w-4 h-4 text-amber-400" />} label="Currency" value={selectedSupplier.currency} />
                  )}
                  {selectedSupplier.taxId && (
                    <DetailRow icon={<FileText className="w-4 h-4 text-slate-400" />} label="Tax ID / GST" value={selectedSupplier.taxId} />
                  )}
                  {(selectedSupplier.leadTimeDays !== undefined) && (
                    <DetailRow icon={<Truck className="w-4 h-4 text-cyan-400" />} label="Lead Time" value={`${selectedSupplier.leadTimeDays} days`} />
                  )}
                  {selectedSupplier.address?.city && (
                    <DetailRow
                      icon={<MapPin className="w-4 h-4 text-rose-400" />}
                      label="Location"
                      value={[selectedSupplier.address.city, selectedSupplier.address.state, selectedSupplier.address.country].filter(Boolean).join(', ')}
                    />
                  )}
                  {selectedSupplier.notes && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl text-xs text-amber-700 dark:text-amber-300">
                      <p className="font-semibold mb-1">Notes</p>
                      <p>{selectedSupplier.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Performance Tab */}
              {activeTab === 'performance' && (
                <div className="space-y-3">
                  {perfLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
                    </div>
                  ) : !performance ? (
                    <div className="py-10 text-center text-slate-400">
                      <BarChart2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">No performance data available yet.</p>
                    </div>
                  ) : (
                    <>
                      <MetricCard icon={<Package className="w-4 h-4" />} label="Total PO Count" value={String(performance.totalOrders || 0)} color="indigo" />
                      <MetricCard icon={<DollarSign className="w-4 h-4" />} label="Total PO Value" value={`₹${(performance.totalValue || 0).toLocaleString('en-IN')}`} color="emerald" />
                      <MetricCard
                        icon={<CheckCircle2 className="w-4 h-4" />}
                        label="On-Time Delivery"
                        value={`${((performance.onTimeDeliveryRate || 0) * 100).toFixed(1)}%`}
                        color={(performance.onTimeDeliveryRate || 0) >= 0.8 ? 'emerald' : 'amber'}
                      />
                      <MetricCard
                        icon={<Clock className="w-4 h-4" />}
                        label="Avg Lead Time"
                        value={`${(performance.avgLeadTimeDays || 0).toFixed(1)} days`}
                        color="sky"
                      />
                      <MetricCard
                        icon={<Star className="w-4 h-4" />}
                        label="Quality Pass Rate"
                        value={`${((performance.qualityPassRate || 0) * 100).toFixed(1)}%`}
                        color={(performance.qualityPassRate || 0) >= 0.9 ? 'emerald' : 'amber'}
                      />
                      {performance.lastOrderDate && (
                        <MetricCard icon={<TrendingUp className="w-4 h-4" />} label="Last Order" value={new Date(performance.lastOrderDate).toLocaleDateString()} color="slate" />
                      )}
                    </>
                  )}
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && (
                <div className="space-y-2">
                  {histLoading ? (
                    Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)
                  ) : history.length === 0 ? (
                    <div className="py-10 text-center text-slate-400">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">No purchase orders found for this supplier.</p>
                    </div>
                  ) : (
                    history.map((po: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white text-xs">{po.poNumber || po.purchaseOrderNumber || '—'}</p>
                          <p className="text-xs text-slate-500">{po.createdAt ? new Date(po.createdAt).toLocaleDateString() : '—'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {po.totalAmount ? `₹${Number(po.totalAmount).toLocaleString('en-IN')}` : '—'}
                          </p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            po.status === 'RECEIVED' || po.status === 'CLOSED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' :
                            po.status === 'CANCELLED' ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400' :
                            'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                          }`}>{po.status || '—'}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-lg text-slate-900 dark:text-white">
                  {editingId ? 'Edit Supplier' : 'Add New Supplier'}
                </h2>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-5 space-y-5">
              {/* Basic Info */}
              <section>
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5" /> Basic Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">{formField('Supplier Name *', 'name')}</div>
                  {formField('Contact Person', 'contactPerson')}
                  {formField('Contact Email', 'contactEmail', 'email')}
                  {formField('Phone', 'phone', 'tel')}
                  {formField('Tax ID / GST No.', 'taxId')}
                  <div>
                    <Select
                      label="Currency"
                      value={form.currency}
                      onChange={(e) => setForm((p: any) => ({ ...p, currency: e.target.value }))}
                      variant="indigo"
                      searchable={false}
                      options={CURRENCY_OPTIONS}
                    />
                  </div>
                  {formField('Lead Time (days)', 'leadTimeDays', 'number', { min: 0 })}
                  {formField('Min. Order Value', 'minOrderValue', 'number', { min: 0 })}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Rating (1–5)</label>
                    <input
                      type="range" min={1} max={5} step={1}
                      value={form.rating}
                      onChange={(e) => setForm((p: any) => ({ ...p, rating: Number(e.target.value) }))}
                      className="w-full accent-indigo-600"
                    />
                    <div className="flex justify-between text-xs text-slate-400 mt-1">
                      {[1, 2, 3, 4, 5].map(v => <span key={v}>{v}★</span>)}
                    </div>
                  </div>
                </div>
              </section>

              {/* Address */}
              <section>
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" /> Address
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">{addrField('Street / Area', 'street')}</div>
                  {addrField('City', 'city')}
                  {addrField('State', 'state')}
                  {addrField('Country', 'country')}
                  {addrField('Postal Code', 'postalCode')}
                </div>
              </section>

              {/* Notes */}
              <section>
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Notes / Remarks</h3>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((p: any) => ({ ...p, notes: e.target.value }))}
                  placeholder="Any additional notes about this supplier..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </section>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 shadow-lg shadow-indigo-600/30"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : editingId ? 'Update Supplier' : 'Create Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Supplier Modal */}
      {viewingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/70 via-slate-50 to-purple-50/40 dark:from-slate-900 dark:via-indigo-950/20 dark:to-slate-900">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center text-xl font-bold shadow-lg shadow-indigo-500/20 ring-4 ring-white dark:ring-slate-800">
                    {viewingSupplier.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                        {viewingSupplier.name}
                      </h2>
                      {statusBadge(viewingSupplier)}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-medium text-slate-600 dark:text-slate-300">
                        {viewingSupplier.supplierCode || viewingSupplier.code || 'NO-CODE'}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <StarRating rating={viewingSupplier.rating || 0} />
                        <span className="font-semibold text-slate-700 dark:text-slate-300 ml-1">{viewingSupplier.rating || 0}.0</span>
                      </span>
                      <span>•</span>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        Currency: {viewingSupplier.currency || 'INR'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {can('purchase:update') && (
                    <button
                      onClick={() => handleToggleStatus(viewingSupplier)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition shadow-xs ${
                        isSupplierActive(viewingSupplier)
                          ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100'
                          : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200'
                      }`}
                      title={isSupplierActive(viewingSupplier) ? 'Click to Deactivate' : 'Click to Activate'}
                    >
                      {isSupplierActive(viewingSupplier) ? (
                        <>
                          <ToggleRight className="w-4 h-4 text-emerald-500" /> Active
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-4 h-4 text-slate-400" /> Inactive
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => setViewingSupplier(null)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex gap-2 mt-5 border-b border-slate-200/60 dark:border-slate-800 -mb-6">
                {[
                  { id: 'info', label: 'Overview & Details', icon: Building2 },
                  { id: 'performance', label: 'Performance Metrics', icon: BarChart2 },
                  { id: 'history', label: 'Purchase Orders', icon: FileText },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id as any)}
                      className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                        active
                          ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white/60 dark:bg-slate-800/40 rounded-t-xl'
                          : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Tab 1: Overview & Details */}
              {activeTab === 'info' && (
                <div className="space-y-6">
                  {/* Highlights Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/30">
                      <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Currency</p>
                      <p className="text-base font-bold text-slate-900 dark:text-white mt-1">{viewingSupplier.currency || 'INR'}</p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-cyan-50/60 dark:bg-cyan-950/30 border border-cyan-100 dark:border-cyan-900/30">
                      <p className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">Lead Time</p>
                      <p className="text-base font-bold text-slate-900 dark:text-white mt-1">{viewingSupplier.leadTimeDays ?? 0} days</p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30">
                      <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Min. Order</p>
                      <p className="text-base font-bold text-slate-900 dark:text-white mt-1">
                        {viewingSupplier.currency || 'INR'} {(viewingSupplier.minOrderValue || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30">
                      <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Rating</p>
                      <p className="text-base font-bold text-slate-900 dark:text-white mt-1">{viewingSupplier.rating ?? 3} / 5 ★</p>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <User className="w-3.5 h-3.5" /> Contact Details
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <DetailRow
                        icon={<Building2 className="w-4 h-4 text-indigo-500" />}
                        label="Contact Person"
                        value={viewingSupplier.contactPerson || 'Not provided'}
                      />
                      <DetailRow
                        icon={<Mail className="w-4 h-4 text-sky-500" />}
                        label="Email Address"
                        value={viewingSupplier.contactEmail || viewingSupplier.email || 'Not provided'}
                      />
                      <DetailRow
                        icon={<Phone className="w-4 h-4 text-emerald-500" />}
                        label="Phone Number"
                        value={viewingSupplier.phone || 'Not provided'}
                      />
                      <DetailRow
                        icon={<Globe className="w-4 h-4 text-purple-500" />}
                        label="Website"
                        value={viewingSupplier.website || 'Not provided'}
                      />
                      <DetailRow
                        icon={<FileText className="w-4 h-4 text-slate-500" />}
                        label="Tax ID / GSTIN"
                        value={viewingSupplier.taxId || viewingSupplier.taxNumber || 'Not provided'}
                      />
                      <DetailRow
                        icon={<DollarSign className="w-4 h-4 text-amber-500" />}
                        label="Payment Terms"
                        value={(viewingSupplier as any).paymentTerms || (viewingSupplier as any).paymentTermsId || 'Standard (Net 30)'}
                      />
                    </div>
                  </div>

                  {/* Address */}
                  <div className="bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5" /> Address
                    </h3>
                    <div className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                      {viewingSupplier.address?.street && <p>{viewingSupplier.address.street}</p>}
                      <p>
                        {[
                          viewingSupplier.address?.city,
                          viewingSupplier.address?.state,
                          viewingSupplier.address?.postalCode,
                        ]
                          .filter(Boolean)
                          .join(', ') || 'No street/city specified'}
                      </p>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {viewingSupplier.address?.country || 'India'}
                      </p>
                    </div>
                  </div>

                  {/* Notes */}
                  {viewingSupplier.notes && (
                    <div className="bg-amber-50/60 dark:bg-amber-950/20 rounded-2xl p-4 border border-amber-200/60 dark:border-amber-900/30">
                      <h3 className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider mb-1">
                        Notes & Remarks
                      </h3>
                      <p className="text-xs text-amber-900 dark:text-amber-300 leading-relaxed">
                        {viewingSupplier.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Performance Tab */}
              {activeTab === 'performance' && (
                <div className="space-y-4">
                  {perfLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-2xl" />
                      ))}
                    </div>
                  ) : !performance ? (
                    <div className="py-16 text-center text-slate-400">
                      <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30 text-indigo-400" />
                      <p className="font-medium text-slate-700 dark:text-slate-300">No performance metrics recorded yet</p>
                      <p className="text-xs text-slate-500 mt-1">Purchase orders with this vendor will automatically generate performance ratings.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <MetricCard icon={<Package className="w-4 h-4" />} label="Total Orders" value={String(performance.totalOrders || 0)} color="indigo" />
                      <MetricCard icon={<DollarSign className="w-4 h-4" />} label="Total Spend" value={`${viewingSupplier.currency || 'INR'} ${(performance.totalValue || 0).toLocaleString()}`} color="emerald" />
                      <MetricCard
                        icon={<CheckCircle2 className="w-4 h-4" />}
                        label="On-Time Delivery"
                        value={`${((performance.onTimeDeliveryRate || 0) * 100).toFixed(1)}%`}
                        color={(performance.onTimeDeliveryRate || 0) >= 0.8 ? 'emerald' : 'amber'}
                      />
                      <MetricCard
                        icon={<Clock className="w-4 h-4" />}
                        label="Average Lead Time"
                        value={`${(performance.avgLeadTimeDays || 0).toFixed(1)} days`}
                        color="sky"
                      />
                      <MetricCard
                        icon={<Star className="w-4 h-4" />}
                        label="Quality Pass Rate"
                        value={`${((performance.qualityPassRate || 0) * 100).toFixed(1)}%`}
                        color={(performance.qualityPassRate || 0) >= 0.9 ? 'emerald' : 'amber'}
                      />
                      {performance.lastOrderDate && (
                        <MetricCard icon={<TrendingUp className="w-4 h-4" />} label="Last Order" value={new Date(performance.lastOrderDate).toLocaleDateString()} color="slate" />
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: History Tab */}
              {activeTab === 'history' && (
                <div className="space-y-3">
                  {histLoading ? (
                    Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)
                  ) : history.length === 0 ? (
                    <div className="py-16 text-center text-slate-400">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-30 text-indigo-400" />
                      <p className="font-medium text-slate-700 dark:text-slate-300">No purchase order history</p>
                      <p className="text-xs text-slate-500 mt-1">There are no purchase orders associated with this supplier yet.</p>
                    </div>
                  ) : (
                    history.map((po: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white text-xs">{po.poNumber || po.purchaseOrderNumber || 'PO-####'}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{po.createdAt ? new Date(po.createdAt).toLocaleDateString() : '—'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white">
                            {viewingSupplier.currency || 'INR'} {Number(po.totalAmount || 0).toLocaleString()}
                          </p>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block mt-1 ${
                            po.status === 'RECEIVED' || po.status === 'CLOSED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' :
                            po.status === 'CANCELLED' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400' :
                            'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                          }`}>{po.status || 'PENDING'}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 px-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Status:</span>
                {statusBadge(viewingSupplier)}
              </div>
              <div className="flex items-center gap-3">
                {can('purchase:update') && (
                  <button
                    onClick={() => {
                      const s = viewingSupplier;
                      setViewingSupplier(null);
                      openEdit(s);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit Supplier
                  </button>
                )}
                <button
                  onClick={() => setViewingSupplier(null)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition shadow-md shadow-indigo-600/20"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper components
const DetailRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
    <div className="mt-0.5 flex-shrink-0">{icon}</div>
    <div>
      <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{label}</p>
      <p className="text-sm font-medium text-slate-900 dark:text-white mt-0.5">{value}</p>
    </div>
  </div>
);

const colorMap: Record<string, { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-indigo-50 dark:bg-indigo-950/30', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-100 dark:border-indigo-900/30' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-100 dark:border-emerald-900/30' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-100 dark:border-amber-900/30' },
  sky: { bg: 'bg-sky-50 dark:bg-sky-950/30', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-100 dark:border-sky-900/30' },
  slate: { bg: 'bg-slate-50 dark:bg-slate-800/50', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-100 dark:border-slate-800' },
};

const MetricCard: React.FC<{ icon: React.ReactNode; label: string; value: string; color: string }> = ({ icon, label, value, color }) => {
  const c = colorMap[color] || colorMap.slate;
  return (
    <div className={`flex items-center justify-between p-3 rounded-xl border ${c.bg} ${c.border}`}>
      <div className="flex items-center gap-2">
        <span className={c.text}>{icon}</span>
        <span className="text-xs text-slate-600 dark:text-slate-400">{label}</span>
      </div>
      <span className={`text-sm font-bold ${c.text}`}>{value}</span>
    </div>
  );
};
