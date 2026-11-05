import { Types } from 'mongoose';
import { Item } from '../../../models/item.model';
import { InventoryBalance } from '../../../models/inventoryBalance.model';
import { InventoryTransaction } from '../../../models/inventoryTransaction.model';
import { Supplier } from '../../../models/supplier.model';
import { Warehouse } from '../../../models/warehouse.model';
import { PurchaseOrder } from '../../procurement/models/purchaseOrder.model';
import { PurchaseQCInspection } from '../../procurement/models/purchaseQc.model';
import { ProductionOrder } from '../../production/models/productionOrder.model';
import { BOM } from '../../production/models/bom.model';
import { AIAudit } from '../models/aiAudit.model';
import { aiProvider, AIInsightItem } from './aiProvider.service';
import { documentNumberService } from '../../../services/documentNumber.service';
import { NotFoundError, BadRequestError } from '../../../core/errors';

export interface UserContextScope {
  userId: string | Types.ObjectId;
  tenantId: string | Types.ObjectId;
  permissions?: string[];
  warehouses?: string[];
  isSuperAdmin?: boolean;
}

export interface AIKPISummary {
  criticalAlertsCount: number;
  itemsUnderSevenDaysRunway: number;
  totalCapitalTrapped: number;
  highRiskSuppliersCount: number;
  activeProductionBottlenecks: number;
  healthScore: number;
}

export class AIContextService {
  async getOperationalInsights(scope: UserContextScope): Promise<{
    insights: AIInsightItem[];
    kpiSummary: AIKPISummary;
    metadata: {
      generatedAt: Date;
      analyzedEntitiesCount: number;
      tenantIsolationEnforced: boolean;
      dataScope: string[];
    };
  }> {
    const tId = new Types.ObjectId(scope.tenantId);
    const uId = new Types.ObjectId(scope.userId);

    // 1. Gather Authorized Tenant Items At Risk of Stockout
    const items = await Item.find({ tenantId: tId, status: 'ACTIVE' }).exec();
    const itemsAtRisk: any[] = [];
    const deadItems: any[] = [];

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    for (const item of items) {
      const balances = await InventoryBalance.find({ tenantId: tId, itemId: item._id }).exec();
      const current = balances.reduce((s, b) => s + (b.quantity || 0), 0);
      const available = balances.reduce((s, b) => s + (b.availableQuantity || 0), 0);
      const totalVal = balances.reduce((s, b) => s + (b.totalValue || 0), 0);

      // Calculate recent 30-day consumption velocity to determine daily burn rate
      const recentOutTxns = await InventoryTransaction.find({
        tenantId: tId,
        itemId: item._id,
        quantityOut: { $gt: 0 },
        transactionDate: { $gte: thirtyDaysAgo },
      }).select('quantityOut').exec();

      const totalConsumed30d = recentOutTxns.reduce((s, t) => s + (t.quantityOut || 0), 0);
      const dailyBurnRate = totalConsumed30d > 0
        ? Math.round((totalConsumed30d / 30) * 10) / 10
        : Math.max(1, Math.round((item.reorderLevel || 10) / 7));

      if (available <= (item.reorderLevel || 10) || available / dailyBurnRate <= 7) {
        itemsAtRisk.push({
          id: item._id.toString(),
          sku: item.sku,
          name: item.name,
          availableQuantity: available,
          reorderLevel: item.reorderLevel || 10,
          dailyBurnRate,
          standardCost: item.standardCost || 0,
        });
      }

      // Check for dead stock (holding inventory with 0 movements in last 60 days)
      if (current > 0) {
        const recentTxns = await InventoryTransaction.countDocuments({
          tenantId: tId,
          itemId: item._id,
          transactionDate: { $gte: sixtyDaysAgo },
        }).exec();

        if (recentTxns === 0) {
          deadItems.push({
            id: item._id.toString(),
            sku: item.sku,
            name: item.name,
            quantity: current,
            valuation: Math.round(totalVal * 100) / 100,
          });
        }
      }
    }

    // 2. Gather Supplier Quality Metrics
    const suppliers = await Supplier.find({ tenantId: tId, status: 'ACTIVE' }).limit(15).exec();
    const supplierMetrics: any[] = [];

    for (const sup of suppliers) {
      const pos = await PurchaseOrder.find({ tenantId: tId, supplierId: sup._id }).exec();
      const qcRecords = await PurchaseQCInspection.find({ tenantId: tId }).exec();
      const totalInspected = qcRecords.reduce((s, q) => s + (q.inspectedQuantity || 0), 0);
      const rejected = qcRecords.reduce((s, q) => s + (q.rejectedQuantity || 0), 0);
      const defectRate = totalInspected > 0 ? Math.round((rejected / totalInspected) * 1000) / 10 : 2;

      supplierMetrics.push({
        id: sup._id.toString(),
        name: sup.name,
        defectRate,
        openPOCount: pos.filter((p) => p.status === 'SENT' || p.status === 'PARTIALLY_RECEIVED').length,
      });
    }

    // 3. Gather Production Work Orders
    const prodOrders = await ProductionOrder.find({ tenantId: tId })
      .populate('productionItemId', 'name sku')
      .sort({ createdAt: -1 })
      .limit(15)
      .exec();

    const productionInsightsData = prodOrders.map((po: any) => {
      const scrapPct = po.yieldQuantity > 0 ? Math.round((po.scrapQuantity / po.yieldQuantity) * 100) : 0;
      return {
        id: po._id.toString(),
        orderNumber: po.productionOrderNumber,
        finishedItemName: po.productionItemId?.name || 'Item',
        status: po.status,
        scrapPercentage: scrapPct,
        notes: po.notes,
      };
    });

    // 4. Generate Insights via Provider
    const [replenishment, supplierRisk, productionInsights, deadStock] = await Promise.all([
      aiProvider.generateReplenishmentInsights(itemsAtRisk),
      aiProvider.generateSupplierRiskInsights(supplierMetrics),
      aiProvider.generateProductionInsights(productionInsightsData),
      aiProvider.generateDeadStockInsights(deadItems),
    ]);

    const allInsights = [...replenishment, ...supplierRisk, ...productionInsights, ...deadStock];

    // Compute Enterprise Health Score (0-100)
    const criticalCount = allInsights.filter((i) => i.severity === 'CRITICAL').length;
    const warningCount = allInsights.filter((i) => i.severity === 'WARNING').length;
    const healthScore = Math.max(35, Math.min(100, 100 - (criticalCount * 12 + warningCount * 4)));

    const kpiSummary: AIKPISummary = {
      criticalAlertsCount: criticalCount,
      itemsUnderSevenDaysRunway: itemsAtRisk.filter((i) => i.availableQuantity / i.dailyBurnRate <= 7).length,
      totalCapitalTrapped: Math.round(deadItems.reduce((acc, d) => acc + (d.valuation || 0), 0)),
      highRiskSuppliersCount: supplierMetrics.filter((s) => s.defectRate > 5).length,
      activeProductionBottlenecks: prodOrders.filter((p: any) => p.status === 'PAUSED' || (p.yieldQuantity > 0 && (p.scrapQuantity / p.yieldQuantity) > 0.04)).length,
      healthScore,
    };

    // 5. Immutable Audit Log of AI Context Access
    await AIAudit.create({
      tenantId: tId,
      userId: uId,
      requestType: 'OPERATIONAL_INSIGHTS_QUERY',
      dataScope: ['INVENTORY_BALANCES', 'PURCHASE_QC', 'PRODUCTION_ORDERS', 'SUPPLIERS'],
      feature: 'ai.insights',
      provider: aiProvider.name,
      responseStatus: 'SUCCESS',
      usageMetadata: {
        insightsGeneratedCount: allInsights.length,
        healthScore,
      },
    });

    return {
      insights: allInsights,
      kpiSummary,
      metadata: {
        generatedAt: new Date(),
        analyzedEntitiesCount: items.length + suppliers.length + prodOrders.length,
        tenantIsolationEnforced: true,
        dataScope: ['INVENTORY', 'SUPPLIERS', 'PRODUCTION', 'QC'],
      },
    };
  }

