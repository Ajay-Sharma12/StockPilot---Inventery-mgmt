import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { PermissionGate } from '../../components/common/PermissionGate';
import { FeatureGate } from '../../components/common/FeatureGate';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { auditApi } from '../../api/entitlement.api';
import { inventoryApi } from '../../api/inventory.api';
import { warehouseApi } from '../../api/warehouse.api';
import { AuditLogItem } from '../../types';
import {
  ShieldCheck,
  Shield,
  Building,
  Building2,
  Users,
  CreditCard,
  History,
  Boxes,
  ShoppingBag,
  TrendingUp,
  Factory,
  CheckCheck,
  Globe,
  Sparkles,
  ArrowUpRight,
  Clock,
  Truck,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardSkeleton, ListSkeleton } from '../../components/ui/Skeleton';

const formatRoleName = (r: any): string => {
  if (!r) return '';
  const slug = typeof r === 'string' ? r : r.slug || r.name || '';
  const name = typeof r === 'object' && r.name ? r.name : '';
  if (name) return name;
  const map: Record<string, string> = {
    'super-admin': 'Platform Super Administrator',
    'tenant-admin': 'Tenant Administrator',
    'operations-manager': 'Operations Manager',
    'warehouse-clerk': 'Warehouse Clerk',
    'purchase-officer': 'Purchase Officer',
    'qc-inspector': 'QC Inspector',
    'sales-rep': 'Sales Representative',
    'production-supervisor': 'Production Supervisor',
    'compliance-auditor': 'Compliance Auditor',
  };
  return map[slug] || slug.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
};

