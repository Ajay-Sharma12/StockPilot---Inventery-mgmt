import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { tenantContext } from '../../../middleware/tenantContext.middleware';
import { requireFeature } from '../../../middleware/entitlement.middleware';
import { requirePermissions } from '../../../middleware/rbac.middleware';
import { validateRequest } from '../../../middleware/validate.middleware';
import { PERMISSIONS } from '../../../config/permissions.config';
import { invoiceController } from '../controllers/invoice.controller';
import { createInvoiceSchema } from '../validators/sales.validator';

const router = Router();

router.use(authenticate, tenantContext, requireFeature('sales'));

router.get(
  '/',
  requirePermissions([PERMISSIONS.INVOICE_VIEW, PERMISSIONS.SALES_READ], false),
  invoiceController.getInvoices
);

router.get(
  '/:id',
  requirePermissions([PERMISSIONS.INVOICE_VIEW, PERMISSIONS.SALES_READ], false),
  invoiceController.getInvoiceById
);

router.get(
  '/:id/print',
  requirePermissions([PERMISSIONS.INVOICE_VIEW, PERMISSIONS.SALES_READ], false),
  invoiceController.printInvoice
);

router.post(
  '/',
  requirePermissions([PERMISSIONS.INVOICE_CREATE, PERMISSIONS.SALES_UPDATE], false),
  validateRequest({ body: createInvoiceSchema }),
  invoiceController.createInvoice
);

router.post(
  '/:id/cancel',
  requirePermissions([PERMISSIONS.INVOICE_CANCEL, PERMISSIONS.SALES_UPDATE], false),
  invoiceController.cancelInvoice
);

export const invoiceRoutes = router;
