import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/common/PageHeader';
import { PermissionGate } from '../../components/common/PermissionGate';
import { FeatureGate } from '../../components/common/FeatureGate';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  Boxes,
  ShoppingBag,
  TrendingUp,
  Factory,
  CheckCheck,
  ShieldCheck,
  Check,
  AlertTriangle,
  Sparkles,
  MapPin,
  DollarSign,
} from 'lucide-react';

interface ModuleConfig {
  title: string;
  phase: string;
  description: string;
  icon: React.ElementType;
  color: string;
  requiredPermission: string;
  entitlementFeature?: string;
  capabilities: string[];
}

const MODULE_REGISTRY: Record<string, ModuleConfig> = {
  '/inventory': {
    title: 'Inventory & Store Management',
    phase: 'Phase 2 Module',
    description: 'Multi-warehouse stock balancing, serial/lot tracking, cycle counts, and stock adjustments',
    icon: Boxes,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    requiredPermission: 'inventory:read',
    entitlementFeature: 'batchTracking',
    capabilities: [
      'Multi-Warehouse Stock Rebalancing',
      'Serial & Lot Number Lifecycle Tracking',
      'Cycle Count Reconciliation',
      'Stock Adjustment Workflows with Dual Approval',
      'Min/Max Automated Reorder Thresholds',
      'Bin Location and Pallet Management',
    ],
  },
  '/purchase': {
    title: 'Procurement & Purchase Orders',
    phase: 'Phase 3 Module',
    description: 'Vendor catalog, Request for Quotation (RFQ), Purchase Orders, and Goods Receipts (GRN)',
    icon: ShoppingBag,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    requiredPermission: 'purchase:read',
    capabilities: [
      'Supplier Onboarding & Performance Scoring',
      'RFQ Creation & Vendor Competitive Bidding',
      'Purchase Order Drafting & ABAC Multi-Tier Approvals',
      'Inbound Goods Receipt Notes (GRN) Matching',
      '3-Way Invoice Matching (PO, GRN, Bill)',
      'Automated Landed Cost Calculation',
    ],
  },
  '/sales': {
    title: 'Sales & Commercial Distribution',
    phase: 'Phase 3 Module',
    description: 'Customer ordering, quotations, pick-pack-dispatch workflows, invoices, and payments',
    icon: TrendingUp,
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    requiredPermission: 'sales:read',
    capabilities: [
      'Customer Directory & Credit Limits',
      'Quotation to Sales Order Conversion',
      'Pick, Pack, and Dispatch Tracking',
      'Commercial Invoicing and Tax Engine',
      'Payment Receipts and Receivables Aging',
      'Sales Rep Commission Scopes',
    ],
  },
  '/production': {
    title: 'Manufacturing & Production Execution',
    phase: 'Phase 4 Module',
    description: 'Multi-level Bill of Materials (BOM), production work orders, machine lines, and batch runs',
    icon: Factory,
    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    requiredPermission: 'production:read',
    capabilities: [
      'Multi-Level Bill of Materials (BOM) Versioning',
      'Work Order Scheduling & Line Allocation',
      'Raw Material Allocation & Backflushing',
      'Batch Tracking & Yield Efficiency Calculations',
      'Downtime & Maintenance Logging',
      'Shop Floor Operator Kiosk View',
    ],
  },
  '/qc': {
    title: 'Quality Control (QC) & Compliance',
    phase: 'Phase 4 Module',
    description: 'Inbound inspection checklists, in-line testing, batch release sign-offs, and quarantine quarantine',
    icon: CheckCheck,
    color: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
    requiredPermission: 'qc:read',
    entitlementFeature: 'qualityControl',
    capabilities: [
      'Custom Inspection Checklist Templates',
      'Inbound Shipment Dock Inspections',
      'In-Process Manufacturing Quality Audits',
      'Lot Quarantine and Non-Conformance Reports (NCR)',
      'Digital Signature Sign-off & Certificate of Analysis (COA)',
      'ISO 9001 Compliance Reporting',
    ],
  },
};

