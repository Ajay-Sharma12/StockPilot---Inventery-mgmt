import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api/auth.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PasswordInput } from '../../components/ui/PasswordInput';
import {
  Layers,
  ArrowRight,
  AlertCircle,
  Building2,
  Mail,
  CheckCircle2,
  Shield,
  Briefcase,
  ShoppingBag,
  Truck,
  Users,
  Factory,
  RefreshCw,
  Sparkles,
  Search,
  Check,
  UserCheck,
} from 'lucide-react';

export interface AssignedRoleCard {
  userId?: string;
  roleSlug: string;
  roleName: string;
  description?: string;
  isSystemRole?: boolean;
  assignedUser?: {
    id?: string;
    name: string;
    email: string;
    tenantSlug?: string;
    tenantName?: string;
    department?: string;
  };
  defaultPassword?: string;
}

// Fallback roles based strictly on manually added users
const DEFAULT_FALLBACK_ROLES: AssignedRoleCard[] = [
  {
    roleSlug: 'super-admin',
    roleName: 'Platform Super Administrator',
    description: 'Global system governance & platform management',
    isSystemRole: true,
    assignedUser: {
      name: 'Ankit Yadav',
      email: 'ajaysuman5160@gmail.com',
      tenantSlug: 'shoes',
      tenantName: 'nike (shoes)',
      department: 'Platform Governance',
    },
    defaultPassword: 'Password123!',
  },
  {
    roleSlug: 'tenant-admin',
    roleName: 'Tenant Administrator',
    description: 'Full organizational authority & user management',
    isSystemRole: true,
    assignedUser: {
      name: 'Ajay sharma',
      email: 'ajaykumarsharma.it27@gmail.com',
      tenantSlug: 'shoes',
      tenantName: 'nike (shoes)',
      department: 'Executive Management',
    },
    defaultPassword: 'Password123!',
  },
  {
    roleSlug: 'purchase-officer',
    roleName: 'Purchase Officer',
    description: 'Procurement execution, RFQs, POs & GRNs',
    isSystemRole: true,
    assignedUser: {
      name: 'Suraj Choudhry',
      email: 'ajaykumarsharma.it25@gmail.com',
      tenantSlug: 'shoes',
      tenantName: 'nike (shoes)',
      department: 'Procurement',
    },
    defaultPassword: 'Password123!',
  },
  {
    roleSlug: 'qc-inspector',
    roleName: 'QC Inspector',
    description: 'Material inspection checklists & QA sign-offs',
    isSystemRole: true,
    assignedUser: {
      name: 'Ankit Yadav',
      email: 'ajaysuman51601@gmail.com',
      tenantSlug: 'shoes',
      tenantName: 'nike (shoes)',
      department: 'Quality Assurance',
    },
    defaultPassword: 'Password123!',
  },
  {
    roleSlug: 'tenant-admin',
    roleName: 'Tenant Administrator',
    description: 'Full organizational authority & user management',
    isSystemRole: true,
    assignedUser: {
      name: 'Arjun Sharma',
      email: 'ajaysuman5160@gmail.com',
      tenantSlug: 'arjun-steels',
      tenantName: 'Arjun Steels',
      department: 'Executive Management',
    },
    defaultPassword: 'Password123!',
  },
  {
    roleSlug: 'tenant-admin',
    roleName: 'Tenant Administrator',
    description: 'Full organizational authority & user management',
    isSystemRole: true,
    assignedUser: {
      name: 'Suamn Sharma',
      email: 'ajaysuman51603@gmail.com',
      tenantSlug: 'suman-steels',
      tenantName: 'Suman Steels',
      department: 'Executive Management',
    },
    defaultPassword: 'Password123!',
  },
  {
    roleSlug: 'auditor',
    roleName: 'Compliance Auditor',
    description: 'Audit trail analysis & compliance reporting',
    isSystemRole: true,
    assignedUser: {
      name: 'Ajay',
      email: 'ajaykumarsharam.it26@gmail.com',
      tenantSlug: 'suman-steels',
      tenantName: 'Suman Steels',
      department: 'Internal Audit & Governance',
    },
    defaultPassword: 'Password123!',
  },
  {
    roleSlug: 'tenant-admin',
    roleName: 'Tenant Administrator',
    description: 'Full organizational authority & user management',
    isSystemRole: true,
    assignedUser: {
      name: 'Aman Verma',
      email: 'amanverma.t@gmail.com',
      tenantSlug: 'aman-steels',
      tenantName: 'Aman Steels',
      department: 'Executive Management',
    },
    defaultPassword: 'Password123!',
  },
  {
    roleSlug: 'auditor',
    roleName: 'Compliance Auditor',
    description: 'Audit trail analysis & compliance reporting',
    isSystemRole: true,
    assignedUser: {
      name: 'Aman Verma',
      email: 'amanverma23@gmail.com',
      tenantSlug: 'aman-steels',
      tenantName: 'Aman Steels',
      department: 'Internal Audit & Governance',
    },
    defaultPassword: 'Password123!',
  },
  {
    roleSlug: 'tenant-admin',
    roleName: 'Tenant Administrator',
    description: 'Full organizational authority & user management',
    isSystemRole: true,
    assignedUser: {
      name: 'Admin',
      email: 'admin@skechers.com',
      tenantSlug: 'skechers',
      tenantName: 'Skechers',
      department: 'Executive Management',
    },
    defaultPassword: 'Password123!',
  },
  {
    roleSlug: 'qc-inspector',
    roleName: 'QC Inspector',
    description: 'Material inspection checklists & QA sign-offs',
    isSystemRole: true,
    assignedUser: {
      name: 'Vayne',
      email: 'vayne@skechers.com',
      tenantSlug: 'skechers',
      tenantName: 'Skechers',
      department: 'Quality Assurance',
    },
    defaultPassword: 'Password123!',
  },
];

