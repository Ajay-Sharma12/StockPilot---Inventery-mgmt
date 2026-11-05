 import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UserProfile, TenantInfo } from '../types';
import { authApi } from '../api/auth.api';
import { systemApi } from '../api/entitlement.api';
import { apiClient } from '../api/client';
import { useToast } from './ToastContext';

interface AuthContextType {
  user: UserProfile | null;
  tenant: TenantInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: {
    email: string;
    password: string;
    tenantSlug?: string;
    rememberMe?: boolean;
  }) => Promise<void>;
  registerTenant: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  switchPersona: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  rolePerspective: string | null;
  setRolePerspective: (slug: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ROLE_PERSPECTIVE_MAP: Record<string, { name: string; slug: string; permissions: string[] }> = {
  'tenant-admin': {
    name: 'Tenant Administrator',
    slug: 'tenant-admin',
    permissions: ['*'],
  },
  'operations-manager': {
    name: 'Operations Manager',
    slug: 'operations-manager',
    permissions: [
      'inventory:read', 'inventory:create', 'inventory:update', 'inventory:adjust', 'inventory:transfer', 'inventory:count',
      'warehouses:read',
      'purchase:read', 'purchase:create', 'purchase:approve',
      'sales:read', 'sales:create', 'sales:approve', 'customers:read',
      'production:read', 'production:create',
      'qc:read', 'reports:read', 'audit:read',
    ],
  },
  'warehouse-clerk': {
    name: 'Warehouse & Logistics Clerk',
    slug: 'warehouse-clerk',
    permissions: [
      'inventory:read', 'inventory:transfer', 'inventory:count',
      'warehouses:read',
      'grn:read', 'grn:receive',
      'sales:read', 'dispatch:read', 'dispatch:create',
    ],
  },
  'purchase-officer': {
    name: 'Purchase Officer',
    slug: 'purchase-officer',
    permissions: [
      'purchase:read', 'purchase:create', 'purchase:update',
      'purchase_requisition.view', 'purchase_requisition.create',
      'rfq.view', 'rfq.create', 'supplier_quote.view',
      'purchase_order.view', 'purchase_order.create',
      'suppliers:read',
    ],
  },
  'sales-representative': {
    name: 'Commercial Sales Representative',
    slug: 'sales-representative',
    permissions: [
      'sales:read', 'sales:create', 'sales:update',
      'sales_order.view', 'sales_order.create',
      'invoice.view', 'payment.view', 'customers:read',
    ],
  },
  'production-supervisor': {
    name: 'Production Supervisor',
    slug: 'production-supervisor',
    permissions: [
      'production:read', 'production:create', 'production:update',
      'bom:read', 'bom:create', 'batch:manage',
    ],
  },
  'qc-inspector': {
    name: 'Quality Assurance Inspector',
    slug: 'qc-inspector',
    permissions: [
      'qc:read', 'qc:create', 'qc:inspect', 'qc:approve', 'qc:templates',
      'purchase_qc.view', 'purchase_qc.create', 'purchase_qc.inspect', 'purchase_qc.approve', 'purchase_qc.disposition', 'purchase_qc.reject', 'purchase_qc.hold',
      'production_qc.view', 'production_qc.inspect', 'production_qc.approve', 'production_qc.disposition',
      'inventory:read',
    ],
  },
  auditor: {
    name: 'Compliance Auditor',
    slug: 'auditor',
    permissions: [
      'audit:read', 'audit:export', 'reports:read',
      'inventory:read', 'purchase:read', 'sales:read', 'production:read',
    ],
  },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('sp_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [tenant, setTenant] = useState<TenantInfo | null>(() => {
    try {
      const saved = localStorage.getItem('sp_tenant');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [rolePerspective, setRolePerspectiveState] = useState<string | null>(() => {
    return localStorage.getItem('sp_role_perspective') || null;
  });

  const setRolePerspective = (slug: string | null) => {
    setRolePerspectiveState(slug);
    if (slug) {
      localStorage.setItem('sp_role_perspective', slug);
    } else {
      localStorage.removeItem('sp_role_perspective');
    }
  };

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const token = localStorage.getItem('sp_access_token');
    const savedUser = localStorage.getItem('sp_user');
    // If we already have token and saved user, we are NOT blocked loading initially!
    return !token || !savedUser;
  });
  const { success, error } = useToast();

  const effectiveUser = React.useMemo(() => {
    if (!user || !rolePerspective) return user;
    const sim = ROLE_PERSPECTIVE_MAP[rolePerspective];
    if (!sim) return user;
    return {
      ...user,
      roles: [{ id: sim.slug, name: sim.name, slug: sim.slug }],
      permissions: sim.permissions,
    };
  }, [user, rolePerspective]);

  const handleAuthSuccess = (data: any) => {
    // Invalidate and purge cached React Query items so fresh data loads instantly
    try {
      queryClient.clear();
    } catch {}

    if (data.accessToken) {
      localStorage.setItem('sp_access_token', data.accessToken);
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
    }
    if (data.refreshToken) localStorage.setItem('sp_refresh_token', data.refreshToken);

    if (data.user) {
      const normalizedUser: UserProfile = {
        ...data.user,
        id: data.user.id || data.user._id,
      };
      localStorage.setItem('sp_user', JSON.stringify(normalizedUser));
      setUser(normalizedUser);

      if (normalizedUser.tenantId) {
        localStorage.setItem('sp_active_tenant_id', normalizedUser.tenantId);
        apiClient.defaults.headers.common['X-Tenant-ID'] = normalizedUser.tenantId;
      } else {
        localStorage.removeItem('sp_active_tenant_id');
        delete apiClient.defaults.headers.common['X-Tenant-ID'];
      }
    }

    if (data.tenant) {
      const normalizedTenant: TenantInfo = {
        ...data.tenant,
        id: data.tenant.id || data.tenant._id,
      };
      localStorage.setItem('sp_tenant', JSON.stringify(normalizedTenant));
      if (normalizedTenant.slug) {
        localStorage.setItem('sp_last_tenant_slug', normalizedTenant.slug);
      }
      if (normalizedTenant.name) {
        localStorage.setItem('sp_last_tenant_name', normalizedTenant.name);
      }
      setTenant(normalizedTenant);
    } else {
      localStorage.removeItem('sp_tenant');
      setTenant(null);
    }

    if (data.user?.email) {
      localStorage.setItem('sp_last_email', data.user.email);
    }
  };

  const refreshProfile = useCallback(async () => {
    const token = localStorage.getItem('sp_access_token');
    const refreshToken = localStorage.getItem('sp_refresh_token');
    const savedUser = localStorage.getItem('sp_user');
    const savedTenant = localStorage.getItem('sp_tenant');

    // No tokens at all → definitely not authenticated
    if (!token && !refreshToken) {
      setUser(null);
      setTenant(null);
      localStorage.removeItem('sp_user');
      localStorage.removeItem('sp_tenant');
      localStorage.removeItem('sp_active_tenant_id');
      setIsLoading(false);
      return;
    }

    // If we have a saved user already in state (from useState initializer), don't
    // block rendering — just try to refresh silently in the background.
    try {
      const response = await authApi.getMe();
      if (response.success && response.data && response.data.user) {
        const u = response.data.user;
        const t = response.data.tenant;
        const normalizedUser: UserProfile = {
          ...u,
          id: u.id || u._id,
        };
        const normalizedTenant: TenantInfo | null = t
          ? {
              ...t,
              id: t.id || t._id,
            }
          : null;

        setUser(normalizedUser);
        setTenant(normalizedTenant);
        localStorage.setItem('sp_user', JSON.stringify(normalizedUser));
        if (normalizedUser.tenantId) {
          localStorage.setItem('sp_active_tenant_id', normalizedUser.tenantId);
        }
        if (normalizedTenant) {
          localStorage.setItem('sp_tenant', JSON.stringify(normalizedTenant));
          if (normalizedTenant.slug) {
            localStorage.setItem('sp_last_tenant_slug', normalizedTenant.slug);
          }
          if (normalizedTenant.name) {
            localStorage.setItem('sp_last_tenant_name', normalizedTenant.name);
          }
        } else {
          localStorage.removeItem('sp_tenant');
        }
        if (normalizedUser.email) {
          localStorage.setItem('sp_last_email', normalizedUser.email);
        }
      }
    } catch (err: any) {
      const status = err.response?.status;

      // 401 = token genuinely invalid/expired → must log out
      if (status === 401) {
        console.warn('Session expired (401) — clearing auth state');
        localStorage.removeItem('sp_access_token');
        localStorage.removeItem('sp_refresh_token');
        localStorage.removeItem('sp_user');
        localStorage.removeItem('sp_tenant');
        localStorage.removeItem('sp_active_tenant_id');
        setUser(null);
        setTenant(null);
      } else {
        // Network error, server down, 5xx, timeout etc.
        // → DON'T log the user out. Restore cached localStorage data.
        console.warn('Could not reach server on refresh — keeping cached session:', err.message || err);
        if (savedUser) {
          try {
            const parsedUser = JSON.parse(savedUser);
            setUser(parsedUser);
          } catch {}
        }
        if (savedTenant) {
          try {
            const parsedTenant = JSON.parse(savedTenant);
            setTenant(parsedTenant);
          } catch {}
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const login = async (credentials: {
    email: string;
    password: string;
    tenantSlug?: string;
    rememberMe?: boolean;
  }) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(credentials);
      if (response.success && response.data) {
        handleAuthSuccess(response.data);
        success(`Welcome back, ${response.data.user.name}!`);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Login failed. Please check your credentials.';
      error(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const registerTenant = async (data: any) => {
    setIsLoading(true);
    try {
      const response = await authApi.registerTenant(data);
      if (response.success && response.data) {
        handleAuthSuccess(response.data);
        success(`Organization ${response.data.tenant?.name} successfully created!`);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Organization registration failed.';
      error(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('sp_refresh_token');
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('sp_access_token');
      localStorage.removeItem('sp_refresh_token');
      localStorage.removeItem('sp_user');
      localStorage.removeItem('sp_tenant');
      localStorage.removeItem('sp_active_tenant_id');
      localStorage.removeItem('sp_role_perspective');
      delete apiClient.defaults.headers.common['Authorization'];
      delete apiClient.defaults.headers.common['X-Tenant-ID'];
      try {
        queryClient.clear();
      } catch {}
      setUser(null);
      setTenant(null);
      setRolePerspectiveState(null);
      success('Logged out successfully');
    }
  };

  const switchPersona = async (email: string) => {
    setIsLoading(true);
    try {
      const response = await systemApi.demoLogin(email);
      if (response.success && response.data) {
        handleAuthSuccess(response.data);
        success(`Switched persona to ${response.data.user.name} (${response.data.user.roles.join(', ')})`);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Persona switch failed.';
      error(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: effectiveUser,
        tenant,
        isAuthenticated: !!user,
        isLoading,
        login,
        registerTenant,
        logout,
        switchPersona,
        refreshProfile,
        rolePerspective,
        setRolePerspective,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
