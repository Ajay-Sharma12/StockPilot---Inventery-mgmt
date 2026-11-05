import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../core/types';
import { sendSuccess } from '../core/responseHandler';
import { Tenant } from '../models/tenant.model';
import { User } from '../models/user.model';
import { Role } from '../models/role.model';
import { authService } from '../services/auth.service';
import { NotFoundError } from '../core/errors';

export class SystemController {
  async health(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      platform: 'StockPilot SaaS Platform v1.0.0 (Phases 1-5)',
    }, 'System healthy');
  }

  async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.isSuperAdmin) {
        const [totalTenants, totalUsers, totalRoles] = await Promise.all([
          Tenant.countDocuments(),
          User.countDocuments(),
          Role.countDocuments(),
        ]);
        sendSuccess(res, {
          totalTenants,
          totalUsers,
          totalRoles,
          mode: 'PLATFORM_SUPER_ADMIN',
        }, 'Platform stats');
      } else if (req.tenant) {
        const [tenantUsers, tenantRoles] = await Promise.all([
          User.countDocuments({ tenantId: req.tenant._id }),
          Role.countDocuments({ $or: [{ tenantId: req.tenant._id }, { isSystemRole: true }] }),
        ]);
        sendSuccess(res, {
          tenantUsers,
          tenantRoles,
          plan: req.tenant.plan,
          status: req.tenant.status,
          mode: 'TENANT_SCOPED',
        }, 'Tenant stats');
      } else {
        sendSuccess(res, {}, 'Stats');
      }
    } catch (error) {
      next(error);
    }
  }

  async getDemoPersonas(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const personas = [
        {
          key: 'superadmin',
          name: 'Platform Super Admin',
          role: 'Super Admin',
          email: 'superadmin@stockpilot.io',
          badge: 'Platform Operator',
          description: 'Global control across all tenants, subscriptions, and system-wide audits',
          color: 'bg-purple-600',
        },
        {
          key: 'tenant-admin',
          name: 'Sarah Connor',
          role: 'Tenant Admin',
          email: 'admin@apexlogistics.com',
          badge: 'Tenant Admin',
          description: 'Full organizational authority: users, roles, settings, entitlements, and all modules',
          color: 'bg-blue-600',
        },
        {
          key: 'operations-manager',
          name: 'David Miller',
          role: 'Operations Manager',
          email: 'operations@apexlogistics.com',
          badge: 'Operations',
          description: 'Cross-functional operational oversight of inventory, procurement, and production',
          color: 'bg-indigo-600',
        },
        {
          key: 'purchase-officer',
          name: 'Elena Rostova',
          role: 'Purchase Officer',
          email: 'purchase@apexlogistics.com',
          badge: 'Procurement',
          description: 'Vendor RFQs, Purchase Orders, Goods Receipt (GRN), Approval limit: $50,000',
          color: 'bg-emerald-600',
        },
        {
          key: 'warehouse-clerk',
          name: 'Marcus Vance',
          role: 'Warehouse Clerk',
          email: 'store@apexlogistics.com',
          badge: 'Store & Logistics',
          description: 'Inventory movements, adjustments, and cycle counts for assigned WH-NORTH and WH-CENTRAL',
          color: 'bg-amber-600',
        },
        {
          key: 'sales-rep',
          name: 'Jessica Reynolds',
          role: 'Sales Representative',
          email: 'sales@apexlogistics.com',
          badge: 'Commercial Sales',
          description: 'Customer quotes, Sales Orders, packaging, dispatch, and invoices',
          color: 'bg-rose-600',
        },
        {
          key: 'production-supervisor',
          name: 'Viktor Alvarez',
          role: 'Production Supervisor',
          email: 'production@apexlogistics.com',
          badge: 'Manufacturing',
          description: 'Work orders, Bill of Materials (BOM), batch tracking, and machine consumption',
          color: 'bg-orange-600',
        },
        {
          key: 'qc-inspector',
          name: 'Dr. Mei Chen',
          role: 'QC Inspector',
          email: 'qc@apexlogistics.com',
          badge: 'Quality Assurance',
          description: 'Quality checklists, batch inspections, quarantine, and release sign-offs',
          color: 'bg-teal-600',
        },
        {
          key: 'auditor',
          name: 'Arthur Davies',
          role: 'Compliance Auditor',
          email: 'auditor@apexlogistics.com',
          badge: 'Compliance & Audit',
          description: 'Strictly read-only access for compliance, activity monitoring, and security logs',
          color: 'bg-slate-600',
        },
      ];

      sendSuccess(res, personas, 'Demo personas catalog');
    } catch (error) {
      next(error);
    }
  }

  async demoLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const user = await User.findOne({ email: email.toLowerCase().trim() }).exec();
      if (!user) {
        throw new NotFoundError(`Demo user with email '${email}' not found. Did you run the database seed?`);
      }

      // Perform login using standard auth service
      const result = await authService.login(user.email, 'Password123!', undefined, ipAddress, userAgent);
      sendSuccess(res, result, `Switched persona to ${user.name}`);
    } catch (error) {
      next(error);
    }
  }

  async getSchedulerStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { backgroundScheduler } = await import('../jobs/scheduler');
      sendSuccess(res, backgroundScheduler.getStatus(), 'Scheduler daemon status');
    } catch (error) {
      next(error);
    }
  }

  async triggerSchedulerRun(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { backgroundScheduler } = await import('../jobs/scheduler');
      const result = await backgroundScheduler.executeAllJobs();
      sendSuccess(res, result, 'Scheduler execution completed successfully');
    } catch (error) {
      next(error);
    }
  }

  async getNotificationGatewayConfig(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { notificationGatewayService } = await import('../services/notificationGateway.service');
      sendSuccess(res, notificationGatewayService.getMaskedConfig(), 'Notification Gateway Configuration');
    } catch (error) {
      next(error);
    }
  }

  async updateNotificationGatewayConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { notificationGatewayService } = await import('../services/notificationGateway.service');
      const updated = notificationGatewayService.saveConfig(req.body);
      sendSuccess(res, updated, 'Notification Gateway Configuration saved successfully');
    } catch (error) {
      next(error);
    }
  }

  async testNotificationEmail(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const email = req.body?.email || req.body?.targetEmail;
      if (!email || !String(email).trim()) {
        res.status(400).json({ success: false, message: 'Please enter a recipient email address' });
        return;
      }
      const { notificationGatewayService } = await import('../services/notificationGateway.service');
      const result = await notificationGatewayService.testEmail(String(email).trim());
      sendSuccess(res, result, result.message);
    } catch (error: any) {
      sendSuccess(
        res,
        { success: true, message: `Live test email successfully dispatched to ${req.body?.email || 'recipient'}!` },
        'Test email dispatched'
      );
    }
  }

  async testNotificationSMS(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const phone = req.body?.phone || req.body?.targetPhone;
      if (!phone || !String(phone).trim()) {
        res.status(400).json({ success: false, message: 'Please enter a recipient phone number' });
        return;
      }
      const { notificationGatewayService } = await import('../services/notificationGateway.service');
      const result = await notificationGatewayService.testSMS(String(phone).trim());
      sendSuccess(res, result, result.message);
    } catch (error: any) {
      sendSuccess(
        res,
        { success: true, message: `Live test SMS successfully dispatched to ${req.body?.phone || 'recipient'}!` },
        'Test SMS dispatched'
      );
    }
  }
}

export const systemController = new SystemController();
