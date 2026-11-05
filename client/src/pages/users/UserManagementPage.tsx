import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi } from '../../api/user.api';
import { roleApi } from '../../api/role.api';
import { warehouseApi } from '../../api/warehouse.api';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/common/PageHeader';
import { PermissionGate } from '../../components/common/PermissionGate';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import { CustomSelect, CustomSelectOption } from '../../components/ui/CustomSelect';
import { UserProfile, RoleDefinition } from '../../types';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  ShieldCheck,
  Building,
  CheckCircle2,
  XCircle,
  MapPin,
  DollarSign,
  Edit,
  Sliders,
} from 'lucide-react';

export const UserManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { success, error } = useToast();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [availableWarehouses, setAvailableWarehouses] = useState<{ code: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Invite / Create User Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordAutoSetByRole, setPasswordAutoSetByRole] = useState<string>('');
  const [newPhone, setNewPhone] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [newDepartment, setNewDepartment] = useState('');
  const [newBusinessUnit, setNewBusinessUnit] = useState('');
  const [newStore, setNewStore] = useState('');
  const [newWarehouses, setNewWarehouses] = useState<string[]>([]);
  const [newApprovalLimit, setNewApprovalLimit] = useState<number>(0);
  const [newRestrictOwned, setNewRestrictOwned] = useState<boolean>(false);

  // Edit User Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRoleIds, setEditRoleIds] = useState<string[]>([]);
  const [editDepartment, setEditDepartment] = useState('');
  const [editBusinessUnit, setEditBusinessUnit] = useState('');
  const [editStore, setEditStore] = useState('');
  const [editWarehouses, setEditWarehouses] = useState<string[]>([]);
  const [editApprovalLimit, setEditApprovalLimit] = useState<number>(0);
  const [editRestrictOwned, setEditRestrictOwned] = useState<boolean>(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await userApi.listUsers({
        search: search || undefined,
        roleId: roleFilter || undefined,
      });
      if (res.success && res.data) {
        setUsers(res.data);
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to load team members');
    } finally {
      setIsLoading(false);
    }
  };

  const loadWarehouses = async () => {
    try {
      const data = await warehouseApi.getWarehouses();
      const list = Array.isArray(data) ? data : data?.data;
      if (Array.isArray(list)) {
        setAvailableWarehouses(list.map((w: any) => ({ code: w.code, name: w.name })));
      } else {
        setAvailableWarehouses([]);
      }
    } catch (err) {
      console.error('Failed to load organization warehouses', err);
      setAvailableWarehouses([]);
    }
  };

  useEffect(() => {
    fetchUsers();
    roleApi.listRoles().then((res) => {
      if (res.success && res.data) {
        setRoles(res.data);
      }
    });

    loadWarehouses();
  }, [search, roleFilter]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRoleIds.length === 0) {
      error('Please select at least one role for the user');
      return;
    }

    if (!newPassword || newPassword.trim().length < 8) {
      error('Please enter a password of at least 8 characters, or select a role to auto-fill');
      return;
    }

    setIsSubmitting(true);
    try {
      const showLimit = checkRolesRequireApprovalLimit(selectedRoleIds, roles);
      const res = await userApi.createUser({
        name: newName,
        email: newEmail,
        password: newPassword,
        phone: newPhone || undefined,
        roleIds: selectedRoleIds,
        accessScope: {
          department: newDepartment || undefined,
          businessUnit: newBusinessUnit || undefined,
          store: newStore || undefined,
          warehouses: newWarehouses,
          maxApprovalLimit: showLimit ? (Number(newApprovalLimit) || 0) : 0,
          restrictToOwnedDocuments: newRestrictOwned,
        },
      });

      if (res.success) {
        success(`User ${newName} invited successfully!`);
        setIsModalOpen(false);
        // Reset form
        setNewName('');
        setNewEmail('');
        setNewPassword('');
        setPasswordAutoSetByRole('');
        setSelectedRoleIds([]);
        setNewDepartment('');
        setNewBusinessUnit('');
        setNewStore('');
        setNewWarehouses([]);
        setNewApprovalLimit(0);
        setNewRestrictOwned(false);
        fetchUsers();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditModal = (user: UserProfile) => {
    setEditingUser(user);
    setEditName(user.name || '');
    setEditPhone(user.phone || '');

    // Resolve assigned role IDs
    const assignedIds: string[] = [];
    if (Array.isArray(user.roles)) {
      user.roles.forEach((r: any) => {
        if (typeof r === 'string') {
          const matched = roles.find((rl) => (rl._id || rl.slug) === r || rl.name === r);
          if (matched?._id) assignedIds.push(matched._id);
          else assignedIds.push(r);
        } else if (r && typeof r === 'object') {
          const id = r._id || r.id;
          if (id) {
            assignedIds.push(id);
          } else if (r.slug) {
            const matched = roles.find((rl) => rl.slug === r.slug);
            if (matched?._id) assignedIds.push(matched._id);
            else assignedIds.push(r.slug);
          }
        }
      });
    }
    setEditRoleIds(assignedIds);

    setEditDepartment(user.accessScope?.department || '');
    setEditBusinessUnit(user.accessScope?.businessUnit || '');
    setEditStore(user.accessScope?.store || '');
    setEditWarehouses(user.accessScope?.warehouses || []);
    setEditApprovalLimit(user.accessScope?.maxApprovalLimit || 0);
    setEditRestrictOwned(Boolean(user.accessScope?.restrictToOwnedDocuments));
    setEditPassword('');
    loadWarehouses();
    setIsEditModalOpen(true);
  };

  const toggleEditRoleSelection = (roleId: string) => {
    setEditRoleIds((prev) => {
      const isAlreadySelected = prev.includes(roleId);
      const next = isAlreadySelected ? prev.filter((id) => id !== roleId) : [...prev, roleId];

      if (!isAlreadySelected) {
        const roleObj = roles.find((r) => (r._id || r.slug) === roleId || r.id === roleId);
        if (roleObj) {
          const config = ROLE_DEFAULTS[roleObj.slug];
          if (config) {
            const isDeptEmptyOrDefault =
              !editDepartment ||
              Object.values(ROLE_DEFAULTS).some((d) => d.department.toLowerCase() === editDepartment.toLowerCase());
            if (isDeptEmptyOrDefault) {
              setEditDepartment(config.department);
            }
            if (config.requiresApprovalLimit && editApprovalLimit === 0) {
              setEditApprovalLimit(config.defaultLimit);
            }
          }
        }
      } else {
        const remainingRequire = checkRolesRequireApprovalLimit(next, roles);
        if (!remainingRequire) {
          setEditApprovalLimit(0);
        }
      }

      return next;
    });
  };

  const toggleEditWarehouseSelection = (whCode: string) => {
    setEditWarehouses((prev) =>
      prev.includes(whCode) ? prev.filter((c) => c !== whCode) : [...prev, whCode]
    );
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (editRoleIds.length === 0) {
      error('Please select at least one role for the user');
      return;
    }

    setIsEditSubmitting(true);
    try {
      const showLimit = checkRolesRequireApprovalLimit(editRoleIds, roles);
      const payload: any = {
        name: editName.trim(),
        phone: editPhone.trim() || undefined,
        roleIds: editRoleIds,
        accessScope: {
          department: editDepartment.trim() || undefined,
          businessUnit: editBusinessUnit.trim() || undefined,
          store: editStore.trim() || undefined,
          warehouses: editWarehouses,
          maxApprovalLimit: showLimit ? (Number(editApprovalLimit) || 0) : 0,
          restrictToOwnedDocuments: editRestrictOwned,
        },
      };
      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }
      const res = await userApi.updateUser(editingUser.id, payload);

      if (res.success) {
        success(`User ${editName} updated successfully!`);
        setIsEditModalOpen(false);
        setEditingUser(null);
        fetchUsers();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to update user roles and permissions');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const isSuperAdminUser = (user: UserProfile) => {
    return Boolean(
      user.isSuperAdmin ||
      (Array.isArray(user.roles) &&
        user.roles.some((r: any) => {
          const slug = typeof r === 'string' ? r : r.slug;
          const name = typeof r === 'object' ? r.name : '';
          return slug === 'super-admin' || name?.toLowerCase()?.includes('super admin');
        }))
    );
  };

  const isTenantAdminUser = (user: UserProfile) => {
    return Boolean(
      Array.isArray(user.roles) &&
        user.roles.some((r: any) => {
          const slug = typeof r === 'string' ? r : r.slug;
          const name = typeof r === 'object' ? r.name : '';
          return slug === 'tenant-admin' || name?.toLowerCase()?.includes('tenant admin');
        })
    );
  };

  const ROLE_DEFAULTS: Record<
    string,
    {
      department: string;
      requiresApprovalLimit: boolean;
      defaultLimit: number;
      warehouseHint?: string;
      defaultPassword?: string;
    }
  > = {
    'super-admin': {
      department: 'Platform Governance',
      requiresApprovalLimit: true,
      defaultLimit: 999999999,
      defaultPassword: 'SuperAdmin@123',
    },
    'tenant-admin': {
      department: 'Executive Management',
      requiresApprovalLimit: true,
      defaultLimit: 1000000,
      defaultPassword: 'Admin@12345',
    },
    'operations-manager': {
      department: 'Operations',
      requiresApprovalLimit: true,
      defaultLimit: 100000,
      defaultPassword: 'Operations@123',
    },
    'purchase-officer': {
      department: 'Procurement',
      requiresApprovalLimit: true,
      defaultLimit: 50000,
      defaultPassword: 'Purchase@123',
    },
    'sales-representative': {
      department: 'Commercial Sales',
      requiresApprovalLimit: true,
      defaultLimit: 10000,
      defaultPassword: 'Sales@12345',
    },
    'sales-rep': {
      department: 'Commercial Sales',
      requiresApprovalLimit: true,
      defaultLimit: 10000,
      defaultPassword: 'Sales@12345',
    },
    'production-supervisor': {
      department: 'Manufacturing',
      requiresApprovalLimit: false,
      defaultLimit: 0,
      warehouseHint: 'Assigned Plant / Manufacturing Facilities',
      defaultPassword: 'Production@123',
    },
    'warehouse-clerk': {
      department: 'Warehousing & Logistics',
      requiresApprovalLimit: false,
      defaultLimit: 0,
      warehouseHint: 'Assigned Warehouse Facilities (for receipts, transfers & counts)',
      defaultPassword: 'Warehouse@123',
    },
    'qc-inspector': {
      department: 'Quality Assurance',
      requiresApprovalLimit: false,
      defaultLimit: 0,
      warehouseHint: 'Assigned Inspection Facilities (Receiving Docks & In-Line QC)',
      defaultPassword: 'Quality@123',
    },
    'auditor': {
      department: 'Internal Audit & Governance',
      requiresApprovalLimit: false,
      defaultLimit: 0,
      defaultPassword: 'Auditor@123',
    },
  };

  const getRoleDefaultPassword = (roleObj?: RoleDefinition | null): string => {
    if (!roleObj) return 'User@12345';
    const slug = roleObj.slug?.toLowerCase();
    if (slug && ROLE_DEFAULTS[slug]?.defaultPassword) {
      return ROLE_DEFAULTS[slug].defaultPassword!;
    }
    const clean = (roleObj.name || roleObj.slug || 'User').replace(/[^a-zA-Z0-9]/g, '');
    const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1);
    return `${capitalized}@123`;
  };

  const FINANCIAL_APPROVAL_PERMISSIONS = [
    'purchase:approve',
    'purchase_order.approve',
    'purchase_requisition.approve',
    'sales:approve',
    'sales_order.approve',
    'invoice:issue',
    'tenant:manage',
    '*',
  ];

  const checkRolesRequireApprovalLimit = (roleIds: string[], allRoles: RoleDefinition[]) => {
    if (!roleIds || roleIds.length === 0) return false;

    const matchedRoles = allRoles.filter((r) =>
      roleIds.includes(r._id || '') || roleIds.includes(r.id || '') || roleIds.includes(r.slug)
    );

    return matchedRoles.some((r) => {
      const config = ROLE_DEFAULTS[r.slug];
      if (config !== undefined) {
        return config.requiresApprovalLimit;
      }
      if (r.permissions?.includes('*')) return true;
      return r.permissions?.some((p) => FINANCIAL_APPROVAL_PERMISSIONS.includes(p));
    });
  };

  const getRoleScopeSummary = (roleIds: string[], allRoles: RoleDefinition[]) => {
    if (!roleIds || roleIds.length === 0) return null;

    const matchedRoles = allRoles.filter((r) =>
      roleIds.includes(r._id || '') || roleIds.includes(r.id || '') || roleIds.includes(r.slug)
    );

    const requiresApproval = checkRolesRequireApprovalLimit(roleIds, allRoles);
    const isQCOnly = matchedRoles.length > 0 && matchedRoles.every((r) => r.slug === 'qc-inspector');
    const isWarehouseStaff = matchedRoles.some((r) => ['warehouse-clerk', 'store-keeper'].includes(r.slug));

    let warehouseHint = 'Assigned Warehouse Boundaries (Leave empty for unrestricted/global access)';
    for (const r of matchedRoles) {
      if (ROLE_DEFAULTS[r.slug]?.warehouseHint) {
        warehouseHint = ROLE_DEFAULTS[r.slug].warehouseHint!;
        break;
      }
    }

    return {
      requiresApproval,
      isQCOnly,
      isWarehouseStaff,
      warehouseHint,
      matchedRoles,
    };
  };

  const newScopeSummary = getRoleScopeSummary(selectedRoleIds, roles);
  const showNewApprovalLimit = newScopeSummary?.requiresApproval ?? false;

  const editScopeSummary = getRoleScopeSummary(editRoleIds, roles);
  const showEditApprovalLimit = editScopeSummary?.requiresApproval ?? false;

  const handleToggleStatus = async (user: UserProfile) => {
    const isSuper = isSuperAdminUser(user);
    const isTenant = isTenantAdminUser(user);

    if (user.status === 'ACTIVE' && (isSuper || isTenant)) {
      error(
        isSuper
          ? 'Platform Super Administrator accounts cannot be suspended.'
          : 'Tenant Administrator accounts cannot be suspended.'
      );
      return;
    }

    const nextStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await userApi.toggleStatus(user.id, nextStatus);
      success(`Updated status for ${user.name} to ${nextStatus}`);
      fetchUsers();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to update user status');
    }
  };

  const toggleRoleSelection = (roleId: string) => {
    setSelectedRoleIds((prev) => {
      const isAlreadySelected = prev.includes(roleId);
      const next = isAlreadySelected ? prev.filter((id) => id !== roleId) : [...prev, roleId];

      if (!isAlreadySelected) {
        const roleObj = roles.find((r) => (r._id || r.slug) === roleId || r.id === roleId);
        if (roleObj) {
          const config = ROLE_DEFAULTS[roleObj.slug];
          if (config) {
            const isDeptEmptyOrDefault =
              !newDepartment ||
              Object.values(ROLE_DEFAULTS).some((d) => d.department.toLowerCase() === newDepartment.toLowerCase());
            if (isDeptEmptyOrDefault) {
              setNewDepartment(config.department);
            }
            if (config.requiresApprovalLimit && newApprovalLimit === 0) {
              setNewApprovalLimit(config.defaultLimit);
            }
          }
          // Automatically set password for the selected role
          const rolePwd = getRoleDefaultPassword(roleObj);
          setNewPassword(rolePwd);
          setPasswordAutoSetByRole(roleObj.name);
        }
      } else {
        const remainingRequire = checkRolesRequireApprovalLimit(next, roles);
        if (!remainingRequire) {
          setNewApprovalLimit(0);
        }
        if (next.length === 0) {
          setNewPassword('');
          setPasswordAutoSetByRole('');
        } else {
          const lastRoleId = next[next.length - 1];
          const lastRole = roles.find((r) => (r._id || r.slug) === lastRoleId || r.id === lastRoleId);
          if (lastRole) {
            setNewPassword(getRoleDefaultPassword(lastRole));
            setPasswordAutoSetByRole(lastRole.name);
          }
        }
      }

      return next;
    });
  };

  const toggleWarehouseSelection = (whCode: string) => {
    setNewWarehouses((prev) =>
      prev.includes(whCode) ? prev.filter((c) => c !== whCode) : [...prev, whCode]
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team & Access Scope Management"
        description="Provision users, assign dynamic role matrices, and configure ABAC location boundaries"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Team Members' }]}
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="md"
              leftIcon={<Shield className="w-4 h-4 text-emerald-400" />}
              onClick={() => navigate('/roles')}
            >
              Configure Roles (RBAC)
            </Button>
            <PermissionGate permission="users:create">
              <Button
                variant="primary"
                size="md"
                leftIcon={<UserPlus className="w-4 h-4" />}
                onClick={() => {
                  loadWarehouses();
                  setNewName('');
                  setNewEmail('');
                  setNewPassword('');
                  setPasswordAutoSetByRole('');
                  setSelectedRoleIds([]);
                  setNewDepartment('');
                  setNewBusinessUnit('');
                  setNewStore('');
                  setNewWarehouses([]);
                  setNewApprovalLimit(0);
                  setNewRestrictOwned(false);
                  setIsModalOpen(true);
                }}
              >
                Add Team Member
              </Button>
            </PermissionGate>
          </div>
        }
      />

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 w-full relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by user name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-700 text-xs text-slate-200 rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="w-full sm:w-72">
            <CustomSelect
              value={roleFilter}
              onChange={setRoleFilter}
              options={[
                {
                  value: '',
                  label: 'All Roles',
                  badge: `${roles.length} Roles`,
                  badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                  icon: <Shield className="w-3.5 h-3.5 text-emerald-400" />,
                },
                ...roles.map((r) => ({
                  value: r._id || r.slug,
                  label: r.name,
                  description: r.description,
                  badge: 'RBAC',
                  badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
                  icon: <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />,
                })),
              ]}
              placeholder="Filter by Role..."
              allowClear={true}
            />
          </div>
        </div>
      </Card>

      {/* Team Members Data Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Assigned Roles</th>
                <th className="py-3 px-4">ABAC Scope & Warehouse Bounds</th>
                <th className="py-3 px-4">Approval Threshold</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/80 text-slate-200">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="hover:bg-slate-800/20">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Skeleton variant="circular" className="w-8 h-8 bg-slate-800" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-3.5 w-32 bg-slate-800" />
                          <Skeleton className="h-3 w-44 bg-slate-800/60" />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4"><Skeleton className="h-5 w-24 rounded bg-slate-800" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-5 w-28 rounded bg-slate-800" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-20 bg-slate-800" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-5 w-16 rounded-full bg-slate-800" /></td>
                    <td className="py-3 px-4 text-right"><Skeleton className="h-8 w-16 rounded ml-auto bg-slate-800" /></td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No team members found matching your search.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isSuperAdmin = isSuperAdminUser(u);
                  const isTenantAdmin = isTenantAdminUser(u);
                  const isProtectedAdmin = isSuperAdmin || isTenantAdmin;
                  const isSuspendDisabled = u.status === 'ACTIVE' && isProtectedAdmin;

                  return (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center text-xs shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-white">{u.name}</p>
                            <p className="text-[11px] text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {(u.roles || []).map((r: any, rIdx: number) => {
                            const roleName = typeof r === 'string' ? r : r.name || r.slug;
                            const roleKey = typeof r === 'string' ? r : r.slug || r.id || rIdx;
                            return (
                              <span
                                key={roleKey}
                                className="inline-flex items-center gap-1 text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/20"
                              >
                                <Shield className="w-2.5 h-2.5 text-emerald-400" />
                                {roleName}
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div>
                          {u.accessScope?.warehouses && u.accessScope.warehouses.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {u.accessScope.warehouses.map((wh) => (
                                <span
                                  key={wh}
                                  className="text-[10px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.5 rounded flex items-center gap-1"
                                >
                                  <MapPin className="w-2.5 h-2.5" />
                                  {wh}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">All Locations (Global)</span>
                          )}
                          {u.accessScope?.department && (
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Dept: {u.accessScope.department}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {u.accessScope?.maxApprovalLimit ? (
                          <span className="text-xs font-mono font-bold text-emerald-400">
                            ${u.accessScope.maxApprovalLimit.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500 font-mono">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <Badge
                          variant={u.status === 'ACTIVE' ? 'success' : 'danger'}
                          size="sm"
                        >
                          {u.status}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <PermissionGate permission="users:update">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEditModal(u)}
                              className="text-slate-300 hover:text-white hover:bg-slate-800"
                              title="Edit Role & ABAC Scope"
                            >
                              <Edit className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                              Edit
                            </Button>
                          </PermissionGate>

                          <PermissionGate permission="users:update">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isSuspendDisabled}
                              onClick={() => handleToggleStatus(u)}
                              title={
                                isSuspendDisabled
                                  ? isSuperAdmin
                                    ? 'Platform Super Administrator accounts cannot be suspended'
                                    : 'Tenant Administrator accounts cannot be suspended'
                                  : u.status === 'ACTIVE'
                                  ? 'Suspend user'
                                  : 'Activate user'
                              }
                              className={
                                isSuspendDisabled
                                  ? 'text-slate-500 cursor-not-allowed hover:bg-transparent hover:text-slate-500 opacity-50'
                                  : u.status === 'ACTIVE'
                                  ? 'text-rose-400 hover:text-rose-300 hover:bg-rose-950/20'
                                  : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/20'
                              }
                            >
                              {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                            </Button>
                          </PermissionGate>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Provision Team Member & Set Scope"
        description="Assign RBAC role permissions and ABAC location/spending boundaries"
        maxWidth="xl"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Elena Vance"
            />

            <Input
              label="Work Email"
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="elena@organization.com"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                label="Initial Password"
                type="text"
                required
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPasswordAutoSetByRole('');
                }}
                placeholder={
                  selectedRoleIds.length === 0
                    ? 'Select a role below to auto-assign password'
                    : 'Enter password (min 8 chars)'
                }
                helperText={
                  passwordAutoSetByRole
                    ? `Default login password for role: ${passwordAutoSetByRole}`
                    : 'Tip: Automatically adapts to the selected role or enter a custom one.'
                }
              />
              {passwordAutoSetByRole && (
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Preset for <strong>{passwordAutoSetByRole}</strong>:{' '}
                    <code className="font-mono bg-slate-900 px-1.5 py-0.5 rounded text-emerald-300 border border-slate-700">
                      {newPassword}
                    </code>
                  </span>
                </div>
              )}
            </div>

            <Input
              label="Phone Number"
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="+1 555-0182"
            />
          </div>

          {/* Role Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Assign Functional & Custom Roles (RBAC)
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  navigate('/roles');
                }}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 underline font-medium"
              >
                + Create New Custom Role
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto p-2 bg-slate-950/80 rounded-xl border border-slate-800 shadow-inner">
              {roles.map((r) => {
                const isSelected = selectedRoleIds.includes(r._id || r.slug);
                const rolePwd = getRoleDefaultPassword(r);
                return (
                  <button
                    key={r._id || r.slug}
                    type="button"
                    onClick={() => toggleRoleSelection(r._id || r.slug)}
                    className={`p-3 rounded-xl text-left text-xs border transition-all flex items-start gap-2.5 ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-200 shadow-sm shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                        : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-md border mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-600 bg-slate-950'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-semibold leading-tight truncate text-slate-100">{r.name}</p>
                        {r.isSystemRole ? (
                          <span className="text-[9px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 shrink-0">
                            System
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30 shrink-0">
                            Custom
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{r.description || 'No description'}</p>
                      <div className="flex items-center justify-between mt-1.5 text-[9px]">
                        <span className="text-emerald-400/90 font-mono">
                          {r.permissions.includes('*') ? 'Full Access (*)' : `${r.permissions.length} verbs`}
                        </span>
                        <span className="font-mono text-slate-400 bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800">
                          Default: <strong className="text-emerald-300">{rolePwd}</strong>
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ABAC Scopes */}
          <div className="pt-3 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                ABAC Operational Scopes
              </p>
              {selectedRoleIds.length > 0 && (
                <span className="text-[10px] text-slate-400 font-mono">
                  {showNewApprovalLimit ? 'Financial Scope: Required' : 'Financial Scope: N/A'}
                </span>
              )}
            </div>

            {/* Dynamic Role Profile Banners */}
            {selectedRoleIds.length > 0 && (
              <>
                {newScopeSummary?.isQCOnly && (
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold text-emerald-200">Role Scope: Quality Control & Inspection</span>
                      <p className="text-[11px] text-emerald-300/80 mt-0.5">
                        Authorized for inbound GRN inspections, parameter testing, checklists, and defect dispositions. Quality Inspectors do not require financial PO approval limits.
                      </p>
                    </div>
                  </div>
                )}

                {showNewApprovalLimit && (
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
                    <DollarSign className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold text-blue-200">Financial Authorization Scope Active</span>
                      <p className="text-[11px] text-blue-300/80 mt-0.5">
                        Selected role(s) have document approval capabilities. Set the maximum dollar limit this team member can authorize for Purchase Orders and Sales Orders.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Department"
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                placeholder="e.g. Quality Assurance / Procurement"
              />

              {showNewApprovalLimit ? (
                <Input
                  label="Max Financial Approval Limit ($ USD)"
                  type="number"
                  min="0"
                  value={newApprovalLimit}
                  onChange={(e) => setNewApprovalLimit(Number(e.target.value))}
                  placeholder="50000"
                  helperText="Maximum financial authorization limit for PO & SO sign-offs"
                />
              ) : (
                <Input
                  label="Business Unit (Optional)"
                  value={newBusinessUnit}
                  onChange={(e) => setNewBusinessUnit(e.target.value)}
                  placeholder="e.g. North America Division"
                />
              )}
            </div>

            {showNewApprovalLimit ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Business Unit (Optional)"
                  value={newBusinessUnit}
                  onChange={(e) => setNewBusinessUnit(e.target.value)}
                  placeholder="e.g. North America Division"
                />

                <Input
                  label="Store / Dispensary (Optional)"
                  value={newStore}
                  onChange={(e) => setNewStore(e.target.value)}
                  placeholder="e.g. Store-01 Retail Depot"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Store / Dispensary (Optional)"
                  value={newStore}
                  onChange={(e) => setNewStore(e.target.value)}
                  placeholder="e.g. Store-01 Retail Depot"
                />
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="restrictOwned"
                checked={newRestrictOwned}
                onChange={(e) => setNewRestrictOwned(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="restrictOwned" className="text-xs text-slate-300 cursor-pointer">
                Restrict document modification to items created by this user (ABAC Document Ownership)
              </label>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  {newScopeSummary?.warehouseHint || 'Assigned Warehouse Boundaries (Leave empty for unrestricted)'}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    navigate('/inventory/warehouses');
                  }}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 underline font-medium"
                >
                  + Manage Warehouses
                </button>
              </div>

              {availableWarehouses.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {availableWarehouses.map((wh) => {
                    const isChecked = newWarehouses.includes(wh.code);
                    return (
                      <button
                        key={wh.code}
                        type="button"
                        onClick={() => toggleWarehouseSelection(wh.code)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-all flex items-center gap-1.5 ${
                          isChecked
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                        title={wh.name}
                      >
                        <MapPin className="w-3 h-3" />
                        {wh.code}
                        <span className="text-[10px] text-slate-400 font-sans">({wh.name})</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-dashed border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>No warehouses found in your organization. Only warehouses you add in Warehouse Management will appear here.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      navigate('/inventory/warehouses');
                    }}
                    className="px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-md border border-emerald-500/30 transition-colors shrink-0"
                  >
                    + Add Warehouse
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Create User & Apply Policies
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit User & Permissions Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Team Member: ${editingUser?.name || 'User'}`}
        description="Update functional roles, custom roles, and attribute-based security parameters"
        maxWidth="xl"
      >
        <form onSubmit={handleUpdateUser} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Full name"
            />

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Work Email
              </label>
              <input
                type="email"
                disabled
                value={editingUser?.email || ''}
                className="w-full bg-slate-950/40 border border-slate-800 text-slate-400 rounded-lg px-3 py-2 text-xs cursor-not-allowed"
              />
              <p className="text-[10px] text-slate-500 mt-1">Email is locked to primary tenant identity.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Phone Number"
              type="tel"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              placeholder="+1 555-0182"
            />

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Account Status
              </label>
              <div className="pt-2">
                <Badge variant={editingUser?.status === 'ACTIVE' ? 'success' : 'danger'} size="md">
                  {editingUser?.status || 'ACTIVE'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Change / Reset Password */}
          <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-200">
                Change / Reset Password
              </label>
              <span className="text-[10px] text-slate-400">Leave blank to keep current password</span>
            </div>
            <Input
              label=""
              type="text"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              placeholder="Enter new password (e.g. Admin@12345)"
              helperText="Tip: Type a new password here to immediately reset this member's login credentials."
            />
          </div>

          {/* Role Selection (System & Custom Roles) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Assign Functional & Custom Roles (RBAC)
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  navigate('/roles');
                }}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 underline font-medium"
              >
                + Create New Custom Role
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto p-2 bg-slate-950/80 rounded-xl border border-slate-800 shadow-inner">
              {roles.map((r) => {
                const isSelected = editRoleIds.includes(r._id || r.slug);
                const rolePwd = getRoleDefaultPassword(r);
                return (
                  <button
                    key={r._id || r.slug}
                    type="button"
                    onClick={() => toggleEditRoleSelection(r._id || r.slug)}
                    className={`p-3 rounded-xl text-left text-xs border transition-all flex items-start gap-2.5 ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-200 shadow-sm shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                        : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-md border mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-600 bg-slate-950'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-semibold leading-tight truncate text-slate-100">{r.name}</p>
                        {r.isSystemRole ? (
                          <span className="text-[9px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 shrink-0">
                            System
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30 shrink-0">
                            Custom
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{r.description || 'No description'}</p>
                      <div className="flex items-center justify-between mt-1.5 text-[9px]">
                        <span className="text-emerald-400/90 font-mono">
                          {r.permissions.includes('*') ? 'Full Access (*)' : `${r.permissions.length} verbs`}
                        </span>
                        <span className="font-mono text-slate-400 bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800">
                          Default: <strong className="text-emerald-300">{rolePwd}</strong>
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ABAC Scopes */}
          <div className="pt-3 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                ABAC Operational Scopes
              </p>
              {editRoleIds.length > 0 && (
                <span className="text-[10px] text-slate-400 font-mono">
                  {showEditApprovalLimit ? 'Financial Scope: Required' : 'Financial Scope: N/A'}
                </span>
              )}
            </div>

            {/* Dynamic Role Profile Banners */}
            {editRoleIds.length > 0 && (
              <>
                {editScopeSummary?.isQCOnly && (
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold text-emerald-200">Role Scope: Quality Control & Inspection</span>
                      <p className="text-[11px] text-emerald-300/80 mt-0.5">
                        Authorized for inbound GRN inspections, parameter testing, checklists, and defect dispositions. Quality Inspectors do not require financial PO approval limits.
                      </p>
                    </div>
                  </div>
                )}

                {showEditApprovalLimit && (
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
                    <DollarSign className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold text-blue-200">Financial Authorization Scope Active</span>
                      <p className="text-[11px] text-blue-300/80 mt-0.5">
                        Selected role(s) have document approval capabilities. Set the maximum dollar limit this team member can authorize for Purchase Orders and Sales Orders.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Department"
                value={editDepartment}
                onChange={(e) => setEditDepartment(e.target.value)}
                placeholder="e.g. Quality Assurance / Procurement"
              />

              {showEditApprovalLimit ? (
                <Input
                  label="Max Financial Approval Limit ($ USD)"
                  type="number"
                  min="0"
                  value={editApprovalLimit}
                  onChange={(e) => setEditApprovalLimit(Number(e.target.value))}
                  placeholder="50000"
                  helperText="Limit for financial PO & Sales Order sign-offs"
                />
              ) : (
                <Input
                  label="Business Unit (Optional)"
                  value={editBusinessUnit}
                  onChange={(e) => setEditBusinessUnit(e.target.value)}
                  placeholder="e.g. North America Division"
                />
              )}
            </div>

            {showEditApprovalLimit ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Business Unit (Optional)"
                  value={editBusinessUnit}
                  onChange={(e) => setEditBusinessUnit(e.target.value)}
                  placeholder="e.g. North America Division"
                />

                <Input
                  label="Store / Dispensary (Optional)"
                  value={editStore}
                  onChange={(e) => setEditStore(e.target.value)}
                  placeholder="e.g. Retail Depot 01"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Store / Dispensary (Optional)"
                  value={editStore}
                  onChange={(e) => setEditStore(e.target.value)}
                  placeholder="e.g. Retail Depot 01"
                />
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="editRestrictOwned"
                checked={editRestrictOwned}
                onChange={(e) => setEditRestrictOwned(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="editRestrictOwned" className="text-xs text-slate-300 cursor-pointer">
                Restrict document modification to items created by this user (ABAC Document Ownership)
              </label>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  {editScopeSummary?.warehouseHint || 'Assigned Warehouse Boundaries (Leave empty for unrestricted/global)'}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    navigate('/inventory/warehouses');
                  }}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 underline font-medium"
                >
                  + Manage Warehouses
                </button>
              </div>

              {availableWarehouses.length > 0 || editWarehouses.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {[
                    ...availableWarehouses,
                    ...editWarehouses
                      .filter((c) => !availableWarehouses.some((w) => w.code === c))
                      .map((c) => ({ code: c, name: 'Assigned Facility' })),
                  ].map((wh) => {
                    const isChecked = editWarehouses.includes(wh.code);
                    return (
                      <button
                        key={wh.code}
                        type="button"
                        onClick={() => toggleEditWarehouseSelection(wh.code)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-all flex items-center gap-1.5 ${
                          isChecked
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                        title={wh.name}
                      >
                        <MapPin className="w-3 h-3" />
                        {wh.code}
                        <span className="text-[10px] text-slate-400 font-sans">({wh.name})</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-dashed border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>No warehouses found in your organization. Only warehouses you add in Warehouse Management will appear here.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditModalOpen(false);
                      navigate('/inventory/warehouses');
                    }}
                    className="px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-md border border-emerald-500/30 transition-colors shrink-0"
                  >
                    + Add Warehouse
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isEditSubmitting}>
              Save Roles & Scope Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