const getRoleIcon = (slug: string) => {
  switch (slug) {
    case 'super-admin':
      return <Shield className="w-4 h-4 text-purple-400" />;
    case 'tenant-admin':
      return <Shield className="w-4 h-4 text-emerald-400" />;
    case 'operations-manager':
      return <Briefcase className="w-4 h-4 text-blue-400" />;
    case 'purchase-officer':
      return <ShoppingBag className="w-4 h-4 text-amber-400" />;
    case 'warehouse-clerk':
      return <Truck className="w-4 h-4 text-cyan-400" />;
    case 'sales-representative':
      return <Users className="w-4 h-4 text-rose-400" />;
    case 'production-supervisor':
      return <Factory className="w-4 h-4 text-orange-400" />;
    case 'qc-inspector':
      return <CheckCircle2 className="w-4 h-4 text-teal-400" />;
    case 'auditor':
      return <UserCheck className="w-4 h-4 text-slate-300" />;
    default:
      return <Sparkles className="w-4 h-4 text-indigo-400" />;
  }
};

const getRoleBadgeStyle = (slug: string) => {
  switch (slug) {
    case 'super-admin':
      return 'bg-purple-500/10 text-purple-300 border-purple-500/30';
    case 'tenant-admin':
      return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
    case 'operations-manager':
      return 'bg-blue-500/10 text-blue-300 border-blue-500/30';
    case 'purchase-officer':
      return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
    case 'warehouse-clerk':
      return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30';
    case 'sales-representative':
      return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
    case 'production-supervisor':
      return 'bg-orange-500/10 text-orange-300 border-orange-500/30';
    case 'qc-inspector':
      return 'bg-teal-500/10 text-teal-300 border-teal-500/30';
    case 'auditor':
      return 'bg-slate-700/40 text-slate-300 border-slate-600/40';
    default:
      return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30';
  }
};

