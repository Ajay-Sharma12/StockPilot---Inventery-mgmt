import { Types } from 'mongoose';
import { PurchaseOrder } from '../../procurement/models/purchaseOrder.model';
import { GoodsReceiptNote } from '../../procurement/models/grn.model';
import { Supplier } from '../../../models/supplier.model';

export class ProcurementReportService {
  async getPurchaseOrdersReport(
    tenantId: Types.ObjectId,
    filters: { supplierId?: Types.ObjectId; warehouseId?: Types.ObjectId; startDate?: Date; endDate?: Date; status?: string }
  ): Promise<{ data: any[]; summary: Record<string, any> }> {
    const query: any = { tenantId };
    if (filters.supplierId) query.supplierId = filters.supplierId;
    if (filters.warehouseId) query.warehouseId = filters.warehouseId;
    if (filters.status) query.status = filters.status;
    if (filters.startDate || filters.endDate) {
      query.orderDate = {};
      if (filters.startDate) query.orderDate.$gte = filters.startDate;
      if (filters.endDate) query.orderDate.$lte = filters.endDate;
    }

    const pos = await PurchaseOrder.find(query)
      .populate('supplierId', 'name email code')
      .populate('warehouseId', 'name code')
      .sort({ orderDate: -1 })
      .exec();

    let totalSpend = 0;
    let totalOrdered = 0;
    let totalReceived = 0;

    const data = pos.map((po: any) => {
      const orderTotal = po.total || po.subtotal || 0;
      totalSpend += orderTotal;
      const ordered = po.items.reduce((s: number, i: any) => s + (i.quantity || 0), 0);
      const received = po.items.reduce((s: number, i: any) => s + (i.receivedQuantity || 0), 0);
      totalOrdered += ordered;
      totalReceived += received;

      const fulfillmentRate = ordered > 0 ? Math.round((received / ordered) * 1000) / 10 : 0;

      return {
        id: po._id,
        poNumber: po.poNumber,
        orderDate: po.orderDate,
        supplierName: po.supplierId?.name || 'Unknown',
        warehouse: po.warehouseId?.name || 'Default',
        status: po.status,
        orderedQuantity: ordered,
        receivedQuantity: received,
        fulfillmentRate: `${fulfillmentRate}%`,
        totalAmount: orderTotal,
      };
    });

    return {
      data,
      summary: {
        totalOrders: data.length,
        totalSpend: Math.round(totalSpend * 100) / 100,
        totalOrderedQuantity: totalOrdered,
        totalReceivedQuantity: totalReceived,
        overallFulfillmentRate: totalOrdered > 0 ? `${Math.round((totalReceived / totalOrdered) * 1000) / 10}%` : '0%',
      },
    };
  }

  async getGRNReport(
    tenantId: Types.ObjectId,
    filters: { warehouseId?: Types.ObjectId; startDate?: Date; endDate?: Date }
  ): Promise<{ data: any[]; summary: Record<string, any> }> {
    const query: any = { tenantId };
    if (filters.warehouseId) query.warehouseId = filters.warehouseId;
    if (filters.startDate || filters.endDate) {
      query.receiptDate = {};
      if (filters.startDate) query.receiptDate.$gte = filters.startDate;
      if (filters.endDate) query.receiptDate.$lte = filters.endDate;
    }

    const grns = await GoodsReceiptNote.find(query)
      .populate('purchaseOrderId', 'poNumber')
      .populate('warehouseId', 'name code')
      .sort({ receiptDate: -1 })
      .exec();

    let totalReceivedUnits = 0;

    const data = grns.map((g: any) => {
      const units = g.items.reduce((s: number, i: any) => s + (i.receivedQuantity || 0), 0);
      totalReceivedUnits += units;

      return {
        id: g._id,
        grnNumber: g.grnNumber,
        poNumber: g.purchaseOrderId?.poNumber || 'N/A',
        receiptDate: g.receiptDate,
        warehouse: g.warehouseId?.name,
        carrier: g.carrier || 'Standard Freight',
        trackingNumber: g.trackingNumber || 'N/A',
        status: g.status,
        totalUnitsReceived: units,
      };
    });

    return {
      data,
      summary: {
        totalReceipts: data.length,
        totalReceivedUnits,
      },
    };
  }

