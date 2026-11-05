import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../core/types';
import { reportQueryService, ReportQueryParams } from '../services/reportQuery.service';
import { reportExportService } from '../services/reportExport.service';
import { ReportSnapshot } from '../models/reportSnapshot.model';

export class ReportController {
  async getReportTypes(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const types = [
        { category: 'INVENTORY', reportType: 'stock-summary', name: 'Stock Balances & Valuation', description: 'Real-time inventory levels across facilities' },
        { category: 'INVENTORY', reportType: 'stock-ledger', name: 'Inventory Movement Ledger', description: 'Comprehensive transaction history by item and location' },
        { category: 'INVENTORY', reportType: 'wastage', name: 'Material Scrap & Wastage', description: 'Damaged, expired, or scrapped inventory tracking' },
        { category: 'PROCUREMENT', reportType: 'purchase-orders', name: 'PO Execution & Vendor Fulfillment', description: 'PO statuses, delivery adherence, and committed spends' },
        { category: 'PROCUREMENT', reportType: 'grns', name: 'Goods Receipts & Inspection Log', description: 'Inbound warehouse receiving history' },
        { category: 'PROCUREMENT', reportType: 'supplier-performance', name: 'Supplier Performance & Quality Matrix', description: 'Vendor on-time delivery, pass rate, rejection %, and spend' },
        { category: 'SALES', reportType: 'sales-orders', name: 'Sales Performance & Order Velocity', description: 'Order book fulfillment, channels, and customer revenue' },
        { category: 'SALES', reportType: 'receivables', name: 'Aging Receivables & Collections', description: 'Overdue invoices, customer credit, and open balances' },
        { category: 'SALES', reportType: 'dispatches', name: 'Outbound Dispatches & Freight Log', description: 'Carrier tracking, gate passes, and delivered cargo' },
        { category: 'PRODUCTION', reportType: 'production-orders', name: 'Work Order Execution & Yield', description: 'Batch throughput, output efficiency, and completion cycles' },
        { category: 'PRODUCTION', reportType: 'material-variance', name: 'BOM Material Variance & Scrap', description: 'Planned versus actual consumption variances' },
        { category: 'PRODUCTION', reportType: 'production-outputs', name: 'Production Outputs & Quality Yield', description: 'Actual outputs, planned vs produced vs accepted, and yield rates' },
        { category: 'PRODUCTION', reportType: 'production-yield', name: 'Production Yield Analysis', description: 'Yield percentage and output efficiency breakdown' },
        { category: 'PRODUCTION', reportType: 'production-wastage', name: 'Production Scrap & Wastage Log', description: 'Detailed scrap and wastage quantities with recorded reasons' },
        { category: 'PRODUCTION', reportType: 'batch-history', name: 'Batch History & Traceability Log', description: 'Finished batch registry, manufactured quantities, and status' },
        { category: 'QC', reportType: 'ALL', name: 'Consolidated Quality Inspection Log', description: 'Overall pass/fail rates across incoming and production runs' },
        { category: 'QC', reportType: 'PURCHASE', name: 'Supplier Inbound QC Log', description: 'Receiving inspection defect rates and quarantine dispositions' },
        { category: 'QC', reportType: 'PRODUCTION', name: 'Plant Floor Quality Inspections', description: 'In-process and final finished goods QC results' },
      ];
      res.status(200).json({ success: true, data: types });
    } catch (err) {
      next(err);
    }
  }

  async runReport(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userScope = {
        warehouses: req.user?.accessScope?.warehouses,
        isSuperAdmin: req.user?.isSuperAdmin,
        roles: req.user?.roles,
      };

      const queryParams: ReportQueryParams = {
        ...(req.query as unknown as ReportQueryParams),
        ...(req.body || {}),
      };

      const result = await reportQueryService.executeReport(
        req.tenant!._id,
        req.user!._id,
        queryParams,
        userScope
      );

      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async exportReport(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userScope = {
        warehouses: req.user?.accessScope?.warehouses,
        isSuperAdmin: req.user?.isSuperAdmin,
        roles: req.user?.roles,
      };

      const queryParams: ReportQueryParams = {
        ...(req.query as unknown as ReportQueryParams),
        ...(req.body || {}),
      };

      const result = await reportQueryService.executeReport(
        req.tenant!._id,
        req.user!._id,
        queryParams,
        userScope
      );

      const csv = reportExportService.convertToCSV(result.data);
      const filename = `${result.category.toLowerCase()}_${result.reportType}_${Date.now()}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csv);
    } catch (err) {
      next(err);
    }
  }

  async getSnapshots(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const snapshots = await ReportSnapshot.find({ tenantId: req.tenant!._id })
        .populate('generatedBy', 'name email')
        .sort({ generatedAt: -1 })
        .limit(20)
        .exec();

      res.status(200).json({ success: true, data: snapshots });
    } catch (err) {
      next(err);
    }
  }

  async getSnapshotById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const snapshot = await ReportSnapshot.findOne({
        _id: req.params.id,
        tenantId: req.tenant!._id,
      })
        .populate('generatedBy', 'name email')
        .exec();

      if (!snapshot) {
        res.status(404).json({ success: false, message: 'Report snapshot not found' });
        return;
      }

      res.status(200).json({ success: true, data: snapshot });
    } catch (err) {
      next(err);
    }
  }
}

export const reportController = new ReportController();
