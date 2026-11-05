import { Types } from 'mongoose';
import { SalesOrder, ISalesOrder } from '../models/salesOrder.model';
import { Package, IPackage } from '../models/package.model';
import { Dispatch, IDispatch } from '../models/dispatch.model';
import { GatePass, IGatePass } from '../models/gatePass.model';
import { Invoice, IInvoice } from '../models/invoice.model';
import { Payment, IPayment } from '../models/payment.model';
import { InventoryTransaction, IInventoryTransaction } from '../../../models/inventoryTransaction.model';
import { Customer } from '../../../models/customer.model';
import { NotFoundError } from '../../../core/errors';

export interface SalesTraceabilityDAG {
  customer: any;
  salesOrder: any;
  packages: any[];
  dispatches: any[];
  gatePasses: any[];
  invoices: any[];
  payments: any[];
  inventoryTransactions: any[];
}

export class SalesTraceabilityService {
  async getLineage(
    tenantId: string | Types.ObjectId,
    docType: 'SO' | 'PACKAGE' | 'DISPATCH' | 'GATE_PASS' | 'INVOICE' | 'PAYMENT',
    identifier: string
  ): Promise<SalesTraceabilityDAG> {
    const tId = new Types.ObjectId(tenantId);
    let salesOrderId: Types.ObjectId | null = null;

    const isObjectId = Types.ObjectId.isValid(identifier);

    // 1. Resolve root Sales Order ID from input document
    switch (docType) {
      case 'SO': {
        const query: any = { tenantId: tId };
        if (isObjectId) query.$or = [{ _id: identifier }, { soNumber: identifier }];
        else query.soNumber = identifier;
        const so = await SalesOrder.findOne(query).exec();
        if (!so) throw new NotFoundError(`Sales Order '${identifier}' not found`);
        salesOrderId = so._id;
        break;
      }
      case 'PACKAGE': {
        const query: any = { tenantId: tId };
        if (isObjectId) query.$or = [{ _id: identifier }, { packageNumber: identifier }];
        else query.packageNumber = identifier;
        const pkg = await Package.findOne(query).exec();
        if (!pkg) throw new NotFoundError(`Package '${identifier}' not found`);
        salesOrderId = pkg.salesOrderId;
        break;
      }
      case 'DISPATCH': {
        const query: any = { tenantId: tId };
        if (isObjectId) query.$or = [{ _id: identifier }, { dispatchNumber: identifier }];
        else query.dispatchNumber = identifier;
        const dsp = await Dispatch.findOne(query).exec();
        if (!dsp) throw new NotFoundError(`Dispatch '${identifier}' not found`);
        salesOrderId = dsp.salesOrderId;
        break;
      }
      case 'GATE_PASS': {
        const query: any = { tenantId: tId };
        if (isObjectId) query.$or = [{ _id: identifier }, { gatePassNumber: identifier }];
        else query.gatePassNumber = identifier;
        const gp = await GatePass.findOne(query).exec();
        if (!gp) throw new NotFoundError(`Gate Pass '${identifier}' not found`);
        salesOrderId = gp.salesOrderId;
        break;
      }
      case 'INVOICE': {
        const query: any = { tenantId: tId };
        if (isObjectId) query.$or = [{ _id: identifier }, { invoiceNumber: identifier }];
        else query.invoiceNumber = identifier;
        const inv = await Invoice.findOne(query).exec();
        if (!inv) throw new NotFoundError(`Invoice '${identifier}' not found`);
        salesOrderId = inv.salesOrderId;
        break;
      }
      case 'PAYMENT': {
        const query: any = { tenantId: tId };
        if (isObjectId) query.$or = [{ _id: identifier }, { paymentNumber: identifier }];
        else query.paymentNumber = identifier;
        const pay = await Payment.findOne(query).exec();
        if (!pay) throw new NotFoundError(`Payment '${identifier}' not found`);
        const linkedInv = await Invoice.findOne({ _id: pay.invoiceId, tenantId: tId }).exec();
        if (linkedInv) salesOrderId = linkedInv.salesOrderId;
        break;
      }
    }

    if (!salesOrderId) {
      throw new NotFoundError(`Unable to resolve lineage for ${docType} '${identifier}'`);
    }

    // 2. Fetch all linked documents in the DAG
    const [so, packages, dispatches, gatePasses, invoices] = await Promise.all([
      SalesOrder.findOne({ _id: salesOrderId, tenantId: tId })
        .populate('customerId')
        .populate('warehouseId')
        .populate('items.itemId')
        .populate('items.uomId')
        .exec(),
      Package.find({ salesOrderId, tenantId: tId })
        .populate('items.itemId')
        .populate('items.uomId')
        .populate('packedBy', 'name email')
        .exec(),
      Dispatch.find({ salesOrderId, tenantId: tId })
        .populate('packageIds')
        .populate('dispatchedBy', 'name email')
        .exec(),
      GatePass.find({ salesOrderId, tenantId: tId })
        .populate('securityOfficerId', 'name email')
        .exec(),
      Invoice.find({ salesOrderId, tenantId: tId })
        .populate('items.itemId')
        .populate('items.uomId')
        .exec(),
    ]);

    if (!so) throw new NotFoundError('Sales Order not found');

    const invoiceIds = invoices.map((i) => i._id);
    const payments = await Payment.find({
      invoiceId: { $in: invoiceIds },
      tenantId: tId,
    })
      .populate('receivedBy', 'name email')
      .exec();

    // Collect all inventory transactions linked to this SO or its dispatches
    const inventoryTxnIds: Types.ObjectId[] = [];
    for (const dsp of dispatches) {
      if (dsp.inventoryTransactionIds && dsp.inventoryTransactionIds.length > 0) {
        inventoryTxnIds.push(...dsp.inventoryTransactionIds);
      }
    }

    const inventoryTransactions = await InventoryTransaction.find({
      $or: [
        { _id: { $in: inventoryTxnIds } },
        { referenceType: 'SALES_ORDER', referenceId: so.soNumber, tenantId: tId },
      ],
    })
      .populate('itemId', 'name sku code')
      .populate('warehouseId', 'name code')
      .populate('userId', 'name email')
      .exec();

    return {
      customer: so.customerId,
      salesOrder: so,
      packages,
      dispatches,
      gatePasses,
      invoices,
      payments,
      inventoryTransactions,
    };
  }
}

export const salesTraceabilityService = new SalesTraceabilityService();
