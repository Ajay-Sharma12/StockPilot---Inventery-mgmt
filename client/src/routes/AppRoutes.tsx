import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { ProtectedRoute } from './ProtectedRoute';

// Auth & Dashboard Pages
import { Login } from '../pages/auth/Login';
import { RegisterTenant } from '../pages/auth/RegisterTenant';
import { ForgotPassword } from '../pages/auth/ForgotPassword';
import { ResetPassword } from '../pages/auth/ResetPassword';
import { DynamicDashboard } from '../pages/dashboard/DynamicDashboard';
import { UserManagementPage } from '../pages/users/UserManagementPage';
import { RolePermissionPage } from '../pages/roles/RolePermissionPage';
import { TenantSettingsPage } from '../pages/tenant/TenantSettingsPage';
import { SubscriptionPage } from '../pages/subscription/SubscriptionPage';
import { AuditPage } from '../pages/audit/AuditPage';
import { PlatformTenantsPage } from '../pages/platform/PlatformTenantsPage';

// Phase 2 Inventory Pages
import { InventoryOverviewPage } from '../pages/inventory/InventoryOverviewPage';
import { ItemMasterPage } from '../pages/inventory/ItemMasterPage';
import { StockBalancesPage } from '../pages/inventory/StockBalancesPage';
import { InventoryLedgerPage } from '../pages/inventory/InventoryLedgerPage';
import { StockTransfersPage } from '../pages/inventory/StockTransfersPage';
import { StockAdjustmentsPage } from '../pages/inventory/StockAdjustmentsPage';
import { WastagePage } from '../pages/inventory/WastagePage';
import { CycleCountsPage } from '../pages/inventory/CycleCountsPage';
import { WarehouseHierarchyPage } from '../pages/inventory/WarehouseHierarchyPage';
import { MasterDataPage } from '../pages/inventory/MasterDataPage';

// Phase 3 Procurement Pages
import { ProcurementOverviewPage } from '../pages/purchase/ProcurementOverviewPage';
import { PurchaseRequisitionsPage } from '../pages/purchase/PurchaseRequisitionsPage';
import { RFQsPage } from '../pages/purchase/RFQsPage';
import { SupplierQuotesPage } from '../pages/purchase/SupplierQuotesPage';
import { QuoteComparisonPage } from '../pages/purchase/QuoteComparisonPage';
import { PurchaseOrdersPage } from '../pages/purchase/PurchaseOrdersPage';
import { IncomingPurchasesPage } from '../pages/purchase/IncomingPurchasesPage';
import { GoodsReceiptsPage } from '../pages/purchase/GoodsReceiptsPage';
import { PurchaseQCPage } from '../pages/purchase/PurchaseQCPage';
import { SupplierManagementPage } from '../pages/purchase/SupplierManagementPage';

// Phase 4 Sales & Order-to-Cash Pages
import { QuotationsPage } from '../pages/sales/QuotationsPage';
import { SalesOverviewPage } from '../pages/sales/SalesOverviewPage';
import { SalesOrdersPage } from '../pages/sales/SalesOrdersPage';
import { PackagingPage } from '../pages/sales/PackagingPage';
import { DispatchPage } from '../pages/sales/DispatchPage';
import { GatePassPage } from '../pages/sales/GatePassPage';
import { InvoicesPage } from '../pages/sales/InvoicesPage';
import { PaymentsPage } from '../pages/sales/PaymentsPage';
import { PublicQuotationReviewPage } from '../pages/sales/PublicQuotationReviewPage';

// Phase 5 Production, Quality Control, Reports, Analytics & AI Pages
import { ProductionOverviewPage } from '../pages/production/ProductionOverviewPage';
import { BOMListPage } from '../pages/production/BOMListPage';
import { ProductionPlanningPage } from '../pages/production/ProductionPlanningPage';
import { ProductionOrdersPage } from '../pages/production/ProductionOrdersPage';
import { MaterialConsumptionPage } from '../pages/production/MaterialConsumptionPage';
import { ProductionBatchesPage } from '../pages/production/ProductionBatchesPage';
import { ProductionQCPage } from '../pages/production/ProductionQCPage';
import { ProductionTraceabilityPage } from '../pages/production/ProductionTraceabilityPage';
import { ProductionOutputPage } from '../pages/production/ProductionOutputPage';
import { ReportsCenterPage } from '../pages/reports/ReportsCenterPage';
import { AnalyticsDashboardPage } from '../pages/analytics/AnalyticsDashboardPage';
import { AIInsightsPage } from '../pages/ai/AIInsightsPage';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

