import { Schema, model, Document, Types } from 'mongoose';

export type DocumentType =
  | 'ITEM'
  | 'STOCK_TRANSFER'
  | 'STOCK_ADJUSTMENT'
  | 'WASTAGE'
  | 'STOCK_COUNT'
  | 'INVENTORY_TXN'
  | 'REQUISITION'
  | 'PURCHASE_REQUISITION'
  | 'RFQ'
  | 'SUPPLIER_QUOTE'
  | 'PURCHASE_ORDER'
  | 'GRN'
  | 'PURCHASE_QC'
  | 'SALES_QUOTATION'
  | 'SALES_ORDER'
  | 'PACKAGE'
  | 'DISPATCH'
  | 'GATE_PASS'
  | 'INVOICE'
  | 'PAYMENT'
  | 'BOM'
  | 'PRODUCTION_ORDER'
  | 'PRODUCTION_QC'
  | 'PRODUCTION_BATCH'
  | 'PRODUCTION_OUTPUT'
  | 'SUPPLIER'
  | 'REPORT_SNAPSHOT';

export interface IDocumentSequence extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  docType: DocumentType;
  prefix: string;
  currentNumber: number;
  padding: number;
  createdAt: Date;
  updatedAt: Date;
}

const documentSequenceSchema = new Schema<IDocumentSequence>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    docType: {
      type: String,
      required: true,
      index: true,
    },
    prefix: {
      type: String,
      required: true,
      trim: true,
    },
    currentNumber: {
      type: Number,
      default: 0,
    },
    padding: {
      type: Number,
      default: 5,
    },
  },
  {
    timestamps: true,
  }
);

documentSequenceSchema.index({ tenantId: 1, docType: 1 }, { unique: true });

export const DocumentSequence = model<IDocumentSequence>('DocumentSequence', documentSequenceSchema);
