import React from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { Link } from 'react-router-dom';

export interface FeatureGateProps {
  feature: string;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
  featureTitle?: string;
  children: React.ReactNode;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  fallback,
  showUpgradePrompt = false,
  featureTitle,
  children,
}) => {
  const { hasFeature, isSuperAdmin } = usePermissions();

  if (isSuperAdmin || hasFeature(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showUpgradePrompt) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 text-center max-w-lg mx-auto my-8">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-3">
          <Sparkles className="w-6 h-6" />
        </div>
        <h4 className="text-base font-semibold text-white">
          {featureTitle || 'Upgrade Required'}
        </h4>
        <p className="text-xs text-slate-400 mt-2 mb-5 leading-relaxed">
          The feature <span className="font-semibold text-amber-300 font-mono">[{feature}]</span> is not included in your current subscription plan. Upgrade to unlock this capability.
        </p>
        <Link to="/subscription">
          <Button variant="primary" size="sm">
            View Upgrade Plans
          </Button>
        </Link>
      </div>
    );
  }

  return null;
};
