import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../core/types';
import { purchaseOrderService } from '../services/purchaseOrder.service';

export class PurchaseOrderController {
  async getPOs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await purchaseOrderService.getPurchaseOrders(req.tenant!._id, req.query as any);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getPOById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const po = await purchaseOrderService.getPOById(req.tenant!._id, req.params.id);
      res.status(200).json({ success: true, data: po });
    } catch (err) {
      next(err);
    }
  }

  async createPO(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const po = await purchaseOrderService.createPO(
        req.tenant!._id,
        req.user!._id,
        req.body
      );
      res.status(201).json({ success: true, data: po });
    } catch (err) {
      next(err);
    }
  }

  async updatePO(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const po = await purchaseOrderService.updatePO(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body
      );
      res.status(200).json({ success: true, data: po });
    } catch (err) {
      next(err);
    }
  }

  async submitPO(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const po = await purchaseOrderService.submitPO(
        req.tenant!._id,
        req.user!._id,
        req.params.id
      );
      res.status(200).json({ success: true, data: po });
    } catch (err) {
      next(err);
    }
  }

  async approvePO(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const po = await purchaseOrderService.approvePO(
        req.tenant!._id,
        req.user!._id,
        req.params.id
      );
      res.status(200).json({ success: true, data: po });
    } catch (err) {
      next(err);
    }
  }

  async rejectPO(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const po = await purchaseOrderService.rejectPO(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body.reason
      );
      res.status(200).json({ success: true, data: po });
    } catch (err) {
      next(err);
    }
  }

  async sendPO(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const po = await purchaseOrderService.sendPO(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body
      );
      res.status(200).json({ success: true, data: po });
    } catch (err) {
      next(err);
    }
  }

  async resendNotification(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const po = await purchaseOrderService.resendNotification(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body
      );
      res.status(200).json({ success: true, data: po });
    } catch (err) {
      next(err);
    }
  }

  async cancelPO(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const po = await purchaseOrderService.cancelPO(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body.reason
      );
      res.status(200).json({ success: true, data: po });
    } catch (err) {
      next(err);
    }
  }

  async printPO(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const po: any = await purchaseOrderService.getPOById(req.tenant!._id, req.params.id);
      const { Tenant } = await import('../../../models/tenant.model');
      const tenant = await Tenant.findById(req.tenant!._id).exec();

      const itemsHtml = (po.items || []).map((item: any, idx: number) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${idx + 1}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
            <strong>${item.name || item.itemId?.name || item.description || 'Item'}</strong><br/>
            <span style="font-size: 12px; color: #64748b;">SKU: ${item.sku || item.itemId?.sku || 'N/A'}</span>
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${item.quantity} ${item.uom || item.uomId?.name || 'units'}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${(item.unitPrice || 0).toFixed(2)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${item.tax || item.taxRate || 0}%</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;"><strong>$${(item.lineTotal || item.totalPrice || 0).toFixed(2)}</strong></td>
        </tr>
      `).join('');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Purchase Order - ${po.poNumber}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 40px; color: #0f172a; background: #fff; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
            .company { font-size: 24px; font-weight: bold; }
            .title { font-size: 28px; font-weight: 800; color: #2563eb; text-align: right; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
            .meta-box { background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #0f172a; color: #fff; padding: 10px; text-align: left; font-size: 13px; text-transform: uppercase; }
            .summary { margin-left: auto; width: 300px; margin-bottom: 40px; }
            .summary-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
            .total-row { display: flex; justify-content: space-between; padding: 12px 0; border-top: 2px solid #0f172a; font-size: 18px; font-weight: bold; }
            .footer { border-top: 1px solid #cbd5e1; padding-top: 20px; display: flex; justify-content: space-between; font-size: 13px; color: #64748b; }
            @media print { body { padding: 0; } button { display: none; } }
          </style>
        </head>
        <body>
          <div style="text-align: right; margin-bottom: 20px;">
            <button onclick="window.print()" style="background: #2563eb; color: #fff; border: 0; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer;">🖨️ Print / Save as PDF</button>
          </div>
          <div class="header">
            <div>
              <div class="company">${tenant?.name || 'StockPilot Workspace'}</div>
              <div style="color: #64748b; font-size: 14px; margin-top: 4px;">
                ${tenant?.contactEmail || ''}<br/>
                ${tenant?.phone || ''}
              </div>
            </div>
            <div>
              <div class="title">PURCHASE ORDER</div>
              <div style="text-align: right; font-weight: bold; font-size: 16px; margin-top: 5px;">${po.poNumber}</div>
              <div style="text-align: right; color: #64748b; font-size: 13px;">Date: ${new Date(po.createdAt || po.orderDate || Date.now()).toLocaleDateString()}</div>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-box">
              <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">Vendor / Supplier</div>
              <strong>${po.supplierId?.name || 'Authorized Supplier'}</strong><br/>
              Email: ${po.supplierId?.contactEmail || po.supplierId?.email || 'N/A'}<br/>
              Phone: ${po.supplierId?.phone || 'N/A'}
            </div>
            <div class="meta-box">
              <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">Delivery Details</div>
              <strong>Destination Warehouse:</strong> ${po.warehouseId?.name || 'Main Warehouse'}<br/>
              <strong>Expected Delivery:</strong> ${po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : 'Immediate'}<br/>
              <strong>Status:</strong> ${po.status}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="text-align: center; width: 40px;">#</th>
                <th>Item Description</th>
                <th style="text-align: right;">Quantity</th>
                <th style="text-align: right;">Unit Cost</th>
                <th style="text-align: right;">Tax</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="summary">
            <div class="summary-row"><span>Subtotal:</span><span>$${Number(po.subtotal || 0).toFixed(2)}</span></div>
            <div class="summary-row"><span>Tax Total:</span><span>$${Number(po.tax || 0).toFixed(2)}</span></div>
            <div class="total-row"><span>Grand Total:</span><span>$${Number(po.total || 0).toFixed(2)}</span></div>
          </div>

          <div class="footer">
            <div>Authorized Procurement Officer<br/><br/>______________________</div>
            <div style="text-align: right;">Authorized Executive Approval<br/><br/>______________________</div>
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

  async getIncomingPurchases(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await purchaseOrderService.getIncomingPurchases(
        req.tenant!._id,
        req.query as any
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async sendDeliveryFollowUp(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await purchaseOrderService.sendDeliveryFollowUp(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const purchaseOrderController = new PurchaseOrderController();
