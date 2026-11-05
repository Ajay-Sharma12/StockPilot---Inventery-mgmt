import { Types } from 'mongoose';
import { Item, IItem } from '../models/item.model';
import { InventoryBalance } from '../models/inventoryBalance.model';
import { Category } from '../models/category.model';
import { UOM } from '../models/uom.model';
import { Warehouse } from '../models/warehouse.model';
import { documentNumberService } from './documentNumber.service';
import { BadRequestError, NotFoundError } from '../core/errors';

export interface ItemFilter {
  search?: string;
  categoryId?: string;
  itemType?: string;
  status?: string;
}

export class ItemService {
  async getItems(
    tenantId: string | Types.ObjectId,
    filter: ItemFilter = {},
    page = 1,
    limit = 20
  ): Promise<{ items: any[]; total: number; page: number; limit: number }> {
    const tId = new Types.ObjectId(tenantId);
    const queryFilter: any = { tenantId: tId };

    if (filter.status) {
      queryFilter.status = filter.status;
    } else {
      queryFilter.status = { $ne: 'DISCONTINUED' };
    }

    if (filter.categoryId) {
      queryFilter.categoryId = new Types.ObjectId(filter.categoryId);
    }

    if (filter.itemType) {
      queryFilter.itemType = filter.itemType;
    }

    if (filter.search) {
      const regex = { $regex: filter.search, $options: 'i' };
      queryFilter.$or = [{ sku: regex }, { itemCode: regex }, { name: regex }];
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Item.find(queryFilter)
        .populate('categoryId', 'name code')
        .populate('baseUomId', 'code name symbol')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Item.countDocuments(queryFilter).exec(),
    ]);

    // Enrich with aggregated total stock
    const itemIds = items.map((i) => i._id);
    const stockAgg = await InventoryBalance.aggregate([
      { $match: { tenantId: tId, itemId: { $in: itemIds } } },
      {
        $group: {
          _id: '$itemId',
          totalQuantity: { $sum: '$quantity' },
          totalAvailable: { $sum: '$availableQuantity' },
          totalValue: { $sum: '$totalValue' },
        },
      },
    ]);

    const stockMap = new Map<string, { totalQuantity: number; totalAvailable: number; totalValue: number }>();
    for (const s of stockAgg) {
      stockMap.set(s._id.toString(), {
        totalQuantity: s.totalQuantity,
        totalAvailable: s.totalAvailable,
        totalValue: s.totalValue,
      });
    }

    const enriched = items.map((item) => {
      const stock = stockMap.get(item._id.toString()) || {
        totalQuantity: 0,
        totalAvailable: 0,
        totalValue: 0,
      };

      let stockStatus = 'NORMAL';
      if (stock.totalAvailable <= 0) {
        stockStatus = (item.reorderLevel > 0 || item.minimumStock > 0) ? 'OUT_OF_STOCK' : 'UNSTOCKED';
      } else if (item.minimumStock > 0 && stock.totalAvailable <= item.minimumStock) {
        stockStatus = 'CRITICAL';
      } else if (item.reorderLevel > 0 && stock.totalAvailable <= item.reorderLevel) {
        stockStatus = 'LOW';
      }

      return {
        ...item.toObject(),
        totalQuantity: stock.totalQuantity,
        totalAvailable: stock.totalAvailable,
        totalValue: stock.totalValue,
        stockStatus,
      };
    });

