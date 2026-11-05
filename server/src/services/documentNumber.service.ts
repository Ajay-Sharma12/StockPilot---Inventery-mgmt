import { Types } from 'mongoose';
import { DocumentSequence, DocumentType } from '../models/documentSequence.model';

const DEFAULT_PREFIXES: Record<DocumentType, string> = {
  ITEM: 'ITM-',
  STOCK_TRANSFER: 'TR-',
  STOCK_ADJUSTMENT: 'ADJ-',
  WASTAGE: 'WST-',
  STOCK_COUNT: 'CNT-',
  INVENTORY_TXN: 'TXN-',
  REQUISITION: 'REQ-',
  PURCHASE_REQUISITION: 'REQ-',
  RFQ: 'RFQ-',
  SUPPLIER_QUOTE: 'QT-',
  PURCHASE_ORDER: 'PO-',
  GRN: 'GRN-',
  PURCHASE_QC: 'QC-',
  SALES_QUOTATION: 'QT-',
  SALES_ORDER: 'SO-',
  PACKAGE: 'PKG-',
  DISPATCH: 'DSP-',
  GATE_PASS: 'GP-',
  INVOICE: 'INV-',
  PAYMENT: 'PAY-',
  BOM: 'BOM-',
  PRODUCTION_ORDER: 'PROD-',
  PRODUCTION_QC: 'QCP-',
  PRODUCTION_BATCH: 'BAT-',
  PRODUCTION_OUTPUT: 'OUT-',
  SUPPLIER: 'SUP-',
  REPORT_SNAPSHOT: 'RPT-',
};

export class DocumentNumberService {
  async getNextNumber(tenantId: string | Types.ObjectId, docType: DocumentType): Promise<string> {
    const tId = new Types.ObjectId(tenantId);
    const prefix = DEFAULT_PREFIXES[docType] || `${docType}-`;

    const sequence = await DocumentSequence.findOneAndUpdate(
      { tenantId: tId, docType },
      {
        $inc: { currentNumber: 1 },
        $setOnInsert: { prefix, padding: 5 },
      },
      { new: true, upsert: true }
    ).exec();

    let currentNum = sequence.currentNumber;
    const padding = sequence.padding || 5;
    const seqPrefix = sequence.prefix || prefix;
    let formatted = `${seqPrefix}${String(currentNum).padStart(padding, '0')}`;

    // Helper to check if the generated code already exists in the target collection
    const checkExists = async (code: string): Promise<boolean> => {
      try {
        if (docType === 'ITEM') {
          const { Item } = await import('../models/item.model');
          return Boolean(await Item.exists({ tenantId: tId, itemCode: code }));
        }
        if (docType === 'PURCHASE_ORDER') {
          const { PurchaseOrder } = await import('../modules/procurement/models/purchaseOrder.model');
          return Boolean(await PurchaseOrder.exists({ tenantId: tId, poNumber: code }));
        }
        if (docType === 'GRN') {
          const { GoodsReceiptNote } = await import('../modules/procurement/models/grn.model');
          return Boolean(await GoodsReceiptNote.exists({ tenantId: tId, grnNumber: code }));
        }
        if (docType === 'PURCHASE_QC') {
          const { PurchaseQCInspection } = await import('../modules/procurement/models/purchaseQc.model');
          return Boolean(await PurchaseQCInspection.exists({ tenantId: tId, qcNumber: code }));
        }
      } catch {
        return false;
      }
      return false;
    };

    // If generated number already exists (e.g. from seeded database items), skip forward
    let attempts = 0;
    while (await checkExists(formatted) && attempts < 1000) {
      currentNum++;
      attempts++;
      formatted = `${seqPrefix}${String(currentNum).padStart(padding, '0')}`;
    }

    if (currentNum !== sequence.currentNumber) {
      await DocumentSequence.updateOne(
        { _id: sequence._id },
        { $set: { currentNumber: currentNum } }
      );
    }

    return formatted;
  }
}

export const documentNumberService = new DocumentNumberService();