export const DynamicDashboard: React.FC = () => {
  const { user, tenant, isLoading } = useAuth();
  const { can, hasRole, isSuperAdmin, accessScope, canApproveAmount, canAccessWarehouse } =
    usePermissions();

  const [recentLogs, setRecentLogs] = useState<AuditLogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [adminMetricTab, setAdminMetricTab] = useState<'default' | 'procurement' | 'warehouse' | 'qc' | 'sales' | 'production' | 'all'>('default');

  const [liveStats, setLiveStats] = useState<{
    totalSkus: number;
    totalStockUnits: number;
    totalValuation: number;
    lowStockCount: number;
    warehouseCount: number;
    warehouseNames: string[];
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    Promise.allSettled([
      inventoryApi.getOverview(),
      warehouseApi.getWarehouses(),
    ]).then(([invRes, whRes]) => {
      if (!isMounted) return;
      const inv = invRes.status === 'fulfilled' ? invRes.value : null;
      const whs = whRes.status === 'fulfilled' ? (whRes.value || []) : [];
      setLiveStats({
        totalSkus: inv?.totalSkus ?? 0,
        totalStockUnits: inv?.totalStockUnits ?? 0,
        totalValuation: inv?.totalValuation ?? 0,
        lowStockCount: inv?.lowStockCount ?? 0,
        warehouseCount: whs.length,
        warehouseNames: whs.map((w: any) => w.code || w.name),
      });
    }).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [user?.id, tenant?.id]);

  const canReadAudit = isSuperAdmin || can('audit:read');
  const isPrivileged = isSuperAdmin || hasRole('tenant-admin') || hasRole('operations-manager');

  if (isLoading) {
    return <DashboardSkeleton />;
  }



  useEffect(() => {
    let isMounted = true;
    if (canReadAudit) {
      setLogsLoading(true);
      auditApi
        .listLogs({ limit: 5 })
        .then((res) => {
          if (isMounted && res.success && res.data) {
            setRecentLogs(res.data);
          }
        })
        .catch((err) => {
          console.error('Failed to load recent audit logs:', err);
        })
        .finally(() => {
          if (isMounted) setLogsLoading(false);
        });
    } else {
      setRecentLogs([]);
      setLogsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [user?.id, canReadAudit]);


  return (
    <div className="space-y-8">
      {/* Dynamic Welcome Header */}
      <PageHeader
        title={`Welcome back, ${user?.name}`}
        description={`Logged in as ${user?.isSuperAdmin ? 'Platform Super Administrator' : (user?.roles || []).map(formatRoleName).join(', ') || 'User'} • Organization: ${tenant?.name || 'Platform Governance'}`}
        actions={
          <div className="flex items-center gap-2">
            <PermissionGate permission="users:create">
              <Link to="/users">
                <Button variant="primary" size="sm" leftIcon={<Users className="w-4 h-4" />}>
                  Manage Team
                </Button>
              </Link>
            </PermissionGate>
            <PermissionGate permission="subscription:read">
              <Link to="/subscription">
                <Button variant="outline" size="sm" leftIcon={<CreditCard className="w-4 h-4" />}>
                  Plan & Quotas
                </Button>
              </Link>
            </PermissionGate>
          </div>
        }
      />

      {/* Authorization Context Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border border-slate-200 dark:border-emerald-500/25 bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-900/95 dark:to-slate-950 shadow-xl overflow-hidden backdrop-blur-md">
          <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base text-slate-900 dark:text-white font-bold flex items-center gap-2">
                    Active Authorization Context
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                    Real-time RBAC, ABAC, and subscription entitlements driving this interface
                  </CardDescription>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-sm">
                {tenant?.plan || (user?.isSuperAdmin ? 'SUPER ADMIN' : 'FREE')} PLAN
              </span>
            </div>
          </CardHeader>

          <CardContent className="pt-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Assigned Roles Box */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/90 shadow-sm hover:border-slate-300 dark:hover:border-slate-700/80 transition-colors">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Assigned Roles
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">RBAC</span>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[32px] items-center">
                  {user?.isSuperAdmin ? (
                    <span className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-500/15 px-2.5 py-1 rounded-md border border-purple-200 dark:border-purple-500/30 shadow-sm">
                      Super Administrator
                    </span>
                  ) : user?.roles && user.roles.length > 0 ? (
                    user.roles.map((r, idx) => {
                      const roleLabel = formatRoleName(r);
                      const roleKey = typeof r === 'string' ? r : r.slug || r.id || idx;
                      return (
                        <span
                          key={roleKey}
                          className="text-xs font-mono font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1.5 shadow-sm"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
                          {roleLabel}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      Standard User
                    </span>
                  )}
                </div>
              </div>

              {/* ABAC Location Scope Box */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/90 shadow-sm hover:border-slate-300 dark:hover:border-slate-700/80 transition-colors">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    Location Scope
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">ABAC</span>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[32px] items-center">
                  {accessScope.warehouses && accessScope.warehouses.length > 0 ? (
                    accessScope.warehouses.map((wh) => (
                      <span
                        key={wh}
                        className="text-xs font-mono font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 px-2.5 py-1 rounded-md border border-amber-200 dark:border-amber-500/30"
                      >
                        {wh}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Unrestricted (All Facilities)
                    </span>
                  )}
                </div>
              </div>

              {/* ABAC Approval Limit Box */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/90 shadow-sm hover:border-slate-300 dark:hover:border-slate-700/80 transition-colors">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Approval Limit
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">POLICY</span>
                </div>
                <div className="min-h-[32px] flex items-center">
                  {accessScope.maxApprovalLimit !== undefined && accessScope.maxApprovalLimit > 0 ? (
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      ${accessScope.maxApprovalLimit.toLocaleString()} USD
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {isSuperAdmin || hasRole('tenant-admin') ? 'Unlimited Authority ($999M)' : 'Not Authorized for PO Approvals'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Security Context strip */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Permissions Evaluated:</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded text-[11px]">
                  {user?.isSuperAdmin ? 'Global Wildcard (*)' : `${user?.permissions?.length || 0} Active Grants`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Operational Department:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                  {accessScope.department || 'Executive & General Administration'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dynamic Quick Actions Gate (Right Card) */}
        <Card className="flex flex-col justify-between border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xl backdrop-blur-md">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <CardTitle className="text-base text-slate-900 dark:text-white font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              Role-Aware Action Gates
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
              Live evaluations enforcing multi-tenant RBAC, ABAC & Plans
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 pt-4 flex-1">
            {/* Gate 1: PO Approval */}
            <PermissionGate
              permission="purchase:approve"
              fallback={
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400">
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>Approve PO ($25,000)</span>
                  </div>
                  <span className="text-[10px] font-mono font-semibold bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 px-2 py-0.5 rounded">
                    Denied (RBAC)
                  </span>
                </div>
              }
            >
              {canApproveAmount(25000) ? (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-200 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Approve PO ($25,000)</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-emerald-500 text-white dark:text-slate-950 px-2 py-0.5 rounded shadow-sm">
                    Authorized
                  </span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-200 font-medium">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Approve PO ($25,000)</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded">
                    Exceeds Limit
                  </span>
                </div>
              )}
            </PermissionGate>

            {/* Gate 2: Stock Adjustment */}
            <PermissionGate
              permission="inventory:adjust"
              fallback={
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400">
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>Stock Adjust (WH-NORTH)</span>
                  </div>
                  <span className="text-[10px] font-mono font-semibold bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 px-2 py-0.5 rounded">
                    Denied (RBAC)
                  </span>
                </div>
              }
            >
              {canAccessWarehouse('WH-NORTH') ? (
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 text-blue-800 dark:text-blue-200 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>Stock Adjust (WH-NORTH)</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-blue-500 text-white px-2 py-0.5 rounded shadow-sm">
                    Permitted
                  </span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-200 font-medium">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Stock Adjust (WH-NORTH)</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded">
                    Out of Scope
                  </span>
                </div>
              )}
            </PermissionGate>

            {/* Gate 3: QC Sign-off */}
            <PermissionGate
              permission="qc:approve"
              fallback={
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400">
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>Sign-off QC Inspection</span>
                  </div>
                  <span className="text-[10px] font-mono font-semibold bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 px-2 py-0.5 rounded">
                    Denied (RBAC)
                  </span>
                </div>
              }
            >
              <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5 text-teal-800 dark:text-teal-200 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>Sign-off QC Inspection</span>
                </div>
                <span className="text-[10px] font-mono font-bold bg-teal-500 text-white dark:text-slate-950 px-2 py-0.5 rounded shadow-sm">
                  Authorized
                </span>
              </div>
            </PermissionGate>

            {/* Gate 4: Multi-Warehouse Transfers */}
            <FeatureGate
              feature="multiWarehouse"
              fallback={
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400">
                    <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400/80 shrink-0" />
                    <span>Multi-Warehouse Transfers</span>
                  </div>
                  <span className="text-[10px] font-mono font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 px-2 py-0.5 rounded">
                    Plan Locked
                  </span>
                </div>
              }
            >
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5 text-purple-800 dark:text-purple-200 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                  <span>Multi-Warehouse Transfers</span>
                </div>
                <span className="text-[10px] font-mono font-bold bg-purple-500 text-white px-2 py-0.5 rounded shadow-sm">
                  Entitled
                </span>
              </div>
            </FeatureGate>
          </CardContent>
        </Card>
      </div>

      {/* Dynamic Role Metrics: Tailored KPI sets based on active Persona */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
              <span>Operational Health & Role Metrics</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live KPI telemetry tailored to active role assignments and governance
            </p>
          </div>

          {/* Department Filter Tabs for Admins & Managers */}
          {isPrivileged && (
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs overflow-x-auto max-w-full">
              {[
                { id: 'default', label: isSuperAdmin ? 'Platform' : 'Organization' },
                { id: 'procurement', label: 'Procurement' },
                { id: 'warehouse', label: 'Warehousing' },
                { id: 'qc', label: 'Quality' },
                { id: 'sales', label: 'Sales' },
                { id: 'production', label: 'Production' },
                { id: 'all', label: 'View All' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAdminMetricTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap text-xs ${
                    adminMetricTab === tab.id
                      ? 'bg-white dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 1. Super Admin Platform View */}
        {isSuperAdmin && (adminMetricTab === 'default' || adminMetricTab === 'all') && (
          <div className="space-y-3">
            {adminMetricTab === 'all' && (
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-purple-400" />
                <span>Platform Governance KPIs</span>
              </h4>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <StatCard
                title="Active Organization"
                value={tenant?.name || 'Platform Governance'}
                subtitle={tenant?.slug ? `Tenant ID: ${tenant.slug}` : 'Multi-tenant Enterprise'}
                icon={<Globe className="w-5 h-5" />}
                iconBgColor="bg-purple-500/10"
                iconColor="text-purple-400"
              />
              <StatCard
                title="Global User Base"
                value="Provisioned"
                subtitle={`Authenticated as ${user?.email}`}
                icon={<Users className="w-5 h-5" />}
                iconBgColor="bg-blue-500/10"
                iconColor="text-blue-400"
              />
              <StatCard
                title="System Roles"
                value="9 Defined"
                subtitle="Global role templates"
                icon={<ShieldCheck className="w-5 h-5" />}
                iconBgColor="bg-emerald-500/10"
                iconColor="text-emerald-400"
              />
              <StatCard
                title="Platform Uptime"
                value="99.98%"
                subtitle="All services healthy"
                icon={<History className="w-5 h-5" />}
                iconBgColor="bg-teal-500/10"
                iconColor="text-teal-400"
              />
            </div>
          </div>
        )}

        {/* 2. Tenant Admin View */}
        {hasRole('tenant-admin') && !isSuperAdmin && (adminMetricTab === 'default' || adminMetricTab === 'all') && (
          <div className="space-y-3">
            {adminMetricTab === 'all' && (
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-blue-400" />
                <span>Organization Health KPIs</span>
              </h4>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <StatCard
                title="Organization Users"
                value="Active Team"
                subtitle={`Plan limit: ${tenant?.quotas?.maxUsers || 50} users max`}
                icon={<Users className="w-5 h-5" />}
                iconBgColor="bg-blue-500/10"
                iconColor="text-blue-400"
              />
              <StatCard
                title="Active Locations"
                value={`${liveStats?.warehouseCount ?? 1} Facilities`}
                subtitle={liveStats?.warehouseNames?.length ? liveStats.warehouseNames.join(', ') : 'Default Facility (WH-MAIN)'}
                icon={<Boxes className="w-5 h-5" />}
                iconBgColor="bg-amber-500/10"
                iconColor="text-amber-400"
              />
              <StatCard
                title="Catalog SKUs"
                value={`${liveStats?.totalSkus ?? 0} SKUs`}
                subtitle={liveStats?.totalStockUnits ? `${liveStats.totalStockUnits.toLocaleString()} units on hand` : 'Register your company items'}
                icon={<Layers className="w-5 h-5" />}
                iconBgColor="bg-emerald-500/10"
                iconColor="text-emerald-400"
              />
              <StatCard
                title="Inventory Valuation"
                value={`$${(liveStats?.totalValuation ?? 0).toLocaleString()}`}
                subtitle={`${tenant?.plan || 'GROWTH'} Plan • Active`}
                icon={<CreditCard className="w-5 h-5" />}
                iconBgColor="bg-purple-500/10"
                iconColor="text-purple-400"
              />
            </div>
          </div>
        )}

        {/* 3. Purchase Officer View */}
        {(hasRole('purchase-officer') || (isPrivileged && (adminMetricTab === 'procurement' || adminMetricTab === 'all'))) && (
          <div className="space-y-3">
            {isPrivileged && (
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
                <span>Procurement & Purchasing KPIs</span>
              </h4>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <StatCard
                title="Pending Purchase Orders"
                value="0 Orders"
                subtitle="$0.00 pending vendor dispatch"
                icon={<ShoppingBag className="w-5 h-5" />}
                iconBgColor="bg-emerald-500/10"
                iconColor="text-emerald-400"
              />
              <StatCard
                title="Approval Authority"
                value={`$${accessScope.maxApprovalLimit?.toLocaleString() || (isSuperAdmin || hasRole('tenant-admin') ? 'Unlimited' : '50,000')}`}
                subtitle="Authorized single PO limit"
                icon={<ShieldCheck className="w-5 h-5" />}
                iconBgColor="bg-blue-500/10"
                iconColor="text-blue-400"
              />
              <StatCard
                title="Active Suppliers"
                value="0 Vendors"
                subtitle="Approved procurement vendors"
                icon={<Building className="w-5 h-5" />}
                iconBgColor="bg-indigo-500/10"
                iconColor="text-indigo-400"
              />
              <StatCard
                title="Catalog SKUs"
                value={`${liveStats?.totalSkus ?? 0} SKUs`}
                subtitle="Available for requisition"
                icon={<Boxes className="w-5 h-5" />}
                iconBgColor="bg-teal-500/10"
                iconColor="text-teal-400"
              />
            </div>
          </div>
        )}

        {/* 4. Warehouse Clerk View */}
        {(hasRole('warehouse-clerk') || (isPrivileged && (adminMetricTab === 'warehouse' || adminMetricTab === 'all'))) && (
          <div className="space-y-3">
            {isPrivileged && (
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-amber-400" />
                <span>Warehouse & Facility Operations KPIs</span>
              </h4>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <StatCard
                title="Assigned Facilities"
                value={accessScope.warehouses?.length ? `${accessScope.warehouses.length} Locations` : `${liveStats?.warehouseCount ?? 1} Locations`}
                subtitle={accessScope.warehouses?.length ? accessScope.warehouses.join(' & ') : (liveStats?.warehouseNames?.join(', ') || 'WH-MAIN')}
                icon={<Boxes className="w-5 h-5" />}
                iconBgColor="bg-amber-500/10"
                iconColor="text-amber-400"
              />
              <StatCard
                title="Stock On Hand"
                value={`${(liveStats?.totalStockUnits ?? 0).toLocaleString()} Units`}
                subtitle={`Valuation: $${(liveStats?.totalValuation ?? 0).toLocaleString()}`}
                icon={<History className="w-5 h-5" />}
                iconBgColor="bg-blue-500/10"
                iconColor="text-blue-400"
              />
              <StatCard
                title="Stock Alerts"
                value={`${liveStats?.lowStockCount ?? 0} Alerts`}
                subtitle={liveStats?.lowStockCount ? 'Low or critical stock items' : 'All stock levels nominal'}
                icon={<TrendingUp className="w-5 h-5" />}
                iconBgColor="bg-emerald-500/10"
                iconColor="text-emerald-400"
              />
              <StatCard
                title="Physical Inventory"
                value="Up to Date"
                subtitle="Continuous cycle counting"
                icon={<CheckCheck className="w-5 h-5" />}
                iconBgColor="bg-teal-500/10"
                iconColor="text-teal-400"
              />
            </div>
          </div>
        )}

        {/* 5. QC Inspector View */}
        {(hasRole('qc-inspector') || (isPrivileged && (adminMetricTab === 'qc' || adminMetricTab === 'all'))) && (
          <div className="space-y-3">
            {isPrivileged && (
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCheck className="w-3.5 h-3.5 text-teal-400" />
                <span>Quality Control & Compliance KPIs</span>
              </h4>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <StatCard
                title="Pending Inbound QC"
                value="0 Shipments"
                subtitle="Incoming raw material verification"
                icon={<CheckCheck className="w-5 h-5" />}
                iconBgColor="bg-teal-500/10"
                iconColor="text-teal-400"
              />
              <StatCard
                title="Quality Pass Rate"
                value="100%"
                subtitle="Rolling 30-day compliance"
                icon={<ShieldCheck className="w-5 h-5" />}
                iconBgColor="bg-emerald-500/10"
                iconColor="text-emerald-400"
              />
              <StatCard
                title="Quarantined Batches"
                value="0 Batches"
                subtitle="No quarantine holds active"
                icon={<History className="w-5 h-5" />}
                iconBgColor="bg-rose-500/10"
                iconColor="text-rose-400"
              />
              <StatCard
                title="Active Checklists"
                value="Ready"
                subtitle="Standard ISO inspection tests"
                icon={<Boxes className="w-5 h-5" />}
                iconBgColor="bg-blue-500/10"
                iconColor="text-blue-400"
              />
            </div>
          </div>
        )}

        {/* 6. Sales Representative View */}
        {((hasRole('sales-representative') || hasRole('sales-rep')) || (isPrivileged && (adminMetricTab === 'sales' || adminMetricTab === 'all'))) && (
          <div className="space-y-3">
            {isPrivileged && (
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
                <span>Commercial Sales & OTC Metrics</span>
              </h4>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <StatCard
                title="Open Sales Orders"
                value="0 Orders"
                subtitle="$0.00 in active pipeline"
                icon={<TrendingUp className="w-5 h-5" />}
                iconBgColor="bg-rose-500/10"
                iconColor="text-rose-400"
              />
              <StatCard
                title="Commercial Approval Limit"
                value={`$${accessScope.maxApprovalLimit?.toLocaleString() || (isSuperAdmin || hasRole('tenant-admin') ? 'Unlimited' : '10,000')}`}
                subtitle="ABAC Single SO limit"
                icon={<ShieldCheck className="w-5 h-5" />}
                iconBgColor="bg-emerald-500/10"
                iconColor="text-emerald-400"
              />
              <StatCard
                title="Available SKUs"
                value={`${liveStats?.totalSkus ?? 0} Products`}
                subtitle="Ready for quote generation"
                icon={<Boxes className="w-5 h-5" />}
                iconBgColor="bg-amber-500/10"
                iconColor="text-amber-400"
              />
              <StatCard
                title="Dispatches & In Transit"
                value="0 Shipments"
                subtitle="No orders currently on road"
                icon={<Truck className="w-5 h-5" />}
                iconBgColor="bg-indigo-500/10"
                iconColor="text-indigo-400"
              />
            </div>
          </div>
        )}

        {/* 7. Production Supervisor View */}
        {(hasRole('production-supervisor') || (isPrivileged && (adminMetricTab === 'production' || adminMetricTab === 'all'))) && (
          <div className="space-y-3">
            {isPrivileged && (
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Factory className="w-3.5 h-3.5 text-purple-400" />
                <span>Production & Manufacturing Metrics</span>
              </h4>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <StatCard
                title="Active Work Orders"
                value="0 Orders"
                subtitle="Manufacturing line idle"
                icon={<Factory className="w-5 h-5" />}
                iconBgColor="bg-purple-500/10"
                iconColor="text-purple-400"
              />
              <StatCard
                title="Active BOM Recipes"
                value="0 Recipes"
                subtitle="Ready to configure BOMs"
                icon={<Layers className="w-5 h-5" />}
                iconBgColor="bg-blue-500/10"
                iconColor="text-blue-400"
              />
              <StatCard
                title="Available Raw Materials"
                value={`${liveStats?.totalSkus ?? 0} SKUs`}
                subtitle="Central stock catalog"
                icon={<Boxes className="w-5 h-5" />}
                iconBgColor="bg-emerald-500/10"
                iconColor="text-emerald-400"
              />
              <StatCard
                title="QC Hand-off Rate"
                value="100% Pass"
                subtitle="Standard quarantine compliance"
                icon={<CheckCheck className="w-5 h-5" />}
                iconBgColor="bg-teal-500/10"
                iconColor="text-teal-400"
              />
            </div>
          </div>
        )}

        {/* 8. Operations Manager / Auditor Default View */}
        {(hasRole('operations-manager') || hasRole('auditor')) && !isSuperAdmin && !hasRole('tenant-admin') && adminMetricTab === 'default' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard
              title="Operational Workload"
              value="Nominal"
              subtitle="All departments operational"
              icon={<Factory className="w-5 h-5" />}
              iconBgColor="bg-indigo-500/10"
              iconColor="text-indigo-400"
            />
            <StatCard
              title="Catalog SKUs"
              value={`${liveStats?.totalSkus ?? 0} SKUs`}
              subtitle={`${(liveStats?.totalStockUnits ?? 0).toLocaleString()} total stock units`}
              icon={<Boxes className="w-5 h-5" />}
              iconBgColor="bg-amber-500/10"
              iconColor="text-amber-400"
            />
            <StatCard
              title="Inventory Valuation"
              value={`$${(liveStats?.totalValuation ?? 0).toLocaleString()}`}
              subtitle="Current asset valuation"
              icon={<TrendingUp className="w-5 h-5" />}
              iconBgColor="bg-rose-500/10"
              iconColor="text-rose-400"
            />
            <StatCard
              title="Audit Compliance"
              value="100% Logged"
              subtitle="Immutable event audit trail"
              icon={<History className="w-5 h-5" />}
              iconBgColor="bg-slate-500/10"
              iconColor="text-slate-400"
            />
          </div>
        )}
      </div>

      {/* Module Hub Preview & Roadmap */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">
            Operational Modules Access Matrix
          </h3>
          <span className="text-xs text-slate-400">
            Phase 1-5 Fully Integrated Enterprise Platform
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/inventory"
            className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700 transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
                <Boxes className="w-5 h-5" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </div>
            <h4 className="text-sm font-semibold text-white">Inventory & Store</h4>
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">
              Multi-warehouse tracking, stock transfers, cycle counts and adjustments.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Access Policy:</span>
              <span className={`font-semibold ${can('inventory:read') ? 'text-emerald-400' : 'text-slate-500'}`}>
                {can('inventory:read') ? 'Authorized' : 'Restricted'}
              </span>
            </div>
          </Link>

          <Link
            to="/purchase"
            className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700 transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </div>
            <h4 className="text-sm font-semibold text-white">Purchase & Procurement</h4>
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">
              Supplier directory, RFQ bidding, PO authorization, and goods receipts.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Access Policy:</span>
              <span className={`font-semibold ${can('purchase:read') ? 'text-emerald-400' : 'text-slate-500'}`}>
                {can('purchase:read') ? 'Authorized' : 'Restricted'}
              </span>
            </div>
          </Link>

          <Link
            to="/sales"
            className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700 transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400">
                <TrendingUp className="w-5 h-5" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </div>
            <h4 className="text-sm font-semibold text-white">Sales & Order-to-Cash</h4>
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">
              Sales orders, stock reservation, packaging, dispatch, gate pass, invoicing & payments.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Access Policy:</span>
              <span className={`font-semibold ${can('sales:read') ? 'text-emerald-400' : 'text-slate-500'}`}>
                {can('sales:read') ? 'Authorized' : 'Restricted'}
              </span>
            </div>
          </Link>

          <Link
            to="/production"
            className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700 transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400">
                <Factory className="w-5 h-5" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </div>
            <h4 className="text-sm font-semibold text-white">Production & Manufacturing</h4>
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">
              BOM builder, MRP calculations, work orders, material consumption & lot tracking.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Access Policy:</span>
              <span className={`font-semibold ${can('production:read') ? 'text-emerald-400' : 'text-slate-500'}`}>
                {can('production:read') ? 'Authorized' : 'Restricted'}
              </span>
            </div>
          </Link>

          <Link
            to="/production/qc"
            className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700 transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-lg bg-teal-500/10 text-teal-400">
                <CheckCheck className="w-5 h-5" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </div>
            <h4 className="text-sm font-semibold text-white">Quality Control (QC)</h4>
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">
              Inbound GRN inspections, production batch sign-off, quarantine & defect tracking.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Access Policy:</span>
              <span className={`font-semibold ${can('qc:read') ? 'text-emerald-400' : 'text-slate-500'}`}>
                {can('qc:read') ? 'Authorized' : 'Restricted'}
              </span>
            </div>
          </Link>

          <Link
            to="/reports"
            className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-all group shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
            </div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Reports Center</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
              Facility-scoped operational queries, live table inspection, and RFC-4180 CSV exports.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-400 dark:text-slate-500">Access Policy:</span>
              <span className={`font-semibold ${can('reports:read') ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                {can('reports:read') ? 'Authorized' : 'Restricted'}
              </span>
            </div>
          </Link>

          <Link
            to="/analytics"
            className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-all group shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <TrendingUp className="w-5 h-5" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
            </div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Operational Analytics</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
              Multi-domain KPIs, period-over-period comparison, yield rates, and inventory velocity.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-400 dark:text-slate-500">Access Policy:</span>
              <span className={`font-semibold ${can('analytics:view') ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                {can('analytics:view') ? 'Authorized' : 'Restricted'}
              </span>
            </div>
          </Link>

          <Link
            to="/ai-insights"
            className="p-5 rounded-xl border border-purple-200 dark:border-purple-800/50 bg-purple-50/50 dark:bg-gradient-to-br dark:from-purple-950/40 dark:to-slate-900 hover:border-purple-300 dark:hover:border-purple-600 transition-all group shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-300">
                <Sparkles className="w-5 h-5" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
            </div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>AI Intelligence</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500 text-white">AI</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
              Automated anomaly detection, predictive shortage signals, and Operations Copilot.
            </p>
            <div className="mt-4 pt-3 border-t border-purple-100 dark:border-purple-800/40 flex items-center justify-between text-[11px]">
              <span className="text-slate-400 dark:text-slate-500">Access Policy:</span>
              <span className={`font-semibold ${can('ai.insights') ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-slate-500'}`}>
                {can('ai.insights') ? 'Authorized' : 'Restricted'}
              </span>
            </div>
          </Link>
        </div>
      </div>

      {/* Audit Stream Preview for Authorized Users */}
      <PermissionGate permission="audit:read">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-400" />
                  Recent Audit Trail Activity
                </CardTitle>
                <CardDescription>
                  Immutable security and compliance log events for this organization
                </CardDescription>
              </div>
              <Link to="/audit">
                <Button variant="ghost" size="sm" rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}>
                  View Full Audit Log
                </Button>
              </Link>
            </div>
          </CardHeader>

          <CardContent>
            {logsLoading && recentLogs.length === 0 ? (
              <ListSkeleton items={4} />
            ) : recentLogs.length === 0 ? (
              <p className="text-xs text-slate-500 py-3">No recent audit entries.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentLogs.map((log) => (
                  <div key={log._id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded uppercase font-semibold">
                        {log.action}
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">{log.userName}</span>
                      <span className="text-slate-600 dark:text-slate-400 truncate max-w-md">{log.details}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </PermissionGate>
    </div>
  );
};
