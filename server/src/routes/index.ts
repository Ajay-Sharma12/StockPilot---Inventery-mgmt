import { Router } from 'express';
import { authRoutes } from './auth.routes';
import { tenantRoutes } from './tenant.routes';
import { userRoutes } from './user.routes';
import { roleRoutes } from './role.routes';
import { entitlementRoutes } from './entitlement.routes';
import { auditRoutes } from './audit.routes';
import { systemRoutes } from './system.routes';

// Phase 2 Inventory & Master Data Routes
import { masterDataRoutes } from './masterData.routes';
import { warehouseRoutes } from './warehouse.routes';
import { itemRoutes } from './item.routes';
import { inventoryRoutes } from './inventory.routes';
import { stockTransferRoutes } from './stockTransfer.routes';
import { stockAdjustmentRoutes } from './stockAdjustment.routes';
import { wastageRoutes } from './wastage.routes';
import { stockCountRoutes } from './stockCount.routes';

// Phase 3 Procurement & Purchase Management Routes
import { purchaseRequisitionRoutes } from '../modules/procurement/routes/purchaseRequisition.routes';
import { rfqRoutes } from '../modules/procurement/routes/rfq.routes';
import { supplierQuoteRoutes } from '../modules/procurement/routes/supplierQuote.routes';
import { purchaseOrderRoutes } from '../modules/procurement/routes/purchaseOrder.routes';
import { grnRoutes } from '../modules/procurement/routes/grn.routes';
import { purchaseQCRoutes } from '../modules/procurement/routes/purchaseQc.routes';
import { procurementRoutes } from '../modules/procurement/routes/procurement.routes';

// Phase 4 Sales & Order-to-Cash Routes
import { quotationRoutes } from '../modules/sales/routes/quotation.routes';
import { salesOrderRoutes } from '../modules/sales/routes/salesOrder.routes';
import { packagingRoutes } from '../modules/sales/routes/packaging.routes';
import { dispatchRoutes } from '../modules/sales/routes/dispatch.routes';
import { gatePassRoutes } from '../modules/sales/routes/gatePass.routes';
import { invoiceRoutes } from '../modules/sales/routes/invoice.routes';
import { paymentRoutes } from '../modules/sales/routes/payment.routes';
import { salesRoutes } from '../modules/sales/routes/sales.routes';

// Phase 5 Production & Manufacturing Routes
import { bomRoutes } from '../modules/production/routes/bom.routes';
import { productionOrderRoutes } from '../modules/production/routes/productionOrder.routes';
import { productionPlanningRoutes } from '../modules/production/routes/productionPlanning.routes';
import { productionMaterialRoutes } from '../modules/production/routes/productionMaterial.routes';
import { productionQcRoutes } from '../modules/production/routes/productionQc.routes';
import { productionBatchRoutes } from '../modules/production/routes/productionBatch.routes';
import { productionTraceabilityRoutes } from '../modules/production/routes/productionTraceability.routes';
import { productionOutputRoutes } from '../modules/production/routes/productionOutput.routes';
import { productionRoutes } from '../modules/production/routes/production.routes';

// Phase 5 Reporting & Analytics Routes
import { reportRoutes } from '../modules/reporting/routes/report.routes';
import { analyticsRoutes } from '../modules/analytics/routes/analytics.routes';

// Phase 5 AI Readiness Routes
import { aiRoutes } from '../modules/ai/routes/ai.routes';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/tenants', tenantRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/roles', roleRoutes);
apiRouter.use('/entitlements', entitlementRoutes);
apiRouter.use('/audit', auditRoutes);
apiRouter.use('/system', systemRoutes);

// Phase 2 Modules
apiRouter.use('/master-data', masterDataRoutes);
apiRouter.use('/warehouses', warehouseRoutes);
apiRouter.use('/items', itemRoutes);
apiRouter.use('/inventory', inventoryRoutes);
apiRouter.use('/stock-transfers', stockTransferRoutes);
apiRouter.use('/stock-adjustments', stockAdjustmentRoutes);
apiRouter.use('/wastage', wastageRoutes);
apiRouter.use('/stock-counts', stockCountRoutes);

// Phase 3 Procurement Modules
apiRouter.use('/purchase-requisitions', purchaseRequisitionRoutes);
apiRouter.use('/rfqs', rfqRoutes);
apiRouter.use('/supplier-quotes', supplierQuoteRoutes);
apiRouter.use('/purchase-orders', purchaseOrderRoutes);
apiRouter.use('/grns', grnRoutes);
apiRouter.use('/purchase-qc', purchaseQCRoutes);
apiRouter.use('/procurement', procurementRoutes);

// Phase 4 Sales & Order-to-Cash Modules
apiRouter.use('/sales-quotations', quotationRoutes);
apiRouter.use('/sales-orders', salesOrderRoutes);
apiRouter.use('/packaging', packagingRoutes);
apiRouter.use('/dispatches', dispatchRoutes);
apiRouter.use('/gate-passes', gatePassRoutes);
apiRouter.use('/invoices', invoiceRoutes);
apiRouter.use('/payments', paymentRoutes);
apiRouter.use('/sales', salesRoutes);

// Phase 5 Production & Manufacturing Modules
apiRouter.use('/boms', bomRoutes);
apiRouter.use('/production/boms', bomRoutes);
apiRouter.use('/production-orders', productionOrderRoutes);
apiRouter.use('/production/orders', productionOrderRoutes);
apiRouter.use('/production-planning', productionPlanningRoutes);
apiRouter.use('/production/planning', productionPlanningRoutes);
apiRouter.use('/production-materials', productionMaterialRoutes);
apiRouter.use('/production/materials', productionMaterialRoutes);
apiRouter.use('/production-qc', productionQcRoutes);
apiRouter.use('/production/qc', productionQcRoutes);
apiRouter.use('/production-batches', productionBatchRoutes);
apiRouter.use('/production/batches', productionBatchRoutes);
apiRouter.use('/production-traceability', productionTraceabilityRoutes);
apiRouter.use('/production/traceability', productionTraceabilityRoutes);
apiRouter.use('/production-outputs', productionOutputRoutes);
apiRouter.use('/production/outputs', productionOutputRoutes);
apiRouter.use('/production', productionRoutes);

// Phase 5 Reporting, Analytics & AI Modules
apiRouter.use('/reports', reportRoutes);
apiRouter.use('/analytics', analyticsRoutes);
apiRouter.use('/ai', aiRoutes);

export default apiRouter;
