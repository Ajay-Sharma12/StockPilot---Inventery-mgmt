import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../core/types';
import { invoiceService } from '../services/invoice.service';

export class InvoiceController {
  async getInvoices(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await invoiceService.getInvoices(req.tenant!._id, req.query as any);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getInvoiceById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const inv = await invoiceService.getInvoiceById(req.tenant!._id, req.params.id);
      res.status(200).json({ success: true, data: inv });
    } catch (err) {
      next(err);
    }
  }

  async createInvoice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const inv = await invoiceService.createInvoice(
        req.tenant!._id,
        req.user!._id,
        req.body
      );
      res.status(201).json({ success: true, data: inv });
    } catch (err) {
      next(err);
    }
  }

  async cancelInvoice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const inv = await invoiceService.cancelInvoice(
        req.tenant!._id,
        req.user!._id,
        req.params.id,
        req.body?.reason
      );
      res.status(200).json({ success: true, data: inv });
    } catch (err) {
      next(err);
    }
  }

  async printInvoice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const inv: any = await invoiceService.getInvoiceById(req.tenant!._id, req.params.id);
      const { Tenant } = await import('../../../models/tenant.model');
      const tenant = await Tenant.findById(req.tenant!._id).exec();

      const itemsHtml = (inv.items || []).map((item: any, idx: number) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${idx + 1}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
            <strong>${item.name || item.itemId?.name || item.description || 'Line Item'}</strong><br/>
            <span style="font-size: 12px; color: #64748b;">SKU: ${item.sku || item.itemId?.sku || 'N/A'}</span>
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${item.quantity} ${item.uom || item.uomId?.name || 'units'}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${Number(item.unitPrice || 0).toFixed(2)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${item.taxRate || 0}%</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;"><strong>$${Number(item.lineTotal || 0).toFixed(2)}</strong></td>
        </tr>
      `).join('');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Tax Invoice - ${inv.invoiceNumber}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 40px; color: #0f172a; background: #fff; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
            .company { font-size: 24px; font-weight: bold; }
            .title { font-size: 28px; font-weight: 800; color: #0284c7; text-align: right; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
            .meta-box { background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #0f172a; color: #fff; padding: 10px; text-align: left; font-size: 13px; text-transform: uppercase; }
            .summary { margin-left: auto; width: 320px; margin-bottom: 40px; }
            .summary-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
            .total-row { display: flex; justify-content: space-between; padding: 12px 0; border-top: 2px solid #0f172a; font-size: 18px; font-weight: bold; }
            .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
            .badge-paid { background: #dcfce7; color: #15803d; }
            .badge-partial { background: #fef9c3; color: #a16207; }
            .badge-unpaid { background: #fee2e2; color: #b91c1c; }
            @media print { body { padding: 0; } button { display: none; } }
          </style>
        </head>
        <body>
          <div style="text-align: right; margin-bottom: 20px;">
            <button onclick="window.print()" style="background: #0284c7; color: #fff; border: 0; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer;">🖨️ Print / Save as PDF</button>
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
              <div class="title">COMMERCIAL INVOICE</div>
              <div style="text-align: right; font-weight: bold; font-size: 16px; margin-top: 5px;">${inv.invoiceNumber}</div>
              <div style="text-align: right; color: #64748b; font-size: 13px;">Date: ${new Date(inv.invoiceDate || inv.createdAt || Date.now()).toLocaleDateString()}</div>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-box">
              <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">Billed To / Customer</div>
              <strong>${inv.customerId?.name || 'Customer'}</strong><br/>
              Email: ${inv.customerId?.email || 'N/A'}<br/>
              Phone: ${inv.customerId?.phone || 'N/A'}
            </div>
            <div class="meta-box">
              <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">Payment Status & Terms</div>
              <strong>Due Date:</strong> ${inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : 'Upon Receipt'}<br/>
              <strong>Payment Terms:</strong> ${inv.paymentTermId?.name || 'Standard Terms'}<br/>
              <strong>Status:</strong> <span class="badge ${inv.status === 'PAID' ? 'badge-paid' : inv.status === 'PARTIALLY_PAID' ? 'badge-partial' : 'badge-unpaid'}">${inv.status}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="text-align: center; width: 40px;">#</th>
                <th>Item Description</th>
                <th style="text-align: right;">Quantity</th>
                <th style="text-align: right;">Unit Price</th>
                <th style="text-align: right;">Tax Rate</th>
                <th style="text-align: right;">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="summary">
            <div class="summary-row"><span>Subtotal:</span><span>$${Number(inv.subtotal || 0).toFixed(2)}</span></div>
            <div class="summary-row"><span>Tax Total:</span><span>$${Number(inv.taxAmount || 0).toFixed(2)}</span></div>
            <div class="summary-row"><span>Discount:</span><span>-$${Number(inv.discountAmount || 0).toFixed(2)}</span></div>
            <div class="total-row"><span>Total Amount:</span><span>$${Number(inv.grandTotal || 0).toFixed(2)}</span></div>
            <div class="summary-row" style="color: #15803d; font-weight: 600;"><span>Paid Amount:</span><span>$${Number(inv.paidAmount || 0).toFixed(2)}</span></div>
            <div class="summary-row" style="color: #b91c1c; font-weight: 700; font-size: 15px;"><span>Balance Due:</span><span>$${Number(inv.outstandingAmount || 0).toFixed(2)}</span></div>
          </div>

          <div style="margin-top: 40px; padding: 15px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">
            <strong>Payment Instructions:</strong> Please reference Invoice #${inv.invoiceNumber} on all remittances and electronic fund transfers. Thank you for your business!
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

export const invoiceController = new InvoiceController();
