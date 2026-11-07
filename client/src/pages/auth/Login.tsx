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
  UserX,
} from 'lucide-react';

export interface AssignedRoleCard {
  userId?: string | null;
  roleSlug: string;
  roleName: string;
  description?: string;
  isSystemRole?: boolean;
  status: 'Assigned' | 'Unassigned';
  isAssigned: boolean;
  assignedUser?: {
    id?: string;
    name: string;
    email: string;
    tenantSlug?: string;
    tenantName?: string;
    department?: string;
  } | null;
  defaultPassword?: string;
}

// Initial fallback strictly for Nike (@shoes)
const INITIAL_NIKE_ROLES: AssignedRoleCard[] = [
  {
    roleSlug: 'tenant-admin',
    roleName: 'Tenant Administrator',
    description: 'Full organizational authority over users, roles & settings',
    isSystemRole: true,
    status: 'Assigned',
    isAssigned: true,
    assignedUser: {
      name: 'Ajay sharma',
      email: 'ajaykumarsharma.it27@gmail.com',
      tenantSlug: 'shoes',
      tenantName: 'nike',
      department: 'Executive Management',
    },
    defaultPassword: 'Password123!',
  },
  {
    roleSlug: 'purchase-officer',
    roleName: 'Purchase Officer',
    description: 'Procurement execution, RFQs, purchase orders & vendor receipts',
    isSystemRole: true,
    status: 'Assigned',
    isAssigned: true,
    assignedUser: {
      name: 'Suraj Choudhry',
      email: 'ajaykumarsharma.it25@gmail.com',
      tenantSlug: 'shoes',
      tenantName: 'nike',
      department: 'Procurement',
    },
    defaultPassword: 'Password123!',
  },
  {
    roleSlug: 'qc-inspector',
    roleName: 'QC Inspector',
    description: 'Quality checklists, incoming shipment inspections & QA sign-offs',
    isSystemRole: true,
    status: 'Assigned',
    isAssigned: true,
    assignedUser: {
      name: 'Ankit Yadav',
      email: 'ajaysuman51601@gmail.com',
      tenantSlug: 'shoes',
      tenantName: 'nike',
      department: 'Quality Assurance',
    },
    defaultPassword: 'Password123!',
  },
  {
    roleSlug: 'super-admin',
    roleName: 'Platform Super Administrator',
    description: 'Global system governance & platform management',
    isSystemRole: true,
    status: 'Assigned',
    isAssigned: true,
    assignedUser: {
      name: 'Ankit Yadav',
      email: 'ajaysuman5160@gmail.com',
      tenantSlug: 'shoes',
      tenantName: 'nike',
      department: 'Platform Governance',
    },
    defaultPassword: 'Password123!',
  },
  {
    roleSlug: 'operations-manager',
    roleName: 'Operations Manager',
    description: 'Cross-functional operational oversight of inventory & procurement',
    isSystemRole: true,
    status: 'Unassigned',
    isAssigned: false,
    assignedUser: null,
    defaultPassword: '',
  },
  {
    roleSlug: 'warehouse-clerk',
    roleName: 'Warehouse Clerk',
    description: 'Store operations, inventory adjustments & bin transfers',
    isSystemRole: true,
    status: 'Unassigned',
    isAssigned: false,
    assignedUser: null,
    defaultPassword: '',
  },
  {
    roleSlug: 'sales-representative',
    roleName: 'Sales Representative',
    description: 'Customer quotations, sales orders & dispatch tracking',
    isSystemRole: true,
    status: 'Unassigned',
    isAssigned: false,
    assignedUser: null,
    defaultPassword: '',
  },
  {
    roleSlug: 'production-supervisor',
    roleName: 'Production Supervisor',
    description: 'Work orders, BOM tracking & batch logging',
    isSystemRole: true,
    status: 'Unassigned',
    isAssigned: false,
    assignedUser: null,
    defaultPassword: '',
  },
  {
    roleSlug: 'auditor',
    roleName: 'Compliance Auditor',
    description: 'Audit trail analysis & compliance governance reporting',
    isSystemRole: true,
    status: 'Unassigned',
    isAssigned: false,
    assignedUser: null,
    defaultPassword: '',
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

export const Login: React.FC = () => {
  const { login, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('shoes');
  const [lastTenantName, setLastTenantName] = useState('nike');
  const [rememberMe, setRememberMe] = useState(false);

  // Field-level inline errors
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [tenantError, setTenantError] = useState('');
  const [formError, setFormError] = useState('');
  const [successBanner, setSuccessBanner] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic roles management for Nike
  const [roles, setRoles] = useState<AssignedRoleCard[]>(INITIAL_NIKE_ROLES);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [roleSearch, setRoleSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [selectedRoleSlug, setSelectedRoleSlug] = useState<string | null>(null);
  const [selectedRoleNotification, setSelectedRoleNotification] = useState<string | null>(null);

  // Dynamic fetch from API
  const fetchAssignedRoles = useCallback(async () => {
    try {
      const res = await authApi.getAssignedRoles();
      const serverRoles = res.data || res;
      if (Array.isArray(serverRoles) && serverRoles.length > 0) {
        setRoles(serverRoles);
      }
    } catch {
      // Graceful fallback to initial state
    } finally {
      setIsLoadingRoles(false);
    }
  }, []);

  // Initial fetch and real-time polling every 3 seconds + window focus listener
  useEffect(() => {
    setIsLoadingRoles(true);
    fetchAssignedRoles();

    // Real-time polling every 3000ms
    const interval = setInterval(() => {
      fetchAssignedRoles();
    }, 3000);

    // Refresh immediately on window focus (e.g. when returning from User Management tab)
    const handleFocus = () => {
      fetchAssignedRoles();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleFocus);
    };
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

  const handleSelectRole = (card: AssignedRoleCard) => {
    setSelectedRoleSlug(card.roleSlug);

    if (card.isAssigned && card.assignedUser) {
      const userEmail = card.assignedUser.email || '';
      const userPassword = card.defaultPassword || 'Password123!';
      const userSlug = card.assignedUser.tenantSlug || 'shoes';
      const userTenantName = card.assignedUser.tenantName || 'nike';

      setEmail(userEmail);
      setPassword(userPassword);
      setTenantSlug(userSlug);
      setLastTenantName(userTenantName);

      setEmailError('');
      setPasswordError('');
      setTenantError('');
      setFormError('');

      setSelectedRoleNotification(
        `Selected ${card.roleName}: ${card.assignedUser.name} (${userEmail}) — Credentials filled`
      );
    } else {
      // Unassigned role clicked
      setEmail('');
      setPassword('');
      setTenantSlug('shoes');
      setLastTenantName('nike');

      setSelectedRoleNotification(
        `Note: Role "${card.roleName}" is currently Unassigned in Nike. Assign a user in User Management to enable login.`
      );
    }
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
        tenantSlug: tenantSlug.trim().toLowerCase() || 'shoes',
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

  // Stats calculation
  const assignedCount = useMemo(() => roles.filter((r) => r.isAssigned).length, [roles]);
  const unassignedCount = useMemo(() => roles.filter((r) => !r.isAssigned).length, [roles]);

  // Filtering roles by search and status
  const filteredRoles = useMemo(() => {
    return roles.filter((r) => {
      // Status filter
      if (statusFilter === 'assigned' && !r.isAssigned) return false;
      if (statusFilter === 'unassigned' && r.isAssigned) return false;

      // Search query
      const query = roleSearch.toLowerCase();
      if (!query) return true;

      const roleMatch = r.roleName.toLowerCase().includes(query) || r.roleSlug.toLowerCase().includes(query);
      const userMatch =
        (r.assignedUser?.name || '').toLowerCase().includes(query) ||
        (r.assignedUser?.email || '').toLowerCase().includes(query);

      return roleMatch || userMatch;
    });
  }, [roles, statusFilter, roleSearch]);

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
          Multi-Tenant Inventory &amp; Operations Platform
        </p>
      </div>

      {/* Main Container: Split Grid for Nike Roles & Login Form */}
      <div className="w-full max-w-6xl mx-auto z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: Nike Role Management UI */}
          <div className="lg:col-span-7 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl p-5 sm:p-6 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <h3 className="text-base font-semibold text-white">
                    Nike Assigned Roles &amp; Accounts
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-slate-800 border border-slate-700 text-emerald-400 font-medium">
                    @shoes
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time role status for Nike company — Click to auto-fill credentials
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsLoadingRoles(true);
                  fetchAssignedRoles();
                }}
                disabled={isLoadingRoles}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition-colors px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 self-start sm:self-auto"
                title="Refresh latest role assignments from database"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRoles ? 'animate-spin text-emerald-400' : ''}`} />
                <span>{isLoadingRoles ? 'Updating...' : 'Refresh Roles'}</span>
              </button>
            </div>

            {/* Filter Tabs & Real-Time Status Count */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                    statusFilter === 'all'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-medium'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  All Roles ({roles.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('assigned')}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                    statusFilter === 'assigned'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-medium'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  Assigned ({assignedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('unassigned')}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                    statusFilter === 'unassigned'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-medium'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  Unassigned ({unassignedCount})
                </button>
              </div>

              <div className="text-[11px] text-slate-500 font-mono">
                Real-time sync active
              </div>
            </div>

            {/* Quick search input */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
                placeholder="Search Nike roles or user names..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-slate-950/70 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Nike Roles Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[460px] overflow-y-auto pr-1 focus:outline-none">
              {filteredRoles.map((card) => {
                const isSelected = selectedRoleSlug === card.roleSlug;
                const isAssigned = card.isAssigned && Boolean(card.assignedUser);
                const assigned = card.assignedUser;

                return (
                  <button
                    key={card.roleSlug}
                    type="button"
                    onClick={() => handleSelectRole(card)}
                    className={`text-left p-3 rounded-xl border transition-all duration-150 flex flex-col justify-between group relative ${
                      isSelected
                        ? isAssigned
                          ? 'bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-950/30 ring-1 ring-emerald-500/40'
                          : 'bg-amber-950/30 border-amber-500/60 shadow-md ring-1 ring-amber-500/40'
                        : isAssigned
                        ? 'bg-slate-950/60 hover:bg-slate-800/70 border-slate-800/90 hover:border-slate-700'
                        : 'bg-slate-950/30 hover:bg-slate-900/50 border-dashed border-slate-800/80 hover:border-slate-700 opacity-85'
                    }`}
                  >
                    {/* Top Row: Role Name, Icon & Status Badge */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`p-1.5 rounded-lg border group-hover:scale-105 transition-transform shrink-0 ${
                            isAssigned
                              ? 'bg-slate-900 border-slate-800'
                              : 'bg-slate-900/60 border-slate-800/60'
                          }`}
                        >
                          {isAssigned ? (
                            getRoleIcon(card.roleSlug)
                          ) : (
                            <UserX className="w-4 h-4 text-amber-400/80" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div
                            className={`text-xs font-semibold transition-colors truncate ${
                              isAssigned
                                ? 'text-white group-hover:text-emerald-300'
                                : 'text-slate-300 group-hover:text-amber-200'
                            }`}
                          >
                            {card.roleName}
                          </div>
                          {card.description && (
                            <div className="text-[10px] text-slate-500 truncate">
                              {card.description}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Status Badge */}
                        {isAssigned ? (
                          <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            Assigned
                          </span>
                        ) : (
                          <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            Unassigned
                          </span>
                        )}

                        {isSelected && isAssigned && (
                          <span className="p-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: Assigned User Name & Email */}
                    <div className="pt-2 border-t border-slate-800/60 mt-1">
                      {isAssigned && assigned ? (
                        <>
                          <div className="flex items-center justify-between text-[11px] gap-1">
                            <span className="text-white font-medium truncate">
                              {assigned.name}
                            </span>
                            <span className="text-[10px] text-emerald-400 font-mono truncate">
                              @shoes
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-emerald-400/90 truncate mt-0.5">
                            {assigned.email}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-between text-[11px] py-0.5">
                          <span className="text-amber-400 font-medium">
                            Unassigned
                          </span>
                          <span className="text-slate-500 text-[10px]">
                            No user assigned yet
                          </span>
                        </div>
                      )}
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
              <span>💡 When you assign a role to a user in Nike, it updates here immediately in real time.</span>
            </div>
          </div>

          {/* RIGHT COLUMN: Sign In Form */}
          <div className="lg:col-span-5 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl p-6 sm:p-8">
            <h3 className="text-lg font-bold text-white mb-1">
              Sign In to StockPilot
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Enter credentials or select an assigned role from the Nike panel.
            </p>

            {/* Selection Notification Banner */}
            {selectedRoleNotification && (
              <div
                className={`mb-4 p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                  selectedRoleNotification.includes('Unassigned')
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                }`}
              >
                {selectedRoleNotification.includes('Unassigned') ? (
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                )}
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
                      setTenantSlug('shoes');
                      setLastTenantName('nike');
                    }}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium ml-2 shrink-0 transition-colors"
                  >
                    Reset
                  </button>
                </div>
              )}

              <div>
                <Input
                  label="Organization Slug"
                  type="text"
                  value={tenantSlug}
                  onChange={(e) => {
                    setTenantSlug(e.target.value);
                    if (tenantError) setTenantError('');
                  }}
                  error={tenantError}
                  placeholder="shoes"
                  helperText="Default workspace: shoes (Nike)"
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
