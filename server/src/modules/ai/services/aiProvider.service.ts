export interface AIInsightItem {
  id: string;
  category: 'REPLENISHMENT' | 'DEAD_STOCK' | 'SUPPLIER_RISK' | 'PRODUCTION_BOTTLENECK' | 'FINANCIAL_ANOMALY';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  summary: string;
  impact: string;
  recommendedAction: string;
  confidenceScore: number;
  actionType?: 'GENERATE_PO' | 'ADJUST_REORDER' | 'FLAG_QUARANTINE' | 'INVESTIGATE_LINE' | 'DISCOUNT_STOCK';
  actionLabel?: string;
  actionPayload?: Record<string, any>;
  metrics?: {
    daysRunway?: number;
    burnRatePerDay?: number;
    capitalTrapped?: number;
    defectRate?: number;
    scrapRate?: number;
    suggestedQty?: number;
    deficit?: number;
  };
  metadata?: Record<string, any>;
}

export interface IAIProvider {
  name: string;
  generateReplenishmentInsights(data: any[]): Promise<AIInsightItem[]>;
  generateSupplierRiskInsights(data: any[]): Promise<AIInsightItem[]>;
  generateProductionInsights(data: any[]): Promise<AIInsightItem[]>;
  generateDeadStockInsights(data: any[]): Promise<AIInsightItem[]>;
}

export class StockPilotIntelligenceProvider implements IAIProvider {
  name = 'StockPilot-Deterministic-Engine';

  async generateReplenishmentInsights(itemsAtRisk: any[]): Promise<AIInsightItem[]> {
    return itemsAtRisk.map((item, idx) => {
      const deficit = Math.max(0, (item.reorderLevel || 10) - (item.availableQuantity || 0));
      const isCritical = (item.availableQuantity || 0) <= 0;
      const burnRatePerDay = item.dailyBurnRate && item.dailyBurnRate > 0 ? item.dailyBurnRate : Math.max(1, Math.round((item.reorderLevel || 10) / 7));
      const daysRunway = Math.max(0, Math.round(((item.availableQuantity || 0) / burnRatePerDay) * 10) / 10);
      const suggestedQty = Math.max((item.reorderLevel || 10) * 2, deficit > 0 ? deficit + (item.reorderLevel || 10) : 50);

      return {
        id: `INS-REP-${idx + 1}`,
        category: 'REPLENISHMENT',
        severity: isCritical ? 'CRITICAL' : daysRunway <= 3 ? 'CRITICAL' : 'WARNING',
        title: `${isCritical ? 'Stockout Alert' : `Stockout in ${daysRunway} Days`}: ${item.name} (${item.sku})`,
        summary: `Available stock (${item.availableQuantity} units) is burning at ~${burnRatePerDay} units/day. Estimated safety buffer runs out in ${daysRunway} days.`,
        impact: isCritical ? 'Immediate stoppage of sales and assembly lines' : `Buffer exhaustion within ${daysRunway} calendar days based on 30-day velocity`,
        recommendedAction: `Create Draft Purchase Order for ${suggestedQty} units to restore buffer safety stock.`,
        confidenceScore: 0.98,
        actionType: 'GENERATE_PO',
        actionLabel: `Draft PO (${suggestedQty} Units)`,
        actionPayload: {
          itemId: item.id,
          itemName: item.name,
          sku: item.sku,
          suggestedQuantity: suggestedQty,
          supplierId: item.preferredSupplierId,
          standardCost: item.standardCost || 0,
        },
        metrics: {
          daysRunway,
          burnRatePerDay,
          suggestedQty,
          deficit,
        },
        metadata: {
          itemId: item.id,
          sku: item.sku,
          availableQuantity: item.availableQuantity,
          reorderLevel: item.reorderLevel,
        },
      };
    });
  }

