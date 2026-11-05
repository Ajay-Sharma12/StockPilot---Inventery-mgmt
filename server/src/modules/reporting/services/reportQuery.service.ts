import { Types } from 'mongoose';
import { inventoryReportService } from './inventoryReport.service';
import { procurementReportService } from './procurementReport.service';
import { salesReportService } from './salesReport.service';
import { productionReportService } from './productionReport.service';
import { qcReportService } from './qcReport.service';
import { ReportSnapshot } from '../models/reportSnapshot.model';
import { documentNumberService } from '../../../services/documentNumber.service';
import { Warehouse } from '../../../models/warehouse.model';
import { BadRequestError, ForbiddenError } from '../../../core/errors';

export interface ReportQueryParams {
  category: 'INVENTORY' | 'PROCUREMENT' | 'SALES' | 'PRODUCTION' | 'QC';
  reportType: string;
  warehouseId?: string;
  startDate?: string;
  endDate?: string;
  customerId?: string;
  supplierId?: string;
  itemId?: string;
  status?: string;
  saveSnapshot?: boolean;
}

export class ReportQueryService {
  async executeReport(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    params: ReportQueryParams,
    userScope?: { warehouses?: string[]; isSuperAdmin?: boolean; roles?: string[] }
  ): Promise<{ data: any[]; summary: Record<string, any>; reportType: string; category: string }> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    // 1. Server-side ABAC Warehouse Enforcement
    let effectiveWarehouseId: Types.ObjectId | undefined = params.warehouseId
      ? new Types.ObjectId(params.warehouseId)
      : undefined;

    const allowedWarehouses = userScope?.warehouses || [];
    const isUnrestricted =
      userScope?.isSuperAdmin ||
      userScope?.roles?.includes('tenant-admin') ||
      allowedWarehouses.length === 0;

    if (!isUnrestricted && params.warehouseId) {
      // Find code of requested warehouse
      const requestedWh = await Warehouse.findOne({ _id: effectiveWarehouseId, tenantId: tId }).exec();
      if (!requestedWh || !allowedWarehouses.includes(requestedWh.code)) {
        throw new ForbiddenError(
          `ABAC Access Denied: You are not authorized to view reports for warehouse facility '${
            requestedWh?.code || params.warehouseId
          }'`
        );
      }
    }

    const startDate = params.startDate ? new Date(params.startDate) : undefined;
    const endDate = params.endDate ? new Date(params.endDate) : undefined;

    let result: { data: any[]; summary: Record<string, any> };

    // 2. Dispatch to functional report services
    switch (params.category) {
      case 'INVENTORY':
        if (params.reportType === 'stock-ledger') {
          result = await inventoryReportService.getStockLedger(tId, {
            warehouseId: effectiveWarehouseId,
            itemId: params.itemId ? new Types.ObjectId(params.itemId) : undefined,
            startDate,
            endDate,
          });
        } else if (params.reportType === 'wastage') {
          result = await inventoryReportService.getWastageReport(tId, {
            warehouseId: effectiveWarehouseId,
            startDate,
            endDate,
          });
        } else {
          // Default: stock-summary
          result = await inventoryReportService.getStockSummary(tId, {
            warehouseId: effectiveWarehouseId,
            itemType: params.status,
          });
        }
        break;

      case 'PROCUREMENT':
        if (params.reportType === 'grns') {
          result = await procurementReportService.getGRNReport(tId, {
            warehouseId: effectiveWarehouseId,
            startDate,
            endDate,
          });
        } else if (params.reportType === 'supplier-performance') {
          result = await procurementReportService.getSupplierPerformanceReport(tId, {
            supplierId: params.supplierId ? new Types.ObjectId(params.supplierId) : undefined,
          });
        } else {
          // Default: purchase-orders
          result = await procurementReportService.getPurchaseOrdersReport(tId, {
            supplierId: params.supplierId ? new Types.ObjectId(params.supplierId) : undefined,
            warehouseId: effectiveWarehouseId,
            startDate,
            endDate,
            status: params.status,
          });
        }
        break;

      case 'SALES':
        if (params.reportType === 'receivables') {
          result = await salesReportService.getReceivablesReport(tId, {
            customerId: params.customerId ? new Types.ObjectId(params.customerId) : undefined,
            status: params.status,
          });
        } else if (params.reportType === 'dispatches') {
          result = await salesReportService.getDispatchReport(tId, {
            warehouseId: effectiveWarehouseId,
            startDate,
            endDate,
          });
        } else {
          // Default: sales-orders
          result = await salesReportService.getSalesOrdersReport(tId, {
            customerId: params.customerId ? new Types.ObjectId(params.customerId) : undefined,
            warehouseId: effectiveWarehouseId,
            startDate,
            endDate,
            status: params.status,
          });
        }
        break;

      case 'PRODUCTION':
        if (params.reportType === 'material-variance' || params.reportType === 'material-consumption') {
          result = await productionReportService.getMaterialVarianceReport(tId, {
            warehouseId: effectiveWarehouseId,
            startDate,
            endDate,
          });
        } else if (params.reportType === 'production-outputs') {
          result = await productionReportService.getProductionOutputReport(tId, {
            warehouseId: effectiveWarehouseId,
            status: params.status,
            startDate,
            endDate,
          });
        } else if (params.reportType === 'production-yield') {
          result = await productionReportService.getYieldReport(tId, {
            warehouseId: effectiveWarehouseId,
            startDate,
            endDate,
          });
        } else if (params.reportType === 'production-wastage') {
          result = await productionReportService.getWastageReport(tId, {
            warehouseId: effectiveWarehouseId,
            startDate,
            endDate,
          });
        } else if (params.reportType === 'batch-history') {
          result = await productionReportService.getBatchHistoryReport(tId, {
            warehouseId: effectiveWarehouseId,
            status: params.status,
            startDate,
            endDate,
          });
        } else {
          // Default: production-orders
          result = await productionReportService.getProductionOrdersReport(tId, {
            warehouseId: effectiveWarehouseId,
            status: params.status,
            startDate,
            endDate,
          });
        }
        break;

      case 'QC':
        result = await qcReportService.getQCInspectionReport(tId, {
          type: (params.reportType as any) || 'ALL',
          status: params.status,
        });
        break;

      default:
        throw new BadRequestError(`Invalid report category '${params.category}'`);
    }

    // 3. Persist snapshot if requested
    if (params.saveSnapshot) {
      const snapshotNumber = await documentNumberService.getNextNumber(tId, 'REPORT_SNAPSHOT');
      await ReportSnapshot.create({
        tenantId: tId,
        snapshotNumber,
        reportType: params.reportType || 'summary',
        category: params.category,
        filters: params,
        data: result.data,
        summary: result.summary,
        generatedBy: uId,
      });
    }

    return {
      category: params.category,
      reportType: params.reportType || 'summary',
      ...result,
    };
  }
}

export const reportQueryService = new ReportQueryService();
