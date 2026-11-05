import { Types } from 'mongoose';
import { logger } from '../core/logger';
import { Tenant } from '../models/tenant.model';
import { Item } from '../models/item.model';
import { InventoryBalance } from '../models/inventoryBalance.model';
import { Batch } from '../models/batch.model';
import { PurchaseOrder } from '../modules/procurement/models/purchaseOrder.model';
import { Invoice } from '../modules/sales/models/invoice.model';
import { emailService } from '../services/email.service';
import { auditRepository } from '../repositories/audit.repository';
import { AuditAction, AuditEntity } from '../config/constants';

interface JobExecutionLog {
  timestamp: Date;
  durationMs: number;
  tenantsProcessed: number;
  lowStockAlerts: number;
  expiringBatches: number;
  overduePOs: number;
  overdueInvoices: number;
  status: 'SUCCESS' | 'ERROR';
  error?: string;
}

class BackgroundScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastExecution: JobExecutionLog | null = null;
  private intervalMinutes: number = 60; // 1 hour

  start(intervalMinutes: number = 60): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.intervalMinutes = intervalMinutes;
    logger.info(`⏰ StockPilot Background Scheduler initialized (Interval: ${intervalMinutes} mins)`);

    // Run initial scan 30 seconds after startup so all models are loaded
    setTimeout(() => {
      this.executeAllJobs().catch((err) => {
        logger.error('Background job initial scan error:', err);
      });
    }, 30000);

    // Set recurring timer
    this.timer = setInterval(() => {
      this.executeAllJobs().catch((err) => {
        logger.error('Background job recurring error:', err);
      });
    }, intervalMinutes * 60 * 1000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('⏹️ StockPilot Background Scheduler stopped');
    }
  }

  getStatus(): { isRunning: boolean; intervalMinutes: number; lastExecution: JobExecutionLog | null } {
    return {
      isRunning: Boolean(this.timer),
      intervalMinutes: this.intervalMinutes,
      lastExecution: this.lastExecution,
    };
  }

  async executeAllJobs(): Promise<JobExecutionLog> {
    if (this.isRunning) {
      logger.warn('Scheduler execution skipped: previous job is still running');
      return this.lastExecution || {
        timestamp: new Date(),
        durationMs: 0,
        tenantsProcessed: 0,
        lowStockAlerts: 0,
        expiringBatches: 0,
        overduePOs: 0,
        overdueInvoices: 0,
        status: 'SUCCESS',
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    let lowStockCount = 0;
    let expiringBatchCount = 0;
    let overduePOCount = 0;
    let overdueInvCount = 0;
    let tenantsProcessed = 0;

    try {
      // Deactivate demo seed tenants (apex-logistics, nova-dynamics) in live DB so they never trigger automated alerts
      await Tenant.updateMany(
        { slug: { $in: ['apex-logistics', 'nova-dynamics'] } },
        { $set: { status: 'ARCHIVED_DEMO', contactEmail: '' } }
      ).exec();

      // Only scan real, registered organizations
      const activeTenants = await Tenant.find({
        status: 'ACTIVE',
        slug: { $nin: ['apex-logistics', 'nova-dynamics'] },
      }).exec();
      tenantsProcessed = activeTenants.length;

      for (const tenant of activeTenants) {
        // 1. Check Low Stock Items
        const tenantLowStock = await this.checkTenantLowStock(tenant._id, tenant.name, tenant.contactEmail);
        lowStockCount += tenantLowStock;

        // 2. Check Expiring Batches
        const tenantExpiringBatches = await this.checkTenantExpiringBatches(tenant._id);
        expiringBatchCount += tenantExpiringBatches;

        // 3. Check Overdue Purchase Orders
        const tenantOverduePOs = await this.checkTenantOverduePOs(tenant._id);
        overduePOCount += tenantOverduePOs;

        // 4. Check Overdue Invoices
        const tenantOverdueInvoices = await this.checkTenantOverdueInvoices(tenant._id);
        overdueInvCount += tenantOverdueInvoices;
      }

      this.lastExecution = {
        timestamp: new Date(),
        durationMs: Date.now() - startTime,
        tenantsProcessed,
        lowStockAlerts: lowStockCount,
        expiringBatches: expiringBatchCount,
        overduePOs: overduePOCount,
        overdueInvoices: overdueInvCount,
        status: 'SUCCESS',
      };

      logger.info(
        `✅ Scheduled scan complete in ${this.lastExecution.durationMs}ms: ` +
        `${lowStockCount} low stock alerts, ${expiringBatchCount} expiring batches, ` +
        `${overduePOCount} overdue POs, ${overdueInvCount} overdue invoices across ${tenantsProcessed} tenants.`
      );

      return this.lastExecution;
    } catch (err: any) {
      logger.error('Error during scheduled job execution:', err);
      this.lastExecution = {
        timestamp: new Date(),
        durationMs: Date.now() - startTime,
        tenantsProcessed,
        lowStockAlerts: lowStockCount,
        expiringBatches: expiringBatchCount,
        overduePOs: overduePOCount,
        overdueInvoices: overdueInvCount,
        status: 'ERROR',
        error: err.message,
      };
      return this.lastExecution;
    } finally {
      this.isRunning = false;
    }
  }

  private async checkTenantLowStock(tenantId: Types.ObjectId, tenantName: string, contactEmail?: string): Promise<number> {
    try {
      const items = await Item.find({
        tenantId,
        status: 'ACTIVE',
        $or: [{ reorderLevel: { $gt: 0 } }, { minimumStock: { $gt: 0 } }],
      }).exec();

      if (items.length === 0) return 0;

      const itemIds = items.map((i) => i._id);
      const stockAgg = await InventoryBalance.aggregate([
        { $match: { tenantId, itemId: { $in: itemIds } } },
        { $group: { _id: '$itemId', totalAvailable: { $sum: '$availableQuantity' } } },
      ]);

      const stockMap = new Map<string, number>();
      stockAgg.forEach((s) => stockMap.set(s._id.toString(), s.totalAvailable));

      const flaggedItems: Array<{ name: string; sku: string; available: number; reorderLevel: number }> = [];

      for (const item of items) {
        const available = stockMap.get(item._id.toString()) || 0;
        const threshold = item.reorderLevel || item.minimumStock || 0;
        if (available <= threshold) {
          flaggedItems.push({
            name: item.name,
            sku: item.sku,
            available,
            reorderLevel: threshold,
          });
        }
      }

      if (flaggedItems.length > 0) {
        let recipient = contactEmail?.trim();
        // If contactEmail is missing or points to demo domains, look up active admin user for this tenant
        if (!recipient || recipient.endsWith('@apexlogistics.com') || recipient.endsWith('@novadynamics.io')) {
          const { User } = await import('../models/user.model');
          const adminUser = await User.findOne({ tenantId, status: 'ACTIVE' }).sort({ createdAt: 1 }).exec();
          recipient = adminUser?.email;
        }

        if (recipient && !recipient.endsWith('@apexlogistics.com') && !recipient.endsWith('@novadynamics.io')) {
          await emailService.sendLowStockAlert(recipient, tenantName, flaggedItems);
        }
      }

      return flaggedItems.length;
    } catch (err) {
      logger.warn(`Could not check low stock for tenant ${tenantId}:`, err);
      return 0;
    }
  }

  private async checkTenantExpiringBatches(tenantId: Types.ObjectId): Promise<number> {
    try {
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const expiringBatches = await Batch.find({
        tenantId,
        expiryDate: { $lte: thirtyDaysFromNow, $gte: new Date() },
        status: { $in: ['ACTIVE', 'RELEASED'] },
      }).exec();

      return expiringBatches.length;
    } catch {
      return 0;
    }
  }

  private async checkTenantOverduePOs(tenantId: Types.ObjectId): Promise<number> {
    try {
      const now = new Date();
      const overduePOs = await PurchaseOrder.find({
        tenantId,
        status: { $in: ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'] },
        expectedDeliveryDate: { $lt: now },
      }).exec();

      return overduePOs.length;
    } catch {
      return 0;
    }
  }

  private async checkTenantOverdueInvoices(tenantId: Types.ObjectId): Promise<number> {
    try {
      const now = new Date();
      const overdueInvoices = await Invoice.find({
        tenantId,
        status: { $in: ['ISSUED', 'PARTIALLY_PAID'] },
        dueDate: { $lt: now },
        outstandingAmount: { $gt: 0 },
      }).exec();

      return overdueInvoices.length;
    } catch {
      return 0;
    }
  }
}

export const backgroundScheduler = new BackgroundScheduler();
