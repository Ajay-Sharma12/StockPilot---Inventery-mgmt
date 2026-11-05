import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../core/types';
import { gatePassService } from '../services/gatePass.service';

export class GatePassController {
  async getGatePasses(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await gatePassService.getGatePasses(req.tenant!._id, req.query as any);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getGatePassById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const gp = await gatePassService.getGatePassById(req.tenant!._id, req.params.id);
      res.status(200).json({ success: true, data: gp });
    } catch (err) {
      next(err);
    }
  }

  async createGatePass(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const gp = await gatePassService.createGatePass(
        req.tenant!._id,
        req.user!._id,
        req.body
      );
      res.status(201).json({ success: true, data: gp });
    } catch (err) {
      next(err);
    }
  }

  async approveGatePass(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const gp = await gatePassService.approveGatePass(
        req.tenant!._id,
        req.user!._id,
        req.params.id
      );
      res.status(200).json({ success: true, data: gp });
    } catch (err) {
      next(err);
    }
  }

  async recordGateOut(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const gp = await gatePassService.recordGateOut(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body?.notes
      );
      res.status(200).json({ success: true, data: gp });
    } catch (err) {
      next(err);
    }
  }

  async printGatePass(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const gp: any = await gatePassService.getGatePassById(req.tenant!._id, req.params.id);
      const { Tenant } = await import('../../../models/tenant.model');
      const tenant = await Tenant.findById(req.tenant!._id).exec();

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Security Gate Pass - ${gp.gatePassNumber}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 40px; color: #0f172a; background: #fff; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
            .company { font-size: 24px; font-weight: bold; }
            .title { font-size: 28px; font-weight: 800; color: #d97706; text-align: right; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
            .meta-box { background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0; }
            .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
            .footer { border-top: 1px solid #cbd5e1; padding-top: 30px; display: flex; justify-content: space-between; font-size: 13px; color: #64748b; margin-top: 50px; }
            @media print { body { padding: 0; } button { display: none; } }
          </style>
        </head>
        <body>
          <div style="text-align: right; margin-bottom: 20px;">
            <button onclick="window.print()" style="background: #d97706; color: #fff; border: 0; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer;">🖨️ Print / Save as PDF</button>
          </div>
          <div class="header">
            <div>
              <div class="company">${tenant?.name || 'StockPilot Workspace'}</div>
              <div style="color: #64748b; font-size: 14px; margin-top: 4px;">Security & Facility Gate Control</div>
            </div>
            <div>
              <div class="title">OFFICIAL GATE PASS</div>
              <div style="text-align: right; font-weight: bold; font-size: 16px; margin-top: 5px;">${gp.gatePassNumber}</div>
              <div style="text-align: right; color: #64748b; font-size: 13px;">Date: ${new Date(gp.createdAt || Date.now()).toLocaleString()}</div>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-box">
              <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">Vehicle & Driver Manifest</div>
              <div class="info-row"><span>Driver Name:</span><strong>${gp.driverName || 'Authorized Driver'}</strong></div>
              <div class="info-row"><span>Driver Contact:</span><span>${gp.driverContact || gp.driverPhone || 'N/A'}</span></div>
              <div class="info-row"><span>Vehicle Number:</span><strong>${gp.vehicleNumber || 'N/A'}</strong></div>
              <div class="info-row"><span>Dispatch Ref:</span><span>${gp.dispatchId?.dispatchNumber || 'Direct Fleet'}</span></div>
            </div>
            <div class="meta-box">
              <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">Consignment Details</div>
              <div class="info-row"><span>Customer / Recipient:</span><strong>${gp.customerId?.name || 'Authorized Recipient'}</strong></div>
              <div class="info-row"><span>Gate Pass Status:</span><strong>${gp.status}</strong></div>
              <div class="info-row"><span>Gate-Out Timestamp:</span><span>${gp.gateOutTime ? new Date(gp.gateOutTime).toLocaleString() : 'Pending Gate-Out'}</span></div>
              <div class="info-row"><span>Security Officer:</span><span>${gp.securityOfficerId?.name || 'On-Duty Security'}</span></div>
            </div>
          </div>

          <div style="padding: 15px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; font-size: 13px; color: #92400e; margin-bottom: 30px;">
            <strong>Gate Control Directive:</strong> Security personnel must verify vehicle registration and driver identification against this manifest before granting gate clearance.
          </div>

          <div class="footer">
            <div>Driver Signature<br/><br/>______________________</div>
            <div>Warehouse Dispatch Lead<br/><br/>______________________</div>
            <div style="text-align: right;">Gate Security Sign-Off<br/><br/>______________________</div>
          </div>
        </body>
        </html>
      `;
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (err) {
      next(err);
    }
  }
}

export const gatePassController = new GatePassController();
