import { Types } from 'mongoose';
import { InventoryBalance } from '../../../models/inventoryBalance.model';
import { SalesOrder } from '../../sales/models/salesOrder.model';
import { PurchaseOrder } from '../../procurement/models/purchaseOrder.model';
import { Invoice } from '../../sales/models/invoice.model';
import { ProductionOrder } from '../../production/models/productionOrder.model';
import { ProductionQC } from '../../production/models/productionQc.model';
import { PurchaseQCInspection } from '../../procurement/models/purchaseQc.model';
import { Item } from '../../../models/item.model';

export type AnalyticsPeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all';

export interface TrendDataPoint {
  date: string;
  sales: number;
  procurement: number;
}

export class AnalyticsService {
  private getDateRange(period: AnalyticsPeriod): { start?: Date; end?: Date; prevStart?: Date; prevEnd?: Date } {
    const now = new Date();
    let start: Date | undefined;
    let prevStart: Date | undefined;
    let prevEnd: Date | undefined;

    switch (period) {
      case 'today': {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        prevStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
        prevEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
        break;
      }
      case 'week': {
        const day = now.getDay() === 0 ? 7 : now.getDay();
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1, 0, 0, 0, 0);
        prevStart = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);
        prevEnd = new Date(start.getTime() - 1);
        break;
      }
      case 'month': {
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        prevEnd = new Date(start.getTime() - 1);
        break;
      }
      case 'quarter': {
        const qMonth = Math.floor(now.getMonth() / 3) * 3;
        start = new Date(now.getFullYear(), qMonth, 1, 0, 0, 0, 0);
        prevStart = new Date(now.getFullYear(), qMonth - 3, 1, 0, 0, 0, 0);
        prevEnd = new Date(start.getTime() - 1);
        break;
      }
      case 'year': {
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        prevStart = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
        prevEnd = new Date(start.getTime() - 1);
        break;
      }
      case 'all':
      default:
        return { end: now };
    }

    return { start, end: now, prevStart, prevEnd };
  }

  private generateTrendBuckets(
    period: AnalyticsPeriod,
    salesList: Array<{ date: Date; amount: number }>,
    poList: Array<{ date: Date; amount: number }>
  ): TrendDataPoint[] {
    const now = new Date();
    const buckets: { [key: string]: { label: string; sales: number; procurement: number; order: number } } = {};

    if (period === 'today') {
      // 6 time blocks across the day: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00
      for (let h = 0; h < 24; h += 4) {
        const label = `${String(h).padStart(2, '0')}:00`;
        buckets[label] = { label, sales: 0, procurement: 0, order: h };
      }
      for (const s of salesList) {
        if (!s.date) continue;
        const h = new Date(s.date).getHours();
        const block = Math.floor(h / 4) * 4;
        const key = `${String(block).padStart(2, '0')}:00`;
        if (buckets[key]) buckets[key].sales += s.amount;
      }
      for (const p of poList) {
        if (!p.date) continue;
        const h = new Date(p.date).getHours();
        const block = Math.floor(h / 4) * 4;
        const key = `${String(block).padStart(2, '0')}:00`;
        if (buckets[key]) buckets[key].procurement += p.amount;
      }
    } else if (period === 'week') {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      days.forEach((day, idx) => {
        buckets[day] = { label: day, sales: 0, procurement: 0, order: idx };
      });
      for (const s of salesList) {
        if (!s.date) continue;
        const dayIdx = (new Date(s.date).getDay() + 6) % 7; // Monday = 0
        const dayName = days[dayIdx];
        if (buckets[dayName]) buckets[dayName].sales += s.amount;
      }
      for (const p of poList) {
        if (!p.date) continue;
        const dayIdx = (new Date(p.date).getDay() + 6) % 7;
        const dayName = days[dayIdx];
        if (buckets[dayName]) buckets[dayName].procurement += p.amount;
      }
    } else if (period === 'month') {
      // 4 week intervals (W1, W2, W3, W4)
      for (let w = 1; w <= 4; w++) {
        const label = `Week ${w}`;
        buckets[label] = { label, sales: 0, procurement: 0, order: w };
      }
      for (const s of salesList) {
        if (!s.date) continue;
        const dateNum = new Date(s.date).getDate();
        const w = Math.min(Math.ceil(dateNum / 7), 4);
        const label = `Week ${w}`;
        if (buckets[label]) buckets[label].sales += s.amount;
      }
      for (const p of poList) {
        if (!p.date) continue;
        const dateNum = new Date(p.date).getDate();
        const w = Math.min(Math.ceil(dateNum / 7), 4);
        const label = `Week ${w}`;
        if (buckets[label]) buckets[label].procurement += p.amount;
      }
    } else if (period === 'quarter') {
      // 3 months of the current quarter
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (let i = 0; i < 3; i++) {
        const m = monthNames[qMonth + i];
        buckets[m] = { label: m, sales: 0, procurement: 0, order: i };
      }
      for (const s of salesList) {
        if (!s.date) continue;
        const m = monthNames[new Date(s.date).getMonth()];
        if (buckets[m]) buckets[m].sales += s.amount;
      }
      for (const p of poList) {
        if (!p.date) continue;
        const m = monthNames[new Date(p.date).getMonth()];
        if (buckets[m]) buckets[m].procurement += p.amount;
      }
    } else {
      // Year or all: 12 months
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      monthNames.forEach((m, idx) => {
        buckets[m] = { label: m, sales: 0, procurement: 0, order: idx };
      });
      for (const s of salesList) {
        if (!s.date) continue;
        const m = monthNames[new Date(s.date).getMonth()];
        if (buckets[m]) buckets[m].sales += s.amount;
      }
      for (const p of poList) {
        if (!p.date) continue;
        const m = monthNames[new Date(p.date).getMonth()];
        if (buckets[m]) buckets[m].procurement += p.amount;
      }
    }

    return Object.values(buckets)
      .sort((a, b) => a.order - b.order)
      .map((b) => ({
        date: b.label,
        sales: Math.round(b.sales * 100) / 100,
        procurement: Math.round(b.procurement * 100) / 100,
      }));
  }

  async getExecutiveOverview(
    tenantId: string | Types.ObjectId,
    period: AnalyticsPeriod = 'month',
    warehouseId?: string
  ): Promise<{
    kpis: {
      totalInventoryValuation: number;
      totalSalesRevenue: number;
      totalProcurementSpend: number;
      outstandingReceivables: number;
      productionYieldRate: number;
      qcPassRate: number;
    };
    growth: {
      salesGrowth: number;
      procurementGrowth: number;
      salesRevenueGrowth: number;
      procurementSpendGrowth: number;
    };
    summary: {
      totalItems: number;
      activeWorkOrders: number;
      openPurchaseOrders: number;
      unpaidInvoices: number;
    };
    trends: TrendDataPoint[];
  }> {
    const tId = new Types.ObjectId(tenantId);
    const { start, end, prevStart, prevEnd } = this.getDateRange(period);

    // Filters with valid order statuses
    const validSalesStatuses = ['CONFIRMED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'APPROVED', 'SUBMITTED'];
    const validPoStatuses = ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CLOSED', 'SUBMITTED'];

    const salesFilter: any = { tenantId: tId, status: { $in: validSalesStatuses } };
    const prevSalesFilter: any = { tenantId: tId, status: { $in: validSalesStatuses } };
    const poFilter: any = { tenantId: tId, status: { $in: validPoStatuses } };
    const prevPoFilter: any = { tenantId: tId, status: { $in: validPoStatuses } };
    const balanceFilter: any = { tenantId: tId };
    const prodFilter: any = { tenantId: tId };

    if (warehouseId && Types.ObjectId.isValid(warehouseId)) {
      const whId = new Types.ObjectId(warehouseId);
      salesFilter.warehouseId = whId;
      prevSalesFilter.warehouseId = whId;
      poFilter.warehouseId = whId;
      prevPoFilter.warehouseId = whId;
      balanceFilter.warehouseId = whId;
      prodFilter.warehouseId = whId;
    }

    if (start) {
      salesFilter.orderDate = { $gte: start, $lte: end };
      poFilter.orderDate = { $gte: start, $lte: end };
    }
    if (prevStart && prevEnd) {
      prevSalesFilter.orderDate = { $gte: prevStart, $lte: prevEnd };
      prevPoFilter.orderDate = { $gte: prevStart, $lte: prevEnd };
    }

    const [
      balances,
      currentSales,
      prevSales,
      currentPOs,
      prevPOs,
      invoices,
      prodOrders,
      prodQCs,
      purchaseQCs,
      totalItemsCount,
      openPOsCount,
      unpaidInvoicesCount,
      trendSalesOrders,
      trendPOs,
    ] = await Promise.all([
      InventoryBalance.aggregate([
        { $match: balanceFilter },
        { $group: { _id: null, totalValuation: { $sum: '$totalValue' } } },
      ]),
      SalesOrder.aggregate([
        { $match: salesFilter },
        { $group: { _id: null, totalSales: { $sum: { $ifNull: ['$grandTotal', '$subtotal'] } } } },
      ]),
      SalesOrder.aggregate([
        { $match: prevSalesFilter },
        { $group: { _id: null, totalSales: { $sum: { $ifNull: ['$grandTotal', '$subtotal'] } } } },
      ]),
      PurchaseOrder.aggregate([
        { $match: poFilter },
        { $group: { _id: null, totalSpend: { $sum: { $ifNull: ['$total', '$subtotal'] } } } },
      ]),
      PurchaseOrder.aggregate([
        { $match: prevPoFilter },
        { $group: { _id: null, totalSpend: { $sum: { $ifNull: ['$total', '$subtotal'] } } } },
      ]),
      Invoice.aggregate([
        { $match: { tenantId: tId } },
        { $group: { _id: null, totalOutstanding: { $sum: '$outstandingAmount' } } },
      ]),
      ProductionOrder.find(prodFilter).exec(),
      ProductionQC.find(start ? { tenantId: tId, createdAt: { $gte: start, $lte: end } } : { tenantId: tId }).exec(),
      PurchaseQCInspection.find(start ? { tenantId: tId, createdAt: { $gte: start, $lte: end } } : { tenantId: tId }).exec(),
      Item.countDocuments({ tenantId: tId }).exec(),
      PurchaseOrder.countDocuments({
        tenantId: tId,
        status: { $in: ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'] },
        ...(warehouseId && Types.ObjectId.isValid(warehouseId) ? { warehouseId: new Types.ObjectId(warehouseId) } : {}),
      }).exec(),
      Invoice.countDocuments({ tenantId: tId, status: { $in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] } }).exec(),
      SalesOrder.find(salesFilter, 'orderDate grandTotal subtotal createdAt').lean().exec(),
      PurchaseOrder.find(poFilter, 'orderDate total subtotal createdAt').lean().exec(),
    ]);

    const totalInventoryValuation = balances[0]?.totalValuation || 0;
    const currentSalesVal = currentSales[0]?.totalSales || 0;
    const prevSalesVal = prevSales[0]?.totalSales || 0;
    const currentPOVal = currentPOs[0]?.totalSpend || 0;
    const prevPOVal = prevPOs[0]?.totalSpend || 0;
    const outstandingReceivables = invoices[0]?.totalOutstanding || 0;

    // Production Yield Calculation
    const totalPlannedProd = prodOrders.reduce((sum, o) => sum + (o.plannedQuantity || 0), 0);
    const totalYieldProd = prodOrders.reduce((sum, o) => sum + (o.yieldQuantity || 0), 0);
    const productionYieldRate =
      totalPlannedProd > 0 ? Math.round((totalYieldProd / totalPlannedProd) * 1000) / 10 : 100;

    // QC Pass Rate Calculation
    const allQCs = [...prodQCs, ...purchaseQCs];
    const totalQCUnits = allQCs.reduce((sum, q: any) => sum + (q.inspectedQuantity || 0), 0);
    const acceptedQCUnits = allQCs.reduce((sum, q: any) => sum + (q.acceptedQuantity || 0), 0);
    const qcPassRate =
      totalQCUnits > 0 ? Math.round((acceptedQCUnits / totalQCUnits) * 1000) / 10 : 100;

    // Growth calculations
    const salesGrowth =
      prevSalesVal > 0 ? Math.round(((currentSalesVal - prevSalesVal) / prevSalesVal) * 1000) / 10 : 0;
    const procurementGrowth =
      prevPOVal > 0 ? Math.round(((currentPOVal - prevPOVal) / prevPOVal) * 1000) / 10 : 0;

    const activeWorkOrders = prodOrders.filter((o) =>
      ['RELEASED', 'IN_PROGRESS', 'PAUSED'].includes(o.status)
    ).length;

    // Trend points
    const trends = this.generateTrendBuckets(
      period,
      trendSalesOrders.map((s: any) => ({
        date: s.orderDate || s.createdAt,
        amount: s.grandTotal || s.subtotal || 0,
      })),
      trendPOs.map((p: any) => ({
        date: p.orderDate || p.createdAt,
        amount: p.total || p.subtotal || 0,
      }))
    );

    return {
      kpis: {
        totalInventoryValuation: Math.round(totalInventoryValuation * 100) / 100,
        totalSalesRevenue: Math.round(currentSalesVal * 100) / 100,
        totalProcurementSpend: Math.round(currentPOVal * 100) / 100,
        outstandingReceivables: Math.round(outstandingReceivables * 100) / 100,
        productionYieldRate,
        qcPassRate,
      },
      growth: {
        salesGrowth,
        procurementGrowth,
        salesRevenueGrowth: salesGrowth,
        procurementSpendGrowth: procurementGrowth,
      },
      summary: {
        totalItems: totalItemsCount,
        activeWorkOrders,
        openPurchaseOrders: openPOsCount,
        unpaidInvoices: unpaidInvoicesCount,
      },
      trends,
    };
  }

  async getInventoryAnalytics(tenantId: string | Types.ObjectId, warehouseId?: string): Promise<any> {
    const tId = new Types.ObjectId(tenantId);
    const balanceFilter: any = { tenantId: tId };
    if (warehouseId && Types.ObjectId.isValid(warehouseId)) {
      balanceFilter.warehouseId = new Types.ObjectId(warehouseId);
    }

    const [balances, totalItems] = await Promise.all([
      InventoryBalance.find(balanceFilter)
        .populate('itemId', 'sku name itemCode standardCost reorderLevel itemType')
        .populate('warehouseId', 'name code')
        .exec(),
      Item.countDocuments({ tenantId: tId }).exec(),
    ]);

    let healthyCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalValuation = 0;

    const warehouseMap: Record<string, { name: string; value: number; count: number }> = {};

    for (const b of balances) {
      const itm: any = b.itemId || {};
      const whName = (b.warehouseId as any)?.name || 'Default Facility';

      if (!warehouseMap[whName]) {
        warehouseMap[whName] = { name: whName, value: 0, count: 0 };
      }
      const val = b.totalValue || 0;
      warehouseMap[whName].value += val;
      warehouseMap[whName].count += 1;
      totalValuation += val;

      if (b.quantity <= 0) {
        outOfStockCount++;
      } else if (b.availableQuantity <= (itm.reorderLevel || 0)) {
        lowStockCount++;
      } else {
        healthyCount++;
      }
    }

    return {
      totalItems,
      totalValuation: Math.round(totalValuation * 100) / 100,
      stockHealth: {
        healthy: healthyCount,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
      },
      warehouseDistribution: Object.values(warehouseMap).map((w) => ({
        ...w,
        value: Math.round(w.value * 100) / 100,
      })),
    };
  }

  async getProductionAnalytics(
    tenantId: string | Types.ObjectId,
    period: AnalyticsPeriod = 'month',
    warehouseId?: string
  ): Promise<any> {
    const tId = new Types.ObjectId(tenantId);
    const { start, end } = this.getDateRange(period);

    const filter: any = { tenantId: tId };
    if (warehouseId && Types.ObjectId.isValid(warehouseId)) {
      filter.warehouseId = new Types.ObjectId(warehouseId);
    }

    // Period specific filter
    const periodFilter = { ...filter };
    if (start) {
      periodFilter.createdAt = { $gte: start, $lte: end };
    }

    let orders = await ProductionOrder.find(periodFilter)
      .populate('productionItemId', 'sku name')
      .exec();

    // If zero orders found in the period, fallback to all orders for visibility
    if (orders.length === 0 && start) {
      orders = await ProductionOrder.find(filter)
        .populate('productionItemId', 'sku name')
        .exec();
    }

    let totalPlanned = 0;
    let totalProduced = 0;
    let totalScrap = 0;
    let totalRejected = 0;
    let totalActualCost = 0;
    let totalPlannedCost = 0;

    const statusCounts: Record<string, number> = {};

    for (const o of orders) {
      totalPlanned += o.plannedQuantity || 0;
      totalProduced += o.yieldQuantity || 0;
      totalScrap += o.scrapQuantity || 0;
      totalRejected += o.rejectedQuantity || 0;
      totalActualCost += o.actualMaterialCost || 0;
      totalPlannedCost += o.plannedMaterialCost || 0;

      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    }

    const yieldRate = totalPlanned > 0 ? Math.round((totalProduced / totalPlanned) * 1000) / 10 : 100;
    const scrapRate = totalProduced > 0 ? Math.round((totalScrap / totalProduced) * 1000) / 10 : 0;
    const costVariance = Math.round((totalActualCost - totalPlannedCost) * 100) / 100;

    return {
      totalOrders: orders.length,
      yieldRate,
      scrapRate,
      totalProduced,
      totalScrap,
      totalRejected,
      totalActualCost: Math.round(totalActualCost * 100) / 100,
      totalPlannedCost: Math.round(totalPlannedCost * 100) / 100,
      costVariance,
      statusDistribution: statusCounts,
    };
  }

  async getSalesAnalytics(
    tenantId: string | Types.ObjectId,
    period: AnalyticsPeriod = 'month',
    warehouseId?: string
  ): Promise<any> {
    const tId = new Types.ObjectId(tenantId);
    const { start, end } = this.getDateRange(period);

    const validStatuses = ['CONFIRMED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'APPROVED', 'SUBMITTED'];
    const filter: any = { tenantId: tId, status: { $in: validStatuses } };
    if (warehouseId && Types.ObjectId.isValid(warehouseId)) {
      filter.warehouseId = new Types.ObjectId(warehouseId);
    }
    if (start) {
      filter.orderDate = { $gte: start, $lte: end };
    }

    let orders = await SalesOrder.find(filter)
      .populate('customerId', 'name code')
      .exec();

    // Fallback if empty in strict period
    if (orders.length === 0 && start) {
      orders = await SalesOrder.find({ tenantId: tId, status: { $in: validStatuses } })
        .populate('customerId', 'name code')
        .exec();
    }

    const customerSpend: Record<string, { customerName: string; revenue: number; orderCount: number }> = {};
    const statusDistribution: Record<string, number> = {};
    let totalRevenue = 0;

    for (const o of orders) {
      const cName = (o.customerId as any)?.name || 'Direct Customer';
      const amt = o.grandTotal || o.subtotal || 0;
      totalRevenue += amt;

      if (!customerSpend[cName]) {
        customerSpend[cName] = { customerName: cName, revenue: 0, orderCount: 0 };
      }
      customerSpend[cName].revenue += amt;
      customerSpend[cName].orderCount += 1;

      statusDistribution[o.status] = (statusDistribution[o.status] || 0) + 1;
    }

    const topCustomers = Object.values(customerSpend)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((c) => ({ ...c, revenue: Math.round(c.revenue * 100) / 100 }));

    const avgOrderValue = orders.length > 0 ? Math.round((totalRevenue / orders.length) * 100) / 100 : 0;

    return {
      totalSalesOrders: orders.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      avgOrderValue,
      topCustomers,
      statusDistribution,
    };
  }

  async getProcurementAnalytics(
    tenantId: string | Types.ObjectId,
    period: AnalyticsPeriod = 'month',
    warehouseId?: string
  ): Promise<any> {
    const tId = new Types.ObjectId(tenantId);
    const { start, end } = this.getDateRange(period);

    const validStatuses = ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CLOSED', 'SUBMITTED'];
    const filter: any = { tenantId: tId, status: { $in: validStatuses } };
    if (warehouseId && Types.ObjectId.isValid(warehouseId)) {
      filter.warehouseId = new Types.ObjectId(warehouseId);
    }
    if (start) {
      filter.orderDate = { $gte: start, $lte: end };
    }

    let orders = await PurchaseOrder.find(filter)
      .populate('supplierId', 'name code')
      .exec();

    // Fallback if empty in strict period
    if (orders.length === 0 && start) {
      orders = await PurchaseOrder.find({ tenantId: tId, status: { $in: validStatuses } })
        .populate('supplierId', 'name code')
        .exec();
    }

    const supplierSpend: Record<string, { supplierName: string; spend: number; orderCount: number }> = {};
    const statusDistribution: Record<string, number> = {};
    let totalSpend = 0;

    for (const o of orders) {
      const sName = (o.supplierId as any)?.name || 'Direct Vendor';
      const amt = o.total || o.subtotal || 0;
      totalSpend += amt;

      if (!supplierSpend[sName]) {
        supplierSpend[sName] = { supplierName: sName, spend: 0, orderCount: 0 };
      }
      supplierSpend[sName].spend += amt;
      supplierSpend[sName].orderCount += 1;

      statusDistribution[o.status] = (statusDistribution[o.status] || 0) + 1;
    }

    const topSuppliers = Object.values(supplierSpend)
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5)
      .map((s) => ({ ...s, spend: Math.round(s.spend * 100) / 100 }));

    const avgPOValue = orders.length > 0 ? Math.round((totalSpend / orders.length) * 100) / 100 : 0;

    return {
      totalPurchaseOrders: orders.length,
      totalSpend: Math.round(totalSpend * 100) / 100,
      avgPOValue,
      topSuppliers,
      statusDistribution,
    };
  }

  async getQCAnalytics(tenantId: string | Types.ObjectId, period: AnalyticsPeriod = 'month'): Promise<any> {
    const tId = new Types.ObjectId(tenantId);
    const { start, end } = this.getDateRange(period);

    const dateFilter: any = { tenantId: tId };
    if (start) {
      dateFilter.createdAt = { $gte: start, $lte: end };
    }

    let [prodQCs, purchaseQCs] = await Promise.all([
      ProductionQC.find(dateFilter).exec(),
      PurchaseQCInspection.find(dateFilter).exec(),
    ]);

    // Fallback if strict date filter has 0 records
    if (prodQCs.length === 0 && purchaseQCs.length === 0 && start) {
      [prodQCs, purchaseQCs] = await Promise.all([
        ProductionQC.find({ tenantId: tId }).exec(),
        PurchaseQCInspection.find({ tenantId: tId }).exec(),
      ]);
    }

    let accepted = 0;
    let rejected = 0;
    let held = 0;
    let rework = 0;

    for (const q of [...prodQCs, ...purchaseQCs]) {
      accepted += q.acceptedQuantity || 0;
      rejected += q.rejectedQuantity || 0;
      held += q.heldQuantity || 0;
      if ((q as any).reworkQuantity) rework += (q as any).reworkQuantity;
    }

    const total = accepted + rejected + held + rework;

    return {
      totalInspections: prodQCs.length + purchaseQCs.length,
      totalUnitsInspected: total,
      acceptedUnits: accepted,
      rejectedUnits: rejected,
      heldUnits: held,
      reworkUnits: rework,
      passRate: total > 0 ? Math.round((accepted / total) * 1000) / 10 : 100,
      dispositionDistribution: {
        accepted,
        rejected,
        held,
        rework,
      },
    };
  }
}

export const analyticsService = new AnalyticsService();