export const AppRoutes: React.FC = () => {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Public Authentication Screens */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<RegisterTenant />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/portal/quotation/:id" element={<PublicQuotationReviewPage />} />

      {/* Universal Single-Application Protected Shell */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DynamicDashboard />} />

        {/* Phase 2: Centralized Inventory & Master Data Modules */}
        <Route
          path="inventory"
          element={
            <ProtectedRoute requiredPermission="inventory:read">
              <InventoryOverviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/items"
          element={
            <ProtectedRoute requiredPermission="inventory:read">
              <ItemMasterPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/balances"
          element={
            <ProtectedRoute requiredPermission="inventory:read">
              <StockBalancesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/ledger"
          element={
            <ProtectedRoute requiredPermission="inventory:read">
              <InventoryLedgerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/transfers"
          element={
            <ProtectedRoute requiredPermission="inventory:transfer">
              <StockTransfersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/adjustments"
          element={
            <ProtectedRoute requiredPermission="inventory:adjust">
              <StockAdjustmentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/wastage"
          element={
            <ProtectedRoute requiredPermission="inventory:adjust">
              <WastagePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/counts"
          element={
            <ProtectedRoute requiredPermission="inventory:count">
              <CycleCountsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/warehouses"
          element={
            <ProtectedRoute requiredPermission="warehouses:read">
              <WarehouseHierarchyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/master-data"
          element={
            <ProtectedRoute requiredPermission="inventory:read">
              <MasterDataPage />
            </ProtectedRoute>
          }
        />

        {/* Phase 3: Centralized Procurement & Purchase Module */}
        <Route
          path="purchase"
          element={
            <ProtectedRoute requiredPermission="purchase:read">
              <ProcurementOverviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="purchase/requisitions"
          element={
            <ProtectedRoute requiredPermission="purchase:read">
              <PurchaseRequisitionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="purchase/rfqs"
          element={
            <ProtectedRoute requiredPermission="purchase:read">
              <RFQsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="purchase/quotes"
          element={
            <ProtectedRoute requiredPermission="purchase:read">
              <SupplierQuotesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="purchase/quotes/compare/:rfqId"
          element={
            <ProtectedRoute requiredPermission="purchase:read">
              <QuoteComparisonPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="purchase/orders"
          element={
            <ProtectedRoute requiredPermission="purchase:read">
              <PurchaseOrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="purchase/incoming"
          element={
            <ProtectedRoute requiredPermission="purchase:read">
              <IncomingPurchasesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="purchase/grns"
          element={
            <ProtectedRoute requiredPermission="grn:read">
              <GoodsReceiptsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="purchase/qc"
          element={
            <ProtectedRoute requiredPermission="qc:read">
              <PurchaseQCPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="purchase/suppliers"
          element={
            <ProtectedRoute requiredPermission="purchase:read">
              <SupplierManagementPage />
            </ProtectedRoute>
          }
        />

        {/* Phase 4: Sales & Order-to-Cash Module */}
        <Route
          path="sales"
          element={
            <ProtectedRoute requiredPermission="sales:read">
              <SalesOverviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="sales/overview"
          element={
            <ProtectedRoute requiredPermission="sales:read">
              <SalesOverviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="sales/quotations"
          element={
            <ProtectedRoute requiredPermission="sales:read">
              <QuotationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="sales/orders"
          element={
            <ProtectedRoute requiredPermission="sales:read">
              <SalesOrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="sales/packaging"
          element={
            <ProtectedRoute requiredPermission="sales:read">
              <PackagingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="sales/dispatches"
          element={
            <ProtectedRoute requiredPermission="sales:read">
              <DispatchPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="sales/gate-passes"
          element={
            <ProtectedRoute requiredPermission="sales:read">
              <GatePassPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="sales/invoices"
          element={
            <ProtectedRoute requiredPermission="sales:read">
              <InvoicesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="sales/payments"
          element={
            <ProtectedRoute requiredPermission="sales:read">
              <PaymentsPage />
            </ProtectedRoute>
          }
        />
        {/* Phase 5: Production & Manufacturing Modules */}
        <Route
          path="production"
          element={
            <ProtectedRoute requiredPermission="production:read">
              <ProductionOverviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="production/boms"
          element={
            <ProtectedRoute requiredPermission="bom:read">
              <BOMListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="production/planning"
          element={
            <ProtectedRoute requiredPermission="production:read">
              <ProductionPlanningPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="production/orders"
          element={
            <ProtectedRoute requiredPermission="production:read">
              <ProductionOrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="production/materials"
          element={
            <ProtectedRoute requiredPermission="production:read">
              <MaterialConsumptionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="production/batches"
          element={
            <ProtectedRoute requiredPermission="batch:manage">
              <ProductionBatchesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="production/qc"
          element={
            <ProtectedRoute requiredPermission="qc:read">
              <ProductionQCPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="qc"
          element={
            <ProtectedRoute requiredPermission="qc:read">
              <ProductionQCPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="production/traceability"
          element={
            <ProtectedRoute requiredPermission="production:read">
              <ProductionTraceabilityPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="production/outputs"
          element={
            <ProtectedRoute requiredPermission="production:read">
              <ProductionOutputPage />
            </ProtectedRoute>
          }
        />

        {/* Phase 5: Centralized Reporting & Operational Analytics */}
        <Route
          path="reports"
          element={
            <ProtectedRoute requiredPermission="reports:read">
              <ReportsCenterPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="analytics"
          element={
            <ProtectedRoute requiredPermission="analytics.view">
              <AnalyticsDashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Phase 5: AI Operational Intelligence & Copilot */}
        <Route
          path="ai-insights"
          element={
            <ProtectedRoute requiredPermission="ai.insights">
              <AIInsightsPage />
            </ProtectedRoute>
          }
        />

        {/* Administration Modules */}
        <Route
          path="users"
          element={
            <ProtectedRoute requiredPermission="users:read">
              <UserManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="roles"
          element={
            <ProtectedRoute requiredPermission="roles:read">
              <RolePermissionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="organization"
          element={
            <ProtectedRoute requiredPermission="tenant:read">
              <TenantSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="subscription"
          element={
            <ProtectedRoute requiredPermission="subscription:read">
              <SubscriptionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="audit"
          element={
            <ProtectedRoute requiredPermission="audit:read">
              <AuditPage />
            </ProtectedRoute>
          }
        />

        {/* Platform Operator Section */}
        <Route
          path="platform/tenants"
          element={
            <ProtectedRoute superAdminOnly>
              <PlatformTenantsPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </ErrorBoundary>
  );
};
