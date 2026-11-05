import { Router } from 'express';
import { masterDataController } from '../controllers/masterData.controller';
import { authenticate } from '../middleware/auth.middleware';
import { tenantContext } from '../middleware/tenantContext.middleware';
import { requirePermissions } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { PERMISSIONS } from '../config/permissions.config';
import {
  createCategorySchema,
  createSubCategorySchema,
  createUomSchema,
  createUomConversionSchema,
  createSupplierSchema,
  updateSupplierSchema,
  createCustomerSchema,
  createDepartmentSchema,
  createTaxCodeSchema,
  createPaymentTermSchema,
  createCurrencySchema,
  createReasonSchema,
} from '../validators/inventory.validator';

const router = Router();
router.use(authenticate, tenantContext);

// Categories & Subcategories
router.get('/categories', requirePermissions([PERMISSIONS.INVENTORY_READ]), (req, res, next) =>
  masterDataController.getCategories(req, res, next)
);
router.post(
  '/categories',
  requirePermissions([PERMISSIONS.INVENTORY_CREATE]),
  validateRequest(createCategorySchema),
  (req, res, next) => masterDataController.createCategory(req, res, next)
);
router.patch('/categories/:id', requirePermissions([PERMISSIONS.INVENTORY_UPDATE]), (req, res, next) =>
  masterDataController.updateCategory(req, res, next)
);

router.get('/subcategories', requirePermissions([PERMISSIONS.INVENTORY_READ]), (req, res, next) =>
  masterDataController.getSubCategories(req, res, next)
);
router.post(
  '/subcategories',
  requirePermissions([PERMISSIONS.INVENTORY_CREATE]),
  validateRequest(createSubCategorySchema),
  (req, res, next) => masterDataController.createSubCategory(req, res, next)
);

// UOM & Conversions
router.get('/uoms', requirePermissions([PERMISSIONS.INVENTORY_READ]), (req, res, next) =>
  masterDataController.getUOMs(req, res, next)
);
router.post(
  '/uoms',
  requirePermissions([PERMISSIONS.INVENTORY_CREATE]),
  validateRequest(createUomSchema),
  (req, res, next) => masterDataController.createUOM(req, res, next)
);

router.get('/uom-conversions', requirePermissions([PERMISSIONS.INVENTORY_READ]), (req, res, next) =>
  masterDataController.getUOMConversions(req, res, next)
);
router.post(
  '/uom-conversions',
  requirePermissions([PERMISSIONS.INVENTORY_CREATE]),
  validateRequest(createUomConversionSchema),
  (req, res, next) => masterDataController.createUOMConversion(req, res, next)
);

// Suppliers
router.get(
  '/suppliers/performance-matrix',
  requirePermissions([PERMISSIONS.SUPPLIERS_READ, PERMISSIONS.PURCHASE_READ], false),
  (req, res, next) => masterDataController.getSupplierPerformanceMatrix(req, res, next)
);
router.get(
  '/suppliers',
  requirePermissions([PERMISSIONS.SUPPLIERS_READ, PERMISSIONS.PURCHASE_READ], false),
  (req, res, next) => masterDataController.getSuppliers(req, res, next)
);
router.get(
  '/suppliers/:id/performance',
  requirePermissions([PERMISSIONS.SUPPLIERS_READ, PERMISSIONS.PURCHASE_READ], false),
  (req, res, next) => masterDataController.getSupplierPerformance(req, res, next)
);
router.get(
  '/suppliers/:id/history',
  requirePermissions([PERMISSIONS.SUPPLIERS_READ, PERMISSIONS.PURCHASE_READ], false),
  (req, res, next) => masterDataController.getSupplierHistory(req, res, next)
);
router.get(
  '/suppliers/:id',
  requirePermissions([PERMISSIONS.SUPPLIERS_READ, PERMISSIONS.PURCHASE_READ], false),
  (req, res, next) => masterDataController.getSupplierById(req, res, next)
);
router.post(
  '/suppliers',
  requirePermissions([PERMISSIONS.SUPPLIERS_MANAGE, PERMISSIONS.PURCHASE_CREATE], false),
  validateRequest(createSupplierSchema),
  (req, res, next) => masterDataController.createSupplier(req, res, next)
);
router.patch(
  '/suppliers/:id/status',
  requirePermissions([PERMISSIONS.SUPPLIERS_MANAGE, PERMISSIONS.PURCHASE_UPDATE], false),
  (req, res, next) => masterDataController.changeSupplierStatus(req, res, next)
);
router.patch(
  '/suppliers/:id',
  requirePermissions([PERMISSIONS.SUPPLIERS_MANAGE, PERMISSIONS.PURCHASE_UPDATE], false),
  validateRequest(updateSupplierSchema),
  (req, res, next) => masterDataController.updateSupplier(req, res, next)
);

