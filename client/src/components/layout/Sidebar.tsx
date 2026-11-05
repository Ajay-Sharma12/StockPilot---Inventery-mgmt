import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { NAVIGATION_ITEMS, NavItem } from '../../routes/navigationConfig';
import { cn } from '../../utils/cn';
import { Badge } from '../ui/Badge';
import { Layers, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

export interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggleCollapse }) => {
  const { tenant } = useAuth();
  const { can, isSuperAdmin } = usePermissions();
  const location = useLocation();

  // Track expanded parent modules (default expanded if currently active)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    '/inventory': true,
    '/sales': true,
    '/purchase': true,
    '/production': true,
  });

  const toggleSection = (href: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedSections((prev) => ({
      ...prev,
      [href]: !prev[href],
    }));
  };

  // Filter items based on user's active permissions & superadmin status
  const visibleItems = NAVIGATION_ITEMS.filter((item) => {
    if (item.superAdminOnly && !isSuperAdmin) {
      return false;
    }
    if (item.requiredPermission && !isSuperAdmin && !can(item.requiredPermission)) {
      return false;
    }
    return true;
  });

  const coreItems = visibleItems.filter((i) => i.section === 'core');
  const operationsItems = visibleItems.filter((i) => i.section === 'operations');
  const adminItems = visibleItems.filter((i) => i.section === 'administration');
  const platformItems = visibleItems.filter((i) => i.section === 'platform');

  const renderNavGroup = (title: string, items: NavItem[]) => {
    if (items.length === 0) return null;

    return (
      <div className="space-y-1 mb-6">
        {!isCollapsed && (
          <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
            {title}
          </p>
        )}
        {items.map((item) => {
          const Icon = item.icon;

          const visibleChildren = item.children?.filter((child) => {
            if (child.requiredPermission && !isSuperAdmin && !can(child.requiredPermission)) {
              return false;
            }
            return true;
          });

          const hasChildren = visibleChildren && visibleChildren.length > 0;

          const hasActiveChild = !!(
            hasChildren &&
            visibleChildren.some(
              (child) =>
                location.pathname === child.href ||
                location.pathname.startsWith(child.href)
            )
          );

          const isItemActive =
            item.href === '/dashboard'
              ? location.pathname === '/dashboard'
              : location.pathname.startsWith(item.href) || hasActiveChild;

          const isExpanded = expandedSections[item.href] ?? (isItemActive || hasActiveChild);

          return (
            <div key={item.href} className="space-y-1">
              <div className="flex items-center">
                <NavLink
                  to={item.href}
                  title={isCollapsed ? item.name : undefined}
                  className={cn(
                    'flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all group relative select-none',
                    isItemActive
                      ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                  {!isCollapsed && <span className="truncate flex-1">{item.name}</span>}
                  {!isCollapsed && item.badge && (
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                      {item.badge}
                    </span>
                  )}
                </NavLink>

                {!isCollapsed && hasChildren && (
                  <button
                    type="button"
                    onClick={(e) => toggleSection(item.href, e)}
                    className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800/80 rounded-md ml-1 transition-colors"
                  >
                    <ChevronDown
                      className={cn(
                        'w-3.5 h-3.5 transition-transform duration-200',
                        isExpanded ? 'rotate-0' : '-rotate-90'
                      )}
                    />
                  </button>
                )}
              </div>

              {/* Submenu Accordion */}
              {!isCollapsed && hasChildren && isExpanded && (
                <div className="pl-6 pr-1 py-1 space-y-0.5 border-l border-slate-800/80 ml-5 my-1">
                  {visibleChildren.map((child) => {
                    const ChildIcon = child.icon;
                    const isChildActive = location.pathname === child.href;

                    return (
                      <NavLink
                        key={child.href}
                        to={child.href}
                        className={cn(
                          'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all',
                          isChildActive
                            ? 'bg-emerald-500/15 text-emerald-300 font-semibold shadow-xs'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                        )}
                      >
                        {ChildIcon ? (
                          <ChildIcon className="w-3.5 h-3.5 shrink-0 text-slate-500 group-hover:text-emerald-400" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                        )}
                        <span className="truncate flex-1">{child.name}</span>
                        {child.badge && (
                          <span className="text-[9px] bg-slate-800 text-slate-400 px-1 rounded">
                            {child.badge}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <aside
      className={cn(
        'bg-slate-900/95 border-r border-slate-800 flex flex-col transition-all duration-300 z-30 h-screen sticky top-0',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Brand Header */}
      <div className="h-16 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
        {!isCollapsed ? (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white font-bold shadow-lg shadow-emerald-950/50 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold tracking-tight text-white truncate">STOCKPILOT</h2>
              <p className="text-[10px] text-emerald-400 font-mono font-medium truncate">
                {tenant?.name || 'Platform Core'}
              </p>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white mx-auto">
            <Layers className="w-4 h-4" />
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors hidden md:block"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Tenant Context Pill */}
      {!isCollapsed && tenant && (
        <div className="px-4 py-3 border-b border-slate-800/60 bg-slate-950/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Tenant Tier</span>
            <Badge variant="success" size="sm">
              {tenant.plan}
            </Badge>
          </div>
        </div>
      )}

      {/* Navigation Registry Tree */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {renderNavGroup('Overview', coreItems)}
        {renderNavGroup('Operations', operationsItems)}
        {renderNavGroup('Administration', adminItems)}
        {renderNavGroup('Platform Operator', platformItems)}
      </div>

      {/* Footer Info */}
      {!isCollapsed && (
        <div className="p-4 border-t border-slate-800 text-[10px] text-slate-500 text-center">
          <p className="font-semibold text-slate-400">StockPilot Enterprise v1.0 (Phases 1–5)</p>
          <p>Single-Application Architecture</p>
        </div>
      )}
    </aside>
  );
};
