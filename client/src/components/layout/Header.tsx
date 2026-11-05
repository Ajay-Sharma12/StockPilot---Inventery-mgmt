import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import {
  LogOut,
  Bell,
  Search,
  Building,
  User,
  ChevronDown,
  X,
  Package,
  Layers,
  ArrowRight,
  ExternalLink,
  Command,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { NAVIGATION_ITEMS, NavItem, NavChildItem } from '../../routes/navigationConfig';
import { itemApi, Item } from '../../api/item.api';
import { inventoryApi } from '../../api/inventory.api';

import { ThemeToggle } from '../common/ThemeToggle';

interface SearchRouteResult {
  name: string;
  href: string;
  section: string;
  icon: React.ElementType;
}

export const Header: React.FC = () => {
  const { user, tenant, logout } = useAuth();
  const { can, isSuperAdmin } = usePermissions();
  const navigate = useNavigate();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    title: string;
    message: string;
    type: 'wastage' | 'stock' | 'system';
    link: string;
    count?: number;
    time: string;
    badge: string;
    badgeColor: string;
  }>>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [itemResults, setItemResults] = useState<Item[]>([]);
  const [isSearchingItems, setIsSearchingItems] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const notificationContainerRef = useRef<HTMLDivElement>(null);

  // Flatten all navigation items into a searchable list
  const searchableRoutes: SearchRouteResult[] = React.useMemo(() => {
    const list: SearchRouteResult[] = [];
    for (const item of NAVIGATION_ITEMS) {
      if (item.superAdminOnly && !isSuperAdmin) continue;
      if (item.requiredPermission && !isSuperAdmin && !can(item.requiredPermission)) continue;

      list.push({
        name: item.name,
        href: item.href,
        section: item.section.toUpperCase(),
        icon: item.icon,
      });

      if (item.children) {
        for (const child of item.children) {
          if (child.requiredPermission && !isSuperAdmin && !can(child.requiredPermission)) continue;
          list.push({
            name: `${item.name} → ${child.name}`,
            href: child.href,
            section: item.section.toUpperCase(),
            icon: child.icon || item.icon,
          });
        }
      }
    }
    return list;
  }, [can, isSuperAdmin]);

  // Filter routes based on search query
  const matchedRoutes = React.useMemo(() => {
    if (!searchQuery.trim()) return searchableRoutes.slice(0, 6);
    const q = searchQuery.toLowerCase();
    return searchableRoutes.filter(
      (r) => r.name.toLowerCase().includes(q) || r.section.toLowerCase().includes(q) || r.href.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [searchQuery, searchableRoutes]);

  // Live item search from backend API
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setItemResults([]);
      setIsSearchingItems(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingItems(true);
        const res = await itemApi.getItems({ search: searchQuery.trim(), limit: 5 });
        if (res?.data && Array.isArray(res.data)) {
          setItemResults(res.data);
        } else if (Array.isArray(res)) {
          setItemResults(res);
        } else {
          setItemResults([]);
        }
      } catch (err) {
        console.error('Search items error:', err);
        setItemResults([]);
      } finally {
        setIsSearchingItems(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Global Ctrl+K keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      } else if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
      if (notificationContainerRef.current && !notificationContainerRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Live operational notifications (including Wastage scrap review & low stock)
  const loadNotifications = React.useCallback(async () => {
    try {
      const list: any[] = [];

      // 1. Pending wastage authorizations
      try {
        const wRes = await inventoryApi.getWastages({ status: 'DRAFT', limit: 10 });
        const pendingW = wRes?.data || [];
        if (pendingW.length > 0) {
          const totalVal = pendingW.reduce((sum: number, w: any) => {
            const cost = w.items?.reduce((s: number, i: any) => s + (i.totalCost || 0), 0) || 0;
            return sum + cost;
          }, 0);

          list.push({
            id: 'wastage-alert',
            title: `${pendingW.length} Scrap Write-off(s) Pending`,
            message: `Wastage write-offs totaling $${totalVal.toFixed(2)} require supervisor review & authorization.`,
            type: 'wastage',
            link: '/inventory/wastage',
            count: pendingW.length,
            time: 'Needs Review',
            badge: 'Scrap Approval',
            badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          });
        }
      } catch (err) {
        // quiet ignore
      }

      // 2. Low stock threshold warnings
      try {
        const overview = await inventoryApi.getOverview();
        if (overview && overview.lowStockCount > 0) {
          list.push({
            id: 'stock-alert',
            title: `${overview.lowStockCount} Item(s) Below Safety Stock`,
            message: 'Physical stock levels reached critical minimum threshold.',
            type: 'stock',
            link: '/inventory/balances?lowStockOnly=true',
            count: overview.lowStockCount,
            time: 'Critical',
            badge: 'Low Stock',
            badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          });
        }
      } catch (err) {
        // quiet ignore
      }

      setNotifications(list);
      setUnreadCount(list.length);
    } catch (err) {
      console.warn('Notification loader skipped:', err);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const handleSelectRoute = (href: string) => {
    navigate(href);
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  const handleSelectItem = (item: Item) => {
    navigate(`/inventory/balances?itemId=${item._id}`);
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 flex items-center justify-between sticky top-8 z-20">
      {/* Search / Global Command Center */}
      <div ref={searchContainerRef} className="relative flex items-center gap-4 flex-1 max-w-lg">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
            placeholder="Search pages, items, POs, warehouses... (Ctrl+K)"
            className="w-full bg-slate-950/70 border border-slate-800 text-xs text-slate-200 rounded-lg pl-9 pr-16 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 transition-all placeholder-slate-500 shadow-inner"
          />

          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setItemResults([]);
                }}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800/80 rounded border border-slate-700">
                <Command className="w-2.5 h-2.5" />K
              </kbd>
            )}
          </div>
        </div>

        {/* Global Search Results Dropdown */}
        {isSearchOpen && (
          <div className="absolute left-0 top-full mt-2 w-full max-h-96 overflow-y-auto bg-slate-900/95 backdrop-blur-xl rounded-xl border border-slate-700 shadow-2xl z-50 divide-y divide-slate-800/70 animate-in fade-in zoom-in-95 duration-100">
            {/* Pages & Navigation Results */}
            <div className="p-2">
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Modules & Actions</span>
                <span className="font-normal text-slate-500">{matchedRoutes.length} found</span>
              </div>
              <div className="space-y-0.5">
                {matchedRoutes.map((route, idx) => {
                  const RouteIcon = route.icon;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectRoute(route.href)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-all group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-md bg-slate-800 text-slate-400 group-hover:text-emerald-400 group-hover:bg-emerald-500/10 transition-colors">
                          <RouteIcon className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-medium truncate">{route.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                        {route.section}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Inventory Items Results */}
            <div className="p-2">
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Inventory Items (Live DB)</span>
                {isSearchingItems ? (
                  <span className="text-[10px] text-emerald-400 animate-pulse font-normal">Searching...</span>
                ) : (
                  <span className="font-normal text-slate-500">{itemResults.length} found</span>
                )}
              </div>

              {itemResults.length > 0 ? (
                <div className="space-y-0.5">
                  {itemResults.map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => handleSelectItem(item)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-all group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400">
                          <Package className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate">{item.name}</p>
                          <p className="text-[10px] font-mono text-slate-400">{item.sku || item.code}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {item.sellingPrice !== undefined && item.sellingPrice > 0 && (
                          <span className="text-xs font-semibold text-emerald-400 font-mono">
                            ${item.sellingPrice}
                          </span>
                        )}
                        <span className="block text-[10px] text-slate-500">View Stock →</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : searchQuery.trim().length >= 2 && !isSearchingItems ? (
                <p className="px-3 py-2 text-xs text-slate-500">No inventory items matched "{searchQuery}"</p>
              ) : (
                <p className="px-3 py-1.5 text-[11px] text-slate-500">Type SKU or item name to search database...</p>
              )}
            </div>

            {/* Footer Hint */}
            <div className="px-3 py-2 bg-slate-950/60 text-[10px] text-slate-500 flex items-center justify-between">
              <span>Press <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-400 font-mono">ESC</kbd> to exit</span>
              <span>StockPilot Global Command</span>
            </div>
          </div>
        )}
      </div>


      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Day / Night Theme Toggle (Icon Only) */}
        <ThemeToggle />

        {/* Tenant Organization Indicator */}
        {tenant && (
          <Link
            to="/organization"
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 transition-colors text-xs"
          >
            <Building className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            <span className="font-semibold text-slate-900 dark:text-white">{tenant.name}</span>
            <span className="text-[10px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400 font-mono">
              {tenant.slug}
            </span>
          </Link>
        )}

        {/* Notifications Center */}
        <div ref={notificationContainerRef} className="relative">
          <button
            title="Notifications"
            onClick={() => {
              setNotificationsOpen(!notificationsOpen);
              if (!notificationsOpen) loadNotifications();
            }}
            className={`relative p-2 rounded-lg transition-colors ${
              notificationsOpen
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-slate-900 animate-pulse">
                {unreadCount}
              </span>
            ) : (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-slate-900" />
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 py-3 z-50 animate-in fade-in zoom-in-95 duration-150 divide-y divide-slate-100 dark:divide-slate-800">
              <div className="px-4 pb-2.5 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Bell className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                    Operational Notifications
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Live inventory & scrap write-off alerts</p>
                </div>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30">
                    {unreadCount} Active
                  </span>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500 dark:text-emerald-400 mx-auto mb-2 opacity-80" />
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">All Clear & Up to Date</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      No pending scrap approvals or low stock warnings.
                    </p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        setNotificationsOpen(false);
                        navigate(notif.link);
                      }}
                      className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors group flex items-start gap-3"
                    >
                      <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        notif.type === 'wastage'
                          ? 'bg-rose-500/10 text-rose-500 dark:text-rose-400'
                          : 'bg-amber-500/10 text-amber-500 dark:text-amber-400'
                      }`}>
                        {notif.type === 'wastage' ? (
                          <Trash2 className="w-4 h-4" />
                        ) : (
                          <AlertTriangle className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors truncate">
                            {notif.title}
                          </p>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono shrink-0 ${notif.badgeColor}`}>
                            {notif.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                          {notif.message}
                        </p>
                        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/40 text-[10px]">
                          <span className="text-slate-400 dark:text-slate-500 font-mono">{notif.time}</span>
                          <span className="text-rose-600 dark:text-rose-400 font-medium group-hover:underline flex items-center gap-1">
                            Review Now &rarr;
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="px-3 pt-2 text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
                <button
                  type="button"
                  onClick={loadNotifications}
                  className="hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1"
                >
                  <RefreshCw className="w-2.5 h-2.5" /> Sync Alerts
                </button>
                <Link
                  to="/inventory/wastage"
                  onClick={() => setNotificationsOpen(false)}
                  className="hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                >
                  Scrap Center &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold text-xs shadow-md">
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <div className="text-left hidden md:block">
              <p className="text-xs font-semibold text-slate-900 dark:text-white leading-none">{user?.name}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-none">{user?.email}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">{user?.name}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {user?.roles.map((r: any, idx: number) => {
                      const roleSlug = typeof r === 'string' ? r : r.slug || r.id || idx;
                      const roleName = typeof r === 'string' ? r : r.name || r.slug;
                      return (
                        <span key={roleSlug} className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono">
                          {roleName}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="py-1">
                  <Link
                    to="/organization"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <Building className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400" />
                    Organization Profile
                  </Link>
                  <Link
                    to="/users"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <User className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400" />
                    User Directory
                  </Link>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-1 mt-1">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