export const ModulePreviewPage: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { can, canApproveAmount, canAccessWarehouse, accessScope } = usePermissions();
  const { success, warning, error } = useToast();

  const moduleConfig =
    MODULE_REGISTRY[location.pathname] || MODULE_REGISTRY['/inventory'];
  const Icon = moduleConfig.icon;

  // ABAC interactive test simulation
  const handleTestApproval = (amount: number) => {
    if (canApproveAmount(amount)) {
      success(`Authorized! Successfully approved PO for $${amount.toLocaleString()} USD (within threshold).`);
    } else {
      error(
        `ABAC Policy Rejection: Purchase Order amount of $${amount.toLocaleString()} exceeds your authorized limit ($${accessScope.maxApprovalLimit?.toLocaleString() || 0}).`
      );
    }
  };

  const handleTestWarehouse = (warehouseCode: string) => {
    if (canAccessWarehouse(warehouseCode)) {
      success(`Access Granted: You are authorized to access and adjust inventory in ${warehouseCode}.`);
    } else {
      warning(
        `ABAC Boundary Rejection: Warehouse ${warehouseCode} is outside your assigned facilities: [${accessScope.warehouses?.join(', ')}].`
      );
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={moduleConfig.title}
        description={moduleConfig.description}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: moduleConfig.title },
        ]}
        actions={
          <Badge variant="purple" size="md">
            {moduleConfig.phase}
          </Badge>
        }
      />

      {/* Authorization Status Banner */}
      <div className="p-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Access Authorized for {user?.name}</span>
              <span className="text-xs font-mono font-normal text-emerald-400">
                ({moduleConfig.requiredPermission})
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Your active roles and permissions satisfy the authorization policy for this operational domain.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Policy:</span>
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20 font-mono">
            RBAC + ABAC ACTIVE
          </span>
        </div>
      </div>

      {/* Module Architectural Roadmap */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon className="w-5 h-5 text-emerald-400" />
              Planned Enterprise Capabilities
            </CardTitle>
            <CardDescription>
              Architectural capabilities slated for execution in upcoming module rollout phases
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {moduleConfig.capabilities.map((cap, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-start gap-2.5"
                >
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-2.5 h-2.5" />
                  </div>
                  <span className="text-xs font-medium text-slate-200">{cap}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Live ABAC Policy Tester Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Live ABAC Policy Sandbox
            </CardTitle>
            <CardDescription>
              Test attribute-based access policy evaluation against your current session
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {location.pathname === '/purchase' ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-300 font-semibold">
                  Test Financial Approval Threshold:
                </p>
                <p className="text-[11px] text-slate-400">
                  Your authorized limit:{' '}
                  <span className="text-emerald-400 font-bold font-mono">
                    ${accessScope.maxApprovalLimit?.toLocaleString() || 'Unlimited'}
                  </span>
                </p>

                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between"
                    onClick={() => handleTestApproval(12500)}
                  >
                    <span>Approve PO #8012 ($12,500)</span>
                    <span className="text-emerald-400 font-mono text-[10px]">Test Low</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between"
                    onClick={() => handleTestApproval(75000)}
                  >
                    <span>Approve PO #8013 ($75,000)</span>
                    <span className="text-amber-400 font-mono text-[10px]">Test High</span>
                  </Button>
                </div>
              </div>
            ) : location.pathname === '/inventory' ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-300 font-semibold">
                  Test Warehouse Facility Bounds:
                </p>
                <p className="text-[11px] text-slate-400">
                  Assigned scope:{' '}
                  <span className="text-amber-400 font-mono">
                    {accessScope.warehouses && accessScope.warehouses.length > 0
                      ? `[${accessScope.warehouses.join(', ')}]`
                      : 'Unrestricted'}
                  </span>
                </p>

                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between"
                    onClick={() => handleTestWarehouse('WH-NORTH')}
                  >
                    <span>Operate on WH-NORTH</span>
                    <span className="text-emerald-400 font-mono text-[10px]">Test Assigned</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between"
                    onClick={() => handleTestWarehouse('WH-SOUTH')}
                  >
                    <span>Operate on WH-SOUTH</span>
                    <span className="text-amber-400 font-mono text-[10px]">Test Unassigned</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-xs text-slate-400">
                <p>
                  This module evaluates resource verbs and user attributes in real-time. In Phase 2-4, full interactive forms, live document workflows, and batch tracking tables will mount here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
