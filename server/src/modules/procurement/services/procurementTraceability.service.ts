import { Types } from 'mongoose';
import { PurchaseRequisition } from '../models/purchaseRequisition.model';
import { RFQ } from '../models/rfq.model';
import { SupplierQuote } from '../models/supplierQuote.model';
import { PurchaseOrder } from '../models/purchaseOrder.model';
import { GoodsReceiptNote } from '../models/grn.model';
import { PurchaseQCInspection } from '../models/purchaseQc.model';
import { InventoryTransaction } from '../../../models/inventoryTransaction.model';
import { NotFoundError, BadRequestError } from '../../../core/errors';

export interface TraceabilityNode {
  type: 'PR' | 'RFQ' | 'QUOTE' | 'PO' | 'GRN' | 'QC' | 'INVENTORY_TXN';
  id: string;
  number: string;
  status: string;
  date: Date;
  details?: Record<string, any>;
}

export interface FullTraceabilityChain {
  current: TraceabilityNode;
  upstream: TraceabilityNode[];
  downstream: TraceabilityNode[];
}

export class ProcurementTraceabilityService {
  async getTraceability(
    tenantId: string | Types.ObjectId,
    type: string,
    id: string
  ): Promise<FullTraceabilityChain> {
    const tId = new Types.ObjectId(tenantId);
    if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Invalid document identifier');
    const docId = new Types.ObjectId(id);

    const upstream: TraceabilityNode[] = [];
    const downstream: TraceabilityNode[] = [];
    let current: TraceabilityNode | null = null;

    const normalizedType = type.toLowerCase().replace(/[-_]/g, '');

    // Let's resolve current node and navigate both directions
    if (normalizedType === 'pr' || normalizedType === 'purchaserequisition') {
      const pr = await PurchaseRequisition.findOne({ _id: docId, tenantId: tId });
      if (!pr) throw new NotFoundError('Purchase Requisition not found');

      current = {
        type: 'PR',
        id: pr._id.toString(),
        number: pr.prNumber,
        status: pr.status,
        date: pr.createdAt,
        details: { itemsCount: pr.items.length, total: pr.estimatedTotal },
      };

      // Downstream: RFQs referencing this PR
      const rfqs = await RFQ.find({
        tenantId: tId,
        $or: [{ sourceId: pr._id }, { sourcePRIds: pr._id }],
      });
      for (const r of rfqs) {
        downstream.push({
          type: 'RFQ',
          id: r._id.toString(),
          number: r.rfqNumber,
          status: r.status,
          date: r.issueDate,
        });

        // Downstream quotes
        const quotes = await SupplierQuote.find({ tenantId: tId, rfqId: r._id });
        for (const q of quotes) {
          downstream.push({
            type: 'QUOTE',
            id: q._id.toString(),
            number: q.quoteNumber,
            status: q.status,
            date: q.quoteDate,
            details: { total: q.total },
          });
        }
      }

      // Downstream POs
      const pos = await PurchaseOrder.find({ tenantId: tId, sourcePRIds: pr._id });
      for (const p of pos) {
        downstream.push({
          type: 'PO',
          id: p._id.toString(),
          number: p.poNumber,
          status: p.status,
          date: p.orderDate,
          details: { total: p.total },
        });

        // Downstream GRNs
        const grns = await GoodsReceiptNote.find({ tenantId: tId, purchaseOrderId: p._id });
        for (const g of grns) {
          downstream.push({
            type: 'GRN',
            id: g._id.toString(),
            number: g.grnNumber,
            status: g.status,
            date: g.receiptDate,
          });

          // Downstream QCs
          const qcs = await PurchaseQCInspection.find({ tenantId: tId, grnId: g._id });
          for (const qc of qcs) {
            downstream.push({
              type: 'QC',
              id: qc._id.toString(),
              number: qc.qcNumber,
              status: qc.status,
              date: qc.createdAt,
              details: { overallResult: qc.overallResult },
            });
          }

          // Downstream Inventory Txns
          const txns = await InventoryTransaction.find({
            tenantId: tId,
            referenceType: 'GRN',
            referenceId: g._id.toString(),
          });
          for (const txn of txns) {
            downstream.push({
              type: 'INVENTORY_TXN',
              id: txn._id.toString(),
              number: txn.transactionNumber,
              status: 'POSTED',
              date: txn.transactionDate,
              details: { quantityIn: txn.quantityIn },
            });
          }
        }
      }
    } else if (normalizedType === 'rfq') {
      const rfq = await RFQ.findOne({ _id: docId, tenantId: tId });
      if (!rfq) throw new NotFoundError('RFQ not found');

      current = {
        type: 'RFQ',
        id: rfq._id.toString(),
        number: rfq.rfqNumber,
        status: rfq.status,
        date: rfq.issueDate,
      };

      // Upstream PRs
      if (rfq.sourcePRIds && rfq.sourcePRIds.length > 0) {
        const prs = await PurchaseRequisition.find({ _id: { $in: rfq.sourcePRIds }, tenantId: tId });
        for (const pr of prs) {
          upstream.push({
            type: 'PR',
            id: pr._id.toString(),
            number: pr.prNumber,
            status: pr.status,
            date: pr.createdAt,
          });
        }
      }

      // Downstream Quotes
      const quotes = await SupplierQuote.find({ tenantId: tId, rfqId: rfq._id });
      for (const q of quotes) {
        downstream.push({
          type: 'QUOTE',
          id: q._id.toString(),
          number: q.quoteNumber,
          status: q.status,
          date: q.quoteDate,
          details: { total: q.total },
        });

        // Downstream POs from selected quotes
        const pos = await PurchaseOrder.find({ tenantId: tId, sourceQuoteId: q._id });
        for (const p of pos) {
          downstream.push({
            type: 'PO',
            id: p._id.toString(),
            number: p.poNumber,
            status: p.status,
            date: p.orderDate,
          });
        }
      }
    } else if (normalizedType === 'quote' || normalizedType === 'supplierquote') {
      const quote = await SupplierQuote.findOne({ _id: docId, tenantId: tId });
      if (!quote) throw new NotFoundError('Quote not found');

      current = {
        type: 'QUOTE',
        id: quote._id.toString(),
        number: quote.quoteNumber,
        status: quote.status,
        date: quote.quoteDate,
        details: { total: quote.total },
      };

      // Upstream RFQ
      const rfq = await RFQ.findOne({ _id: quote.rfqId, tenantId: tId });
      if (rfq) {
        upstream.push({
          type: 'RFQ',
          id: rfq._id.toString(),
          number: rfq.rfqNumber,
          status: rfq.status,
          date: rfq.issueDate,
        });
      }

      // Downstream PO
      const pos = await PurchaseOrder.find({ tenantId: tId, sourceQuoteId: quote._id });
      for (const p of pos) {
        downstream.push({
          type: 'PO',
          id: p._id.toString(),
          number: p.poNumber,
          status: p.status,
          date: p.orderDate,
        });
      }
    } else if (normalizedType === 'po' || normalizedType === 'purchaseorder') {
      const po = await PurchaseOrder.findOne({ _id: docId, tenantId: tId });
      if (!po) throw new NotFoundError('Purchase Order not found');

      current = {
        type: 'PO',
        id: po._id.toString(),
        number: po.poNumber,
        status: po.status,
        date: po.orderDate,
        details: { total: po.total },
      };

      // Upstream Quote
      if (po.sourceQuoteId) {
        const quote = await SupplierQuote.findOne({ _id: po.sourceQuoteId, tenantId: tId });
        if (quote) {
          upstream.push({
            type: 'QUOTE',
            id: quote._id.toString(),
            number: quote.quoteNumber,
            status: quote.status,
            date: quote.quoteDate,
          });
        }
      }

      // Upstream RFQ
      if (po.sourceRFQId) {
        const rfq = await RFQ.findOne({ _id: po.sourceRFQId, tenantId: tId });
        if (rfq) {
          upstream.push({
            type: 'RFQ',
            id: rfq._id.toString(),
            number: rfq.rfqNumber,
            status: rfq.status,
            date: rfq.issueDate,
          });
        }
      }

      // Upstream PRs
      if (po.sourcePRIds && po.sourcePRIds.length > 0) {
        const prs = await PurchaseRequisition.find({ _id: { $in: po.sourcePRIds }, tenantId: tId });
        for (const pr of prs) {
          upstream.push({
            type: 'PR',
            id: pr._id.toString(),
            number: pr.prNumber,
            status: pr.status,
            date: pr.createdAt,
          });
        }
      }

      // Downstream GRNs
      const grns = await GoodsReceiptNote.find({ tenantId: tId, purchaseOrderId: po._id });
      for (const g of grns) {
        downstream.push({
          type: 'GRN',
          id: g._id.toString(),
          number: g.grnNumber,
          status: g.status,
          date: g.receiptDate,
        });

        // Downstream QCs
        const qcs = await PurchaseQCInspection.find({ tenantId: tId, grnId: g._id });
        for (const qc of qcs) {
          downstream.push({
            type: 'QC',
            id: qc._id.toString(),
            number: qc.qcNumber,
            status: qc.status,
            date: qc.createdAt,
            details: { overallResult: qc.overallResult },
          });
        }

        // Downstream Inventory Txns
        const txns = await InventoryTransaction.find({
          tenantId: tId,
          referenceType: 'GRN',
          referenceId: g._id.toString(),
        });
        for (const txn of txns) {
          downstream.push({
            type: 'INVENTORY_TXN',
            id: txn._id.toString(),
            number: txn.transactionNumber,
            status: 'POSTED',
            date: txn.transactionDate,
            details: { quantityIn: txn.quantityIn },
          });
        }
      }
    } else if (normalizedType === 'grn' || normalizedType === 'goodsreceiptnote') {
      const grn = await GoodsReceiptNote.findOne({ _id: docId, tenantId: tId });
      if (!grn) throw new NotFoundError('GRN not found');

      current = {
        type: 'GRN',
        id: grn._id.toString(),
        number: grn.grnNumber,
        status: grn.status,
        date: grn.receiptDate,
      };

      // Upstream PO
      const po = await PurchaseOrder.findOne({ _id: grn.purchaseOrderId, tenantId: tId });
      if (po) {
        upstream.push({
          type: 'PO',
          id: po._id.toString(),
          number: po.poNumber,
          status: po.status,
          date: po.orderDate,
        });

        if (po.sourceQuoteId) {
          const q = await SupplierQuote.findOne({ _id: po.sourceQuoteId, tenantId: tId });
          if (q) {
            upstream.push({
              type: 'QUOTE',
              id: q._id.toString(),
              number: q.quoteNumber,
              status: q.status,
              date: q.quoteDate,
            });
          }
        }
      }

      // Downstream QC Inspections
      const qcs = await PurchaseQCInspection.find({ tenantId: tId, grnId: grn._id });
      for (const qc of qcs) {
        downstream.push({
          type: 'QC',
          id: qc._id.toString(),
          number: qc.qcNumber,
          status: qc.status,
          date: qc.createdAt,
          details: { overallResult: qc.overallResult },
        });
      }

      // Downstream Inventory Txns
      const txns = await InventoryTransaction.find({
        tenantId: tId,
        referenceType: 'GRN',
        referenceId: grn._id.toString(),
      });
      for (const txn of txns) {
        downstream.push({
          type: 'INVENTORY_TXN',
          id: txn._id.toString(),
          number: txn.transactionNumber,
          status: 'POSTED',
          date: txn.transactionDate,
          details: { quantityIn: txn.quantityIn },
        });
      }
    } else if (normalizedType === 'qc' || normalizedType === 'purchaseqc') {
      const qc = await PurchaseQCInspection.findOne({ _id: docId, tenantId: tId });
      if (!qc) throw new NotFoundError('QC Inspection not found');

      current = {
        type: 'QC',
        id: qc._id.toString(),
        number: qc.qcNumber,
        status: qc.status,
        date: qc.createdAt,
        details: { overallResult: qc.overallResult },
      };

      // Upstream GRN
      const grn = await GoodsReceiptNote.findOne({ _id: qc.grnId, tenantId: tId });
      if (grn) {
        upstream.push({
          type: 'GRN',
          id: grn._id.toString(),
          number: grn.grnNumber,
          status: grn.status,
          date: grn.receiptDate,
        });

        const po = await PurchaseOrder.findOne({ _id: grn.purchaseOrderId, tenantId: tId });
        if (po) {
          upstream.push({
            type: 'PO',
            id: po._id.toString(),
            number: po.poNumber,
            status: po.status,
            date: po.orderDate,
          });
        }
      }

      // Downstream Inventory Txns
      if (grn) {
        const txns = await InventoryTransaction.find({
          tenantId: tId,
          referenceType: 'GRN',
          referenceId: grn._id.toString(),
        });
        for (const txn of txns) {
          downstream.push({
            type: 'INVENTORY_TXN',
            id: txn._id.toString(),
            number: txn.transactionNumber,
            status: 'POSTED',
            date: txn.transactionDate,
            details: { quantityIn: txn.quantityIn },
          });
        }
      }
    } else {
      throw new BadRequestError(`Unsupported document type '${type}' for traceability query`);
    }

    return {
      current: current!,
      upstream,
      downstream,
    };
  }

