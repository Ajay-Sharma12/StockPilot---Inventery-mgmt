import { Types } from 'mongoose';
import { ProductionQC } from '../../production/models/productionQc.model';
import { PurchaseQCInspection } from '../../procurement/models/purchaseQc.model';

export class QCReportService {
  async getQCInspectionReport(
    tenantId: Types.ObjectId,
    filters: { type?: 'ALL' | 'PURCHASE' | 'PRODUCTION'; status?: string }
  ): Promise<{ data: any[]; summary: Record<string, any> }> {
    const pFilter: any = { tenantId };
    const prodFilter: any = { tenantId };

    if (filters.status) {
      pFilter.status = filters.status;
      prodFilter.status = filters.status;
    }

    const [purchaseQCs, prodQCs] = await Promise.all([
      filters.type === 'PRODUCTION'
        ? []
        : PurchaseQCInspection.find(pFilter)
            .populate('itemId', 'sku name itemCode')
            .populate('inspectorId', 'name')
            .sort({ createdAt: -1 })
            .exec(),
      filters.type === 'PURCHASE'
        ? []
        : ProductionQC.find(prodFilter)
            .populate('itemId', 'sku name itemCode')
            .populate('inspectorId', 'name')
            .sort({ createdAt: -1 })
            .exec(),
    ]);

    let totalInspected = 0;
    let totalAccepted = 0;
    let totalRejected = 0;
    let totalHeld = 0;

    const data: any[] = [];

    for (const q of purchaseQCs as any[]) {
      totalInspected += q.inspectedQuantity || 0;
      totalAccepted += q.acceptedQuantity || 0;
      totalRejected += q.rejectedQuantity || 0;
      totalHeld += q.heldQuantity || 0;

      data.push({
        id: q._id,
        qcNumber: q.qcNumber,
        category: 'PURCHASE_INBOUND',
        sku: q.itemId?.sku,
        itemName: q.itemId?.name,
        batchNumber: q.batchNumber || 'N/A',
        inspectedQuantity: q.inspectedQuantity,
        acceptedQuantity: q.acceptedQuantity,
        rejectedQuantity: q.rejectedQuantity,
        heldQuantity: q.heldQuantity,
        overallResult: q.overallResult,
        status: q.status,
        inspector: q.inspectorId?.name || 'QC Team',
        date: q.createdAt,
      });
    }

    for (const q of prodQCs as any[]) {
      totalInspected += q.inspectedQuantity || 0;
      totalAccepted += q.acceptedQuantity || 0;
      totalRejected += q.rejectedQuantity || 0;
      totalHeld += q.heldQuantity || 0;

      data.push({
        id: q._id,
        qcNumber: q.qcNumber,
        category: 'PRODUCTION_OUTBOUND',
        sku: q.itemId?.sku,
        itemName: q.itemId?.name,
        batchNumber: q.batchNumber || 'N/A',
        inspectedQuantity: q.inspectedQuantity,
        acceptedQuantity: q.acceptedQuantity,
        rejectedQuantity: q.rejectedQuantity,
        heldQuantity: q.heldQuantity,
        overallResult: q.overallResult,
        status: q.status,
        inspector: q.inspectorId?.name || 'QC Team',
        date: q.createdAt,
      });
    }

    data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const passRate =
      totalInspected > 0 ? `${Math.round((totalAccepted / totalInspected) * 1000) / 10}%` : '100%';

    return {
      data,
      summary: {
        totalInspections: data.length,
        totalInspectedUnits: totalInspected,
        totalAcceptedUnits: totalAccepted,
        totalRejectedUnits: totalRejected,
        totalHeldUnits: totalHeld,
        overallPassRate: passRate,
      },
    };
  }
}

export const qcReportService = new QCReportService();