// Customers
router.get(
  '/customers',
  requirePermissions([PERMISSIONS.CUSTOMERS_READ, PERMISSIONS.SALES_READ, PERMISSIONS.SALES_CREATE], false),
  (req, res, next) => masterDataController.getCustomers(req, res, next)
);
router.get(
  '/customers/:id',
  requirePermissions([PERMISSIONS.CUSTOMERS_READ, PERMISSIONS.SALES_READ, PERMISSIONS.SALES_CREATE], false),
  (req, res, next) => masterDataController.getCustomerById(req, res, next)
);
router.post(
  '/customers',
  requirePermissions([PERMISSIONS.CUSTOMERS_MANAGE]),
  validateRequest(createCustomerSchema),
  (req, res, next) => masterDataController.createCustomer(req, res, next)
);
router.patch('/customers/:id', requirePermissions([PERMISSIONS.CUSTOMERS_MANAGE]), (req, res, next) =>
  masterDataController.updateCustomer(req, res, next)
);

// Departments
router.get('/departments', requirePermissions([PERMISSIONS.TENANT_READ]), (req, res, next) =>
  masterDataController.getDepartments(req, res, next)
);
router.post(
  '/departments',
  requirePermissions([PERMISSIONS.TENANT_UPDATE]),
  validateRequest(createDepartmentSchema),
  (req, res, next) => masterDataController.createDepartment(req, res, next)
);

// Tax Codes
router.get('/tax-codes', requirePermissions([PERMISSIONS.INVENTORY_READ]), (req, res, next) =>
  masterDataController.getTaxCodes(req, res, next)
);
router.post(
  '/tax-codes',
  requirePermissions([PERMISSIONS.TENANT_UPDATE]),
  validateRequest(createTaxCodeSchema),
  (req, res, next) => masterDataController.createTaxCode(req, res, next)
);

// Payment Terms
router.get('/payment-terms', requirePermissions([PERMISSIONS.INVENTORY_READ]), (req, res, next) =>
  masterDataController.getPaymentTerms(req, res, next)
);
router.post(
  '/payment-terms',
  requirePermissions([PERMISSIONS.TENANT_UPDATE]),
  validateRequest(createPaymentTermSchema),
  (req, res, next) => masterDataController.createPaymentTerm(req, res, next)
);

// Currencies
router.get('/currencies', requirePermissions([PERMISSIONS.INVENTORY_READ]), (req, res, next) =>
  masterDataController.getCurrencies(req, res, next)
);
router.post(
  '/currencies',
  requirePermissions([PERMISSIONS.TENANT_UPDATE]),
  validateRequest(createCurrencySchema),
  (req, res, next) => masterDataController.createCurrency(req, res, next)
);

// Reason Codes
router.get('/reasons/wastage', requirePermissions([PERMISSIONS.INVENTORY_READ]), (req, res, next) =>
  masterDataController.getWastageReasons(req, res, next)
);
router.post(
  '/reasons/wastage',
  requirePermissions([PERMISSIONS.INVENTORY_CREATE]),
  validateRequest(createReasonSchema),
  (req, res, next) => masterDataController.createWastageReason(req, res, next)
);

router.get('/reasons/stock-adjustment', requirePermissions([PERMISSIONS.INVENTORY_READ]), (req, res, next) =>
  masterDataController.getStockAdjustmentReasons(req, res, next)
);
router.post(
  '/reasons/stock-adjustment',
  requirePermissions([PERMISSIONS.INVENTORY_CREATE]),
  validateRequest(createReasonSchema),
  (req, res, next) => masterDataController.createStockAdjustmentReason(req, res, next)
);

// Starter Master Data Provisioning & Sample Data Wipe
router.post('/initialize-starter', requirePermissions([PERMISSIONS.TENANT_READ]), (req, res, next) =>
  masterDataController.initializeStarterData(req, res, next)
);

router.post('/clear-sample-data', requirePermissions([PERMISSIONS.INVENTORY_ADJUST]), (req, res, next) =>
  masterDataController.clearSampleData(req, res, next)
);

export const masterDataRoutes = router;
