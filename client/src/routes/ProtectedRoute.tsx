import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { ShieldAlert, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';

import { AppSkeleton, PageSkeleton } from '../components/ui/Skeleton';

export interface ProtectedRouteProps {
  requiredPermission?: string;
  requiredFeature?: string;
  superAdminOnly?: boolean;
  skeletonType?: 'app' | 'page';
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  requiredPermission,
  requiredFeature,
  superAdminOnly = false,
  skeletonType,
  children,
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { can, hasFeature, isSuperAdmin } = usePermissions();
  const location = useLocation();

  if (isLoading) {
    if (skeletonType === 'page' || requiredPermission || requiredFeature || superAdminOnly) {
      return <PageSkeleton />;
    }
    return <AppSkeleton />;
  }


  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Super Admin Only Guard
  if (superAdminOnly && !isSuperAdmin) {
    return (
      <div className="p-8 max-w-2xl mx-auto my-12 text-center rounded-2xl border border-rose-500/20 bg-rose-950/20">
        <div className="w-14 h-14 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Platform Administrator Access Required</h2>
        <p className="text-sm text-slate-400 mt-2 mb-6">
          This system area is restricted exclusively to StockPilot Platform Super Administrators.
        </p>
        <Button variant="secondary" onClick={() => window.history.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  // Permission Guard
  if (requiredPermission && !isSuperAdmin && !can(requiredPermission)) {
    return (
      <div className="p-8 max-w-2xl mx-auto my-12 text-center rounded-2xl border border-amber-500/20 bg-slate-900">
        <div className="w-14 h-14 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Access Denied: Insufficient Permissions</h2>
        <p className="text-sm text-slate-400 mt-2">
          Your current roles <span className="font-semibold text-slate-200">({(user?.roles || []).map((r: any) => (typeof r === 'string' ? r : r.name || r.slug)).join(', ')})</span> do not grant the required permission:
        </p>
        <div className="my-4 inline-block px-3 py-1.5 rounded-lg bg-slate-800 text-amber-300 font-mono text-xs border border-slate-700">
          {requiredPermission}
        </div>
        <p className="text-xs text-slate-500 mb-6">
          Contact your organization's Tenant Administrator if you believe this is in error.
        </p>
        <Button variant="secondary" onClick={() => window.history.back()}>
          Return to Previous Page
        </Button>
      </div>
    );
  }

  // Entitlement Feature Guard
  if (requiredFeature && !isSuperAdmin && !hasFeature(requiredFeature)) {
    return (
      <div className="p-8 max-w-2xl mx-auto my-12 text-center rounded-2xl border border-emerald-500/20 bg-slate-900">
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Plan Upgrade Required</h2>
        <p className="text-sm text-slate-400 mt-2 mb-6">
          This feature requires a higher subscription tier. Upgrade your organization plan to unlock this operational capability.
        </p>
        <Button variant="primary" onClick={() => (window.location.href = '/subscription')}>
          Explore Subscription Tiers
        </Button>
      </div>
    );
  }

  return <>{children}</>;
};
