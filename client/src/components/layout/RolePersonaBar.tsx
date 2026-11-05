import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  UserCheck,
  ChevronDown,
  Building2,
  Shield,
  RotateCcw,
  Check,
  Boxes,
  ShoppingCart,
  TrendingUp,
  Factory,
  Search,
  FileText,
  Crown,
} from 'lucide-react';

const COMPANY_ROLES = [
  {
    slug: 'tenant-admin',
    name: 'Tenant Administrator',
    badge: 'Full Access',
    description: 'Primary administrator with full organizational authority, billing, users & settings',
    icon: <Crown className="w-3.5 h-3.5 text-amber-400" />,
    color: 'bg-amber-500',
  },
  {
    slug: 'operations-manager',
    name: 'Operations Manager',
    badge: 'Operations',
    description: 'Cross-functional operational oversight of inventory, procurement, and dispatch',
    icon: <Building2 className="w-3.5 h-3.5 text-blue-400" />,
    color: 'bg-blue-500',
  },
  {
    slug: 'warehouse-clerk',
    name: 'Warehouse & Logistics Clerk',
    badge: 'Inventory',
    description: 'Inventory balances, stock transfers, cycle counts, and receiving dispatches',
    icon: <Boxes className="w-3.5 h-3.5 text-emerald-400" />,
    color: 'bg-emerald-500',
  },
  {
    slug: 'purchase-officer',
    name: 'Purchase Officer',
    badge: 'Procurement',
    description: 'Vendor RFQs, purchase orders, requisitions, and supplier quotes',
    icon: <ShoppingCart className="w-3.5 h-3.5 text-teal-400" />,
    color: 'bg-teal-500',
  },
  {
    slug: 'sales-representative',
    name: 'Commercial Sales Rep',
    badge: 'Sales & Invoicing',
    description: 'Customer sales orders, packaging dispatch, gate passes, and invoicing',
    icon: <TrendingUp className="w-3.5 h-3.5 text-purple-400" />,
    color: 'bg-purple-500',
  },
  {
    slug: 'production-supervisor',
    name: 'Production Supervisor',
    badge: 'Manufacturing',
    description: 'Bills of Materials, production planning, batch execution, and materials',
    icon: <Factory className="w-3.5 h-3.5 text-orange-400" />,
    color: 'bg-orange-500',
  },
  {
    slug: 'qc-inspector',
    name: 'Quality Assurance Inspector',
    badge: 'Quality Control',
    description: 'Incoming procurement QC, production inspections, and pass/fail test gates',
    icon: <Search className="w-3.5 h-3.5 text-rose-400" />,
    color: 'bg-rose-500',
  },
  {
    slug: 'auditor',
    name: 'Compliance Auditor',
    badge: 'Compliance & Audit',
    description: 'Read-only immutable audit logs, reports center, and compliance traceability',
    icon: <FileText className="w-3.5 h-3.5 text-indigo-400" />,
    color: 'bg-indigo-500',
  },
];

export const RolePersonaBar: React.FC = () => {
  const { user, tenant, rolePerspective, setRolePerspective, isLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const activeRoleName = () => {
    if (rolePerspective) {
      const match = COMPANY_ROLES.find((r) => r.slug === rolePerspective);
      return match ? match.name : rolePerspective;
    }
    if (user?.roles && user.roles.length > 0) {
      const firstRole: any = user.roles[0];
      return typeof firstRole === 'string' ? firstRole : firstRole.name || firstRole.slug;
    }
    return 'Authorized User';
  };

  return (
    <div className="bg-slate-900 border-b border-slate-800 text-xs px-4 py-2 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left Side: Active Workspace & User Context */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Organization / Workspace Badge */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold uppercase tracking-wider text-[10px] border border-emerald-500/20">
            <Building2 className="w-3 h-3" />
            <span>{tenant ? tenant.name : 'Organization Workspace'}</span>
          </div>

          {/* User Identity */}
          <span className="text-slate-400 hidden sm:inline">User:</span>
          <span className="font-semibold text-white truncate max-w-[160px]">{user?.name}</span>

          <span className="text-slate-500 hidden sm:inline">•</span>

          {/* Role Badge */}
          <span
            className={`font-mono text-[11px] px-2 py-0.5 rounded border ${
              rolePerspective
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            {rolePerspective ? `Simulating: ${activeRoleName()}` : activeRoleName()}
          </span>

          {/* Reset Perspective Button if simulating */}
          {rolePerspective && (
            <button
              onClick={() => setRolePerspective(null)}
              className="text-amber-400 hover:text-amber-300 text-[10px] bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1 transition-colors"
              title="Reset to your default account role"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset to Admin</span>
            </button>
          )}

          {tenant?.plan && (
            <span className="text-slate-400 text-[10px] bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700 font-mono">
              {tenant.plan} PLAN
            </span>
          )}
        </div>

        {/* Right Side: Role Perspective / Switcher Button */}
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg border border-slate-700 transition-all text-xs font-medium"
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Test Role Perspective</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {isOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
              <div className="absolute right-0 mt-2 w-88 max-w-[90vw] bg-slate-900 rounded-xl shadow-2xl border border-slate-700 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 border-b border-slate-800 bg-slate-950/40">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      {tenant?.name || 'Organization'} Roles
                    </p>
                    {tenant?.plan && (
                      <span className="text-[9px] font-mono text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                        {tenant.plan}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Test how the single application reconfigures UI, permissions, and menus for each role in your organization:
                  </p>
                </div>

                <div className="max-h-80 overflow-y-auto py-1 divide-y divide-slate-800/40">
                  {COMPANY_ROLES.map((r) => {
                    const isSelected =
                      rolePerspective === r.slug || (!rolePerspective && r.slug === 'tenant-admin');
                    return (
                      <button
                        key={r.slug}
                        onClick={() => {
                          if (r.slug === 'tenant-admin') {
                            setRolePerspective(null);
                          } else {
                            setRolePerspective(r.slug);
                          }
                          setIsOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 hover:bg-slate-800/80 transition-colors flex items-start gap-2.5 group ${
                          isSelected ? 'bg-emerald-500/10 border-l-2 border-emerald-500' : ''
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">{r.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p
                              className={`text-xs font-semibold truncate ${
                                isSelected ? 'text-emerald-300' : 'text-white group-hover:text-emerald-400'
                              }`}
                            >
                              {r.name}
                            </p>
                            {isSelected ? (
                              <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                <Check className="w-3 h-3 stroke-[3]" /> Active View
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-500 font-mono">{r.badge}</span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{r.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
