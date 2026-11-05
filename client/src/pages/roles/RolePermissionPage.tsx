import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { roleApi } from '../../api/role.api';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/common/PageHeader';
import { PermissionGate } from '../../components/common/PermissionGate';
import { FeatureGate } from '../../components/common/FeatureGate';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { RoleDefinition, PermissionDefinition } from '../../types';
import {
  ShieldCheck,
  Plus,
  Check,
  Lock,
  Sparkles,
  Layers,
  Edit,
  Trash2,
  Copy,
  Search,
  Grid,
  List,
  CheckCircle2,
  XCircle,
  Building,
  Warehouse,
  DollarSign,
  FileCheck,
  UserCheck,
  Users,
  Store,
  Briefcase,
  AlertTriangle,
  Sliders,
  ChevronRight,
} from 'lucide-react';

interface ModuleMatrixRow {
  moduleId: string;
  moduleName: string;
  category: string;
  actions: {
    view?: string;
    create?: string;
    edit?: string;
    delete?: string;
    submit?: string;
    approve?: string;
    reject?: string;
    export?: string;
    special?: { code: string; label: string }[];
  };
}

const MODULE_MATRIX_CONFIG: ModuleMatrixRow[] = [
  {
    moduleId: 'inventory',
    moduleName: 'Inventory Ledger & Stock',
    category: 'Inventory',
    actions: {
      view: 'inventory:read',
      create: 'inventory:create',
      edit: 'inventory:update',
      delete: 'inventory:delete',
      export: 'inventory:export',
      special: [
        { code: 'inventory:adjust', label: 'Adjust' },
        { code: 'inventory:transfer', label: 'Transfer' },
        { code: 'inventory:receive', label: 'Receive' },
        { code: 'inventory:issue', label: 'Issue' },
        { code: 'inventory:count', label: 'Count' },
      ],
    },
  },
  {
    moduleId: 'warehouses',
    moduleName: 'Warehouses & Physical Hierarchy',
    category: 'Inventory',
    actions: {
      view: 'warehouses:read',
      create: 'warehouses:create',
      edit: 'warehouses:update',
      delete: 'warehouses:delete',
      special: [{ code: 'warehouses:manage', label: 'Manage' }],
    },
  },
  {
    moduleId: 'requisitions',
    moduleName: 'Purchase Requisitions (PR)',
    category: 'Procurement',
    actions: {
      view: 'purchase_requisition.view',
      create: 'purchase_requisition.create',
      edit: 'purchase_requisition.edit',
      delete: 'purchase_requisition.delete',
      submit: 'purchase_requisition.submit',
      approve: 'purchase_requisition.approve',
      reject: 'purchase_requisition.reject',
      export: 'purchase_requisition.export',
    },
  },
  {
    moduleId: 'rfq',
    moduleName: 'Requests for Quotation (RFQ)',
    category: 'Procurement',
    actions: {
      view: 'rfq.view',
      create: 'rfq.create',
      edit: 'rfq.edit',
      delete: 'rfq.delete',
      export: 'rfq.export',
      special: [
        { code: 'rfq.issue', label: 'Issue' },
        { code: 'rfq.close', label: 'Close' },
      ],
    },
  },
  {
    moduleId: 'quotes',
    moduleName: 'Supplier Quotations',
    category: 'Procurement',
    actions: {
      view: 'supplier_quote.view',
      create: 'supplier_quote.create',
      edit: 'supplier_quote.edit',
      reject: 'supplier_quote.reject',
      export: 'supplier_quote.export',
      special: [{ code: 'supplier_quote.finalize', label: 'Finalize' }],
    },
  },
  {
    moduleId: 'purchase_orders',
    moduleName: 'Purchase Orders (PO)',
    category: 'Procurement',
    actions: {
      view: 'purchase_order.view',
      create: 'purchase_order.create',
      edit: 'purchase_order.edit',
      delete: 'purchase_order.delete',
      submit: 'purchase_order.submit',
      approve: 'purchase_order.approve',
      reject: 'purchase_order.reject',
      export: 'purchase_order.export',
      special: [
        { code: 'purchase_order.send', label: 'Send' },
        { code: 'purchase_order.cancel', label: 'Cancel' },
      ],
    },
  },
  {
    moduleId: 'grn',
    moduleName: 'Goods Receipts (GRN)',
    category: 'Procurement',
    actions: {
      view: 'grn.view',
      create: 'grn:create',
      edit: 'grn.edit',
      export: 'grn.export',
      special: [
        { code: 'grn.receive', label: 'Receive' },
        { code: 'grn.complete', label: 'Complete' },
        { code: 'grn.cancel', label: 'Cancel' },
      ],
    },
  },
  {
    moduleId: 'purchase_qc',
    moduleName: 'Inbound Purchase QC',
    category: 'Quality Control',
    actions: {
      view: 'purchase_qc.view',
      create: 'purchase_qc.create',
      edit: 'purchase_qc.edit',
      approve: 'purchase_qc.approve',
      reject: 'purchase_qc.reject',
      export: 'purchase_qc.export',
      special: [
        { code: 'purchase_qc.inspect', label: 'Inspect' },
        { code: 'purchase_qc.hold', label: 'Hold' },
        { code: 'purchase_qc.disposition', label: 'Disposition' },
      ],
    },
  },
  {
    moduleId: 'sales_orders',
    moduleName: 'Sales Orders & OTC',
    category: 'Sales',
    actions: {
      view: 'sales_order.view',
      create: 'sales_order.create',
      edit: 'sales_order.edit',
      delete: 'sales_order.delete',
      submit: 'sales_order.submit',
      approve: 'sales_order.approve',
      reject: 'sales_order.reject',
      export: 'sales_order.export',
      special: [
        { code: 'sales_order.confirm', label: 'Confirm' },
        { code: 'sales_order.allocate', label: 'Allocate' },
        { code: 'sales_order.cancel', label: 'Cancel' },
      ],
    },
  },
  {
    moduleId: 'packaging',
    moduleName: 'Packaging Operations',
    category: 'Sales',
    actions: {
      view: 'packaging.view',
      create: 'packaging.create',
      edit: 'packaging.edit',
      export: 'packaging.export',
      special: [
        { code: 'packaging.pack', label: 'Pack' },
        { code: 'packaging.cancel', label: 'Cancel' },
      ],
    },
  },
  {
    moduleId: 'dispatch',
    moduleName: 'Outbound Dispatch & Shipping',
    category: 'Sales',
    actions: {
      view: 'dispatch.view',
      create: 'dispatch.create',
      edit: 'dispatch.edit',
      export: 'dispatch.export',
      special: [
        { code: 'dispatch.dispatch', label: 'Dispatch' },
        { code: 'dispatch.cancel', label: 'Cancel' },
      ],
    },
  },
  {
    moduleId: 'gatepass',
    moduleName: 'Security Gate Passes',
    category: 'Security',
    actions: {
      view: 'gatepass.view',
      create: 'gatepass.create',
      edit: 'gatepass.edit',
      approve: 'gatepass.approve',
      export: 'gatepass.export',
      special: [
        { code: 'gatepass.gateout', label: 'Gate-Out' },
        { code: 'gatepass.close', label: 'Close' },
      ],
    },
  },
  {
    moduleId: 'invoices',
    moduleName: 'Invoicing & Billing',
    category: 'Billing',
    actions: {
      view: 'invoice.view',
      create: 'invoice.create',
      edit: 'invoice.edit',
      export: 'invoice.export',
      special: [
        { code: 'invoice.issue', label: 'Issue' },
        { code: 'invoice.cancel', label: 'Cancel' },
      ],
    },
  },
  {
    moduleId: 'payments',
    moduleName: 'Payments & Collections',
    category: 'Billing',
    actions: {
      view: 'payment.view',
      create: 'payment.create',
      edit: 'payment.edit',
      export: 'payment.export',
      special: [{ code: 'payment.reverse', label: 'Reverse' }],
    },
  },
  {
    moduleId: 'bom',
    moduleName: 'Bill of Materials (BOM)',
    category: 'Production',
    actions: {
      view: 'bom.view',
      create: 'bom.create',
      edit: 'bom.edit',
      delete: 'bom.delete',
      approve: 'bom.approve',
      export: 'bom.export',
      special: [
        { code: 'bom.activate', label: 'Activate' },
        { code: 'bom.archive', label: 'Archive' },
      ],
    },
  },
  {
    moduleId: 'production',
    moduleName: 'Production Work Orders',
    category: 'Production',
    actions: {
      view: 'production.view',
      create: 'production.create',
      edit: 'production.edit',
      delete: 'production.delete',
      submit: 'production.submit',
      approve: 'production.approve',
      export: 'production.export',
      special: [
        { code: 'production.release', label: 'Release' },
        { code: 'production.start', label: 'Start' },
        { code: 'production.pause', label: 'Pause' },
        { code: 'production.resume', label: 'Resume' },
        { code: 'production.complete', label: 'Complete' },
        { code: 'production.consume', label: 'Consume' },
        { code: 'production.receive', label: 'Receive' },
        { code: 'production.cancel', label: 'Cancel' },
      ],
    },
  },
  {
    moduleId: 'production_qc',
    moduleName: 'Production Batch QC',
    category: 'Quality Control',
    actions: {
      view: 'production-qc.view',
      create: 'production-qc.create',
      edit: 'production-qc.edit',
      approve: 'production-qc.approve',
      reject: 'production-qc.reject',
      export: 'production-qc.export',
      special: [
        { code: 'production-qc.inspect', label: 'Inspect' },
        { code: 'production-qc.hold', label: 'Hold' },
        { code: 'production-qc.rework', label: 'Rework' },
        { code: 'production-qc.scrap', label: 'Scrap' },
      ],
    },
  },
  {
    moduleId: 'quality_general',
    moduleName: 'General Quality Control',
    category: 'Quality Control',
    actions: {
      view: 'qc:read',
      create: 'qc:create',
      edit: 'qc:edit',
      delete: 'qc:delete',
      approve: 'qc:approve',
      reject: 'qc:reject',
      export: 'qc:export',
      special: [
        { code: 'qc:inspect', label: 'Inspect' },
        { code: 'qc:templates', label: 'Templates' },
      ],
    },
  },
  {
    moduleId: 'reports_analytics',
    moduleName: 'Reports & Analytics',
    category: 'Reporting',
    actions: {
      view: 'reports:read',
      export: 'reports:export',
      special: [
        { code: 'analytics.view', label: 'Analytics' },
        { code: 'analytics.export', label: 'Analytics Export' },
      ],
    },
  },
  {
    moduleId: 'admin_security',
    moduleName: 'Users, Roles & Security',
    category: 'Administration',
    actions: {
      view: 'users:read',
      create: 'users:create',
      edit: 'users:update',
      delete: 'users:delete',
      special: [
        { code: 'users:manage', label: 'User Admin' },
        { code: 'roles:manage', label: 'Role Admin' },
        { code: 'policies:manage', label: 'ABAC Admin' },
        { code: 'audit:export', label: 'Audit Export' },
      ],
    },
  },
];

