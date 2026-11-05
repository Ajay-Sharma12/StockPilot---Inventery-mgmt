import { Types } from 'mongoose';
import { Category, ICategory, SubCategory, ISubCategory } from '../models/category.model';
import { UOM, IUOM, UOMConversion, IUOMConversion } from '../models/uom.model';
import { Supplier, ISupplier } from '../models/supplier.model';
import { Customer, ICustomer } from '../models/customer.model';
import { Department, IDepartment } from '../models/department.model';
import { TaxCode, ITaxCode } from '../models/taxCode.model';
import { PaymentTerm, IPaymentTerm } from '../models/paymentTerm.model';
import { CurrencyMaster, ICurrencyMaster } from '../models/currency.model';
import { WastageReason, StockAdjustmentReason } from '../models/reason.model';
import { Warehouse, Zone } from '../models/warehouse.model';
import { Item } from '../models/item.model';
import { InventoryBalance } from '../models/inventoryBalance.model';
import { InventoryTransaction } from '../models/inventoryTransaction.model';
import { StockTransfer } from '../models/stockTransfer.model';
import { StockAdjustment } from '../models/stockAdjustment.model';
import { Wastage } from '../models/wastage.model';
import { PurchaseOrder } from '../modules/procurement/models/purchaseOrder.model';
import { RFQ } from '../modules/procurement/models/rfq.model';
import { SupplierQuote } from '../modules/procurement/models/supplierQuote.model';
import { GoodsReceiptNote } from '../modules/procurement/models/grn.model';
import { PurchaseQCInspection } from '../modules/procurement/models/purchaseQc.model';
import { documentNumberService } from './documentNumber.service';
import { auditRepository } from '../repositories/audit.repository';
import { AuditAction, AuditEntity } from '../config/constants';
import { BadRequestError, NotFoundError } from '../core/errors';

export class MasterDataService {
  // --- CATEGORIES ---
  async getCategories(tenantId: string | Types.ObjectId): Promise<ICategory[]> {
    return Category.find({ tenantId: new Types.ObjectId(tenantId) }).sort({ name: 1 }).exec();
  }

  async createCategory(tenantId: string | Types.ObjectId, data: Partial<ICategory>): Promise<ICategory> {
    const existing = await Category.findOne({
      tenantId: new Types.ObjectId(tenantId),
      code: data.code?.toUpperCase().trim(),
    }).exec();
    if (existing) {
      throw new BadRequestError(`Category code '${data.code}' already exists`);
    }
    return Category.create({
      ...data,
      code: data.code?.toUpperCase().trim(),
      tenantId: new Types.ObjectId(tenantId),
    });
  }