  async getSupplierPerformanceReport(
    tenantId: Types.ObjectId,
    filters: { supplierId?: Types.ObjectId } = {}
  ): Promise<{ data: any[]; summary: Record<string, any> }> {
    const supplierQuery: any = { tenantId };
    if (filters.supplierId) supplierQuery._id = filters.supplierId;

    const suppliers = await Supplier.find(supplierQuery).sort({ name: 1 }).exec();

    const [allPOs, allGRNs] = await Promise.all([
      PurchaseOrder.find({ tenantId }).exec(),
      GoodsReceiptNote.find({ tenantId }).exec(),
    ]);

    let totalSpendAll = 0;
    let totalOrdersAll = 0;
    let totalOrderedQtyAll = 0;
    let totalReceivedQtyAll = 0;
    let totalRejectedQtyAll = 0;

    const data = suppliers.map((supplier) => {
      const pos = allPOs.filter(
        (p) => p.supplierId.toString() === supplier._id.toString() && p.status !== 'CANCELLED'
      );
      const grns = allGRNs.filter(
        (g) => g.supplierId.toString() === supplier._id.toString() && g.status !== 'CANCELLED'
      );

      const totalOrders = pos.length;
      const totalSpend = Math.round(
        pos.reduce((sum, p) => sum + (p.total || p.subtotal || 0), 0) * 100
      ) / 100;

      let orderedQty = 0;
      for (const po of pos) {
        for (const item of po.items) {
          orderedQty += item.quantity || 0;
        }
      }

      let receivedQty = 0;
      let rejectedQty = 0;
      for (const grn of grns) {
        for (const item of grn.items) {
          receivedQty += item.acceptedQuantity || item.receivedQuantity || 0;
          rejectedQty += item.rejectedQuantity || 0;
        }
      }

      // On-time delivery rate
      let onTimeCount = 0;
      let deliveredCount = 0;
      for (const po of pos) {
        const linked = grns.filter((g) => g.purchaseOrderId.toString() === po._id.toString());
        if (linked.length > 0) {
          deliveredCount++;
          const latestReceipt = linked.reduce((lat, g) =>
            new Date(g.receiptDate) > new Date(lat.receiptDate) ? g : lat
          );
          if (po.expectedDeliveryDate) {
            if (new Date(latestReceipt.receiptDate) <= new Date(po.expectedDeliveryDate)) {
              onTimeCount++;
            }
          } else {
            onTimeCount++;
          }
        }
      }

      const onTimeRate = deliveredCount > 0 ? Math.round((onTimeCount / deliveredCount) * 1000) / 10 : 100;
      const totalInspected = receivedQty + rejectedQty;
      const qualityPassRate = totalInspected > 0 ? Math.round((receivedQty / totalInspected) * 1000) / 10 : 100;
      const rejectionRate = totalInspected > 0 ? Math.round((rejectedQty / totalInspected) * 1000) / 10 : 0;

      totalSpendAll += totalSpend;
      totalOrdersAll += totalOrders;
      totalOrderedQtyAll += orderedQty;
      totalReceivedQtyAll += receivedQty;
      totalRejectedQtyAll += rejectedQty;

      return {
        id: supplier._id,
        supplierName: supplier.name,
        supplierCode: supplier.supplierCode,
        totalOrders,
        totalPurchaseValue: totalSpend,
        orderedQuantity: Math.round(orderedQty * 100) / 100,
        receivedQuantity: Math.round(receivedQty * 100) / 100,
        rejectedQuantity: Math.round(rejectedQty * 100) / 100,
        onTimeDeliveryRate: `${onTimeRate}%`,
        qualityPassRate: `${qualityPassRate}%`,
        rejectionRate: `${rejectionRate}%`,
        status: supplier.status,
      };
    });

    return {
      data,
      summary: {
        totalSuppliers: data.length,
        totalOrders: totalOrdersAll,
        totalSpend: Math.round(totalSpendAll * 100) / 100,
        totalOrderedQuantity: Math.round(totalOrderedQtyAll * 100) / 100,
        totalReceivedQuantity: Math.round(totalReceivedQtyAll * 100) / 100,
        totalRejectedQuantity: Math.round(totalRejectedQtyAll * 100) / 100,
      },
    };
  }
}

export const procurementReportService = new ProcurementReportService();