export const Login: React.FC = () => {
  const { login, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [lastTenantName, setLastTenantName] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Field-level inline errors
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [tenantError, setTenantError] = useState('');
  const [formError, setFormError] = useState('');
  const [successBanner, setSuccessBanner] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic roles management
  const [roles, setRoles] = useState<AssignedRoleCard[]>(DEFAULT_FALLBACK_ROLES);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [roleSearch, setRoleSearch] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('all');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedRoleNotification, setSelectedRoleNotification] = useState<string | null>(null);

  const fetchAssignedRoles = useCallback(async () => {
    setIsLoadingRoles(true);
    try {
      const res = await authApi.getAssignedRoles();
      const serverRoles = res.data || res;
      if (Array.isArray(serverRoles) && serverRoles.length > 0) {
        setRoles(serverRoles);
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsLoadingRoles(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignedRoles();
  }, [fetchAssignedRoles]);

  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
    if ((location.state as any)?.message) {
      setSuccessBanner((location.state as any).message);
    }
  }, [isAuthenticated, navigate, location]);

  const handleSelectRole = (card: AssignedRoleCard, uniqueKey: string) => {
    const userEmail = card.assignedUser?.email || '';
    const userPassword = card.defaultPassword || 'Password123!';
    const userSlug = card.assignedUser?.tenantSlug || '';
    const userTenantName = card.assignedUser?.tenantName || '';

    setEmail(userEmail);
    setPassword(userPassword);
    setTenantSlug(userSlug);
    setLastTenantName(userTenantName);
    setSelectedCardId(uniqueKey);

    // Clear previous errors
    setEmailError('');
    setPasswordError('');
    setTenantError('');
    setFormError('');

    setSelectedRoleNotification(
      `Selected ${card.roleName}: ${card.assignedUser?.name} (${userEmail})`
    );
  };

  const validateForm = (): boolean => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');
    setTenantError('');
    setFormError('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setEmailError('Email address is required.');
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setEmailError('Please enter a valid email address.');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Password is required.');
      isValid = false;
    }

    return isValid;
  };

  const mapBackendError = (err: any): string => {
    const status = err.response?.status;
    const msg = (err.response?.data?.message || '').toLowerCase();

    if (!err.response) {
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    }
    if (status === 401) {
      return 'Invalid email or password.';
    }
    if (status === 403) {
      if (msg.includes('suspended')) {
        return 'Your account has been temporarily blocked. Please contact your administrator.';
      }
      if (msg.includes('inactive')) {
        return 'Your account is inactive. Please contact your administrator.';
      }
      return 'Access denied. You do not have permission to access the application.';
    }
    if (status === 400 && msg.includes('organization')) {
      setTenantError('Organization not found.');
      return 'Organization not found.';
    }
    if (status === 429) {
      return 'Too many login attempts. Please wait a few minutes before trying again.';
    }
    return 'Something went wrong. Please try again.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isLoading) return;

    if (!validateForm()) return;

    setIsSubmitting(true);
    setFormError('');

    try {
      await login({
        email: email.trim().toLowerCase(),
        password,
        tenantSlug: tenantSlug.trim().toLowerCase() || undefined,
        rememberMe,
      });
      navigate('/dashboard');
    } catch (err: any) {
      const friendlyError = mapBackendError(err);
      setFormError(friendlyError);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Distinct workspaces for filtering
  const distinctWorkspaces = useMemo(() => {
    const map = new Map<string, string>();
    roles.forEach((r) => {
      const slug = r.assignedUser?.tenantSlug;
      const name = r.assignedUser?.tenantName;
      if (slug && name) {
        map.set(slug, name);
      }
    });
    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
  }, [roles]);

  const filteredRoles = useMemo(() => {
    return roles.filter((r) => {
      // Workspace filter
      if (selectedWorkspace !== 'all') {
        const slug = r.assignedUser?.tenantSlug || '';
        if (slug !== selectedWorkspace) return false;
      }

      // Search query
      const query = roleSearch.toLowerCase();
      if (!query) return true;

      const roleMatch = r.roleName.toLowerCase().includes(query) || r.roleSlug.toLowerCase().includes(query);
      const userMatch =
        (r.assignedUser?.name || '').toLowerCase().includes(query) ||
        (r.assignedUser?.email || '').toLowerCase().includes(query) ||
        (r.assignedUser?.tenantSlug || '').toLowerCase().includes(query) ||
        (r.assignedUser?.tenantName || '').toLowerCase().includes(query);

      return roleMatch || userMatch;
    });
  }, [roles, selectedWorkspace, roleSearch]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10 mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-xl shadow-emerald-950/50 mb-3">
          <Layers className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-white">
          STOCKPILOT
        </h2>
        <p className="mt-1 text-xs text-emerald-400 font-mono font-medium tracking-wide uppercase">
          Multi-Tenant Inventory & Operations Platform
        </p>
      </div>

      {/* Main Container: Split Grid for Roles & Login Form */}
      <div className="w-full max-w-6xl mx-auto z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: Role Switcher / Quick Login Cards */}
          <div className="lg:col-span-7 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl p-5 sm:p-6 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <h3 className="text-base font-semibold text-white">
                    Assigned Roles & Accounts
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Click any role to auto-fill its email &amp; credentials
                </p>
              </div>

              <button
                type="button"
                onClick={fetchAssignedRoles}
                disabled={isLoadingRoles}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition-colors px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 self-start sm:self-auto"
                title="Refresh roles from database"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRoles ? 'animate-spin text-emerald-400' : ''}`} />
                <span>{isLoadingRoles ? 'Updating...' : 'Refresh Roles'}</span>
              </button>
            </div>

            {/* Workspace Filter Pills */}
            {distinctWorkspaces.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setSelectedWorkspace('all')}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border whitespace-nowrap transition-colors ${
                    selectedWorkspace === 'all'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-medium'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  All ({roles.length})
                </button>
                {distinctWorkspaces.map((ws) => (
                  <button
                    key={ws.slug}
                    type="button"
                    onClick={() => setSelectedWorkspace(ws.slug)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border whitespace-nowrap transition-colors ${
                      selectedWorkspace === ws.slug
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-medium'
                        : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {ws.name}
                  </button>
                ))}
              </div>
            )}

            {/* Quick search input */}
            <div className="relative mb-4">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
                placeholder="Search by role, user name, or email..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-slate-950/70 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Role Cards List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[460px] overflow-y-auto pr-1 focus:outline-none">
              {filteredRoles.map((card, idx) => {
                const uniqueKey = `${card.roleSlug}-${card.assignedUser?.email}-${card.assignedUser?.tenantSlug || idx}`;
                const isSelected = selectedCardId === uniqueKey;
                const assigned = card.assignedUser;

                return (
                  <button
                    key={uniqueKey}
                    type="button"
                    onClick={() => handleSelectRole(card, uniqueKey)}
                    className={`text-left p-3 rounded-xl border transition-all duration-150 flex flex-col justify-between group relative ${
                      isSelected
                        ? 'bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-950/30 ring-1 ring-emerald-500/40'
                        : 'bg-slate-950/50 hover:bg-slate-800/70 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    {/* Top Row: Role Name & Badge */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 group-hover:scale-105 transition-transform shrink-0">
                          {getRoleIcon(card.roleSlug)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white group-hover:text-emerald-300 transition-colors truncate">
                            {card.roleName}
                          </div>
                          {card.description && (
                            <div className="text-[10px] text-slate-500 truncate">
                              {card.description}
                            </div>
                          )}
                        </div>
                      </div>

                      {isSelected ? (
                        <span className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
                          <Check className="w-3 h-3" />
                        </span>
                      ) : (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-md border font-mono font-medium shrink-0 ${getRoleBadgeStyle(
                            card.roleSlug
                          )}`}
                        >
                          {card.isSystemRole ? 'SYSTEM' : 'TENANT'}
                        </span>
                      )}
                    </div>

                    {/* Bottom Row: Assigned User Name & Email */}
                    <div className="pt-2 border-t border-slate-800/60 mt-1">
                      <div className="flex items-center justify-between text-[11px] gap-1">
                        <span className="text-slate-200 font-medium truncate">
                          {assigned?.name || 'Assigned User'}
                        </span>
                        {assigned?.tenantSlug && (
                          <span className="text-[10px] text-emerald-400 font-mono truncate">
                            @{assigned.tenantSlug}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                        {assigned?.email || 'No email assigned'}
                      </div>
                    </div>
                  </button>
                );
              })}

              {filteredRoles.length === 0 && (
                <div className="col-span-full py-8 text-center text-xs text-slate-500">
                  No roles found matching "{roleSearch}".
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>💡 When you assign a new user or role in the system, it automatically updates here.</span>
            </div>
          </div>

          {/* RIGHT COLUMN: Sign In Form */}
          <div className="lg:col-span-5 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl p-6 sm:p-8">
            <h3 className="text-lg font-bold text-white mb-1">
              Sign In to StockPilot
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Enter credentials or select a role from the left panel.
            </p>

            {/* Selection Notification Banner */}
            {selectedRoleNotification && (
              <div className="mb-4 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span className="truncate">{selectedRoleNotification}</span>
              </div>
            )}

            {/* Success Banner */}
            {successBanner && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successBanner}</span>
              </div>
            )}

            {/* Form-Level Error Alert */}
            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <Input
                  label="Email Address"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError('');
                  }}
                  error={emailError}
                  placeholder="user@organization.com"
                  leftIcon={<Mail className="w-4 h-4" />}
                  autoComplete="email"
                />
              </div>

              <div>
                <PasswordInput
                  label="Password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  error={passwordError}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                />
              </div>

              {lastTenantName && tenantSlug && (
                <div className="flex items-center justify-between text-xs text-slate-300 bg-slate-950/80 border border-emerald-500/20 rounded-lg px-3 py-2">
                  <span className="flex items-center gap-1.5 truncate">
                    <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>
                      Workspace: <strong className="text-white">{lastTenantName}</strong>{' '}
                      <span className="text-slate-400 font-mono text-[11px]">({tenantSlug})</span>
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setTenantSlug('');
                      setLastTenantName('');
                      localStorage.removeItem('sp_last_tenant_slug');
                      localStorage.removeItem('sp_last_tenant_name');
                    }}
                    className="text-[11px] text-slate-400 hover:text-rose-400 underline ml-2 shrink-0 transition-colors"
                  >
                    Change
                  </button>
                </div>
              )}

              <div>
                <Input
                  label="Organization Slug (Optional)"
                  type="text"
                  value={tenantSlug}
                  onChange={(e) => {
                    setTenantSlug(e.target.value);
                    if (tenantError) setTenantError('');
                  }}
                  error={tenantError}
                  placeholder="Auto-detected from email"
                  helperText="Leave blank to auto-detect from your email"
                  leftIcon={<Building2 className="w-4 h-4" />}
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 h-3.5 w-3.5"
                  />
                  <span>Remember me</span>
                </label>

                <Link
                  to="/forgot-password"
                  className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2"
                isLoading={isSubmitting || isLoading}
                disabled={isSubmitting || isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {isSubmitting || isLoading ? 'Signing in...' : 'Sign In to StockPilot'}
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-800 text-center text-xs text-slate-400">
              Need a new organization workspace?{' '}
              <Link to="/register" className="text-emerald-400 hover:underline font-medium">
                Register Tenant
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