  async updateCategory(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    data: Partial<ICategory>
  ): Promise<ICategory> {
    const cat = await Category.findOneAndUpdate(
      { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) },
      { $set: data },
      { new: true }
    ).exec();
    if (!cat) throw new NotFoundError('Category not found');
    return cat;
  }

  // --- SUBCATEGORIES ---
  async getSubCategories(tenantId: string | Types.ObjectId, categoryId?: string): Promise<ISubCategory[]> {
    const filter: any = { tenantId: new Types.ObjectId(tenantId) };
    if (categoryId) filter.categoryId = new Types.ObjectId(categoryId);
    return SubCategory.find(filter).populate('categoryId', 'name code').sort({ name: 1 }).exec();
  }

  async createSubCategory(tenantId: string | Types.ObjectId, data: Partial<ISubCategory>): Promise<ISubCategory> {
    const existing = await SubCategory.findOne({
      tenantId: new Types.ObjectId(tenantId),
      categoryId: data.categoryId,
      code: data.code?.toUpperCase().trim(),
    }).exec();
    if (existing) {
      throw new BadRequestError(`Subcategory code '${data.code}' already exists in this category`);
    }
    return SubCategory.create({
      ...data,
      code: data.code?.toUpperCase().trim(),
      tenantId: new Types.ObjectId(tenantId),
    });
  }

  // --- UOM & CONVERSIONS ---
  async getUOMs(tenantId: string | Types.ObjectId): Promise<IUOM[]> {
    return UOM.find({ tenantId: new Types.ObjectId(tenantId) }).sort({ name: 1 }).exec();
  }

  async createUOM(tenantId: string | Types.ObjectId, data: Partial<IUOM>): Promise<IUOM> {
    const existing = await UOM.findOne({
      tenantId: new Types.ObjectId(tenantId),
      code: data.code?.toUpperCase().trim(),
    }).exec();
    if (existing) {
      throw new BadRequestError(`UOM code '${data.code}' already exists`);
    }
    return UOM.create({
      ...data,
      code: data.code?.toUpperCase().trim(),
      tenantId: new Types.ObjectId(tenantId),
    });
  }

  async getUOMConversions(tenantId: string | Types.ObjectId): Promise<IUOMConversion[]> {
    return UOMConversion.find({ tenantId: new Types.ObjectId(tenantId) })
      .populate('fromUomId', 'code name symbol')
      .populate('toUomId', 'code name symbol')
      .exec();
  }

  async createUOMConversion(
    tenantId: string | Types.ObjectId,
    data: Partial<IUOMConversion>
  ): Promise<IUOMConversion> {
    if (data.fromUomId?.toString() === data.toUomId?.toString()) {
      throw new BadRequestError('From UOM and To UOM must be different');
    }
    const existing = await UOMConversion.findOne({
      tenantId: new Types.ObjectId(tenantId),
      fromUomId: data.fromUomId,
      toUomId: data.toUomId,
    }).exec();
    if (existing) {
      throw new BadRequestError('Conversion between these UOMs already exists');
    }
    return UOMConversion.create({
      ...data,
      tenantId: new Types.ObjectId(tenantId),
    });
  }

  // --- SUPPLIERS ---
  async getSuppliers(
    tenantId: string | Types.ObjectId,
    page = 1,
    limit = 20,
    search?: string,
    status?: string
  ): Promise<{ items: ISupplier[]; total: number; page: number; limit: number; totalPages: number }> {
    const filter: any = { tenantId: new Types.ObjectId(tenantId) };
    if (status && status !== 'ALL') {
      filter.status = status.toUpperCase();
    }
    if (search) {
      filter.$or = [
        { supplierCode: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Supplier.find(filter)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Supplier.countDocuments(filter).exec(),
    ]);
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getSupplierById(tenantId: string | Types.ObjectId, id: string | Types.ObjectId): Promise<ISupplier> {
    const supplier = await Supplier.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    })
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .exec();
    if (!supplier) throw new NotFoundError('Supplier not found');
    return supplier;
  }

  async createSupplier(
    tenantId: string | Types.ObjectId,
    data: Partial<ISupplier>,
    userId?: string | Types.ObjectId
  ): Promise<ISupplier> {
    const tId = new Types.ObjectId(tenantId);
    let code = data.supplierCode?.toUpperCase().trim();
    if (!code) {
      try {
        code = await documentNumberService.getNextNumber(tId, 'SUPPLIER');
      } catch {
        code = `SUP-${Date.now().toString().slice(-6)}`;
      }
    }

    const existing = await Supplier.findOne({
      tenantId: tId,
      supplierCode: code,
    }).exec();
    if (existing) {
      throw new BadRequestError(`Supplier code '${code}' already exists`);
    }

    const emailVal = data.email || (data as any).contactEmail || '';
    const taxVal = data.taxNumber || (data as any).taxId || '';

    const supplier = await Supplier.create({
      ...data,
      email: emailVal,
      contactEmail: emailVal,
      taxNumber: taxVal,
      taxId: taxVal,
      supplierCode: code,
      creditLimit: data.creditLimit !== undefined ? Number(data.creditLimit) : 0,
      leadTimeDays: data.leadTimeDays !== undefined ? Number(data.leadTimeDays) : 7,
      minOrderValue: data.minOrderValue !== undefined ? Number(data.minOrderValue) : 0,
      rating: data.rating !== undefined ? Number(data.rating) : 3,
      status: data.status || 'ACTIVE',
      tenantId: tId,
      createdBy: userId ? new Types.ObjectId(userId) : undefined,
      updatedBy: userId ? new Types.ObjectId(userId) : undefined,
    });

    if (userId) {
      await auditRepository.create({
        tenantId: tId,
        userId: new Types.ObjectId(userId),
        action: AuditAction.CREATE,
        entity: AuditEntity.PURCHASE,
        entityId: supplier._id.toString(),
        details: `Created supplier ${supplier.name} (${supplier.supplierCode})`,
      });
    }

    return supplier;
  }

  async updateSupplier(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    data: Partial<ISupplier>,
    userId?: string | Types.ObjectId
  ): Promise<ISupplier> {
    const tId = new Types.ObjectId(tenantId);
    const sId = new Types.ObjectId(id);

    if (data.supplierCode) {
      const existing = await Supplier.findOne({
        tenantId: tId,
        supplierCode: data.supplierCode.toUpperCase().trim(),
        _id: { $ne: sId },
      }).exec();
      if (existing) {
        throw new BadRequestError(`Supplier code '${data.supplierCode}' is already taken by another supplier`);
      }
      data.supplierCode = data.supplierCode.toUpperCase().trim();
    }

    const updatePayload: any = { ...data };
    if (data.email !== undefined || (data as any).contactEmail !== undefined) {
      const emailVal = data.email || (data as any).contactEmail || '';
      updatePayload.email = emailVal;
      updatePayload.contactEmail = emailVal;
    }
    if (data.taxNumber !== undefined || (data as any).taxId !== undefined) {
      const taxVal = data.taxNumber || (data as any).taxId || '';
      updatePayload.taxNumber = taxVal;
      updatePayload.taxId = taxVal;
    }
    if (userId) {
      updatePayload.updatedBy = new Types.ObjectId(userId);
    }

    const supplier = await Supplier.findOneAndUpdate(
      { _id: sId, tenantId: tId },
      { $set: updatePayload },
      { new: true }
    )
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .exec();

    if (!supplier) throw new NotFoundError('Supplier not found');

    if (userId) {
      await auditRepository.create({
        tenantId: tId,
        userId: new Types.ObjectId(userId),
        action: AuditAction.UPDATE,
        entity: AuditEntity.PURCHASE,
        entityId: supplier._id.toString(),
        details: `Updated supplier details for ${supplier.name} (${supplier.supplierCode})`,
      });
    }

    return supplier;
  }

  async changeSupplierStatus(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED',
    userId?: string | Types.ObjectId
  ): Promise<ISupplier> {
    const tId = new Types.ObjectId(tenantId);
    const sId = new Types.ObjectId(id);

    const supplier = await Supplier.findOneAndUpdate(
      { _id: sId, tenantId: tId },
      { $set: { status, updatedBy: userId ? new Types.ObjectId(userId) : undefined } },
      { new: true }
    ).exec();

    if (!supplier) throw new NotFoundError('Supplier not found');

    if (userId) {
      await auditRepository.create({
        tenantId: tId,
        userId: new Types.ObjectId(userId),
        action: AuditAction.STATUS_CHANGE,
        entity: AuditEntity.PURCHASE,
        entityId: supplier._id.toString(),
        details: `Changed supplier ${supplier.name} status to ${status}`,
      });
    }

    return supplier;
  }

  async getSupplierPerformance(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<{
    supplierId: string;
    supplierName: string;
    supplierCode: string;
    totalOrders: number;
    totalPurchaseValue: number;
    orderedQuantity: number;
    receivedQuantity: number;
    rejectedQuantity: number;
    onTimeDeliveryRate: number;
    qualityPassRate: number;
    rejectionRate: number;
    averageDeliveryDays: number;
    purchaseReturnQuantity: number;
    outstandingAmount: number;
    status: string;
  }> {
    const tId = new Types.ObjectId(tenantId);
    const sId = new Types.ObjectId(id);

    const supplier = await Supplier.findOne({ _id: sId, tenantId: tId }).exec();
    if (!supplier) throw new NotFoundError('Supplier not found');

    const [pos, grns] = await Promise.all([
      PurchaseOrder.find({ tenantId: tId, supplierId: sId }).exec(),
      GoodsReceiptNote.find({ tenantId: tId, supplierId: sId }).exec(),
    ]);

    const validPOs = pos.filter((p) => p.status !== 'CANCELLED');
    const totalOrders = validPOs.length;
    const totalPurchaseValue = Math.round(
      validPOs.reduce((acc, p) => acc + (p.total || p.subtotal || 0), 0) * 100
    ) / 100;

    let orderedQuantity = 0;
    for (const po of validPOs) {
      for (const item of po.items) {
        orderedQuantity += item.quantity || 0;
      }
    }

    let receivedQuantity = 0;
    let rejectedQuantity = 0;
    const validGRNs = grns.filter((g) => g.status !== 'CANCELLED');
    for (const grn of validGRNs) {
      for (const item of grn.items) {
        receivedQuantity += item.acceptedQuantity || item.receivedQuantity || 0;
        rejectedQuantity += item.rejectedQuantity || 0;
      }
    }

    // On-Time Delivery Rate & Average Delivery Days
    let onTimeCount = 0;
    let deliveredCount = 0;
    let totalDeliveryDays = 0;
    let deliveryDaysSamples = 0;

    for (const po of validPOs) {
      const linkedGrns = validGRNs.filter((g) => g.purchaseOrderId.toString() === po._id.toString());
      if (linkedGrns.length > 0) {
        deliveredCount++;
        // Check latest receipt date
        const latestReceipt = linkedGrns.reduce((latest, g) =>
          new Date(g.receiptDate) > new Date(latest.receiptDate) ? g : latest
        );

        if (po.expectedDeliveryDate) {
          if (new Date(latestReceipt.receiptDate) <= new Date(po.expectedDeliveryDate)) {
            onTimeCount++;
          }
        } else {
          onTimeCount++;
        }

        const days = Math.max(
          0,
          Math.round(
            (new Date(latestReceipt.receiptDate).getTime() - new Date(po.orderDate).getTime()) /
              (1000 * 3600 * 24)
          )
        );
        totalDeliveryDays += days;
        deliveryDaysSamples++;
      }
    }

    const onTimeDeliveryRate =
      deliveredCount > 0 ? Math.round((onTimeCount / deliveredCount) * 1000) / 10 : 100;

    const totalInspected = receivedQuantity + rejectedQuantity;
    const qualityPassRate =
      totalInspected > 0 ? Math.round((receivedQuantity / totalInspected) * 1000) / 10 : 100;
    const rejectionRate =
      totalInspected > 0 ? Math.round((rejectedQuantity / totalInspected) * 1000) / 10 : 0;
    const averageDeliveryDays =
      deliveryDaysSamples > 0 ? Math.round((totalDeliveryDays / deliveryDaysSamples) * 10) / 10 : 0;

    // Outstanding open PO amounts
    const openPOs = validPOs.filter(
      (p) => p.status !== 'CLOSED' && p.status !== 'FULLY_RECEIVED'
    );
    const outstandingAmount = Math.round(
      openPOs.reduce((acc, p) => acc + (p.total || p.subtotal || 0), 0) * 100
    ) / 100;

    return {
      supplierId: supplier._id.toString(),
      supplierName: supplier.name,
      supplierCode: supplier.supplierCode,
      totalOrders,
      totalPurchaseValue,
      orderedQuantity: Math.round(orderedQuantity * 100) / 100,
      receivedQuantity: Math.round(receivedQuantity * 100) / 100,
      rejectedQuantity: Math.round(rejectedQuantity * 100) / 100,
      onTimeDeliveryRate,
      qualityPassRate,
      rejectionRate,
      averageDeliveryDays,
      purchaseReturnQuantity: Math.round(rejectedQuantity * 100) / 100,
      outstandingAmount,
      status: supplier.status,
    };
  }

  async getSupplierPerformanceMatrix(tenantId: string | Types.ObjectId): Promise<any[]> {
    const tId = new Types.ObjectId(tenantId);
    const suppliers = await Supplier.find({ tenantId: tId }).sort({ name: 1 }).exec();

    const matrix = await Promise.all(
      suppliers.map((s) => this.getSupplierPerformance(tId, s._id))
    );

    return matrix;
  }

  async getSupplierHistory(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<{
    supplier: ISupplier;
    purchaseOrders: any[];
    rfqs: any[];
    quotes: any[];
    goodsReceipts: any[];
    qcInspections: any[];
    metrics: any;
    uniqueProducts: any[];
  }> {
    const tId = new Types.ObjectId(tenantId);
    const sId = new Types.ObjectId(id);

    const supplier = await this.getSupplierById(tId, sId);

    const [pos, rfqs, quotes, grns, metrics] = await Promise.all([
      PurchaseOrder.find({ tenantId: tId, supplierId: sId })
        .populate('items.itemId', 'sku name itemCode standardCost')
        .populate('warehouseId', 'name code')
        .sort({ orderDate: -1 })
        .limit(50)
        .exec(),
      RFQ.find({ tenantId: tId, 'suppliers.supplierId': sId })
        .populate('items.itemId', 'sku name itemCode')
        .sort({ createdAt: -1 })
        .limit(50)
        .exec(),
      SupplierQuote.find({ tenantId: tId, supplierId: sId })
        .populate('rfqId', 'rfqNumber title')
        .populate('items.itemId', 'sku name itemCode')
        .sort({ quoteDate: -1 })
        .limit(50)
        .exec(),
      GoodsReceiptNote.find({ tenantId: tId, supplierId: sId })
        .populate('purchaseOrderId', 'poNumber')
        .populate('warehouseId', 'name code')
        .populate('items.itemId', 'sku name itemCode')
        .sort({ receiptDate: -1 })
        .limit(50)
        .exec(),
      this.getSupplierPerformance(tId, sId),
    ]);

    const grnIds = grns.map((g) => g._id);
    const qcInspections = await PurchaseQCInspection.find({
      tenantId: tId,
      grnId: { $in: grnIds },
    })
      .populate('itemId', 'sku name itemCode')
      .populate('inspectorId', 'name email')
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();

    // Compile unique products bought from this supplier
    const productMap = new Map<string, any>();
    for (const po of pos) {
      for (const line of po.items) {
        const item: any = line.itemId;
        if (item && item._id && !productMap.has(item._id.toString())) {
          productMap.set(item._id.toString(), {
            _id: item._id,
            sku: item.sku,
            name: item.name,
            itemCode: item.itemCode,
            standardCost: item.standardCost,
          });
        }
      }
    }

    return {
      supplier,
      purchaseOrders: pos,
      rfqs,
      quotes,
      goodsReceipts: grns,
      qcInspections,
      metrics,
      uniqueProducts: Array.from(productMap.values()),
    };
  }

  // --- CUSTOMERS ---
  async getCustomers(
    tenantId: string | Types.ObjectId,
    page = 1,
    limit = 20,
    search?: string
  ): Promise<{ items: ICustomer[]; total: number; page: number; limit: number }> {
    const filter: any = { tenantId: new Types.ObjectId(tenantId) };
    if (search) {
      filter.$or = [
        { customerCode: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Customer.find(filter).sort({ name: 1 }).skip(skip).limit(limit).exec(),
      Customer.countDocuments(filter).exec(),
    ]);
    return { items, total, page, limit };
  }

  async getCustomerById(tenantId: string | Types.ObjectId, id: string | Types.ObjectId): Promise<ICustomer> {
    const customer = await Customer.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    }).exec();
    if (!customer) throw new NotFoundError('Customer not found');
    return customer;
  }

  async createCustomer(tenantId: string | Types.ObjectId, data: Partial<ICustomer>): Promise<ICustomer> {
    const existing = await Customer.findOne({
      tenantId: new Types.ObjectId(tenantId),
      customerCode: data.customerCode?.toUpperCase().trim(),
    }).exec();
    if (existing) {
      throw new BadRequestError(`Customer code '${data.customerCode}' already exists`);
    }
    return Customer.create({
      ...data,
      customerCode: data.customerCode?.toUpperCase().trim(),
      tenantId: new Types.ObjectId(tenantId),
    });
  }

  async updateCustomer(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    data: Partial<ICustomer>
  ): Promise<ICustomer> {
    const customer = await Customer.findOneAndUpdate(
      { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) },
      { $set: data },
      { new: true }
    ).exec();
    if (!customer) throw new NotFoundError('Customer not found');
    return customer;
  }

  // --- DEPARTMENTS ---
  async getDepartments(tenantId: string | Types.ObjectId): Promise<IDepartment[]> {
    return Department.find({ tenantId: new Types.ObjectId(tenantId) })
      .populate('managerId', 'name email')
      .sort({ name: 1 })
      .exec();
  }

  async createDepartment(tenantId: string | Types.ObjectId, data: Partial<IDepartment>): Promise<IDepartment> {
    const existing = await Department.findOne({
      tenantId: new Types.ObjectId(tenantId),
      code: data.code?.toUpperCase().trim(),
    }).exec();
    if (existing) throw new BadRequestError(`Department code '${data.code}' already exists`);
    return Department.create({
      ...data,
      code: data.code?.toUpperCase().trim(),
      tenantId: new Types.ObjectId(tenantId),
    });
  }

  // --- TAX CODES ---
  async getTaxCodes(tenantId: string | Types.ObjectId): Promise<ITaxCode[]> {
    return TaxCode.find({ tenantId: new Types.ObjectId(tenantId) }).sort({ rate: 1 }).exec();
  }

  async createTaxCode(tenantId: string | Types.ObjectId, data: Partial<ITaxCode>): Promise<ITaxCode> {
    const existing = await TaxCode.findOne({
      tenantId: new Types.ObjectId(tenantId),
      code: data.code?.toUpperCase().trim(),
    }).exec();
    if (existing) throw new BadRequestError(`Tax code '${data.code}' already exists`);
    return TaxCode.create({
      ...data,
      code: data.code?.toUpperCase().trim(),
      tenantId: new Types.ObjectId(tenantId),
    });
  }

  // --- PAYMENT TERMS ---
  async getPaymentTerms(tenantId: string | Types.ObjectId): Promise<IPaymentTerm[]> {
    return PaymentTerm.find({ tenantId: new Types.ObjectId(tenantId) }).sort({ days: 1 }).exec();
  }

  async createPaymentTerm(tenantId: string | Types.ObjectId, data: Partial<IPaymentTerm>): Promise<IPaymentTerm> {
    const existing = await PaymentTerm.findOne({
      tenantId: new Types.ObjectId(tenantId),
      code: data.code?.toUpperCase().trim(),
    }).exec();
    if (existing) throw new BadRequestError(`Payment term code '${data.code}' already exists`);
    return PaymentTerm.create({
      ...data,
      code: data.code?.toUpperCase().trim(),
      tenantId: new Types.ObjectId(tenantId),
    });
  }

  // --- CURRENCIES ---
  async getCurrencies(tenantId: string | Types.ObjectId): Promise<ICurrencyMaster[]> {
    return CurrencyMaster.find({ tenantId: new Types.ObjectId(tenantId) }).sort({ code: 1 }).exec();
  }

  async createCurrency(tenantId: string | Types.ObjectId, data: Partial<ICurrencyMaster>): Promise<ICurrencyMaster> {
    const existing = await CurrencyMaster.findOne({
      tenantId: new Types.ObjectId(tenantId),
      code: data.code?.toUpperCase().trim(),
    }).exec();
    if (existing) throw new BadRequestError(`Currency code '${data.code}' already exists`);
    return CurrencyMaster.create({
      ...data,
      code: data.code?.toUpperCase().trim(),
      tenantId: new Types.ObjectId(tenantId),
    });
  }

  // --- REASONS ---
  async getWastageReasons(tenantId: string | Types.ObjectId) {
    return WastageReason.find({ tenantId: new Types.ObjectId(tenantId), status: 'ACTIVE' }).sort({ name: 1 }).exec();
  }

  async createWastageReason(tenantId: string | Types.ObjectId, data: { code: string; name: string; description?: string }) {
    const existing = await WastageReason.findOne({
      tenantId: new Types.ObjectId(tenantId),
      code: data.code.toUpperCase().trim(),
    }).exec();
    if (existing) throw new BadRequestError(`Wastage reason code '${data.code}' already exists`);
    return WastageReason.create({
      ...data,
      code: data.code.toUpperCase().trim(),
      tenantId: new Types.ObjectId(tenantId),
    });
  }

  async getStockAdjustmentReasons(tenantId: string | Types.ObjectId) {
    return StockAdjustmentReason.find({ tenantId: new Types.ObjectId(tenantId), status: 'ACTIVE' }).sort({ name: 1 }).exec();
  }

  async createStockAdjustmentReason(tenantId: string | Types.ObjectId, data: { code: string; name: string; description?: string }) {
    const existing = await StockAdjustmentReason.findOne({
      tenantId: new Types.ObjectId(tenantId),
      code: data.code.toUpperCase().trim(),
    }).exec();
    if (existing) throw new BadRequestError(`Adjustment reason code '${data.code}' already exists`);
    return StockAdjustmentReason.create({
      ...data,
      code: data.code.toUpperCase().trim(),
      tenantId: new Types.ObjectId(tenantId),
    });
  }

  // --- STARTER MASTER DATA PROVISIONING ---
  async initializeStarterData(
    tenantId: string | Types.ObjectId,
    adminUserId?: string | Types.ObjectId
  ): Promise<{
    categoriesCreated: number;
    uomsCreated: number;
    warehousesCreated: number;
    reasonsCreated: number;
  }> {
    const tId = new Types.ObjectId(tenantId);
    const uId = adminUserId ? new Types.ObjectId(adminUserId) : undefined;

    let categoriesCreated = 0;
    let uomsCreated = 0;
    let warehousesCreated = 0;
    let reasonsCreated = 0;

    // 1. Starter Categories
    const existingCats = await Category.countDocuments({ tenantId: tId });
    if (existingCats === 0) {
      const defaultCategories = [
        { name: 'Raw Materials', code: 'RAW_MAT', description: 'Direct materials used in production assembly and fabrication' },
        { name: 'Finished Goods', code: 'FIN_GOOD', description: 'Completed products ready for customer fulfillment' },
        { name: 'Packaging Materials', code: 'PKG_MAT', description: 'Boxes, crates, cartons, and protective shipping supplies' },
        { name: 'General Inventory', code: 'GEN_INV', description: 'Standard commercial inventory products and supplies' },
        { name: 'Consumables & Tools', code: 'CONSUM', description: 'Workshop consumables, maintenance tools, and operating supplies' },
      ];
      for (const cat of defaultCategories) {
        await Category.create({ ...cat, tenantId: tId, status: 'ACTIVE', createdBy: uId });
        categoriesCreated++;
      }
    }

    // 2. Starter Units of Measure (UOM)
    const existingUoms = await UOM.countDocuments({ tenantId: tId });
    if (existingUoms === 0) {
      const defaultUoms = [
        { name: 'Pieces', code: 'PCS', symbol: 'pc', type: 'COUNT', decimalPrecision: 0 },
        { name: 'Kilogram', code: 'KG', symbol: 'kg', type: 'WEIGHT', decimalPrecision: 2 },
        { name: 'Liter', code: 'LTR', symbol: 'L', type: 'VOLUME', decimalPrecision: 2 },
        { name: 'Box', code: 'BOX', symbol: 'bx', type: 'PACKAGING', decimalPrecision: 0 },
        { name: 'Meter', code: 'MTR', symbol: 'm', type: 'LENGTH', decimalPrecision: 2 },
      ];
      for (const u of defaultUoms) {
        await UOM.create({ ...u, tenantId: tId, status: 'ACTIVE' });
        uomsCreated++;
      }
    }

    // 3. Starter Default Facility Warehouse
    const existingWh = await Warehouse.countDocuments({ tenantId: tId });
    if (existingWh === 0) {
      const defaultWh = await Warehouse.create({
        tenantId: tId,
        code: 'WH-MAIN',
        name: 'Main Distribution Center',
        type: 'MAIN',
        address: {
          street: '100 Industrial Parkway',
          city: 'Corporate Depot',
          state: 'State',
          country: 'USA',
        },
        status: 'ACTIVE',
      });
      await Zone.create({
        tenantId: tId,
        warehouseId: defaultWh._id,
        code: 'ZONE-A',
        name: 'General Storage Bay A',
        status: 'ACTIVE',
      });
      warehousesCreated++;
    }

    // 4. Starter Stock Adjustment Reasons
    const existingAdj = await StockAdjustmentReason.countDocuments({ tenantId: tId });
    if (existingAdj === 0) {
      const defaultAdjReasons = [
        { code: 'REA-VAR', name: 'Physical Count Discrepancy', description: 'Variance identified during physical inventory audit' },
        { code: 'REA-DMG', name: 'Damaged in Storage', description: 'Internal facility damage or packaging breakage' },
        { code: 'REA-EXP', name: 'Expired / Shelf-Life Exceeded', description: 'Material exceeded expiration threshold' },
        { code: 'REA-AUD', name: 'Routine Audit Reconciliation', description: 'Administrative correction after count validation' },
      ];
      for (const r of defaultAdjReasons) {
        await StockAdjustmentReason.create({ ...r, tenantId: tId, status: 'ACTIVE' });
        reasonsCreated++;
      }
    }

    // 5. Starter Wastage Reasons
    const existingWst = await WastageReason.countDocuments({ tenantId: tId });
    if (existingWst === 0) {
      const defaultWstReasons = [
        { code: 'WST-DMG', name: 'Damaged in Handling', description: 'Broken or ruined during warehouse movement' },
        { code: 'WST-DEF', name: 'Supplier / Factory Defect', description: 'Inherent product defects detected on arrival' },
        { code: 'WST-EXP', name: 'Expired / Obsolete Material', description: 'Written off due to obsolescence or expiry' },
        { code: 'WST-SCRAP', name: 'Operational Scrap', description: 'Off-cuts, shavings, or packaging scrap' },
      ];
      for (const r of defaultWstReasons) {
        await WastageReason.create({ ...r, tenantId: tId, status: 'ACTIVE' });
        reasonsCreated++;
      }
    }

    // 6. Starter Tax Codes & Payment Terms
    const existingTax = await TaxCode.countDocuments({ tenantId: tId });
    if (existingTax === 0) {
      await TaxCode.create({ tenantId: tId, code: 'TAX-EXEMPT', name: 'Tax Exempt / Zero Rate', rate: 0, status: 'ACTIVE' });
      await TaxCode.create({ tenantId: tId, code: 'TAX-STD', name: 'Standard GST / VAT', rate: 18, status: 'ACTIVE' });
    }

    const existingTerms = await PaymentTerm.countDocuments({ tenantId: tId });
    if (existingTerms === 0) {
      await PaymentTerm.create({ tenantId: tId, code: 'NET30', name: 'Net 30 Days', days: 30, status: 'ACTIVE' });
      await PaymentTerm.create({ tenantId: tId, code: 'DUE-RECEIPT', name: 'Due Upon Receipt', days: 0, status: 'ACTIVE' });
    }

    // 7. Starter Currencies (Document Phase 2 requirement)
    const existingCurrencies = await CurrencyMaster.countDocuments({ tenantId: tId });
    if (existingCurrencies === 0) {
      await CurrencyMaster.create({ tenantId: tId, code: 'USD', name: 'US Dollar', symbol: '$', decimalPrecision: 2, isDefault: true, status: 'ACTIVE' });
      await CurrencyMaster.create({ tenantId: tId, code: 'EUR', name: 'Euro', symbol: '€', decimalPrecision: 2, isDefault: false, status: 'ACTIVE' });
      await CurrencyMaster.create({ tenantId: tId, code: 'GBP', name: 'British Pound', symbol: '£', decimalPrecision: 2, isDefault: false, status: 'ACTIVE' });
      await CurrencyMaster.create({ tenantId: tId, code: 'INR', name: 'Indian Rupee', symbol: '₹', decimalPrecision: 2, isDefault: false, status: 'ACTIVE' });
    }

    // 8. Starter Departments (Phase 3 Requisitions requirement)
    const existingDepts = await Department.countDocuments({ tenantId: tId });
    if (existingDepts === 0) {
      const defaultDepts = [
        { code: 'OPS', name: 'Operations & Logistics', description: 'Warehouse, dispatch, and material handling' },
        { code: 'PROC', name: 'Procurement & Purchasing', description: 'Sourcing, vendor management, and purchase requisitions' },
        { code: 'MFG', name: 'Production & Manufacturing', description: 'Assembly lines, fabrication, and shop floor' },
        { code: 'QA', name: 'Quality Assurance & QC', description: 'Inspection, standards compliance, and testing' },
        { code: 'EXEC', name: 'Executive Administration', description: 'Corporate governance and general management' },
        { code: 'MAINT', name: 'Maintenance & Facility', description: 'Plant equipment, tooling, and infrastructure' },
        { code: 'FIN', name: 'Finance & Accounts', description: 'Commercial accounting and cost management' },
      ];
      for (const d of defaultDepts) {
        await Department.create({ ...d, tenantId: tId, status: 'ACTIVE' });
      }
    }

    // 8. Starter Subcategories (Document Phase 2 requirement)
    const rawCat = await Category.findOne({ tenantId: tId, code: 'RAW_MAT' });
    if (rawCat) {
      const existingSub = await SubCategory.countDocuments({ tenantId: tId, categoryId: rawCat._id });
      if (existingSub === 0) {
        await SubCategory.create({ tenantId: tId, categoryId: rawCat._id, code: 'METALS', name: 'Metals & Alloys', status: 'ACTIVE' });
        await SubCategory.create({ tenantId: tId, categoryId: rawCat._id, code: 'POLYMERS', name: 'Plastics & Polymers', status: 'ACTIVE' });
      }
    }
    const fgCat = await Category.findOne({ tenantId: tId, code: 'FIN_GOOD' });
    if (fgCat) {
      const existingSubFg = await SubCategory.countDocuments({ tenantId: tId, categoryId: fgCat._id });
      if (existingSubFg === 0) {
        await SubCategory.create({ tenantId: tId, categoryId: fgCat._id, code: 'ELECTRONICS', name: 'Electronic Assemblies', status: 'ACTIVE' });
        await SubCategory.create({ tenantId: tId, categoryId: fgCat._id, code: 'MECHANICAL', name: 'Mechanical Systems', status: 'ACTIVE' });
      }
    }

    return { categoriesCreated, uomsCreated, warehousesCreated, reasonsCreated };
  }

  // --- CLEAR DUMMY / SAMPLE PHASE 2 DATA ---
  async clearSampleData(tenantId: string | Types.ObjectId): Promise<{
    itemsDeleted: number;
    balancesCleared: number;
    transactionsCleared: number;
  }> {
    const tId = new Types.ObjectId(tenantId);

    // 1. Remove all inventory transactions & balances for tenant
    const txRes = await InventoryTransaction.deleteMany({ tenantId: tId });
    const balRes = await InventoryBalance.deleteMany({ tenantId: tId });

    // 2. Remove sample/demo stock transfers, adjustments, and wastages
    await StockTransfer.deleteMany({ tenantId: tId });
    await StockAdjustment.deleteMany({ tenantId: tId });
    await Wastage.deleteMany({ tenantId: tId });

    // 3. Remove sample demo items (items with sample SKUs)
    const demoSkus = ['RM-STEEL-01', 'RM-ALUM-02', 'FG-TURB-01', 'PKG-BOX-24', 'CN-LUBR-50', 'AERO-ALU-7075', 'TURB-BLADE-V4', 'HYDR-PUMP-X2'];
    const itmRes = await Item.deleteMany({
      tenantId: tId,
      $or: [
        { sku: { $in: demoSkus } },
        { sku: { $regex: /^(RM-|FG-|PKG-|CN-|DEMO-|SAMPLE-)/i } },
      ],
    });

    // 4. Ensure clean starter categories and warehouse WH-MAIN exist
    await this.initializeStarterData(tId);

    return {
      itemsDeleted: itmRes.deletedCount || 0,
      balancesCleared: balRes.deletedCount || 0,
      transactionsCleared: txRes.deletedCount || 0,
    };
  }
}

export const masterDataService = new MasterDataService();