  async getDashboardStats(tenantId: string | Types.ObjectId): Promise<any> {
    const tId = new Types.ObjectId(tenantId);

    const [
      pendingPRs,
      approvedPRs,
      openRFQs,
      receivedQuotes,
      submittedPOs,
      openPOs,
      pendingGRNs,
      pendingQC,
    ] = await Promise.all([
      PurchaseRequisition.countDocuments({ tenantId: tId, status: 'SUBMITTED' }),
      PurchaseRequisition.countDocuments({ tenantId: tId, status: 'APPROVED' }),
      RFQ.countDocuments({ tenantId: tId, status: { $in: ['DRAFT', 'ISSUED', 'PARTIALLY_RESPONDED'] } }),
      SupplierQuote.countDocuments({ tenantId: tId, status: 'RECEIVED' }),
      PurchaseOrder.countDocuments({ tenantId: tId, status: 'SUBMITTED' }),
      PurchaseOrder.countDocuments({ tenantId: tId, status: { $in: ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'] } }),
      GoodsReceiptNote.countDocuments({ tenantId: tId, status: 'DRAFT' }),
      PurchaseQCInspection.countDocuments({ tenantId: tId, status: { $in: ['PENDING', 'INSPECTED'] } }),
    ]);

    return {
      pendingPRs,
      approvedPRs,
      openRFQs,
      receivedQuotes,
      submittedPOs,
      openPOs,
      pendingGRNs,
      pendingQC,
    };
  }
}

export const procurementTraceabilityService = new ProcurementTraceabilityService();
