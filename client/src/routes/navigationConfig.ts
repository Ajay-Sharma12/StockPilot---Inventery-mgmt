import {
  LayoutDashboard,
  Building2,
  Users,
  ShieldCheck,
  CreditCard,
  History,
  Boxes,
  ShoppingBag,
  TrendingUp,
  Factory,
  CheckCheck,
  Globe,
  Package,
  ArrowLeftRight,
  Sliders,
  Trash2,
  ClipboardList,
  Warehouse,
  Database,
  FileText,
  Layers,
  Sparkles,
  Truck,
  BarChart2,
  FileCheck,
} from 'lucide-react';
import React from 'react';

export interface NavChildItem {
  name: string;
  href: string;
  icon?: React.ElementType;
  requiredPermission?: string;
  badge?: string;
}

export interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  requiredPermission?: string;
  requiredPermissions?: string[];
  requiredFeature?: string;
  superAdminOnly?: boolean;
  badge?: string;
  section: 'core' | 'operations' | 'administration' | 'platform';
  children?: NavChildItem[];
}

export const NAVIGATION_ITEMS: NavItem[] = [
  // Core
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    section: 'core',
  },

  // Operations Modules
  {
    name: 'Inventory & Warehouses',
    href: '/inventory',
    icon: Boxes,
    requiredPermission: 'inventory:read',
    section: 'operations',
    children: [
      { name: 'Overview', href: '/inventory', icon: LayoutDashboard },
      { name: 'Item Master', href: '/inventory/items', icon: Package, requiredPermission: 'inventory:read' },
      { name: 'Live Stock Balances', href: '/inventory/balances', icon: Layers, requiredPermission: 'inventory:read' },
      { name: 'Transaction Ledger', href: '/inventory/ledger', icon: FileText, requiredPermission: 'inventory:read' },
      { name: 'Stock Transfers', href: '/inventory/transfers', icon: ArrowLeftRight, requiredPermission: 'inventory:transfer' },
      { name: 'Stock Adjustments', href: '/inventory/adjustments', icon: Sliders, requiredPermission: 'inventory:adjust' },
      { name: 'Wastage & Scrap', href: '/inventory/wastage', icon: Trash2, requiredPermission: 'inventory:adjust' },
      { name: 'Cycle Counts', href: '/inventory/counts', icon: ClipboardList, requiredPermission: 'inventory:count' },
      { name: 'Warehouse Hierarchy', href: '/inventory/warehouses', icon: Warehouse, requiredPermission: 'warehouses:read' },
      { name: 'Master Data Center', href: '/inventory/master-data', icon: Database, requiredPermission: 'inventory:read' },
    ],
  },
  {
    name: 'Purchase & Procurement',
    href: '/purchase',
    icon: ShoppingBag,
    requiredPermission: 'purchase:read',
    section: 'operations',
    children: [
      { name: 'Overview & Pipeline', href: '/purchase', icon: LayoutDashboard },
      { name: 'Requisitions (PR)', href: '/purchase/requisitions', icon: FileText, requiredPermission: 'purchase:read' },
      { name: 'RFQs & Tenders', href: '/purchase/rfqs', icon: ArrowLeftRight, requiredPermission: 'purchase:read' },
      { name: 'Supplier Quotes & Matrix', href: '/purchase/quotes', icon: Sliders, requiredPermission: 'purchase:read' },
      { name: 'Purchase Orders (PO)', href: '/purchase/orders', icon: Package, requiredPermission: 'purchase:read' },
      { name: 'Incoming Purchases', href: '/purchase/incoming', icon: Truck, requiredPermission: 'purchase:read', badge: 'Dock' },
      { name: 'Goods Receipts (GRN)', href: '/purchase/grns', icon: Warehouse, requiredPermission: 'grn:read' },
      { name: 'Incoming Purchase QC', href: '/purchase/qc', icon: ShieldCheck, requiredPermission: 'qc:read' },
      { name: 'Supplier Management', href: '/purchase/suppliers', icon: Truck, requiredPermission: 'purchase:read' },
    ],
  },
  {
    name: 'Sales & Order-to-Cash',
    href: '/sales',
    icon: TrendingUp,
    requiredPermission: 'sales:read',
    section: 'operations',
    children: [
      { name: 'Overview', href: '/sales/overview', icon: LayoutDashboard },
      { name: 'Sales Quotations', href: '/sales/quotations', icon: FileCheck, requiredPermission: 'sales:read', badge: 'Pre-Sales' },
      { name: 'Sales Orders', href: '/sales/orders', icon: ShoppingBag, requiredPermission: 'sales:read' },
      { name: 'Packaging Queue', href: '/sales/packaging', icon: Boxes, requiredPermission: 'sales:read' },
      { name: 'Outbound Dispatches', href: '/sales/dispatches', icon: Package, requiredPermission: 'sales:read' },
      { name: 'Security Gate Passes', href: '/sales/gate-passes', icon: ShieldCheck, requiredPermission: 'sales:read' },
      { name: 'Customer Invoices', href: '/sales/invoices', icon: FileText, requiredPermission: 'sales:read' },
      { name: 'Payments & Collections', href: '/sales/payments', icon: CreditCard, requiredPermission: 'sales:read' },
    ],
  },
  {
    name: 'Production & BOM',
    href: '/production',
    icon: Factory,
    requiredPermission: 'production:read',
    section: 'operations',
    children: [
      { name: 'Overview', href: '/production', icon: LayoutDashboard },
      { name: 'BOM Recipes', href: '/production/boms', icon: Layers, requiredPermission: 'bom:read' },
      { name: 'MRP Planning', href: '/production/planning', icon: Sliders, requiredPermission: 'production:read' },
      { name: 'Work Orders', href: '/production/orders', icon: Factory, requiredPermission: 'production:read' },
      { name: 'Material Issuance', href: '/production/materials', icon: Boxes, requiredPermission: 'production:read' },
      { name: 'Batch Registry', href: '/production/batches', icon: Package, requiredPermission: 'batch:manage' },
      { name: 'Production QC', href: '/production/qc', icon: CheckCheck, requiredPermission: 'qc:read' },
      { name: 'Traceability DAG', href: '/production/traceability', icon: ArrowLeftRight, requiredPermission: 'production:read' },
      { name: 'Production Outputs', href: '/production/outputs', icon: BarChart2, requiredPermission: 'production:read' },
    ],
  },
  {
    name: 'Quality Control (QC)',
    href: '/production/qc',
    icon: CheckCheck,
    requiredPermission: 'qc:read',
    section: 'operations',
  },
  {
    name: 'Reports Center',
    href: '/reports',
    icon: FileText,
    requiredPermission: 'reports:read',
    section: 'operations',
  },
  {
    name: 'Operational Analytics',
    href: '/analytics',
    icon: TrendingUp,
    requiredPermission: 'analytics.view',
    section: 'operations',
  },
  {
    name: 'AI Intelligence',
    href: '/ai-insights',
    icon: Sparkles,
    requiredPermission: 'ai.insights',
    badge: 'AI',
    section: 'operations',
  },

  // Tenant Administration
  {
    name: 'Team Members',
    href: '/users',
    icon: Users,
    requiredPermission: 'users:read',
    section: 'administration',
  },
  {
    name: 'Roles & Permissions',
    href: '/roles',
    icon: ShieldCheck,
    requiredPermission: 'roles:read',
    section: 'administration',
  },
  {
    name: 'Organization Settings',
    href: '/organization',
    icon: Building2,
    requiredPermission: 'tenant:read',
    section: 'administration',
  },
  {
    name: 'Subscription & Quotas',
    href: '/subscription',
    icon: CreditCard,
    requiredPermission: 'subscription:read',
    section: 'administration',
  },
  {
    name: 'Audit Logs',
    href: '/audit',
    icon: History,
    requiredPermission: 'audit:read',
    section: 'administration',
  },

  // Platform (Super Admin)
  {
    name: 'Platform Tenants',
    href: '/platform/tenants',
    icon: Globe,
    superAdminOnly: true,
    section: 'platform',
  },
];
