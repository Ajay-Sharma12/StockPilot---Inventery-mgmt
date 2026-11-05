import React, { useState, useEffect } from 'react';
import { tenantApi } from '../../api/tenant.api';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../context/ToastContext';
import { Globe, Users, Building, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';

export const PlatformTenantsPage: React.FC = () => {
  const [tenants, setTenants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { success, error } = useToast();

  const fetchTenants = async () => {
    setIsLoading(true);
    try {
      const res = await tenantApi.listAllTenants();
      if (res.success && res.data) {
        setTenants(res.data);
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to list platform tenants');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleToggleStatus = async (t: any) => {
    const nextStatus = t.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await tenantApi.updateTenantStatus(t.id, { status: nextStatus });
      success(`Updated status for tenant '${t.name}' to ${nextStatus}`);
      fetchTenants();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to update tenant status');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Multi-Tenant Directory"
        description="Global platform operator directory for cross-tenant provisioning, governance, and status management"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Platform Tenants' }]}
      />

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Organization Tenant</th>
                <th className="py-3 px-4">Identifier (Slug)</th>
                <th className="py-3 px-4">Subscription Plan</th>
                <th className="py-3 px-4">Active Team</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/80 text-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Loading platform tenants...
                  </td>
                </tr>
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No tenants found.
                  </td>
                </tr>
              ) : (
                tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 text-purple-400 font-bold flex items-center justify-center text-xs shrink-0">
                          <Building className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-white">{t.name}</p>
                          <p className="text-[11px] text-slate-400">{t.contactEmail}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-300">
                      {t.slug}
                    </td>

                    <td className="py-3 px-4">
                      <Badge variant="purple" size="sm">
                        {t.plan}
                      </Badge>
                    </td>

                    <td className="py-3 px-4 font-mono text-xs text-slate-300">
                      {t.userCount} Users
                    </td>

                    <td className="py-3 px-4">
                      <Badge variant={t.status === 'ACTIVE' ? 'success' : 'danger'} size="sm">
                        {t.status}
                      </Badge>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(t)}
                        className={
                          t.status === 'ACTIVE'
                            ? 'text-rose-400 hover:text-rose-300'
                            : 'text-emerald-400 hover:text-emerald-300'
                        }
                      >
                        {t.status === 'ACTIVE' ? 'Suspend Tenant' : 'Activate Tenant'}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
