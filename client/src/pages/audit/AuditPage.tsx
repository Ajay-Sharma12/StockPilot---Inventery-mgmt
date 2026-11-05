import React, { useState, useEffect } from 'react';
import { auditApi } from '../../api/entitlement.api';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { AuditLogItem } from '../../types';
import { History, Search, Filter, Clock, Globe, Code, ArrowRight } from 'lucide-react';
import { Select } from '../../components/ui/Select';

export const AuditPage: React.FC = () => {
  const { isSuperAdmin } = usePermissions();
  const { error } = useToast();

  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  // Diff Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await auditApi.listLogs({
        page,
        limit: 20,
        search: search || undefined,
        action: actionFilter || undefined,
        entity: entityFilter || undefined,
      });

      if (res.success && res.data) {
        setLogs(res.data);
        if (res.meta?.pagination) {
          setTotal(res.meta.pagination.total);
        }
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to fetch audit records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, search, actionFilter, entityFilter]);

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'success';
      case 'UPDATE':
        return 'info';
      case 'DELETE':
      case 'REJECT':
        return 'danger';
      case 'APPROVE':
        return 'success';
      case 'STATUS_CHANGE':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance & Security Audit Trails"
        description="Immutable chronological record of organizational events, permission modifications, and user actions"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Audit Logs' }]}
      />

      {/* Filter Bar */}
      <Card className="p-4 relative z-30">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search details or user name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[38px]"
            />
          </div>

          <div className="w-full">
            <Select
              value={actionFilter}
              variant="emerald"
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              placeholder="All Actions"
              options={[
                { value: '', label: 'All Actions' },
                { value: 'LOGIN', label: 'Login Session', badge: 'LOGIN' },
                { value: 'CREATE', label: 'Create Record', badge: 'CREATE' },
                { value: 'UPDATE', label: 'Update Record', badge: 'UPDATE' },
                { value: 'STATUS_CHANGE', label: 'Status Change', badge: 'STATUS' },
                { value: 'INVITE', label: 'Invite Member', badge: 'INVITE' },
                { value: 'APPROVE', label: 'Approve Event', badge: 'APPROVE' },
                { value: 'REJECT', label: 'Reject Event', badge: 'REJECT' },
                { value: 'CANCEL', label: 'Cancel Event', badge: 'CANCEL' },
                { value: 'DELETE', label: 'Delete Record', badge: 'DELETE' },
              ]}
            />
          </div>

          <div className="w-full">
            <Select
              value={entityFilter}
              variant="emerald"
              align="right"
              onChange={(e) => {
                setEntityFilter(e.target.value);
                setPage(1);
              }}
              placeholder="All Entities"
              options={[
                { value: '', label: 'All Entities' },
                { value: 'AUTH', label: 'Authentication', badge: 'AUTH' },
                { value: 'USER', label: 'User Accounts', badge: 'USER' },
                { value: 'ROLE', label: 'Roles & Permissions', badge: 'ROLE' },
                { value: 'TENANT', label: 'Organization & Tenant', badge: 'TENANT' },
                { value: 'SETTINGS', label: 'System Settings', badge: 'CONFIG' },
                { value: 'SUBSCRIPTION', label: 'Subscriptions & Billing', badge: 'BILLING' },
                { value: 'INVENTORY', label: 'Inventory & Stock', badge: 'STOCK' },
                { value: 'PURCHASE', label: 'Procurement & Purchase', badge: 'PURCHASE' },
                { value: 'PRODUCTION', label: 'Manufacturing & Production', badge: 'PROD' },
                { value: 'SALES', label: 'Sales & Orders', badge: 'SALES' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Audit Log Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">Triggered By</th>
                <th className="py-3 px-4">Event Details</th>
                <th className="py-3 px-4 text-right">Inspection</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/80 text-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Loading audit trail records...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No audit records match the selected filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>

                    <td className="py-3 px-4">
                      <Badge variant={getActionBadgeVariant(log.action) as any} size="sm">
                        {log.action}
                      </Badge>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-mono text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                        {log.entity}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div>
                        <p className="font-semibold text-white">{log.userName || 'System'}</p>
                        <p className="text-[10px] text-slate-500">{log.userEmail || 'daemon'}</p>
                      </div>
                    </td>

                    <td className="py-3 px-4 max-w-md truncate text-slate-300">
                      {log.details || '—'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {(log.previousState || log.newState) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Code className="w-3.5 h-3.5" />}
                          onClick={() => setSelectedLog(log)}
                        >
                          Inspect Diff
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* State Diff Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={`Audit Record: ${selectedLog?.action} [${selectedLog?.entity}]`}
        description={`Event ID: ${selectedLog?._id} • Recorded: ${selectedLog ? new Date(selectedLog.createdAt).toLocaleString() : ''}`}
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs">
            <p className="font-semibold text-white">{selectedLog?.details}</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Triggered by: {selectedLog?.userName} ({selectedLog?.userEmail}) • IP: {selectedLog?.ipAddress || '127.0.0.1'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                Previous State
              </p>
              <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 max-h-60 overflow-y-auto">
                {selectedLog?.previousState
                  ? JSON.stringify(selectedLog.previousState, null, 2)
                  : 'null (Created)'}
              </pre>
            </div>

            <div>
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                New State
              </p>
              <pre className="p-3 rounded-lg bg-slate-950 border border-emerald-500/20 font-mono text-[11px] text-emerald-300 max-h-60 overflow-y-auto">
                {selectedLog?.newState
                  ? JSON.stringify(selectedLog.newState, null, 2)
                  : 'null'}
              </pre>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
