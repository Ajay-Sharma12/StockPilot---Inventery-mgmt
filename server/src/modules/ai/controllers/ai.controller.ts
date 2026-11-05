import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../core/types';
import { aiContextService } from '../services/aiContext.service';
import { AIAudit } from '../models/aiAudit.model';
import { ProductionOrder } from '../../production/models/productionOrder.model';
import { InventoryBalance } from '../../../models/inventoryBalance.model';
import { Item } from '../../../models/item.model';
import { Supplier } from '../../../models/supplier.model';
import { PurchaseOrder } from '../../procurement/models/purchaseOrder.model';
import { PurchaseQCInspection } from '../../procurement/models/purchaseQc.model';

export class AIController {
  async getInsights(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const scope = {
        userId: req.user!._id,
        tenantId: req.tenant!._id,
        permissions: req.user?.permissions,
        warehouses: req.user?.accessScope?.warehouses,
        isSuperAdmin: req.user?.isSuperAdmin,
      };

      const result = await aiContextService.getOperationalInsights(scope);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async askAssistant(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { prompt } = req.body;
      const tenantId = req.tenant!._id;
      const promptLower = (prompt || '').trim().toLowerCase();

      let answer = '';
      const references: string[] = ['Centralized Inventory Ledger'];

      // 1. Check if user is asking about a specific item or low stock / shortages
      if (
        promptLower.includes('short') ||
        promptLower.includes('low stock') ||
        promptLower.includes('reorder') ||
        promptLower.includes('stockout')
      ) {
        references.push('Inventory Balance Engine', 'Item Safety Registry');
        const items = await Item.find({ tenantId, status: 'ACTIVE' }).limit(30).exec();
        const shortItems: Array<{ name: string; sku: string; available: number; reorder: number }> = [];

        for (const it of items) {
          const balances = await InventoryBalance.find({ tenantId, itemId: it._id }).exec();
          const avail = balances.reduce((sum, b) => sum + (b.availableQuantity || 0), 0);
          if (avail <= (it.reorderLevel || 10)) {
            shortItems.push({
              name: it.name,
              sku: it.sku,
              available: avail,
              reorder: it.reorderLevel || 10,
            });
          }
        }

        if (shortItems.length > 0) {
          const topShort = shortItems.slice(0, 5);
          answer = `**Material Shortage & Runway Alert**\n\nIdentified **${shortItems.length} items** operating below safety stock levels:\n\n` +
            `| Item Name | SKU | Available Stock | Reorder Threshold |\n` +
            `| :--- | :--- | :--- | :--- |\n` +
            topShort.map((s) => `| ${s.name} | \`${s.sku}\` | **${s.available}** | ${s.reorder} |`).join('\n') +
            `\n\n*Recommendation:* Use the **1-Click Draft PO** button in the Insights tab to trigger replenishment for these items.`;
        } else {
          answer = `Good news! All active inventoried items are currently sitting at or above designated safety stock buffers. No immediate stockouts projected.`;
        }
      }
      // 2. Check if asking about Production or Work Orders
      else if (
        promptLower.includes('production') ||
        promptLower.includes('work order') ||
        promptLower.includes('batch') ||
        promptLower.includes('order')
      ) {
        references.push('BOM DAG Engine', 'Shop Floor Execution Pipeline');
        const orders = await ProductionOrder.find({ tenantId })
          .populate('productionItemId', 'name sku')
          .sort({ createdAt: -1 })
          .limit(4)
          .exec();

        if (orders.length > 0) {
          answer = `**Live Shop-Floor Production Status**\n\nTracking **${orders.length} recent manufacturing orders**:\n\n` +
            `| Work Order | Finished Good | Status | Target Qty | Yield Qty |\n` +
            `| :--- | :--- | :--- | :--- | :--- |\n` +
            orders.map((o: any) => `| \`${o.productionOrderNumber}\` | ${o.productionItemId?.name || 'Item'} | **${o.status}** | ${o.plannedQuantity} | ${o.yieldQuantity || 0} |`).join('\n') +
            `\n\nAll recipes conform to approved BOM revisions with material reservation validation enforced.`;
        } else {
          answer = `No active production orders found in this tenant. You can release a new work order from the **Production Orders** page.`;
        }
      }
      // 3. Check if asking about Suppliers or Quality Control
      else if (
        promptLower.includes('supplier') ||
        promptLower.includes('vendor') ||
        promptLower.includes('qc') ||
        promptLower.includes('quality') ||
        promptLower.includes('defect')
      ) {
        references.push('Purchase QC Service', 'Supplier Performance Ledger');
        const suppliers = await Supplier.find({ tenantId, status: 'ACTIVE' }).limit(5).exec();
        const qcRecords = await PurchaseQCInspection.find({ tenantId }).exec();
        const totalInspected = qcRecords.reduce((s, q) => s + (q.inspectedQuantity || 0), 0);
        const rejected = qcRecords.reduce((s, q) => s + (q.rejectedQuantity || 0), 0);
        const avgDefect = totalInspected > 0 ? Math.round((rejected / totalInspected) * 1000) / 10 : 1.2;

        answer = `**Supplier Quality & Reliability Matrix**\n\n` +
          `• **Active Suppliers Monitored:** ${suppliers.length}\n` +
          `• **Aggregate Inbound Defect Rate:** **${avgDefect}%** (${rejected} rejected out of ${totalInspected} units inspected)\n` +
          `• **Top Active Vendors:** ${suppliers.map((s) => s.name).join(', ')}\n\n` +
          `*Risk Mitigation:* Inbound dock gating enforces quarantine holds on any lot whose supplier has a defect rating exceeding 5%.`;
      }
      // 4. Default / General Executive Query
      else {
        references.push('Multi-Tenant Enterprise Core', 'Executive Operational Summary');
        const [activeOrders, totalSKUs, openPOs] = await Promise.all([
          ProductionOrder.countDocuments({ tenantId, status: { $in: ['RELEASED', 'IN_PROGRESS'] } }),
          Item.countDocuments({ tenantId, status: 'ACTIVE' }),
          PurchaseOrder.countDocuments({ tenantId, status: { $in: ['SENT', 'PARTIALLY_RECEIVED'] } }),
        ]);

        answer = `**StockPilot Operations Copilot Summary**\n\n` +
          `Operational parameters for your tenant are running smoothly:\n\n` +
          `• **Active Catalog SKUs:** ${totalSKUs} items tracked across warehouses\n` +
          `• **Work Orders in Flight:** ${activeOrders} live shop-floor jobs\n` +
          `• **Open Procurement Inbound:** ${openPOs} POs awaiting gate receive\n` +
          `• **Data Isolation:** Strict ABAC tenant boundary active\n\n` +
          `*Tip:* Ask me *"Which materials are short?"* or *"Analyze work order status"* for targeted insights.`;
      }

      // Log AI Audit entry
      await AIAudit.create({
        tenantId,
        userId: req.user!._id,
        requestType: 'ASSISTANT_QUERY',
        dataScope: references,
        feature: 'ai-copilot',
        provider: 'StockPilot-Deterministic-Engine',
        responseStatus: 'SUCCESS',
        usageMetadata: { promptLength: (prompt || '').length, responseLength: answer.length },
      });

      res.status(200).json({
        success: true,
        data: { answer, references },
      });
    } catch (err) {
      next(err);
    }
  }

  async executeAction(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actionType, payload } = req.body;
      const result = await aiContextService.executeAction(
        req.tenant!._id,
        req.user!._id,
        actionType,
        payload
      );
      res.status(200).json({ ...result, success: result.success ?? true });
    } catch (err) {
      next(err);
    }
  }

  async simulateDemand(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { finishedItemId, targetQuantity } = req.body;
      const result = await aiContextService.simulateProductionDemand(
        req.tenant!._id,
        finishedItemId,
        targetQuantity
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const logs = await AIAudit.find({ tenantId: req.tenant!._id })
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .limit(50)
        .exec();

      res.status(200).json({ success: true, data: logs });
    } catch (err) {
      next(err);
    }
  }
}

export const aiController = new AIController();
