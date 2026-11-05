export interface PermissionDefinition {
  code: string;
  name: string;
  category: string;
  description: string;
}

export const PERMISSIONS = {
  // Tenant & System
  TENANT_READ: 'tenant:read',
  TENANT_UPDATE: 'tenant:update',
  TENANT_MANAGE: 'tenant:manage', // Super admin level

  // User Management
  USERS_READ: 'users:read',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
  USERS_MANAGE: 'users:manage',

  // Role Management
  ROLES_READ: 'roles:read',
  ROLES_CREATE: 'roles:create',
  ROLES_UPDATE: 'roles:update',
  ROLES_DELETE: 'roles:delete',

  // ABAC Access Policies
  POLICIES_READ: 'policies:read',
  POLICIES_MANAGE: 'policies:manage',

  // Subscription & Entitlements
  SUBSCRIPTION_READ: 'subscription:read',
  SUBSCRIPTION_MANAGE: 'subscription:manage',

  // Audit Logs
  AUDIT_READ: 'audit:read',
  AUDIT_EXPORT: 'audit:export',

  // Inventory & Warehouse Modules
  INVENTORY_READ: 'inventory:read',
  INVENTORY_CREATE: 'inventory:create',
  INVENTORY_UPDATE: 'inventory:update',
  INVENTORY_DELETE: 'inventory:delete',
  INVENTORY_ADJUST: 'inventory:adjust',
  INVENTORY_TRANSFER: 'inventory:transfer',
  INVENTORY_RECEIVE: 'inventory:receive',
  INVENTORY_ISSUE: 'inventory:issue',
  INVENTORY_COUNT: 'inventory:count',
  INVENTORY_EXPORT: 'inventory:export',
  WAREHOUSE_READ: 'warehouses:read',
  WAREHOUSE_CREATE: 'warehouses:create',
  WAREHOUSE_UPDATE: 'warehouses:update',
  WAREHOUSE_DELETE: 'warehouses:delete',
  WAREHOUSE_MANAGE: 'warehouses:manage',

  // Purchase & Procurement Module (Phase 3 Granular Permissions)
  PURCHASE_READ: 'purchase:read',
  PURCHASE_CREATE: 'purchase:create',
  PURCHASE_UPDATE: 'purchase:update',
  PURCHASE_APPROVE: 'purchase:approve',
  SUPPLIERS_READ: 'suppliers:read',
  SUPPLIERS_MANAGE: 'suppliers:manage',
  GRN_READ: 'grn:read',
  GRN_CREATE: 'grn:create',

  // Purchase Requisition
  PR_VIEW: 'purchase_requisition.view',
  PR_CREATE: 'purchase_requisition.create',
  PR_EDIT: 'purchase_requisition.edit',
  PR_DELETE: 'purchase_requisition.delete',
  PR_SUBMIT: 'purchase_requisition.submit',
  PR_APPROVE: 'purchase_requisition.approve',
  PR_REJECT: 'purchase_requisition.reject',
  PR_EXPORT: 'purchase_requisition.export',

  // RFQ
  RFQ_VIEW: 'rfq.view',
  RFQ_CREATE: 'rfq.create',
  RFQ_EDIT: 'rfq.edit',
  RFQ_DELETE: 'rfq.delete',
  RFQ_ISSUE: 'rfq.issue',
  RFQ_CLOSE: 'rfq.close',
  RFQ_EXPORT: 'rfq.export',

  // Supplier Quotes
  QUOTE_VIEW: 'supplier_quote.view',
  QUOTE_CREATE: 'supplier_quote.create',
  QUOTE_EDIT: 'supplier_quote.edit',
  QUOTE_FINALIZE: 'supplier_quote.finalize',
  QUOTE_REJECT: 'supplier_quote.reject',
  QUOTE_EXPORT: 'supplier_quote.export',

  // Purchase Orders
  PO_VIEW: 'purchase_order.view',
  PO_CREATE: 'purchase_order.create',
  PO_EDIT: 'purchase_order.edit',
  PO_DELETE: 'purchase_order.delete',
  PO_SUBMIT: 'purchase_order.submit',
  PO_APPROVE: 'purchase_order.approve',
  PO_REJECT: 'purchase_order.reject',
  PO_SEND: 'purchase_order.send',
  PO_CANCEL: 'purchase_order.cancel',
  PO_EXPORT: 'purchase_order.export',

  // Goods Receipt Note (GRN)
  GRN_VIEW: 'grn.view',
  GRN_EDIT: 'grn.edit',
  GRN_RECEIVE: 'grn.receive',
  GRN_COMPLETE: 'grn.complete',
  GRN_CANCEL: 'grn.cancel',
  GRN_EXPORT: 'grn.export',

  // Purchase QC
  PURCHASE_QC_VIEW: 'purchase_qc.view',
  PURCHASE_QC_CREATE: 'purchase_qc.create',
  PURCHASE_QC_EDIT: 'purchase_qc.edit',
  PURCHASE_QC_INSPECT: 'purchase_qc.inspect',
  PURCHASE_QC_APPROVE: 'purchase_qc.approve',
  PURCHASE_QC_REJECT: 'purchase_qc.reject',
  PURCHASE_QC_HOLD: 'purchase_qc.hold',
  PURCHASE_QC_DISPOSITION: 'purchase_qc.disposition',
  PURCHASE_QC_EXPORT: 'purchase_qc.export',

  // Sales Module
  SALES_READ: 'sales:read',
  SALES_CREATE: 'sales:create',
  SALES_UPDATE: 'sales:update',
  SALES_APPROVE: 'sales:approve',
  CUSTOMERS_READ: 'customers:read',
  CUSTOMERS_MANAGE: 'customers:manage',
  DISPATCH_MANAGE: 'dispatch:manage',
  INVOICES_READ: 'invoices:read',
  INVOICES_CREATE: 'invoices:create',
  PAYMENTS_READ: 'payments:read',
  PAYMENTS_CREATE: 'payments:create',
  GATEPASS_READ: 'gatepass:read',
  GATEPASS_MANAGE: 'gatepass:manage',

  // Sales Order Granular
  SO_VIEW: 'sales_order.view',
  SO_CREATE: 'sales_order.create',
  SO_EDIT: 'sales_order.edit',
  SO_DELETE: 'sales_order.delete',
  SO_SUBMIT: 'sales_order.submit',
  SO_APPROVE: 'sales_order.approve',
  SO_REJECT: 'sales_order.reject',
  SO_CONFIRM: 'sales_order.confirm',
  SO_CANCEL: 'sales_order.cancel',
  SO_ALLOCATE: 'sales_order.allocate',
  SO_EXPORT: 'sales_order.export',

  // Packaging Granular
  PKG_VIEW: 'packaging.view',
  PKG_CREATE: 'packaging.create',
  PKG_EDIT: 'packaging.edit',
  PKG_PACK: 'packaging.pack',
  PKG_CANCEL: 'packaging.cancel',
  PKG_EXPORT: 'packaging.export',

  // Dispatch Granular
  DISPATCH_VIEW: 'dispatch.view',
  DISPATCH_CREATE: 'dispatch.create',
  DISPATCH_EDIT: 'dispatch.edit',
  DISPATCH_DISPATCH: 'dispatch.dispatch',
  DISPATCH_CANCEL: 'dispatch.cancel',
  DISPATCH_EXPORT: 'dispatch.export',

  // Gate Pass Granular
  GATEPASS_VIEW: 'gatepass.view',
  GATEPASS_CREATE: 'gatepass.create',
  GATEPASS_EDIT: 'gatepass.edit',
  GATEPASS_APPROVE: 'gatepass.approve',
  GATEPASS_GATEOUT: 'gatepass.gateout',
  GATEPASS_CLOSE: 'gatepass.close',
  GATEPASS_EXPORT: 'gatepass.export',

  // Invoice Granular
  INVOICE_VIEW: 'invoice.view',
  INVOICE_CREATE: 'invoice.create',
  INVOICE_EDIT: 'invoice.edit',
  INVOICE_ISSUE: 'invoice.issue',
  INVOICE_CANCEL: 'invoice.cancel',
  INVOICE_EXPORT: 'invoice.export',

  // Payment Granular
  PAYMENT_VIEW: 'payment.view',
  PAYMENT_CREATE: 'payment.create',
  PAYMENT_EDIT: 'payment.edit',
  PAYMENT_REVERSE: 'payment.reverse',
  PAYMENT_EXPORT: 'payment.export',

  // Production Module
  PRODUCTION_READ: 'production:read',
  PRODUCTION_CREATE: 'production:create',
  PRODUCTION_UPDATE: 'production:update',
  BOM_READ: 'bom:read',
  BOM_MANAGE: 'bom:manage',
  BATCH_MANAGE: 'batch:manage',

  // Production Granular Permissions
  PROD_VIEW: 'production.view',
  PROD_CREATE: 'production.create',
  PROD_EDIT: 'production.edit',
  PROD_DELETE: 'production.delete',
  PROD_SUBMIT: 'production.submit',
  PROD_APPROVE: 'production.approve',
  PROD_RELEASE: 'production.release',
  PROD_START: 'production.start',
  PROD_PAUSE: 'production.pause',
  PROD_RESUME: 'production.resume',
  PROD_COMPLETE: 'production.complete',
  PROD_CANCEL: 'production.cancel',
  PROD_CONSUME: 'production.consume',
  PROD_RECEIVE: 'production.receive',
  PROD_EXPORT: 'production.export',

  // BOM Granular Permissions
  BOM_VIEW: 'bom.view',
  BOM_CREATE: 'bom.create',
  BOM_EDIT: 'bom.edit',
  BOM_DELETE: 'bom.delete',
  BOM_APPROVE: 'bom.approve',
  BOM_ACTIVATE: 'bom.activate',
  BOM_ARCHIVE: 'bom.archive',
  BOM_EXPORT: 'bom.export',

  // Production QC Granular Permissions
  PROD_QC_VIEW: 'production-qc.view',
  PROD_QC_CREATE: 'production-qc.create',
  PROD_QC_EDIT: 'production-qc.edit',
  PROD_QC_INSPECT: 'production-qc.inspect',
  PROD_QC_APPROVE: 'production-qc.approve',
  PROD_QC_REJECT: 'production-qc.reject',
  PROD_QC_HOLD: 'production-qc.hold',
  PROD_QC_REWORK: 'production-qc.rework',
  PROD_QC_SCRAP: 'production-qc.scrap',
  PROD_QC_EXPORT: 'production-qc.export',

  // Quality Control (QC) Module
  QC_READ: 'qc:read',
  QC_CREATE: 'qc:create',
  QC_EDIT: 'qc:edit',
  QC_DELETE: 'qc:delete',
  QC_INSPECT: 'qc:inspect',
  QC_TEMPLATES: 'qc:templates',
  QC_APPROVE: 'qc:approve',
  QC_REJECT: 'qc:reject',
  QC_EXPORT: 'qc:export',

  // Reports & Analytics
  REPORTS_READ: 'reports:read',
  REPORTS_EXPORT: 'reports:export',
  REPORTS_INVENTORY_VIEW: 'reports.inventory.view',
  REPORTS_PROCUREMENT_VIEW: 'reports.procurement.view',
  REPORTS_SALES_VIEW: 'reports.sales.view',
  REPORTS_PRODUCTION_VIEW: 'reports.production.view',
  REPORTS_QC_VIEW: 'reports.qc.view',
  REPORTS_FINANCIAL_VIEW: 'reports.financial.view',

  ANALYTICS_VIEW: 'analytics.view',
  ANALYTICS_EXPORT: 'analytics.export',

  // AI Readiness Permissions
  AI_ACCESS: 'ai.access',
  AI_INSIGHTS: 'ai.insights',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const SYSTEM_PERMISSIONS_CATALOG: PermissionDefinition[] = [
  // Tenant & System
  { code: PERMISSIONS.TENANT_READ, name: 'View Tenant Profile', category: 'Organization', description: 'View organization details and profile' },
  { code: PERMISSIONS.TENANT_UPDATE, name: 'Update Tenant Settings', category: 'Organization', description: 'Modify organization settings and preferences' },
  { code: PERMISSIONS.TENANT_MANAGE, name: 'Platform Tenant Management', category: 'Platform', description: 'Super Admin manage all platform tenants' },

  // User Management
  { code: PERMISSIONS.USERS_READ, name: 'View Users', category: 'User Management', description: 'View organization user list and profiles' },
  { code: PERMISSIONS.USERS_CREATE, name: 'Invite & Create Users', category: 'User Management', description: 'Add and invite new users' },
  { code: PERMISSIONS.USERS_UPDATE, name: 'Update Users', category: 'User Management', description: 'Edit user details, roles and scopes' },
  { code: PERMISSIONS.USERS_DELETE, name: 'Deactivate Users', category: 'User Management', description: 'Suspend or deactivate users' },
  { code: PERMISSIONS.USERS_MANAGE, name: 'Full User Administration', category: 'User Management', description: 'Manage all aspects of users' },

  // Role Management
  { code: PERMISSIONS.ROLES_READ, name: 'View Roles', category: 'Role Management', description: 'View role list and permissions' },
  { code: PERMISSIONS.ROLES_CREATE, name: 'Create Custom Roles', category: 'Role Management', description: 'Create new custom roles' },
  { code: PERMISSIONS.ROLES_UPDATE, name: 'Modify Roles', category: 'Role Management', description: 'Update permissions on roles' },
  { code: PERMISSIONS.ROLES_DELETE, name: 'Delete Roles', category: 'Role Management', description: 'Remove custom roles' },

  // ABAC Access Policies
  { code: PERMISSIONS.POLICIES_READ, name: 'View ABAC Policies', category: 'Access Policies', description: 'Inspect facility, department and financial approval limits' },
  { code: PERMISSIONS.POLICIES_MANAGE, name: 'Manage ABAC Policies', category: 'Access Policies', description: 'Configure facility scopes, spending thresholds and document restrictions' },

  // Subscription
  { code: PERMISSIONS.SUBSCRIPTION_READ, name: 'View Subscription', category: 'Billing', description: 'View current plan, limits and usage' },
  { code: PERMISSIONS.SUBSCRIPTION_MANAGE, name: 'Manage Subscription', category: 'Billing', description: 'Upgrade, downgrade or manage billing' },

  // Audit
  { code: PERMISSIONS.AUDIT_READ, name: 'View Audit Logs', category: 'Compliance', description: 'Inspect system and security audit logs' },
  { code: PERMISSIONS.AUDIT_EXPORT, name: 'Export Audit Logs', category: 'Compliance', description: 'Download compliance audit logs' },

  // Inventory & Warehousing
  { code: PERMISSIONS.INVENTORY_READ, name: 'View Inventory', category: 'Inventory', description: 'View stock levels, items and catalogs' },
  { code: PERMISSIONS.INVENTORY_CREATE, name: 'Create Inventory Items', category: 'Inventory', description: 'Add new SKUs and items' },
  { code: PERMISSIONS.INVENTORY_UPDATE, name: 'Update Inventory Items', category: 'Inventory', description: 'Edit item details and reorder points' },
  { code: PERMISSIONS.INVENTORY_DELETE, name: 'Delete Inventory Items', category: 'Inventory', description: 'Archive or remove inventory items' },
  { code: PERMISSIONS.INVENTORY_ADJUST, name: 'Adjust Stock Levels', category: 'Inventory', description: 'Perform manual stock adjustments' },
  { code: PERMISSIONS.INVENTORY_TRANSFER, name: 'Transfer Stock', category: 'Inventory', description: 'Initiate and receive stock transfers' },
  { code: PERMISSIONS.INVENTORY_RECEIVE, name: 'Receive Stock', category: 'Inventory', description: 'Record direct inbound material receipts' },
  { code: PERMISSIONS.INVENTORY_ISSUE, name: 'Issue Stock', category: 'Inventory', description: 'Issue stock for departments or production' },
  { code: PERMISSIONS.INVENTORY_COUNT, name: 'Cycle Counts', category: 'Inventory', description: 'Execute and record physical inventory audits' },
  { code: PERMISSIONS.INVENTORY_EXPORT, name: 'Export Inventory', category: 'Inventory', description: 'Download stock levels, ledgers and movements to CSV/PDF' },
  { code: PERMISSIONS.WAREHOUSE_READ, name: 'View Warehouses', category: 'Inventory', description: 'View warehouse locations and zones' },
  { code: PERMISSIONS.WAREHOUSE_CREATE, name: 'Create Warehouse', category: 'Inventory', description: 'Add new warehouse facilities, zones and bins' },
  { code: PERMISSIONS.WAREHOUSE_UPDATE, name: 'Update Warehouse', category: 'Inventory', description: 'Modify warehouse zones, racks and capacities' },
  { code: PERMISSIONS.WAREHOUSE_DELETE, name: 'Delete Warehouse', category: 'Inventory', description: 'Decommission or remove warehouse facilities' },
  { code: PERMISSIONS.WAREHOUSE_MANAGE, name: 'Manage Warehouses', category: 'Inventory', description: 'Configure warehouses and physical layout hierarchy' },

  // Purchase & Procurement (Phase 3)
  { code: PERMISSIONS.PURCHASE_READ, name: 'View Purchase Orders', category: 'Purchase', description: 'View RFQs, POs, and purchase records' },
  { code: PERMISSIONS.PURCHASE_CREATE, name: 'Create Purchase Orders', category: 'Purchase', description: 'Create RFQs and Purchase Orders' },
  { code: PERMISSIONS.PURCHASE_UPDATE, name: 'Modify Purchase Orders', category: 'Purchase', description: 'Edit pending purchase orders' },
  { code: PERMISSIONS.PURCHASE_APPROVE, name: 'Approve Purchase Orders', category: 'Purchase', description: 'Approve POs within authorization limits' },
  { code: PERMISSIONS.SUPPLIERS_READ, name: 'View Suppliers', category: 'Purchase', description: 'View vendor registry and contacts' },
  { code: PERMISSIONS.SUPPLIERS_MANAGE, name: 'Manage Suppliers', category: 'Purchase', description: 'Create and onboard suppliers' },
  { code: PERMISSIONS.GRN_READ, name: 'View Goods Receipts (GRN)', category: 'Purchase', description: 'Inspect goods received notes' },
  { code: PERMISSIONS.GRN_CREATE, name: 'Create Goods Receipts', category: 'Purchase', description: 'Receive shipment against PO' },

  // Purchase Requisition
  { code: PERMISSIONS.PR_VIEW, name: 'View Purchase Requisitions', category: 'Procurement', description: 'View purchase requisitions across departments' },
  { code: PERMISSIONS.PR_CREATE, name: 'Create Purchase Requisition', category: 'Procurement', description: 'Draft purchase requests for materials or services' },
  { code: PERMISSIONS.PR_EDIT, name: 'Edit Purchase Requisition', category: 'Procurement', description: 'Modify draft purchase requisitions' },
  { code: PERMISSIONS.PR_DELETE, name: 'Delete Purchase Requisition', category: 'Procurement', description: 'Remove draft requisitions' },
  { code: PERMISSIONS.PR_SUBMIT, name: 'Submit Purchase Requisition', category: 'Procurement', description: 'Submit requisition for managerial review' },
  { code: PERMISSIONS.PR_APPROVE, name: 'Approve Purchase Requisition', category: 'Procurement', description: 'Authorize department purchase requisitions' },
  { code: PERMISSIONS.PR_REJECT, name: 'Reject Purchase Requisition', category: 'Procurement', description: 'Decline requisitions with formal justification' },
  { code: PERMISSIONS.PR_EXPORT, name: 'Export Purchase Requisitions', category: 'Procurement', description: 'Export requisitions data to CSV/PDF' },

  // RFQ
  { code: PERMISSIONS.RFQ_VIEW, name: 'View RFQs', category: 'Procurement', description: 'View requests for quotation sent to suppliers' },
  { code: PERMISSIONS.RFQ_CREATE, name: 'Create RFQ', category: 'Procurement', description: 'Generate RFQs from PRs or direct requests' },
  { code: PERMISSIONS.RFQ_EDIT, name: 'Edit RFQ', category: 'Procurement', description: 'Update RFQ specifications and terms' },
  { code: PERMISSIONS.RFQ_DELETE, name: 'Delete RFQ', category: 'Procurement', description: 'Remove draft requests for quotation' },
  { code: PERMISSIONS.RFQ_ISSUE, name: 'Issue RFQ', category: 'Procurement', description: 'Formally dispatch RFQs to selected suppliers' },
  { code: PERMISSIONS.RFQ_CLOSE, name: 'Close RFQ', category: 'Procurement', description: 'Close bidding window for quotations' },
  { code: PERMISSIONS.RFQ_EXPORT, name: 'Export RFQs', category: 'Procurement', description: 'Export RFQ details' },

  // Supplier Quotes
  { code: PERMISSIONS.QUOTE_VIEW, name: 'View Supplier Quotes', category: 'Procurement', description: 'View received vendor quotations' },
  { code: PERMISSIONS.QUOTE_CREATE, name: 'Create Supplier Quote', category: 'Procurement', description: 'Record vendor bids and proposals' },
  { code: PERMISSIONS.QUOTE_EDIT, name: 'Edit Supplier Quote', category: 'Procurement', description: 'Modify quotation details prior to review' },
  { code: PERMISSIONS.QUOTE_FINALIZE, name: 'Finalize / Select Quote', category: 'Procurement', description: 'Formally award bid to winning supplier quote' },
  { code: PERMISSIONS.QUOTE_REJECT, name: 'Reject Supplier Quote', category: 'Procurement', description: 'Decline quotation with comments' },
  { code: PERMISSIONS.QUOTE_EXPORT, name: 'Export Supplier Quotes', category: 'Procurement', description: 'Export quotes and price comparisons' },

  // Purchase Orders
  { code: PERMISSIONS.PO_VIEW, name: 'View Purchase Orders', category: 'Procurement', description: 'View formal POs and fulfillment status' },
  { code: PERMISSIONS.PO_CREATE, name: 'Create Purchase Order', category: 'Procurement', description: 'Generate PO from finalized quote or direct' },
  { code: PERMISSIONS.PO_EDIT, name: 'Edit Purchase Order', category: 'Procurement', description: 'Modify draft purchase orders' },
  { code: PERMISSIONS.PO_DELETE, name: 'Delete Purchase Order', category: 'Procurement', description: 'Remove draft purchase orders' },
  { code: PERMISSIONS.PO_SUBMIT, name: 'Submit Purchase Order', category: 'Procurement', description: 'Submit PO for financial approval' },
  { code: PERMISSIONS.PO_APPROVE, name: 'Approve Purchase Order', category: 'Procurement', description: 'Approve PO within financial limit' },
  { code: PERMISSIONS.PO_REJECT, name: 'Reject Purchase Order', category: 'Procurement', description: 'Reject PO with audit feedback' },
  { code: PERMISSIONS.PO_SEND, name: 'Send PO to Vendor', category: 'Procurement', description: 'Dispatch approved PO to supplier' },
  { code: PERMISSIONS.PO_CANCEL, name: 'Cancel Purchase Order', category: 'Procurement', description: 'Void or cancel purchase order' },
  { code: PERMISSIONS.PO_EXPORT, name: 'Export Purchase Orders', category: 'Procurement', description: 'Export POs' },

  // Goods Receipt Note (GRN)
  { code: PERMISSIONS.GRN_VIEW, name: 'View GRNs', category: 'Warehousing', description: 'Inspect inbound goods receipt notes' },
  { code: PERMISSIONS.GRN_EDIT, name: 'Edit GRN', category: 'Warehousing', description: 'Modify draft goods receipt records' },
  { code: PERMISSIONS.GRN_RECEIVE, name: 'Receive Inbound Stock', category: 'Warehousing', description: 'Record physical arrival at receiving dock' },
  { code: PERMISSIONS.GRN_COMPLETE, name: 'Complete GRN', category: 'Warehousing', description: 'Finalize receipt reconciliation' },
  { code: PERMISSIONS.GRN_CANCEL, name: 'Cancel GRN', category: 'Warehousing', description: 'Void draft or unverified GRN' },
  { code: PERMISSIONS.GRN_EXPORT, name: 'Export Goods Receipts', category: 'Warehousing', description: 'Export GRN records to CSV' },

  // Purchase QC
  { code: PERMISSIONS.PURCHASE_QC_VIEW, name: 'View Purchase QC', category: 'Quality Control', description: 'Access inbound inspection queue' },
  { code: PERMISSIONS.PURCHASE_QC_CREATE, name: 'Create QC Inspection', category: 'Quality Control', description: 'Initiate inspection worksheet for GRN' },
  { code: PERMISSIONS.PURCHASE_QC_EDIT, name: 'Edit Purchase QC', category: 'Quality Control', description: 'Modify inspection worksheets before final signoff' },
  { code: PERMISSIONS.PURCHASE_QC_INSPECT, name: 'Perform QC Testing', category: 'Quality Control', description: 'Execute quality checklist tests' },
  { code: PERMISSIONS.PURCHASE_QC_APPROVE, name: 'Approve QC Disposition', category: 'Quality Control', description: 'Authorize batch acceptance into available stock' },
  { code: PERMISSIONS.PURCHASE_QC_REJECT, name: 'Reject QC Disposition', category: 'Quality Control', description: 'Mark non-conforming batch as rejected' },
  { code: PERMISSIONS.PURCHASE_QC_HOLD, name: 'Hold QC Batch', category: 'Quality Control', description: 'Quarantine batch pending investigation' },
  { code: PERMISSIONS.PURCHASE_QC_DISPOSITION, name: 'Authorize Final Disposition', category: 'Quality Control', description: 'Sign off conditional acceptance or rework' },
  { code: PERMISSIONS.PURCHASE_QC_EXPORT, name: 'Export Purchase QC', category: 'Quality Control', description: 'Download inbound QC inspection reports' },

  // Sales
  { code: PERMISSIONS.SALES_READ, name: 'View Sales Orders', category: 'Sales', description: 'View customer quotes and sales orders' },
  { code: PERMISSIONS.SALES_CREATE, name: 'Create Sales Orders', category: 'Sales', description: 'Generate customer quotes and sales orders' },
  { code: PERMISSIONS.SALES_UPDATE, name: 'Modify Sales Orders', category: 'Sales', description: 'Edit active sales orders' },
  { code: PERMISSIONS.SALES_APPROVE, name: 'Approve Sales Orders', category: 'Sales', description: 'Authorize sales orders within approval limit' },
  { code: PERMISSIONS.CUSTOMERS_READ, name: 'View Customers', category: 'Sales', description: 'Access customer directory' },
  { code: PERMISSIONS.CUSTOMERS_MANAGE, name: 'Manage Customers', category: 'Sales', description: 'Create and update customer profiles' },
  { code: PERMISSIONS.DISPATCH_MANAGE, name: 'Manage Dispatch', category: 'Sales', description: 'Create picklists, pack and dispatch orders' },
  { code: PERMISSIONS.INVOICES_READ, name: 'View Invoices', category: 'Sales', description: 'View sales invoices and payments' },
  { code: PERMISSIONS.INVOICES_CREATE, name: 'Generate Invoices', category: 'Sales', description: 'Issue invoices and record receipts' },
  { code: PERMISSIONS.PAYMENTS_READ, name: 'View Payments', category: 'Sales', description: 'View customer payment history' },
  { code: PERMISSIONS.PAYMENTS_CREATE, name: 'Record Payments', category: 'Sales', description: 'Record collections against customer invoices' },
  { code: PERMISSIONS.GATEPASS_READ, name: 'View Gate Passes', category: 'Sales', description: 'View vehicle and package gate passes' },
  { code: PERMISSIONS.GATEPASS_MANAGE, name: 'Manage Gate Passes', category: 'Sales', description: 'Authorize and execute gate-out events' },

  // Granular Sales Order
  { code: PERMISSIONS.SO_VIEW, name: 'View Sales Order', category: 'Sales', description: 'View sales order details' },
  { code: PERMISSIONS.SO_CREATE, name: 'Create Sales Order', category: 'Sales', description: 'Create draft sales orders' },
  { code: PERMISSIONS.SO_EDIT, name: 'Edit Sales Order', category: 'Sales', description: 'Edit draft and submitted sales orders' },
  { code: PERMISSIONS.SO_DELETE, name: 'Delete Sales Order', category: 'Sales', description: 'Remove draft sales orders' },
  { code: PERMISSIONS.SO_SUBMIT, name: 'Submit Sales Order', category: 'Sales', description: 'Submit order for approval' },
  { code: PERMISSIONS.SO_APPROVE, name: 'Approve Sales Order', category: 'Sales', description: 'Sign off sales order approval' },
  { code: PERMISSIONS.SO_REJECT, name: 'Reject Sales Order', category: 'Sales', description: 'Reject sales order with reason' },
  { code: PERMISSIONS.SO_CONFIRM, name: 'Confirm Sales Order', category: 'Sales', description: 'Confirm order and reserve inventory' },
  { code: PERMISSIONS.SO_CANCEL, name: 'Cancel Sales Order', category: 'Sales', description: 'Cancel sales order and release stock' },
  { code: PERMISSIONS.SO_ALLOCATE, name: 'Allocate Inventory', category: 'Sales', description: 'Allocate stock for sales orders' },
  { code: PERMISSIONS.SO_EXPORT, name: 'Export Sales Orders', category: 'Sales', description: 'Export sales order data' },

  // Packaging
  { code: PERMISSIONS.PKG_VIEW, name: 'View Packages', category: 'Packaging', description: 'View packaging workstation records' },
  { code: PERMISSIONS.PKG_CREATE, name: 'Create Package', category: 'Packaging', description: 'Create package against sales order' },
  { code: PERMISSIONS.PKG_EDIT, name: 'Edit Package', category: 'Packaging', description: 'Modify draft packaging details' },
  { code: PERMISSIONS.PKG_PACK, name: 'Pack Order', category: 'Packaging', description: 'Finalize packaging with lot/serial' },
  { code: PERMISSIONS.PKG_CANCEL, name: 'Cancel Package', category: 'Packaging', description: 'Cancel packaging record' },
  { code: PERMISSIONS.PKG_EXPORT, name: 'Export Packaging Data', category: 'Packaging', description: 'Export packing logs' },

  // Dispatch
  { code: PERMISSIONS.DISPATCH_VIEW, name: 'View Dispatches', category: 'Dispatch', description: 'View shipping dispatches' },
  { code: PERMISSIONS.DISPATCH_CREATE, name: 'Create Dispatch', category: 'Dispatch', description: 'Prepare dispatch from packed packages' },
  { code: PERMISSIONS.DISPATCH_EDIT, name: 'Edit Dispatch', category: 'Dispatch', description: 'Modify draft shipping dispatch details' },
  { code: PERMISSIONS.DISPATCH_DISPATCH, name: 'Dispatch Shipment', category: 'Dispatch', description: 'Confirm shipment and issue stock' },
  { code: PERMISSIONS.DISPATCH_CANCEL, name: 'Cancel Dispatch', category: 'Dispatch', description: 'Cancel shipment record' },
  { code: PERMISSIONS.DISPATCH_EXPORT, name: 'Export Dispatch Records', category: 'Dispatch', description: 'Export outbound shipment records' },

  // Gate Pass
  { code: PERMISSIONS.GATEPASS_VIEW, name: 'View Gate Pass', category: 'Security', description: 'View security gate passes' },
  { code: PERMISSIONS.GATEPASS_CREATE, name: 'Create Gate Pass', category: 'Security', description: 'Generate gate pass for dispatch' },
  { code: PERMISSIONS.GATEPASS_EDIT, name: 'Edit Gate Pass', category: 'Security', description: 'Update gate pass vehicle or driver info' },
  { code: PERMISSIONS.GATEPASS_APPROVE, name: 'Approve Gate Pass', category: 'Security', description: 'Authorize gate clearance' },
  { code: PERMISSIONS.GATEPASS_GATEOUT, name: 'Execute Gate Out', category: 'Security', description: 'Log physical vehicle gate out' },
  { code: PERMISSIONS.GATEPASS_CLOSE, name: 'Close Gate Pass', category: 'Security', description: 'Complete gate clearance' },
  { code: PERMISSIONS.GATEPASS_EXPORT, name: 'Export Gate Passes', category: 'Security', description: 'Download security gate pass logs' },

  // Invoices & Payments
  { code: PERMISSIONS.INVOICE_VIEW, name: 'View Customer Invoice', category: 'Billing', description: 'View invoice details and balances' },
  { code: PERMISSIONS.INVOICE_CREATE, name: 'Create Customer Invoice', category: 'Billing', description: 'Generate invoice for dispatch' },
  { code: PERMISSIONS.INVOICE_EDIT, name: 'Edit Invoice', category: 'Billing', description: 'Update draft invoice line items and pricing' },
  { code: PERMISSIONS.INVOICE_ISSUE, name: 'Issue Invoice', category: 'Billing', description: 'Post invoice to customer account' },
  { code: PERMISSIONS.INVOICE_CANCEL, name: 'Cancel Invoice', category: 'Billing', description: 'Void customer invoice' },
  { code: PERMISSIONS.INVOICE_EXPORT, name: 'Export Invoices', category: 'Billing', description: 'Export invoice data' },
  { code: PERMISSIONS.PAYMENT_VIEW, name: 'View Payments', category: 'Billing', description: 'Inspect payment collections' },
  { code: PERMISSIONS.PAYMENT_CREATE, name: 'Record Payment', category: 'Billing', description: 'Apply payment against invoice' },
  { code: PERMISSIONS.PAYMENT_EDIT, name: 'Edit Payment Record', category: 'Billing', description: 'Modify payment collection reference or notes' },
  { code: PERMISSIONS.PAYMENT_REVERSE, name: 'Reverse Payment', category: 'Billing', description: 'Reverse incorrect payment' },
  { code: PERMISSIONS.PAYMENT_EXPORT, name: 'Export Payments', category: 'Billing', description: 'Export collections data' },

  // Production
  { code: PERMISSIONS.PRODUCTION_READ, name: 'View Production', category: 'Production', description: 'View production work orders' },
  { code: PERMISSIONS.PRODUCTION_CREATE, name: 'Create Work Orders', category: 'Production', description: 'Schedule new manufacturing jobs' },
  { code: PERMISSIONS.PRODUCTION_UPDATE, name: 'Update Work Orders', category: 'Production', description: 'Log progress and consumption' },
  { code: PERMISSIONS.BOM_READ, name: 'View BOM', category: 'Production', description: 'Inspect Bill of Materials' },
  { code: PERMISSIONS.BOM_MANAGE, name: 'Manage BOM', category: 'Production', description: 'Create and edit Bill of Materials' },
  { code: PERMISSIONS.BATCH_MANAGE, name: 'Manage Batches', category: 'Production', description: 'Create, split, and track manufacturing batches' },

  // Granular Production Orders
  { code: PERMISSIONS.PROD_VIEW, name: 'View Production Orders', category: 'Production', description: 'View work orders and execution logs' },
  { code: PERMISSIONS.PROD_CREATE, name: 'Create Production Order', category: 'Production', description: 'Create work orders against BOM' },
  { code: PERMISSIONS.PROD_EDIT, name: 'Edit Production Order', category: 'Production', description: 'Modify planned quantities and dates' },
  { code: PERMISSIONS.PROD_DELETE, name: 'Delete Production Order', category: 'Production', description: 'Remove draft production orders' },
  { code: PERMISSIONS.PROD_SUBMIT, name: 'Submit Production Order', category: 'Production', description: 'Submit order for approval' },
  { code: PERMISSIONS.PROD_APPROVE, name: 'Approve Production Order', category: 'Production', description: 'Authorize production order' },
  { code: PERMISSIONS.PROD_RELEASE, name: 'Release Production Order', category: 'Production', description: 'Release order and reserve materials' },
  { code: PERMISSIONS.PROD_START, name: 'Start Production', category: 'Production', description: 'Begin manufacturing run' },
  { code: PERMISSIONS.PROD_PAUSE, name: 'Pause Production', category: 'Production', description: 'Temporarily halt manufacturing run' },
  { code: PERMISSIONS.PROD_RESUME, name: 'Resume Production', category: 'Production', description: 'Continue paused manufacturing run' },
  { code: PERMISSIONS.PROD_COMPLETE, name: 'Complete Production', category: 'Production', description: 'Finalize output and scrap quantities' },
  { code: PERMISSIONS.PROD_CANCEL, name: 'Cancel Production Order', category: 'Production', description: 'Void or cancel work order' },
  { code: PERMISSIONS.PROD_CONSUME, name: 'Consume Production Material', category: 'Production', description: 'Issue raw materials from stock' },
  { code: PERMISSIONS.PROD_RECEIVE, name: 'Receive Finished Goods', category: 'Production', description: 'Post accepted finished goods into inventory' },
  { code: PERMISSIONS.PROD_EXPORT, name: 'Export Production Data', category: 'Production', description: 'Export production logs' },

  // Granular BOM
  { code: PERMISSIONS.BOM_VIEW, name: 'View BOM', category: 'BOM', description: 'View Bill of Materials versions' },
  { code: PERMISSIONS.BOM_CREATE, name: 'Create BOM', category: 'BOM', description: 'Create new Bill of Materials recipe' },
  { code: PERMISSIONS.BOM_EDIT, name: 'Edit BOM', category: 'BOM', description: 'Edit draft Bill of Materials' },
  { code: PERMISSIONS.BOM_DELETE, name: 'Delete BOM', category: 'BOM', description: 'Remove draft Bill of Materials recipe' },
  { code: PERMISSIONS.BOM_APPROVE, name: 'Approve BOM', category: 'BOM', description: 'Review and approve BOM specifications' },
  { code: PERMISSIONS.BOM_ACTIVATE, name: 'Activate BOM', category: 'BOM', description: 'Set BOM as active version for manufacturing' },
  { code: PERMISSIONS.BOM_ARCHIVE, name: 'Archive BOM', category: 'BOM', description: 'Deprecate or archive old BOM versions' },
  { code: PERMISSIONS.BOM_EXPORT, name: 'Export BOM', category: 'BOM', description: 'Export Bill of Materials structure to CSV' },

  // Granular Production QC
  { code: PERMISSIONS.PROD_QC_VIEW, name: 'View Production QC', category: 'Quality Control', description: 'Inspect production QC records' },
  { code: PERMISSIONS.PROD_QC_CREATE, name: 'Create Production QC', category: 'Quality Control', description: 'Initiate inspection for finished goods batch' },
  { code: PERMISSIONS.PROD_QC_EDIT, name: 'Edit Production QC', category: 'Quality Control', description: 'Update production inspection parameters' },
  { code: PERMISSIONS.PROD_QC_INSPECT, name: 'Execute Production QC', category: 'Quality Control', description: 'Record parameter checklist results' },
  { code: PERMISSIONS.PROD_QC_APPROVE, name: 'Approve Production QC', category: 'Quality Control', description: 'Sign off batch acceptance' },
  { code: PERMISSIONS.PROD_QC_REJECT, name: 'Reject Production QC', category: 'Quality Control', description: 'Reject batch or mark for scrap' },
  { code: PERMISSIONS.PROD_QC_HOLD, name: 'Hold Production QC', category: 'Quality Control', description: 'Quarantine finished goods pending review' },
  { code: PERMISSIONS.PROD_QC_REWORK, name: 'Authorize Rework', category: 'Quality Control', description: 'Route rejected batch for rework order' },
  { code: PERMISSIONS.PROD_QC_SCRAP, name: 'Authorize Scrap', category: 'Quality Control', description: 'Scrap defective production batch' },
  { code: PERMISSIONS.PROD_QC_EXPORT, name: 'Export Production QC', category: 'Quality Control', description: 'Export batch QC inspection certificates' },

  // QC
  { code: PERMISSIONS.QC_READ, name: 'View QC Inspections', category: 'Quality Control', description: 'Inspect quality logs and reports' },
  { code: PERMISSIONS.QC_CREATE, name: 'Create QC Record', category: 'Quality Control', description: 'Create inspection record or checklist' },
  { code: PERMISSIONS.QC_EDIT, name: 'Edit QC Record', category: 'Quality Control', description: 'Modify QC inspection parameters' },
  { code: PERMISSIONS.QC_DELETE, name: 'Delete QC Record', category: 'Quality Control', description: 'Remove draft QC inspection' },
  { code: PERMISSIONS.QC_INSPECT, name: 'Perform Inspection', category: 'Quality Control', description: 'Execute inbound and in-line inspections' },
  { code: PERMISSIONS.QC_TEMPLATES, name: 'Manage QC Templates', category: 'Quality Control', description: 'Configure checklist test criteria' },
  { code: PERMISSIONS.QC_APPROVE, name: 'Sign-off QC Approval', category: 'Quality Control', description: 'Release or quarantine inspected batches' },
  { code: PERMISSIONS.QC_REJECT, name: 'Reject QC Inspection', category: 'Quality Control', description: 'Flag item/batch as failed quality testing' },
  { code: PERMISSIONS.QC_EXPORT, name: 'Export QC Records', category: 'Quality Control', description: 'Download comprehensive QC records and audit sheets' },

  // Reports
  { code: PERMISSIONS.REPORTS_READ, name: 'View Reports', category: 'Reporting', description: 'Access cross-functional reports' },
  { code: PERMISSIONS.REPORTS_EXPORT, name: 'Export Reports', category: 'Reporting', description: 'Download CSV and PDF reports' },
  { code: PERMISSIONS.REPORTS_INVENTORY_VIEW, name: 'View Inventory Reports', category: 'Reporting', description: 'Stock ledger and valuation reports' },
  { code: PERMISSIONS.REPORTS_PROCUREMENT_VIEW, name: 'View Procurement Reports', category: 'Reporting', description: 'PO and vendor fulfillment reports' },
  { code: PERMISSIONS.REPORTS_SALES_VIEW, name: 'View Sales Reports', category: 'Reporting', description: 'Sales and receivables reports' },
  { code: PERMISSIONS.REPORTS_PRODUCTION_VIEW, name: 'View Production Reports', category: 'Reporting', description: 'Yield, scrap, and material variance reports' },
  { code: PERMISSIONS.REPORTS_QC_VIEW, name: 'View QC Reports', category: 'Reporting', description: 'Quality inspection and defect reports' },
  { code: PERMISSIONS.REPORTS_FINANCIAL_VIEW, name: 'View Financial Reports', category: 'Reporting', description: 'Costing and valuation summaries' },

  // Analytics
  { code: PERMISSIONS.ANALYTICS_VIEW, name: 'View Analytics', category: 'Analytics', description: 'Access operational analytics dashboards' },
  { code: PERMISSIONS.ANALYTICS_EXPORT, name: 'Export Analytics', category: 'Analytics', description: 'Export analytics summaries' },

  // AI Readiness
  { code: PERMISSIONS.AI_ACCESS, name: 'Access AI Intelligence', category: 'AI', description: 'Access AI-assisted operational insights' },
  { code: PERMISSIONS.AI_INSIGHTS, name: 'View AI Insights', category: 'AI', description: 'View predictive inventory and risk insights' },
];