  async executeAction(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    actionType: string,
    payload: Record<string, any>
  ): Promise<{ success: boolean; message: string; data?: any }> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    switch (actionType) {
      case 'GENERATE_PO': {
        const { itemId, suggestedQuantity, standardCost } = payload;
        if (!itemId) throw new BadRequestError('Item ID is required for generating Purchase Order');

        const item = await Item.findOne({ _id: new Types.ObjectId(itemId), tenantId: tId }).exec();
        if (!item) throw new NotFoundError('Item not found');

        // Locate active warehouse
        const warehouse = await Warehouse.findOne({ tenantId: tId, status: 'ACTIVE' }).exec();
        if (!warehouse) throw new BadRequestError('No active warehouse configured in tenant');

        // Locate supplier
        let supplier = payload.supplierId && Types.ObjectId.isValid(payload.supplierId)
          ? await Supplier.findOne({ _id: new Types.ObjectId(payload.supplierId), tenantId: tId }).exec()
          : null;

        if (!supplier) {
          supplier = await Supplier.findOne({ tenantId: tId, status: 'ACTIVE' }).exec();
        }
        if (!supplier) throw new BadRequestError('No active supplier found to draft Purchase Order');

        const qty = Number(suggestedQuantity) || 50;
        const price = Number(standardCost) || item.standardCost || 10;
        const poNumber = await documentNumberService.getNextNumber(tId, 'PURCHASE_ORDER');

        const po = await PurchaseOrder.create({
          tenantId: tId,
          poNumber,
          supplierId: supplier._id,
          orderDate: new Date(),
          expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          warehouseId: warehouse._id,
          currency: 'USD',
          subtotal: qty * price,
          discount: 0,
          tax: 0,
          total: qty * price,
          notes: `Auto-generated by StockPilot AI Intelligence for replenishment of ${item.name} (${item.sku})`,
          status: 'DRAFT',
          items: [
            {
              itemId: item._id,
              quantity: qty,
              uomId: item.purchaseUomId || item.baseUomId,
              unitPrice: price,
              discount: 0,
              tax: 0,
              lineTotal: qty * price,
              receivedQuantity: 0,
              pendingQuantity: qty,
            },
          ],
          createdBy: uId,
        });

        // Log AI Audit entry
        await AIAudit.create({
          tenantId: tId,
          userId: uId,
          requestType: 'AI_AUTOMATED_PO_GENERATION',
          dataScope: ['PURCHASE_ORDER', 'ITEM'],
          feature: 'ai.action.generate_po',
          provider: 'StockPilot-Deterministic-Engine',
          responseStatus: 'SUCCESS',
          usageMetadata: { poNumber: po.poNumber, itemId: item._id },
        });

        return {
          success: true,
          message: `Draft Purchase Order ${po.poNumber} created successfully for ${qty} units.`,
          data: { poId: po._id, poNumber: po.poNumber },
        };
      }

      case 'ADJUST_REORDER': {
        const { itemId, newReorderLevel } = payload;
        if (!itemId || newReorderLevel === undefined) {
          throw new BadRequestError('Item ID and newReorderLevel are required');
        }

        const updated = await Item.findOneAndUpdate(
          { _id: new Types.ObjectId(itemId), tenantId: tId },
          { reorderLevel: Number(newReorderLevel) },
          { new: true }
        ).exec();

        if (!updated) throw new NotFoundError('Item not found');

        return {
          success: true,
          message: `Reorder threshold for ${updated.name} updated to ${updated.reorderLevel} units.`,
          data: { itemId: updated._id, reorderLevel: updated.reorderLevel },
        };
      }

      default:
        throw new BadRequestError(`Unsupported AI action type: '${actionType}'`);
    }
  }

  async simulateProductionDemand(
    tenantId: string | Types.ObjectId,
    finishedItemId: string | Types.ObjectId,
    targetQuantity: number
  ): Promise<{
    feasible: boolean;
    finishedItem: any;
    targetQuantity: number;
    components: Array<{
      itemId: string;
      name: string;
      sku: string;
      requiredQuantity: number;
      availableStock: number;
      shortage: number;
      isAvailable: boolean;
      estimatedCost: number;
    }>;
    totalEstimatedShortageCost: number;
    summary: string;
  }> {
    const tId = new Types.ObjectId(tenantId);
    const fId = new Types.ObjectId(finishedItemId);
    const targetQty = Math.max(1, Number(targetQuantity) || 1);

    const finishedItem = await Item.findOne({ _id: fId, tenantId: tId }).exec();
    if (!finishedItem) throw new NotFoundError('Finished item not found');

    const bom = await BOM.findOne({ finishedItemId: fId, tenantId: tId })
      .populate('components.itemId', 'name sku standardCost')
      .exec();

    if (!bom || !bom.components || bom.components.length === 0) {
      throw new BadRequestError(`No active Bill of Materials (BOM) found for '${finishedItem.name}'.`);
    }

    const multiplier = targetQty / (bom.quantity || 1);
    let totalEstimatedShortageCost = 0;
    let allFeasible = true;

    const components = await Promise.all(
      bom.components.map(async (c: any) => {
        const compItem = c.itemId;
        const requiredQuantity = Math.ceil(c.quantity * multiplier * (1 + (c.scrapPercentage || 0) / 100));

        const balances = await InventoryBalance.find({
          tenantId: tId,
          itemId: compItem._id,
        }).exec();

        const availableStock = balances.reduce((sum, b) => sum + (b.availableQuantity || 0), 0);
        const shortage = Math.max(0, requiredQuantity - availableStock);
        const isAvailable = shortage === 0;

        if (!isAvailable) {
          allFeasible = false;
        }

        const unitCost = compItem?.standardCost || 0;
        const estimatedCost = Math.round(shortage * unitCost * 100) / 100;
        totalEstimatedShortageCost += estimatedCost;

        return {
          itemId: compItem._id.toString(),
          name: compItem.name || 'Component Item',
          sku: compItem.sku || 'SKU',
          requiredQuantity,
          availableStock,
          shortage,
          isAvailable,
          estimatedCost,
        };
      })
    );

    const summary = allFeasible
      ? `Full production run of ${targetQty} units is 100% FEASIBLE. All ${components.length} BOM components have sufficient warehouse reserves.`
      : `Production of ${targetQty} units has ${components.filter((c) => !c.isAvailable).length} material shortages. Estimated procurement budget needed: $${totalEstimatedShortageCost.toLocaleString()}.`;

    return {
      feasible: allFeasible,
      finishedItem: {
        id: finishedItem._id,
        name: finishedItem.name,
        sku: finishedItem.sku,
      },
      targetQuantity: targetQty,
      components,
      totalEstimatedShortageCost: Math.round(totalEstimatedShortageCost * 100) / 100,
      summary,
    };
  }
}

export const aiContextService = new AIContextService();