    return { items: enriched, total, page, limit };
  }

  async getItemById(tenantId: string | Types.ObjectId, id: string | Types.ObjectId): Promise<any> {
    const tId = new Types.ObjectId(tenantId);
    const itmId = new Types.ObjectId(id);

    const item = await Item.findOne({ _id: itmId, tenantId: tId })
      .populate('categoryId', 'name code')
      .populate('subCategoryId', 'name code')
      .populate('baseUomId', 'code name symbol')
      .populate('purchaseUomId', 'code name symbol')
      .populate('salesUomId', 'code name symbol')
      .populate('taxCodeId', 'code name rate')
      .exec();

    if (!item) throw new NotFoundError('Item not found');

    // Fetch warehouse breakdown
    const balances = await InventoryBalance.find({ tenantId: tId, itemId: itmId })
      .populate('warehouseId', 'name code')
      .populate('locationId', 'code name')
      .exec();

    return {
      item,
      warehouseStock: balances.map((b) => ({
        id: b._id,
        warehouse: b.warehouseId,
        location: b.locationId,
        batchNumber: b.batchNumber,
        quantity: b.quantity,
        availableQuantity: b.availableQuantity,
        averageCost: b.averageCost,
        totalValue: b.totalValue,
      })),
    };
  }

  async createItem(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    data: Partial<IItem>
  ): Promise<IItem> {
    const tId = new Types.ObjectId(tenantId);

    // Validate SKU
    if (!data.sku) throw new BadRequestError('SKU is required');
    const cleanSku = data.sku.trim().toUpperCase();

    const existingSku = await Item.findOne({ tenantId: tId, sku: cleanSku }).exec();
    if (existingSku) throw new BadRequestError(`SKU '${cleanSku}' already exists in your organization`);

    // Auto-generate or validate item code
    let itemCode = data.itemCode?.trim().toUpperCase();
    if (!itemCode) {
      itemCode = await documentNumberService.getNextNumber(tId, 'ITEM');
    } else {
      const existingCode = await Item.findOne({ tenantId: tId, itemCode }).exec();
      if (existingCode) throw new BadRequestError(`Item Code '${itemCode}' already exists`);
    }

    // Verify Category
    const category = await Category.findOne({ _id: data.categoryId, tenantId: tId }).exec();
    if (!category) throw new BadRequestError('Invalid category');

    // Verify Base UOM
    const uom = await UOM.findOne({ _id: data.baseUomId, tenantId: tId }).exec();
    if (!uom) throw new BadRequestError('Invalid base unit of measure');

    const createdItem = await Item.create({
      ...data,
      sku: cleanSku,
      itemCode,
      tenantId: tId,
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });

    // Handle initial / opening stock if specified by user
    const openingQty = Number((data as any).openingStock || (data as any).initialStock || 0);
    if (openingQty > 0) {
      try {
        let whId = (data as any).initialWarehouseId || (data as any).warehouseId;
        if (!whId) {
          const defaultWh = await Warehouse.findOne({ tenantId: tId, status: { $ne: 'INACTIVE' } }).exec();
          if (defaultWh) whId = defaultWh._id.toString();
        }

        if (whId) {
          const { inventoryService } = await import('./inventory.service');
          await inventoryService.receiveStock(tId, userId, {
            itemId: createdItem._id.toString(),
            warehouseId: whId,
            quantity: openingQty,
            unitCost: Number((data as any).initialUnitCost || data.standardCost || 0),
            batchNumber: (data as any).batchNumber || 'OPENING-STOCK',
            referenceType: 'OPENING_BALANCE',
            reason: 'Initial opening stock registered during SKU creation',
          });
        }
      } catch (stockErr) {
        console.warn('Could not initialize opening stock for item:', stockErr);
      }
    }

    return createdItem;
  }

  async addStock(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    itemId: string | Types.ObjectId,
    data: {
      quantity: number;
      warehouseId?: string;
      unitCost?: number;
      batchNumber?: string;
      notes?: string;
    }
  ): Promise<any> {
    const tId = new Types.ObjectId(tenantId);
    const itmId = new Types.ObjectId(itemId);
    const item = await Item.findOne({ _id: itmId, tenantId: tId }).exec();
    if (!item) throw new NotFoundError('Item not found');

    const qty = Number(data.quantity);
    if (!qty || qty <= 0) {
      throw new BadRequestError('Quantity must be greater than zero');
    }

    let whId = data.warehouseId;
    if (!whId) {
      const defaultWh = await Warehouse.findOne({ tenantId: tId, status: { $ne: 'INACTIVE' } }).exec();
      if (!defaultWh) throw new BadRequestError('No active warehouse found');
      whId = defaultWh._id.toString();
    }

    const { inventoryService } = await import('./inventory.service');
    await inventoryService.receiveStock(tId, userId, {
      itemId: itmId.toString(),
      warehouseId: whId,
      quantity: qty,
      unitCost: Number(data.unitCost ?? item.standardCost ?? 0),
      batchNumber: data.batchNumber || 'STOCK-IN',
      referenceType: 'OPENING_BALANCE',
      reason: data.notes || 'Direct stock addition from Item Master',
    });

    return this.getItemById(tId, itmId);
  }

  async updateItem(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    data: Partial<IItem>
  ): Promise<IItem> {
    const tId = new Types.ObjectId(tenantId);
    const itmId = new Types.ObjectId(id);

    if (data.sku) {
      const cleanSku = data.sku.trim().toUpperCase();
      const existing = await Item.findOne({ tenantId: tId, sku: cleanSku, _id: { $ne: itmId } }).exec();
      if (existing) throw new BadRequestError(`SKU '${cleanSku}' already in use`);
      data.sku = cleanSku;
    }

    const updated = await Item.findOneAndUpdate(
      { _id: itmId, tenantId: tId },
      { $set: { ...data, updatedBy: new Types.ObjectId(userId) } },
      { new: true }
    ).exec();

    if (!updated) throw new NotFoundError('Item not found');
    return updated;
  }

  async bulkImportItems(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    itemsData: Array<any>
  ): Promise<{ imported: number; failed: number; errors: Array<{ sku: string; error: string }> }> {
    const tId = new Types.ObjectId(tenantId);
    if (!Array.isArray(itemsData) || itemsData.length === 0) {
      throw new BadRequestError('Items payload must be a non-empty array');
    }

    if (itemsData.length > 500) {
      throw new BadRequestError('Bulk import batch size cannot exceed 500 items per request');
    }

    const defaultCat = await Category.findOne({ tenantId: tId }).exec();
    const defaultUom = await UOM.findOne({ tenantId: tId }).exec();
    const defaultWh = await Warehouse.findOne({ tenantId: tId, status: { $ne: 'INACTIVE' } }).exec();

    let imported = 0;
    let failed = 0;
    const errors: Array<{ sku: string; error: string }> = [];

    for (const item of itemsData) {
      const rawSku = (item.sku || item.SKU || '').toString().trim().toUpperCase();
      const rawName = (item.name || item.Name || '').toString().trim();

      if (!rawSku || !rawName) {
        failed++;
        errors.push({ sku: rawSku || 'UNKNOWN', error: 'Both SKU and Item Name are required' });
        continue;
      }

      const existing = await Item.findOne({ tenantId: tId, sku: rawSku }).exec();
      if (existing) {
        failed++;
        errors.push({ sku: rawSku, error: `SKU '${rawSku}' already exists in your organization` });
        continue;
      }

      try {
        let catId = item.categoryId;
        if (!catId && item.category) {
          const matchedCat = await Category.findOne({
            tenantId: tId,
            name: { $regex: new RegExp(`^${item.category.trim()}$`, 'i') },
          }).exec();
          catId = matchedCat?._id;
        }
        if (!catId && defaultCat) {
          catId = defaultCat._id;
        }

        let uomId = item.baseUomId || item.uomId;
        if (!uomId && item.uom) {
          const matchedUom = await UOM.findOne({
            tenantId: tId,
            $or: [
              { code: { $regex: new RegExp(`^${item.uom.trim()}$`, 'i') } },
              { name: { $regex: new RegExp(`^${item.uom.trim()}$`, 'i') } },
            ],
          }).exec();
          uomId = matchedUom?._id;
        }
        if (!uomId && defaultUom) {
          uomId = defaultUom._id;
        }

        const itemCode = (item.itemCode || (await documentNumberService.getNextNumber(tId, 'ITEM'))).toUpperCase();

        const created = await Item.create({
          tenantId: tId,
          sku: rawSku,
          itemCode,
          name: rawName,
          description: item.description || '',
          categoryId: catId,
          baseUomId: uomId,
          itemType: item.itemType || 'RAW_MATERIAL',
          standardCost: Number(item.cost || item.standardCost || 0),
          sellingPrice: Number(item.price || item.sellingPrice || 0),
          reorderLevel: Number(item.reorderLevel || 0),
          minimumStock: Number(item.minStock || item.minimumStock || 0),
          maximumStock: Number(item.maxStock || item.maximumStock || 0),
          status: 'ACTIVE',
          createdBy: new Types.ObjectId(userId),
          updatedBy: new Types.ObjectId(userId),
        });

        // Receive opening stock balance if provided
        const openingQty = Number(item.openingStock || item.initialStock || item.quantity || 0);
        if (openingQty > 0 && defaultWh) {
          const { inventoryService } = await import('./inventory.service');
          await inventoryService.receiveStock(tId, userId, {
            itemId: created._id.toString(),
            warehouseId: defaultWh._id.toString(),
            quantity: openingQty,
            unitCost: Number(item.cost || item.standardCost || 0),
            batchNumber: item.batchNumber || 'BATCH-INIT',
            referenceType: 'OPENING_BALANCE',
            reason: 'Opening stock from bulk CSV import',
          });
        }

        imported++;
      } catch (err: any) {
        failed++;
        errors.push({ sku: rawSku, error: err.message || 'Failed to save item' });
      }
    }

    return { imported, failed, errors };
  }

  async deleteItem(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    itemId: string | Types.ObjectId
  ): Promise<{ success: boolean; message: string }> {
    const tId = new Types.ObjectId(tenantId);
    const itmId = new Types.ObjectId(itemId);
    const item = await Item.findOne({ _id: itmId, tenantId: tId }).exec();
    if (!item) throw new NotFoundError('Item not found');

    const { InventoryBalance } = await import('../models/inventoryBalance.model');
    const { InventoryTransaction } = await import('../models/inventoryTransaction.model');

    await InventoryBalance.deleteMany({ itemId: itmId, tenantId: tId });
    await InventoryTransaction.deleteMany({ itemId: itmId, tenantId: tId });
    await Item.deleteOne({ _id: itmId, tenantId: tId });

    return { success: true, message: `Item ${item.sku} deleted successfully` };
  }
}

export const itemService = new ItemService();
