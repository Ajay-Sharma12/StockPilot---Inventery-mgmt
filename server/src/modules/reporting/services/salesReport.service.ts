import { Types } from 'mongoose';
import { SalesOrder } from '../../sales/models/salesOrder.model';
import { Invoice } from '../../sales/models/invoice.model';
import { Dispatch } from '../../sales/models/dispatch.model';

export class SalesReportService {
  async getSalesOrdersReport(
    tenantId: Types.ObjectId,
    filters: { customerId?: Types.ObjectId; warehouseId?: Types.ObjectId; startDate?: Date; endDate?: Date; status?: string }
  ): Promise<{ data: any[]; summary: Record<string, any> }> {
    const query: any = { tenantId };
    if (filters.customerId) query.customerId = filters.customerId;
    if (filters.warehouseId) query.warehouseId = filters.warehouseId;
    if (filters.status) query.status = filters.status;
    if (filters.startDate || filters.endDate) {
      query.orderDate = {};
      if (filters.startDate) query.orderDate.$gte = filters.startDate;
      if (filters.endDate) query.orderDate.$lte = filters.endDate;
    }

    const sos = await SalesOrder.find(query)
      .populate('customerId', 'name email code')
      .populate('warehouseId', 'name code')
      .sort({ orderDate: -1 })
      .exec();

    let totalRevenue = 0;
    let totalUnits = 0;

    const data = sos.map((so: any) => {
      const orderTotal = so.grandTotal || so.subtotal || 0;
      totalRevenue += orderTotal;
      const units = so.items.reduce((s: number, i: any) => s + (i.quantity || 0), 0);
      totalUnits += units;

      return {
        id: so._id,
        soNumber: so.soNumber,
        orderDate: so.orderDate,
        customerName: so.customerId?.name || 'Unknown',
        warehouse: so.warehouseId?.name || 'Default',
        status: so.status,
        totalUnits: units,
        subtotal: so.subtotal,
        taxAmount: so.taxAmount,
        totalAmount: orderTotal,
      };
    });

    return {
      data,
      summary: {
        totalOrders: data.length,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalUnits,
      },
    };
  }

  async getReceivablesReport(
    tenantId: Types.ObjectId,
    filters: { customerId?: Types.ObjectId; status?: string }
  ): Promise<{ data: any[]; summary: Record<string, any> }> {
    const query: any = { tenantId };
    if (filters.customerId) query.customerId = filters.customerId;
    if (filters.status) query.status = filters.status;

    const invoices = await Invoice.find(query)
      .populate('customerId', 'name email code')
      .populate('salesOrderId', 'soNumber')
      .sort({ dueDate: 1 })
      .exec();

    let totalBilled = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;

    const now = new Date();

    const data = invoices.map((inv: any) => {
      totalBilled += inv.totalAmount || 0;
      totalCollected += inv.paidAmount || 0;
      totalOutstanding += inv.outstandingAmount || 0;

      const isOverdue = inv.outstandingAmount > 0 && new Date(inv.dueDate) < now;

      return {
        id: inv._id,
        invoiceNumber: inv.invoiceNumber,
        soNumber: inv.salesOrderId?.soNumber || 'N/A',
        customerName: inv.customerId?.name || 'Unknown',
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        totalAmount: inv.totalAmount,
        paidAmount: inv.paidAmount,
        outstandingAmount: inv.outstandingAmount,
        status: inv.status,
        agingStatus: isOverdue ? 'OVERDUE' : inv.outstandingAmount === 0 ? 'SETTLED' : 'CURRENT',
      };
    });

    return {
      data,
      summary: {
        totalInvoices: data.length,
        totalBilled: Math.round(totalBilled * 100) / 100,
        totalCollected: Math.round(totalCollected * 100) / 100,
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      },
    };
  }

  async getDispatchReport(
    tenantId: Types.ObjectId,
    filters: { warehouseId?: Types.ObjectId; startDate?: Date; endDate?: Date }
  ): Promise<{ data: any[]; summary: Record<string, any> }> {
    const query: any = { tenantId };
    if (filters.warehouseId) query.warehouseId = filters.warehouseId;
    if (filters.startDate || filters.endDate) {
      query.dispatchDate = {};
      if (filters.startDate) query.dispatchDate.$gte = filters.startDate;
      if (filters.endDate) query.dispatchDate.$lte = filters.endDate;
    }

    const dispatches = await Dispatch.find(query)
      .populate('salesOrderId', 'soNumber')
      .populate('warehouseId', 'name code')
      .sort({ dispatchDate: -1 })
      .exec();

    const data = dispatches.map((d: any) => ({
      id: d._id,
      dispatchNumber: d.dispatchNumber,
      soNumber: d.salesOrderId?.soNumber || 'N/A',
      dispatchDate: d.dispatchDate,
      warehouse: d.warehouseId?.name,
      carrier: d.carrier,
      trackingNumber: d.trackingNumber || 'N/A',
      driverName: d.driverName,
      vehicleNumber: d.vehicleNumber,
      status: d.status,
      inventoryIssued: d.inventoryIssued,
    }));

    return {
      data,
      summary: {
        totalDispatches: data.length,
      },
    };
  }
}

export const salesReportService = new SalesReportService();
