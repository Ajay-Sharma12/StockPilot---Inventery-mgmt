import { Types } from 'mongoose';
import { BOM } from '../models/bom.model';
import { InventoryBalance } from '../../../models/inventoryBalance.model';
import { Item } from '../../../models/item.model';
import { BadRequestError, NotFoundError } from '../../../core/errors';

export interface MaterialRequirementDetail {
  itemId: Types.ObjectId;
  sku: string;
  name: string;
  itemCode: string;
  uomId: Types.ObjectId;
  uomName?: string;
  uomCode?: string;
  baseQuantity: number;
  scrapPercentage: number;
  grossRequiredQuantity: number;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  shortfall: number;
  isAvailable: boolean;
  unitCost: number;
  estimatedCost: number;
  sequence: number;
  operationCode?: string;
}

export interface MaterialRequirementPlan {
  bomId: Types.ObjectId;
  bomNumber: string;
  bomVersion: number;
  finishedItemId: Types.ObjectId;
  finishedItemName: string;
  plannedQuantity: number;
  warehouseId?: Types.ObjectId;
  feasible: boolean;
  totalEstimatedMaterialCost: number;
  components: MaterialRequirementDetail[];
}

export class ProductionPlanningService {
  async calculateMaterialRequirements(
    tenantId: string | Types.ObjectId,
    bomId: string | Types.ObjectId,
    plannedQuantity: number,
    warehouseId?: string | Types.ObjectId
  ): Promise<MaterialRequirementPlan> {
    const tId = new Types.ObjectId(tenantId);
    if (!bomId || !Types.ObjectId.isValid(bomId)) {
      throw new BadRequestError('Invalid or missing BOM identifier');
    }
    const bId = new Types.ObjectId(bomId);
    const whId = warehouseId && Types.ObjectId.isValid(warehouseId) ? new Types.ObjectId(warehouseId) : undefined;

    const bom = await BOM.findOne({ _id: bId, tenantId: tId })
      .populate('finishedItemId', 'sku name itemCode standardCost')
      .populate('components.itemId', 'sku name itemCode standardCost baseUomId')
      .populate('components.uomId', 'code name')
      .exec();

    if (!bom) throw new NotFoundError('Bill of Materials not found');

    const finishedItem: any = bom.finishedItemId;
    const baseBOMQty = bom.quantity || 1;
    const multiplier = plannedQuantity / baseBOMQty;

    let totalEstimatedMaterialCost = 0;
    let feasible = true;

    const components: MaterialRequirementDetail[] = [];

    for (const comp of bom.components) {
      const item: any = comp.itemId;
      const scrapFactor = 1 + (comp.scrapPercentage || 0) / 100;
      const grossRequiredQuantity = Math.round(comp.quantity * multiplier * scrapFactor * 1000) / 1000;

      // Query live inventory balances
      const balanceFilter: any = {
        tenantId: tId,
        itemId: item._id,
      };
      if (whId) balanceFilter.warehouseId = whId;

      const balances = await InventoryBalance.find(balanceFilter).exec();
      const currentStock = balances.reduce((sum, b) => sum + (b.quantity || 0), 0);
      const reservedStock = balances.reduce((sum, b) => sum + (b.reservedQuantity || 0), 0);
      const availableStock = balances.reduce((sum, b) => sum + (b.availableQuantity || 0), 0);

      const shortfall = Math.max(0, Math.round((grossRequiredQuantity - availableStock) * 1000) / 1000);
      const isAvailable = availableStock >= grossRequiredQuantity;
      if (!isAvailable) feasible = false;

      const unitCost = item.standardCost || 0;
      const estimatedCost = Math.round(grossRequiredQuantity * unitCost * 100) / 100;
      totalEstimatedMaterialCost += estimatedCost;

      const uom: any = comp.uomId;

      components.push({
        itemId: item._id,
        sku: item.sku,
        name: item.name,
        itemCode: item.itemCode,
        uomId: uom?._id || comp.uomId,
        uomName: uom?.name,
        uomCode: uom?.code,
        baseQuantity: comp.quantity,
        scrapPercentage: comp.scrapPercentage || 0,
        grossRequiredQuantity,
        currentStock,
        reservedStock,
        availableStock,
        shortfall,
        isAvailable,
        unitCost,
        estimatedCost,
        sequence: comp.sequence || 10,
        operationCode: comp.operationCode,
      });
    }

    return {
      bomId: bom._id,
      bomNumber: bom.bomNumber,
      bomVersion: bom.version,
      finishedItemId: finishedItem._id,
      finishedItemName: finishedItem.name,
      plannedQuantity,
      warehouseId: whId,
      feasible,
      totalEstimatedMaterialCost: Math.round(totalEstimatedMaterialCost * 100) / 100,
      components,
    };
  }

  async getPlanningDashboard(
    tenantId: string | Types.ObjectId,
    warehouseId?: string | Types.ObjectId
  ): Promise<{
    activeBOMsCount: number;
    rawMaterialShortageCount: number;
    lowStockComponents: Array<{ sku: string; name: string; available: number; reorderLevel: number }>;
  }> {
    const tId = new Types.ObjectId(tenantId);
    const whFilter: any = { tenantId: tId };
    if (warehouseId) whFilter.warehouseId = new Types.ObjectId(warehouseId);

    const activeBOMsCount = await BOM.countDocuments({ tenantId: tId, status: 'ACTIVE' }).exec();

    // Find raw materials with low stock
    const rawItems = await Item.find({
      tenantId: tId,
      itemType: { $in: ['RAW_MATERIAL', 'SEMI_FINISHED', 'CONSUMABLE'] },
      status: 'ACTIVE',
    }).exec();

    const lowStockComponents: Array<{ sku: string; name: string; available: number; reorderLevel: number }> = [];

    for (const item of rawItems) {
      const balances = await InventoryBalance.find({ ...whFilter, itemId: item._id }).exec();
      const available = balances.reduce((sum, b) => sum + (b.availableQuantity || 0), 0);
      if (available <= (item.reorderLevel || 0)) {
        lowStockComponents.push({
          sku: item.sku,
          name: item.name,
          available,
          reorderLevel: item.reorderLevel || 0,
        });
      }
    }

    return {
      activeBOMsCount,
      rawMaterialShortageCount: lowStockComponents.length,
      lowStockComponents: lowStockComponents.slice(0, 10),
    };
  }
}

export const productionPlanningService = new ProductionPlanningService();