export const RolePermissionPage: React.FC = () => {
  const navigate = useNavigate();
  const { can, hasFeature } = usePermissions();
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<'rbac' | 'abac'>('rbac');
  const [viewMode, setViewMode] = useState<'matrix' | 'list'>('matrix');

  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [catalog, setCatalog] = useState<PermissionDefinition[]>([]);
  const [selectedRole, setSelectedRole] = useState<RoleDefinition | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter
  const [roleSearch, setRoleSearch] = useState('');
  const [permSearch, setPermSearch] = useState('');

  // Custom Role Modal (Create or Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [rolePerms, setRolePerms] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirmation Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<RoleDefinition | null>(null);

  const fetchRolesAndCatalog = async () => {
    setIsLoading(true);
    try {
      const [rolesRes, catalogRes] = await Promise.all([
        roleApi.listRoles(),
        roleApi.getPermissionsCatalog(),
      ]);

      if (rolesRes.success && rolesRes.data) {
        setRoles(rolesRes.data);
        if (!selectedRole && rolesRes.data.length > 0) {
          setSelectedRole(rolesRes.data[0]);
        } else if (selectedRole) {
          // Re-sync selected role
          const updated = rolesRes.data.find(
            (r: RoleDefinition) => (r._id || r.slug) === (selectedRole._id || selectedRole.slug)
          );
          if (updated) setSelectedRole(updated);
        }
      }

      if (catalogRes.success && catalogRes.data) {
        setCatalog(catalogRes.data);
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to load roles and permissions matrix');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRolesAndCatalog();
  }, []);

  // Filtered Roles List
  const filteredRoles = useMemo(() => {
    if (!roleSearch.trim()) return roles;
    const term = roleSearch.toLowerCase();
    return roles.filter(
      (r) => r.name.toLowerCase().includes(term) || (r.description && r.description.toLowerCase().includes(term))
    );
  }, [roles, roleSearch]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingRoleId(null);
    setRoleName('');
    setRoleDesc('');
    setRolePerms([]);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (role: RoleDefinition) => {
    if (role.isSystemRole) {
      error('System default roles are protected and cannot be directly modified. You can clone this role instead.');
      return;
    }
    setEditingRoleId(role._id || null);
    setRoleName(role.name);
    setRoleDesc(role.description || '');
    setRolePerms([...role.permissions]);
    setIsModalOpen(true);
  };

  // Clone Role
  const handleCloneRole = (role: RoleDefinition) => {
    setEditingRoleId(null);
    setRoleName(`${role.name} (Custom Copy)`);
    setRoleDesc(`Customized replica of ${role.name}. ${role.description || ''}`.trim());
    // If wildcard, expand or keep
    setRolePerms(role.permissions.includes('*') ? catalog.map((p) => p.code) : [...role.permissions]);
    setIsModalOpen(true);
  };

  // Submit Role (Create or Update)
  const handleSubmitRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) {
      error('Please provide a name for the role');
      return;
    }
    if (rolePerms.length === 0) {
      error('Please assign at least one permission to the custom role');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingRoleId) {
        const res = await roleApi.updateRole(editingRoleId, {
          name: roleName.trim(),
          description: roleDesc.trim(),
          permissions: rolePerms,
        });
        if (res.success) {
          success(`Role '${roleName}' updated successfully!`);
          setIsModalOpen(false);
          fetchRolesAndCatalog();
        }
      } else {
        const res = await roleApi.createRole({
          name: roleName.trim(),
          description: roleDesc.trim(),
          permissions: rolePerms,
        });
        if (res.success) {
          success(`Custom role '${roleName}' created successfully!`);
          setIsModalOpen(false);
          fetchRolesAndCatalog();
        }
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to save role');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Custom Role
  const handleDeleteRoleConfirm = async () => {
    if (!roleToDelete || !roleToDelete._id) return;
    try {
      const res = await roleApi.deleteRole(roleToDelete._id);
      if (res.success) {
        success(`Custom role '${roleToDelete.name}' deleted successfully!`);
        setIsDeleteModalOpen(false);
        setRoleToDelete(null);
        if (selectedRole?._id === roleToDelete._id) {
          setSelectedRole(roles[0] || null);
        }
        fetchRolesAndCatalog();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to delete custom role');
    }
  };

  const toggleModalPermission = (code: string) => {
    setRolePerms((prev) =>
      prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code]
    );
  };

  const toggleAllInModule = (codes: string[]) => {
    const allSelected = codes.every((c) => rolePerms.includes(c));
    if (allSelected) {
      setRolePerms((prev) => prev.filter((c) => !codes.includes(c)));
    } else {
      setRolePerms((prev) => Array.from(new Set([...prev, ...codes])));
    }
  };

  // Check if permission granted for selected role
  const isGranted = (code?: string): boolean => {
    if (!code || !selectedRole) return false;
    return selectedRole.permissions.includes('*') || selectedRole.permissions.includes(code);
  };

  const categories = Array.from(new Set(catalog.map((p) => p.category)));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions (RBAC / ABAC)"
        description="Enterprise access control matrix, granular verb permissions, and attribute-based security policies"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Roles & Permissions' }]}
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="md"
              leftIcon={<Users className="w-4 h-4 text-emerald-400" />}
              onClick={() => navigate('/users')}
            >
              Assign Roles to Team
            </Button>
            <PermissionGate permission="roles:create">
              <Button
                variant="primary"
                size="md"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={handleOpenCreateModal}
              >
                Create Custom Role
              </Button>
            </PermissionGate>
          </div>
        }
      />

      {/* Main Mode Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('rbac')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'rbac'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-md shadow-emerald-950/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            RBAC Permission Matrix
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 font-mono">
              {roles.length} Roles
            </span>
          </button>

          <button
            onClick={() => setActiveTab('abac')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'abac'
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 shadow-md shadow-indigo-950/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
            }`}
          >
            <Sliders className="w-4 h-4" />
            ABAC Policy Framework & Scopes
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
              8 Attributes
            </span>
          </button>
        </div>

        {activeTab === 'rbac' && (
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-900 rounded-lg p-1 border border-slate-800">
              <button
                onClick={() => setViewMode('matrix')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  viewMode === 'matrix'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Module by Action Matrix View"
              >
                <Grid className="w-3.5 h-3.5" />
                Matrix Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  viewMode === 'list'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Categorized List View"
              >
                <List className="w-3.5 h-3.5" />
                Category List
              </button>
            </div>
          </div>
        )}
      </div>

      {activeTab === 'rbac' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column: Roles Explorer */}
          <div className="lg:col-span-1 space-y-3">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                System & Custom Roles ({filteredRoles.length})
              </p>
            </div>

            {/* Role Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search roles..."
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {filteredRoles.map((r) => {
                const isSelected = (selectedRole?._id || selectedRole?.slug) === (r._id || r.slug);
                return (
                  <div
                    key={r._id || r.slug}
                    onClick={() => setSelectedRole(r)}
                    className={`group w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-950/20'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-bold text-white truncate">{r.name}</p>
                          {r.isSystemRole ? (
                            <span className="text-[9px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                              System
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30">
                              Custom
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-1">
                          {r.description || 'Custom organization role'}
                        </p>
                      </div>

                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0">
                        {r.permissions.includes('*') ? 'All (*)' : `${r.permissions.length} perms`}
                      </span>
                    </div>

                    {/* Quick Role Actions */}
                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloneRole(r);
                        }}
                        className="hover:text-emerald-400 flex items-center gap-1 transition-colors"
                        title="Clone role to create custom variation"
                      >
                        <Copy className="w-3 h-3" /> Clone
                      </button>

                      {!r.isSystemRole && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(r);
                            }}
                            className="hover:text-amber-400 flex items-center gap-1 transition-colors"
                            title="Edit role permissions"
                          >
                            <Edit className="w-3 h-3" /> Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRoleToDelete(r);
                              setIsDeleteModalOpen(true);
                            }}
                            className="hover:text-rose-400 flex items-center gap-1 transition-colors"
                            title="Delete custom role"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Permission Matrix / Details */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {selectedRole?.name}
                        {selectedRole?.isSystemRole ? (
                          <Badge variant="default" size="sm">
                            SYSTEM DEFAULT
                          </Badge>
                        ) : (
                          <Badge variant="purple" size="sm">
                            CUSTOM TENANT ROLE
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {selectedRole?.description || 'Active functional authorization matrix for this role'}
                      </CardDescription>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Copy className="w-3.5 h-3.5" />}
                    onClick={() => selectedRole && handleCloneRole(selectedRole)}
                  >
                    Clone Role
                  </Button>
                  {!selectedRole?.isSystemRole && (
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<Edit className="w-3.5 h-3.5" />}
                      onClick={() => selectedRole && handleOpenEditModal(selectedRole)}
                    >
                      Edit Role
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Global Wildcard Notice if role has * */}
              {selectedRole?.permissions.includes('*') && (
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-purple-200">Global Wildcard Authorization (*)</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      This role possesses unrestricted administrative authority across all modules, ledger mutations, routes, and data entities within the tenant isolation partition.
                    </p>
                  </div>
                </div>
              )}

              {/* View Mode 1: Module x Action Grid Matrix */}
              {viewMode === 'matrix' ? (
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900/90 text-slate-300 font-bold border-b border-slate-800 text-[11px] uppercase tracking-wider">
                        <th className="p-3 min-w-[200px]">Functional Module</th>
                        <th className="p-3 text-center">View</th>
                        <th className="p-3 text-center">Create</th>
                        <th className="p-3 text-center">Edit</th>
                        <th className="p-3 text-center">Delete</th>
                        <th className="p-3 text-center">Submit</th>
                        <th className="p-3 text-center">Approve</th>
                        <th className="p-3 text-center">Reject</th>
                        <th className="p-3 text-center">Export</th>
                        <th className="p-3 min-w-[180px]">Operational Verbs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {MODULE_MATRIX_CONFIG.map((mod) => {
                        const { actions } = mod;
                        return (
                          <tr key={mod.moduleId} className="hover:bg-slate-900/50 transition-colors">
                            <td className="p-3">
                              <p className="font-bold text-white text-xs">{mod.moduleName}</p>
                              <span className="text-[10px] font-mono text-slate-500">{mod.category}</span>
                            </td>

                            {/* View */}
                            <td className="p-3 text-center">
                              {actions.view ? (
                                isGranted(actions.view) ? (
                                  <span className="inline-flex p-1 rounded-md bg-emerald-500/20 text-emerald-400" title={actions.view}>
                                    <Check className="w-3.5 h-3.5" />
                                  </span>
                                ) : (
                                  <span className="inline-flex p-1 rounded-md bg-slate-900 text-slate-600" title={`Locked: ${actions.view}`}>
                                    <Lock className="w-3.5 h-3.5" />
                                  </span>
                                )
                              ) : (
                                <span className="text-slate-700">—</span>
                              )}
                            </td>

                            {/* Create */}
                            <td className="p-3 text-center">
                              {actions.create ? (
                                isGranted(actions.create) ? (
                                  <span className="inline-flex p-1 rounded-md bg-emerald-500/20 text-emerald-400" title={actions.create}>
                                    <Check className="w-3.5 h-3.5" />
                                  </span>
                                ) : (
                                  <span className="inline-flex p-1 rounded-md bg-slate-900 text-slate-600" title={`Locked: ${actions.create}`}>
                                    <Lock className="w-3.5 h-3.5" />
                                  </span>
                                )
                              ) : (
                                <span className="text-slate-700">—</span>
                              )}
                            </td>

                            {/* Edit */}
                            <td className="p-3 text-center">
                              {actions.edit ? (
                                isGranted(actions.edit) ? (
                                  <span className="inline-flex p-1 rounded-md bg-emerald-500/20 text-emerald-400" title={actions.edit}>
                                    <Check className="w-3.5 h-3.5" />
                                  </span>
                                ) : (
                                  <span className="inline-flex p-1 rounded-md bg-slate-900 text-slate-600" title={`Locked: ${actions.edit}`}>
                                    <Lock className="w-3.5 h-3.5" />
                                  </span>
                                )
                              ) : (
                                <span className="text-slate-700">—</span>
                              )}
                            </td>

                            {/* Delete */}
                            <td className="p-3 text-center">
                              {actions.delete ? (
                                isGranted(actions.delete) ? (
                                  <span className="inline-flex p-1 rounded-md bg-emerald-500/20 text-emerald-400" title={actions.delete}>
                                    <Check className="w-3.5 h-3.5" />
                                  </span>
                                ) : (
                                  <span className="inline-flex p-1 rounded-md bg-slate-900 text-slate-600" title={`Locked: ${actions.delete}`}>
                                    <Lock className="w-3.5 h-3.5" />
                                  </span>
                                )
                              ) : (
                                <span className="text-slate-700">—</span>
                              )}
                            </td>

                            {/* Submit */}
                            <td className="p-3 text-center">
                              {actions.submit ? (
                                isGranted(actions.submit) ? (
                                  <span className="inline-flex p-1 rounded-md bg-emerald-500/20 text-emerald-400" title={actions.submit}>
                                    <Check className="w-3.5 h-3.5" />
                                  </span>
                                ) : (
                                  <span className="inline-flex p-1 rounded-md bg-slate-900 text-slate-600" title={`Locked: ${actions.submit}`}>
                                    <Lock className="w-3.5 h-3.5" />
                                  </span>
                                )
                              ) : (
                                <span className="text-slate-700">—</span>
                              )}
                            </td>

                            {/* Approve */}
                            <td className="p-3 text-center">
                              {actions.approve ? (
                                isGranted(actions.approve) ? (
                                  <span className="inline-flex p-1 rounded-md bg-emerald-500/20 text-emerald-400" title={actions.approve}>
                                    <Check className="w-3.5 h-3.5" />
                                  </span>
                                ) : (
                                  <span className="inline-flex p-1 rounded-md bg-slate-900 text-slate-600" title={`Locked: ${actions.approve}`}>
                                    <Lock className="w-3.5 h-3.5" />
                                  </span>
                                )
                              ) : (
                                <span className="text-slate-700">—</span>
                              )}
                            </td>

                            {/* Reject */}
                            <td className="p-3 text-center">
                              {actions.reject ? (
                                isGranted(actions.reject) ? (
                                  <span className="inline-flex p-1 rounded-md bg-emerald-500/20 text-emerald-400" title={actions.reject}>
                                    <Check className="w-3.5 h-3.5" />
                                  </span>
                                ) : (
                                  <span className="inline-flex p-1 rounded-md bg-slate-900 text-slate-600" title={`Locked: ${actions.reject}`}>
                                    <Lock className="w-3.5 h-3.5" />
                                  </span>
                                )
                              ) : (
                                <span className="text-slate-700">—</span>
                              )}
                            </td>

                            {/* Export */}
                            <td className="p-3 text-center">
                              {actions.export ? (
                                isGranted(actions.export) ? (
                                  <span className="inline-flex p-1 rounded-md bg-emerald-500/20 text-emerald-400" title={actions.export}>
                                    <Check className="w-3.5 h-3.5" />
                                  </span>
                                ) : (
                                  <span className="inline-flex p-1 rounded-md bg-slate-900 text-slate-600" title={`Locked: ${actions.export}`}>
                                    <Lock className="w-3.5 h-3.5" />
                                  </span>
                                )
                              ) : (
                                <span className="text-slate-700">—</span>
                              )}
                            </td>

                            {/* Special Operations */}
                            <td className="p-3">
                              {actions.special && actions.special.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {actions.special.map((sp) => {
                                    const granted = isGranted(sp.code);
                                    return (
                                      <span
                                        key={sp.code}
                                        title={sp.code}
                                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono border flex items-center gap-1 ${
                                          granted
                                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                            : 'bg-slate-900 text-slate-600 border-slate-800'
                                        }`}
                                      >
                                        {granted ? <Check className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                                        {sp.label}
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-slate-700">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* View Mode 2: Categorized List */
                <div className="space-y-6">
                  {categories.map((category) => {
                    const categoryPerms = catalog.filter((p) => p.category === category);
                    return (
                      <div key={category} className="space-y-2">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                          <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                            {category}
                          </p>
                          <span className="text-[10px] font-mono text-slate-500">
                            {categoryPerms.filter((p) => isGranted(p.code)).length} of {categoryPerms.length} granted
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {categoryPerms.map((perm) => {
                            const granted = isGranted(perm.code);
                            return (
                              <div
                                key={perm.code}
                                className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                                  granted
                                    ? 'bg-emerald-500/5 border-emerald-500/20 text-slate-200'
                                    : 'bg-slate-950/40 border-slate-800 text-slate-500 opacity-60'
                                }`}
                              >
                                <div
                                  className={`w-4 h-4 rounded-full mt-0.5 flex items-center justify-center shrink-0 ${
                                    granted
                                      ? 'bg-emerald-500/20 text-emerald-400'
                                      : 'bg-slate-800 text-slate-600'
                                  }`}
                                >
                                  {granted ? <Check className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-white truncate leading-tight">{perm.name}</p>
                                  <p className="text-[10px] text-slate-400 truncate mt-0.5">{perm.description}</p>
                                  <p className="text-[9px] text-slate-500 truncate font-mono mt-0.5">{perm.code}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* ABAC Policy Framework & Scopes Tab */
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Sliders className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle className="text-base">Attribute-Based Access Control (ABAC) Policy Framework</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Multi-dimensional security constraints evaluated at both UI routes and backend data query layers per PDF Section 7 & 9
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Tenant Boundary */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Building className="w-4 h-4" />
                    </span>
                    <Badge variant="success" size="sm">MANDATORY</Badge>
                  </div>
                  <h4 className="text-sm font-bold text-white">1. Tenant Isolation</h4>
                  <p className="text-xs text-slate-400">
                    Row-level isolation. Every MongoDB query contains strict <code className="text-emerald-400 font-mono text-[10px]">tenantId</code> filters. Tenant A can never view or manipulate Tenant B data.
                  </p>
                </div>

                {/* 2. Warehouse Scope */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <Warehouse className="w-4 h-4" />
                    </span>
                    <Badge variant="info" size="sm">FACILITY</Badge>
                  </div>
                  <h4 className="text-sm font-bold text-white">2. Warehouse Scope</h4>
                  <p className="text-xs text-slate-400">
                    Confines warehouse personnel to assigned facilities (e.g. <code className="text-blue-400 font-mono text-[10px]">['WH-NORTH', 'WH-CENTRAL']</code>). Blocks cross-facility transactions.
                  </p>
                </div>

                {/* 3. Approval Amount */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <DollarSign className="w-4 h-4" />
                    </span>
                    <Badge variant="warning" size="sm">FINANCIAL</Badge>
                  </div>
                  <h4 className="text-sm font-bold text-white">3. Approval Amount Limit</h4>
                  <p className="text-xs text-slate-400">
                    Tiered monetary ceilings enforced on Purchase Orders and Requisitions. Requisitions exceeding a user's <code className="text-amber-400 font-mono text-[10px]">maxApprovalLimit</code> require manager sign-off.
                  </p>
                </div>

                {/* 4. Department Scope */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <Briefcase className="w-4 h-4" />
                    </span>
                    <Badge variant="purple" size="sm">ORGANIZATION</Badge>
                  </div>
                  <h4 className="text-sm font-bold text-white">4. Departmental Scope</h4>
                  <p className="text-xs text-slate-400">
                    Restricts requisition creation and budget tracking to the employee's assigned department (e.g. Operations, Logistics, Production).
                  </p>
                </div>

                {/* 5. Store Scope */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      <Store className="w-4 h-4" />
                    </span>
                    <Badge variant="default" size="sm">LOCATION</Badge>
                  </div>
                  <h4 className="text-sm font-bold text-white">5. Store / Retail Scope</h4>
                  <p className="text-xs text-slate-400">
                    Restricts local retail or sub-stock operators to their designated store dispensary or retail depot.
                  </p>
                </div>

                {/* 6. Business Unit */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20">
                      <Layers className="w-4 h-4" />
                    </span>
                    <Badge variant="default" size="sm">DIVISION</Badge>
                  </div>
                  <h4 className="text-sm font-bold text-white">6. Business Unit (BU)</h4>
                  <p className="text-xs text-slate-400">
                    Divisional grouping across enterprise branches, subsidiaries, or business units.
                  </p>
                </div>

                {/* 7. Document Ownership */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <FileCheck className="w-4 h-4" />
                    </span>
                    <Badge variant="success" size="sm">INTEGRITY</Badge>
                  </div>
                  <h4 className="text-sm font-bold text-white">7. Document Ownership</h4>
                  <p className="text-xs text-slate-400">
                    Only document creators can edit draft PRs or POs. Once submitted or approved, documents become tamper-evident and require revision workflows.
                  </p>
                </div>

                {/* 8. User Direct Overrides */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
                      <UserCheck className="w-4 h-4" />
                    </span>
                    <Badge variant="default" size="sm">OVERRIDE</Badge>
                  </div>
                  <h4 className="text-sm font-bold text-white">8. User Direct Scope</h4>
                  <p className="text-xs text-slate-400">
                    Individual grant permissions and custom thresholds overriding inherited role defaults for executive or emergency personnel.
                  </p>
                </div>
              </div>

              {/* Persona ABAC Policy Matrix Summary */}
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Live Persona Scope Profiles (Configured in User Management)
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-white">Sarah Connor (Tenant Admin)</p>
                      <Badge variant="purple" size="sm">Full Scope</Badge>
                    </div>
                    <p className="text-slate-400 text-[11px]">Department: Executive Administration</p>
                    <p className="text-slate-400 text-[11px]">Warehouses: <span className="text-emerald-400 font-mono">All Facilities</span></p>
                    <p className="text-slate-400 text-[11px]">Approval Limit: <span className="text-emerald-400 font-mono">$1,000,000 USD</span></p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-white">Elena Rostova (Purchase Officer)</p>
                      <Badge variant="warning" size="sm">$50k Limit</Badge>
                    </div>
                    <p className="text-slate-400 text-[11px]">Department: Procurement</p>
                    <p className="text-slate-400 text-[11px]">Warehouses: <span className="text-slate-300 font-mono">WH-NORTH, WH-CENTRAL</span></p>
                    <p className="text-slate-400 text-[11px]">Approval Limit: <span className="text-amber-400 font-mono">$50,000 USD</span></p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-white">Marcus Vance (Store Clerk)</p>
                      <Badge variant="info" size="sm">Warehouse Scope</Badge>
                    </div>
                    <p className="text-slate-400 text-[11px]">Department: Warehousing & Logistics</p>
                    <p className="text-slate-400 text-[11px]">Warehouses: <span className="text-blue-400 font-mono">WH-NORTH, WH-CENTRAL</span></p>
                    <p className="text-slate-400 text-[11px]">Approval Limit: <span className="text-slate-400 font-mono">$0 USD (Operational Only)</span></p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Author / Edit Custom Role Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRoleId ? 'Modify Custom Role' : 'Author Custom Role'}
        description="Craft or adjust a tailored role matching your organization's exact operational requirements"
        maxWidth="3xl"
      >
        <FeatureGate
          feature="customRoles"
          fallback={
            <div className="p-6 text-center">
              <Lock className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">Custom Roles Locked</h3>
              <p className="text-xs text-slate-400 mt-2 mb-4">
                Your current subscription tier does not include custom role authoring. Upgrade to Starter or Growth to enable custom roles.
              </p>
              <Button variant="primary" size="sm" onClick={() => (window.location.href = '/subscription')}>
                Upgrade Plan
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSubmitRole} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Role Name"
                required
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="e.g. Lead Material Expeditor"
              />

              <Input
                label="Role Description"
                value={roleDesc}
                onChange={(e) => setRoleDesc(e.target.value)}
                placeholder="Brief summary of duties and responsibilities"
              />
            </div>

            {/* Permission Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Select Role Permissions ({rolePerms.length} Selected)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRolePerms(catalog.map((p) => p.code))}
                    className="text-[11px] text-emerald-400 hover:underline font-semibold"
                  >
                    Select All ({catalog.length})
                  </button>
                  <span className="text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={() => setRolePerms([])}
                    className="text-[11px] text-slate-400 hover:text-white font-semibold"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Live Search inside Modal */}
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter permissions by keyword (e.g. create, approve, export, po, grn)..."
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="max-h-80 overflow-y-auto space-y-4 p-2 rounded-lg bg-slate-950 border border-slate-800">
                {categories.map((cat) => {
                  const catPerms = catalog.filter((p) => {
                    const matchCategory = p.category === cat;
                    if (!permSearch.trim()) return matchCategory;
                    const term = permSearch.toLowerCase();
                    return matchCategory && (p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term));
                  });

                  if (catPerms.length === 0) return null;

                  const allCatSelected = catPerms.every((p) => rolePerms.includes(p.code));

                  return (
                    <div key={cat} className="space-y-1.5">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
                        <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                          {cat}
                        </p>
                        <button
                          type="button"
                          onClick={() => toggleAllInModule(catPerms.map((p) => p.code))}
                          className="text-[10px] text-emerald-400 hover:underline font-mono"
                        >
                          {allCatSelected ? 'Deselect Module' : 'Select All in Module'}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {catPerms.map((p) => {
                          const checked = rolePerms.includes(p.code);
                          return (
                            <button
                              key={p.code}
                              type="button"
                              onClick={() => toggleModalPermission(p.code)}
                              className={`p-2 rounded-lg text-left text-xs border transition-all flex items-start gap-2 ${
                                checked
                                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-200'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              <div
                                className={`w-3.5 h-3.5 rounded border mt-0.5 flex items-center justify-center shrink-0 ${
                                  checked
                                    ? 'bg-emerald-600 border-emerald-600 text-white'
                                    : 'border-slate-600'
                                }`}
                              >
                                {checked && <Check className="w-2.5 h-2.5" />}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-white truncate text-[11px]">{p.name}</p>
                                <p className="text-[9px] text-slate-500 font-mono truncate">{p.code}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isSubmitting}>
                {editingRoleId ? 'Update Custom Role' : 'Save Custom Role'}
              </Button>
            </div>
          </form>
        </FeatureGate>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Role Deletion"
        description="Are you sure you want to permanently delete this custom role?"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-200">
              Deleting <strong className="text-white">{roleToDelete?.name}</strong> will revoke these permissions from any users currently assigned to this role.
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDeleteRoleConfirm}>
              Permanently Delete Role
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
