import { Types } from 'mongoose';
import { RFQ, IRFQ } from '../models/rfq.model';
import { SupplierQuote, ISupplierQuote } from '../models/supplierQuote.model';
import { NotFoundError } from '../../../core/errors';

export interface QuoteComparisonResult {
  rfq: IRFQ;
  suppliers: {
    quoteId: string;
    quoteNumber: string;
    supplierId: string;
    supplierName: string;
    supplierCode: string;
    status: string;
    currency: string;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    paymentTerms?: string;
    shippingTerms?: string;
    validityDate: Date;
    deliveryDate?: Date;
    selectionReason?: string;
  }[];
  itemsMatrix: {
    itemId: string;
    itemName: string;
    itemSku: string;
    requestedQuantity: number;
    uomSymbol: string;
    quotes: {
      quoteId: string;
      supplierId: string;
      quotedQuantity: number;
      unitPrice: number;
      discount: number;
      tax: number;
      deliveryDays: number;
      lineTotal: number;
    }[];
  }[];
  bestOptions: {
    lowestPriceQuoteId?: string;
    lowestPriceSupplierName?: string;
    lowestPriceAmount?: number;
    selectedQuoteId?: string;
    selectedSupplierName?: string;
  };
}

export class QuoteComparisonService {
  async compareQuotesForRFQ(
    tenantId: string | Types.ObjectId,
    rfqId: string | Types.ObjectId
  ): Promise<QuoteComparisonResult> {
    const tId = new Types.ObjectId(tenantId);
    const rId = new Types.ObjectId(rfqId);

    const rfq = await RFQ.findOne({ _id: rId, tenantId: tId })
      .populate('items.itemId', 'name sku standardCost')
      .populate('items.uomId', 'name symbol')
      .populate('suppliers.supplierId', 'name supplierCode')
      .exec();

    if (!rfq) throw new NotFoundError('RFQ not found in organization');

    const quotes = await SupplierQuote.find({ tenantId: tId, rfqId: rId })
      .populate('supplierId', 'name supplierCode')
      .populate('paymentTermsId', 'name code days')
      .populate('items.itemId', 'name sku')
      .populate('items.uomId', 'name symbol')
      .exec();

    const suppliersSummary = quotes.map((q: any) => ({
      quoteId: q._id.toString(),
      quoteNumber: q.quoteNumber,
      supplierId: q.supplierId?._id?.toString() || '',
      supplierName: q.supplierId?.name || 'Unknown Supplier',
      supplierCode: q.supplierId?.supplierCode || '',
      status: q.status,
      currency: q.currency,
      subtotal: q.subtotal,
      discount: q.discount,
      tax: q.tax,
      total: q.total,
      paymentTerms: q.paymentTermsId?.name || q.shippingTerms || 'Net 30',
      shippingTerms: q.shippingTerms,
      validityDate: q.validityDate,
      deliveryDate: q.deliveryDate,
      selectionReason: q.selectionReason,
    }));

    // Build item-by-item matrix across all quotes
    const itemsMatrix = rfq.items.map((rfqItem: any) => {
      const itmId = rfqItem.itemId?._id?.toString() || rfqItem.itemId?.toString();
      const itmName = rfqItem.itemId?.name || 'Item';
      const itmSku = rfqItem.itemId?.sku || '';
      const uomSym = rfqItem.uomId?.symbol || 'pcs';

      const itemQuotes = quotes.map((q: any) => {
        const matchingLine = q.items.find(
          (line: any) =>
            line.itemId?._id?.toString() === itmId || line.itemId?.toString() === itmId
        );

        return {
          quoteId: q._id.toString(),
          supplierId: q.supplierId?._id?.toString() || '',
          quotedQuantity: matchingLine ? matchingLine.quantity : 0,
          unitPrice: matchingLine ? matchingLine.unitPrice : 0,
          discount: matchingLine ? matchingLine.discount : 0,
          tax: matchingLine ? matchingLine.tax : 0,
          deliveryDays: matchingLine ? matchingLine.deliveryDays : 0,
          lineTotal: matchingLine ? matchingLine.lineTotal : 0,
        };
      });

      return {
        itemId: itmId,
        itemName: itmName,
        itemSku: itmSku,
        requestedQuantity: rfqItem.quantity,
        uomSymbol: uomSym,
        quotes: itemQuotes,
      };
    });

    // Determine lowest price and selected quote
    let lowestPriceQuote: any = null;
    let selectedQuote: any = null;

    for (const q of quotes) {
      if (!lowestPriceQuote || q.total < lowestPriceQuote.total) {
        lowestPriceQuote = q;
      }
      if (q.status === 'SELECTED') {
        selectedQuote = q;
      }
    }

    return {
      rfq,
      suppliers: suppliersSummary,
      itemsMatrix,
      bestOptions: {
        lowestPriceQuoteId: lowestPriceQuote?._id?.toString(),
        lowestPriceSupplierName: lowestPriceQuote?.supplierId?.name,
        lowestPriceAmount: lowestPriceQuote?.total,
        selectedQuoteId: selectedQuote?._id?.toString(),
        selectedSupplierName: selectedQuote?.supplierId?.name,
      },
    };
  }
}

export const quoteComparisonService = new QuoteComparisonService();