  async generateSupplierRiskInsights(supplierMetrics: any[]): Promise<AIInsightItem[]> {
    return supplierMetrics
      .filter((s) => s.defectRate > 4 || s.openPOCount > 3)
      .map((s, idx) => {
        const isCritical = s.defectRate > 10;
        return {
          id: `INS-SUP-${idx + 1}`,
          category: 'SUPPLIER_RISK',
          severity: isCritical ? 'CRITICAL' : 'WARNING',
          title: `Supplier Quality Risk: ${s.name}`,
          summary: `Inbound defect rate is currently ${s.defectRate}% with ${s.openPOCount} open POs awaiting gate receiving.`,
          impact: 'Substandard lots may enter production lines or cause dock quarantine hold-ups',
          recommendedAction: 'Place supplier on mandatory 100% Inbound QC sampling and issue corrective action request.',
          confidenceScore: 0.93,
          actionType: 'FLAG_QUARANTINE',
          actionLabel: 'Audit Supplier QC',
          actionPayload: {
            supplierId: s.id,
            supplierName: s.name,
            defectRate: s.defectRate,
          },
          metrics: {
            defectRate: s.defectRate,
          },
          metadata: {
            supplierId: s.id,
            defectRate: s.defectRate,
            openPOs: s.openPOCount,
          },
        };
      });
  }

  async generateProductionInsights(productionOrders: any[]): Promise<AIInsightItem[]> {
    return productionOrders
      .filter((o) => o.scrapPercentage > 4 || o.status === 'PAUSED')
      .map((o, idx) => ({
        id: `INS-PRD-${idx + 1}`,
        category: 'PRODUCTION_BOTTLENECK',
        severity: o.status === 'PAUSED' ? 'WARNING' : o.scrapPercentage > 10 ? 'CRITICAL' : 'INFO',
        title: `Work Order Variance: ${o.orderNumber} (${o.finishedItemName})`,
        summary: o.status === 'PAUSED'
          ? `Manufacturing line halted for order ${o.orderNumber}. Reason: ${o.notes || 'Awaiting materials or machine maintenance'}`
          : `High material scrap detected (${o.scrapPercentage}%) exceeding standard 3% tolerance.`,
        impact: 'Raw material margin leakage and scheduled delivery commitment delay',
        recommendedAction: 'Inspect tool calibration, check raw lot CoA, and review operator scrap logging.',
        confidenceScore: 0.91,
        actionType: 'INVESTIGATE_LINE',
        actionLabel: 'Inspect Work Order DAG',
        actionPayload: {
          productionOrderId: o.id,
          orderNumber: o.orderNumber,
        },
        metrics: {
          scrapRate: o.scrapPercentage,
        },
        metadata: {
          productionOrderId: o.id,
          scrapPercentage: o.scrapPercentage,
        },
      }));
  }

  async generateDeadStockInsights(deadItems: any[]): Promise<AIInsightItem[]> {
    return deadItems.map((item, idx) => ({
      id: `INS-DED-${idx + 1}`,
      category: 'DEAD_STOCK',
      severity: item.valuation > 50000 ? 'WARNING' : 'INFO',
      title: `Trapped Working Capital: ${item.name} (${item.sku})`,
      summary: `Holding ${item.quantity} units ($${item.valuation.toLocaleString()}) with zero warehouse movements in the last 60+ days.`,
      impact: 'Capital locked in non-moving inventory; shelf space and holding cost overhead',
      recommendedAction: 'Apply promotional liquidation discount or return unused packaging to supplier.',
      confidenceScore: 0.96,
      actionType: 'DISCOUNT_STOCK',
      actionLabel: 'Review Inventory Aging',
      actionPayload: {
        itemId: item.id,
        itemName: item.name,
        valuation: item.valuation,
        quantity: item.quantity,
      },
      metrics: {
        capitalTrapped: item.valuation,
      },
      metadata: {
        itemId: item.id,
        quantity: item.quantity,
        valuation: item.valuation,
      },
    }));
  }
}

export const aiProvider = new StockPilotIntelligenceProvider();
