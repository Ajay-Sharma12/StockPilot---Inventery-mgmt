import { Types } from 'mongoose';
import { SalesOrder } from '../models/salesOrder.model';
import { Package } from '../models/package.model';
import { Dispatch } from '../models/dispatch.model';
import { GatePass } from '../models/gatePass.model';
import { Invoice } from '../models/invoice.model';
import { Payment } from '../models/payment.model';

export interface SalesDashboardStats {
  ordersToday: number;
  ordersThisMonth: number;
  totalOrderValueThisMonth: number;
  pendingApprovalCount: number;
  awaitingFulfillmentCount: number;
  partiallyFulfilledCount: number;
  readyForPackagingCount: number;
  readyForDispatchCount: number;
  todayDispatchesCount: number;
  pendingGatePassesCount: number;
  invoicesIssuedCount: number;
  outstandingReceivables: number;
  overdueInvoicesCount: number;
}

export class SalesDashboardService {
  async getDashboardStats(tenantId: string | Types.ObjectId): Promise<SalesDashboardStats> {
    const tId = new Types.ObjectId(tenantId);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      ordersToday,
      monthOrders,
      pendingApprovalCount,
      confirmedOrders,
      partiallyFulfilledCount,
      packedPackages,
      readyDispatches,
      todayDispatchesCount,
      pendingGatePassesCount,
      issuedInvoices,
    ] = await Promise.all([
      SalesOrder.countDocuments({ tenantId: tId, createdAt: { $gte: startOfToday } }),
      SalesOrder.find({ tenantId: tId, createdAt: { $gte: startOfMonth } }),
      SalesOrder.countDocuments({ tenantId: tId, status: 'SUBMITTED' }),
      SalesOrder.countDocuments({ tenantId: tId, status: { $in: ['APPROVED', 'CONFIRMED'] } }),
      SalesOrder.countDocuments({ tenantId: tId, status: 'PARTIALLY_FULFILLED' }),
      Package.countDocuments({ tenantId: tId, status: 'PACKED' }),
      Dispatch.countDocuments({ tenantId: tId, status: 'READY' }),
      Dispatch.countDocuments({
        tenantId: tId,
        status: 'DISPATCHED',
        dispatchedAt: { $gte: startOfToday },
      }),
      GatePass.countDocuments({ tenantId: tId, status: { $in: ['READY', 'APPROVED'] } }),
      Invoice.find({ tenantId: tId, status: { $in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] } }),
    ]);

    const ordersThisMonth = monthOrders.length;
    const totalOrderValueThisMonth = Math.round(
      monthOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0) * 100
    ) / 100;

    let outstandingReceivables = 0;
    let overdueInvoicesCount = 0;

    for (const inv of issuedInvoices) {
      outstandingReceivables += inv.outstandingAmount || 0;
      if (new Date(inv.dueDate) < now && inv.outstandingAmount > 0) {
        overdueInvoicesCount++;
      }
    }

    return {
      ordersToday,
      ordersThisMonth,
      totalOrderValueThisMonth,
      pendingApprovalCount,
      awaitingFulfillmentCount: confirmedOrders,
      partiallyFulfilledCount,
      readyForPackagingCount: confirmedOrders,
      readyForDispatchCount: readyDispatches,
      todayDispatchesCount,
      pendingGatePassesCount,
      invoicesIssuedCount: issuedInvoices.length,
      outstandingReceivables: Math.round(outstandingReceivables * 100) / 100,
      overdueInvoicesCount,
    };
  }
}

export const salesDashboardService = new SalesDashboardService();
