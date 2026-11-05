import React, { useState, useEffect } from 'react';
import { entitlementApi } from '../../api/entitlement.api';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/common/PageHeader';
import { PermissionGate } from '../../components/common/PermissionGate';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { SubscriptionData } from '../../types';
import { CreditCard, Check, Sparkles, Zap, Shield, ChevronRight } from 'lucide-react';

export const SubscriptionPage: React.FC = () => {
  const { tenant, refreshProfile } = useAuth();
  const { can } = usePermissions();
  const { success, error } = useToast();

  const [entitlements, setEntitlements] = useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);

  const fetchEntitlements = async () => {
    setIsLoading(true);
    try {
      const res = await entitlementApi.getEntitlements();
      if (res.success && res.data) {
        setEntitlements(res.data);
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to load subscription details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEntitlements();
  }, [tenant]);

  const handleUpgrade = async (planKey: string) => {
    setUpgradingPlan(planKey);
    try {
      await entitlementApi.upgradePlan(planKey);
      success(`Successfully upgraded organization to ${planKey} Plan!`);
      await fetchEntitlements();
      await refreshProfile();
    } catch (err: any) {
      error(err.response?.data?.message || 'Plan upgrade failed');
    } finally {
      setUpgradingPlan(null);
    }
  };

  const plans = [
    {
      key: 'FREE',
      name: 'Free Starter',
      price: '$0',
      description: 'Ideal for small retail shops and sole proprietors',
      features: ['Up to 3 Users', '1 Warehouse Location', 'Standard Inventory Tracking', 'Community Support'],
    },
    {
      key: 'STARTER',
      name: 'Starter Operations',
      price: '$99 /mo',
      description: 'Growing distributor managing multi-batch items',
      features: ['Up to 10 Users', '2 Warehouse Facilities', 'Batch & Lot Tracking', 'Custom Roles Authoring', 'Email Support'],
    },
    {
      key: 'GROWTH',
      name: 'Growth Enterprise',
      price: '$299 /mo',
      description: 'Scaling manufacturing and high-throughput distribution',
      features: [
        'Up to 50 Users',
        '10 Warehouses & Hubs',
        'Full Quality Control (QC)',
        'Advanced Operations Analytics',
        'Multi-Warehouse Stock Balancing',
        'Audit Trail Export',
      ],
    },
    {
      key: 'ENTERPRISE',
      name: 'Global Enterprise',
      price: 'Custom',
      description: 'Mission-critical enterprise supply chain execution',
      features: [
        'Unlimited Users',
        'Unlimited Facilities',
        'Direct REST API Access',
        'Dedicated Enterprise SLA',
        'Custom SSO & Identity Sync',
        'Audit Compliance Archive',
      ],
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Subscription Entitlements & Quotas"
        description="Review tenant feature flags, consumption quotas, and plan tiers driving the platform shell"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Subscription & Quotas' }]}
      />

      {/* Quota Consumption Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-400 uppercase tracking-wider">Active Team Seats</span>
              <span className="font-mono text-emerald-400 font-bold">
                {entitlements?.usage.userCount || 0} / {entitlements?.quotas.maxUsers || 3}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    ((entitlements?.usage.userCount || 1) / (entitlements?.quotas.maxUsers || 3)) * 100
                  )}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              {((entitlements?.quotas.maxUsers || 3) - (entitlements?.usage.userCount || 0))} seats remaining
            </p>
          </div>
        </Card>

        <Card>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-400 uppercase tracking-wider">Facility Quota</span>
              <span className="font-mono text-amber-400 font-bold">
                2 / {entitlements?.quotas.maxWarehouses || 1}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-500"
                style={{
                  width: `${Math.min(100, (2 / (entitlements?.quotas.maxWarehouses || 1)) * 100)}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Max {entitlements?.quotas.maxWarehouses || 1} physical facility sites
            </p>
          </div>
        </Card>

        <Card>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-400 uppercase tracking-wider">Product Catalog SKU Limit</span>
              <span className="font-mono text-purple-400 font-bold">
                {entitlements?.quotas.maxProducts?.toLocaleString() || 50} SKUs
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: '15%' }} />
            </div>
            <p className="text-[11px] text-slate-500">Ample headroom for SKU expansion</p>
          </div>
        </Card>
      </div>

      {/* Feature Flags Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            Entitled Operational Capabilities (Feature Flags)
          </CardTitle>
          <CardDescription>
            These entitlement flags dynamically unlock and render platform modules in the UI shell
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {entitlements?.features &&
              Object.entries(entitlements.features).map(([key, enabled]) => (
                <div
                  key={key}
                  className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                    enabled
                      ? 'bg-emerald-500/5 border-emerald-500/20 text-slate-200'
                      : 'bg-slate-950 border-slate-800 text-slate-500 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center ${
                        enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-600'
                      }`}
                    >
                      <Check className="w-2.5 h-2.5" />
                    </div>
                    <span className="font-mono font-medium">{key}</span>
                  </div>

                  <span className={`text-[10px] font-bold ${enabled ? 'text-emerald-400' : 'text-slate-600'}`}>
                    {enabled ? 'ENABLED' : 'LOCKED'}
                  </span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Plan Tier Matrix */}
      <div>
        <h3 className="text-base font-semibold text-white mb-4">
          Subscription Plan Tiers
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((p) => {
            const isCurrent = entitlements?.plan === p.key;

            return (
              <Card
                key={p.key}
                className={`flex flex-col justify-between transition-all ${
                  isCurrent
                    ? 'border-emerald-500 bg-emerald-950/10 shadow-xl shadow-emerald-950/30 ring-1 ring-emerald-500'
                    : 'border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-white">{p.name}</h4>
                    {isCurrent && (
                      <Badge variant="success" size="sm">
                        CURRENT PLAN
                      </Badge>
                    )}
                  </div>

                  <p className="text-2xl font-bold text-white font-mono">{p.price}</p>
                  <p className="text-xs text-slate-400 mt-1 mb-6 leading-relaxed">{p.description}</p>

                  <div className="space-y-2 pt-4 border-t border-slate-800/80">
                    {p.features.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-800">
                  <PermissionGate permission="subscription:manage">
                    <Button
                      variant={isCurrent ? 'outline' : 'primary'}
                      size="sm"
                      className="w-full"
                      disabled={isCurrent}
                      isLoading={upgradingPlan === p.key}
                      onClick={() => handleUpgrade(p.key)}
                    >
                      {isCurrent ? 'Active Plan' : `Switch to ${p.key}`}
                    </Button>
                  </PermissionGate>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};
