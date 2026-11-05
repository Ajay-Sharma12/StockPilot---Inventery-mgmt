import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../core/types';
import { masterDataService } from '../services/masterData.service';
import { sendSuccess, sendCreated, sendPaginated } from '../core/responseHandler';
import { ForbiddenError, BadRequestError } from '../core/errors';

export class MasterDataController {
  // Categories
  async getCategories(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const items = await masterDataService.getCategories(req.tenant._id);
      sendSuccess(res, items, 'Categories retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createCategory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const item = await masterDataService.createCategory(req.tenant._id, {
        ...req.body,
        createdBy: req.user?._id,
      });
      sendCreated(res, item, 'Category created');
    } catch (err) {
      next(err);
    }
  }

  async updateCategory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const item = await masterDataService.updateCategory(req.tenant._id, req.params.id, req.body);
      sendSuccess(res, item, 'Category updated');
    } catch (err) {
      next(err);
    }
  }

  // SubCategories
  async getSubCategories(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const items = await masterDataService.getSubCategories(req.tenant._id, req.query.categoryId as string);
      sendSuccess(res, items, 'Subcategories retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createSubCategory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const item = await masterDataService.createSubCategory(req.tenant._id, req.body);
      sendCreated(res, item, 'Subcategory created');
    } catch (err) {
      next(err);
    }
  }

  // UOMs
  async getUOMs(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const items = await masterDataService.getUOMs(req.tenant._id);
      sendSuccess(res, items, 'UOMs retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createUOM(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const item = await masterDataService.createUOM(req.tenant._id, req.body);
      sendCreated(res, item, 'UOM created');
    } catch (err) {
      next(err);
    }
  }

  // UOM Conversions
  async getUOMConversions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const items = await masterDataService.getUOMConversions(req.tenant._id);
      sendSuccess(res, items, 'UOM conversions retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createUOMConversion(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const item = await masterDataService.createUOMConversion(req.tenant._id, req.body);
      sendCreated(res, item, 'UOM conversion created');
    } catch (err) {
      next(err);
    }
  }

  // Suppliers
  async getSuppliers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const search = req.query.search as string;
      const status = req.query.status as string;
      const result = await masterDataService.getSuppliers(req.tenant._id, page, limit, search, status);
      sendPaginated(res, result.items, result.total, result.page, result.limit, 'Suppliers retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getSupplierById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const item = await masterDataService.getSupplierById(req.tenant._id, req.params.id);
      sendSuccess(res, item, 'Supplier retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createSupplier(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const item = await masterDataService.createSupplier(req.tenant._id, req.body, req.user?._id);
      sendCreated(res, item, 'Supplier created');
    } catch (err) {
      next(err);
    }
  }

  async updateSupplier(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const item = await masterDataService.updateSupplier(req.tenant._id, req.params.id, req.body, req.user?._id);
      sendSuccess(res, item, 'Supplier updated');
    } catch (err) {
      next(err);
    }
  }

  async changeSupplierStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      let status = req.body.status;
      if (!status && typeof req.body.isActive === 'boolean') {
        status = req.body.isActive ? 'ACTIVE' : 'INACTIVE';
      }
      if (typeof status === 'string') {
        status = status.toUpperCase();
      }
      if (!['ACTIVE', 'INACTIVE', 'BLOCKED'].includes(status)) {
        throw new BadRequestError('Invalid supplier status. Must be ACTIVE, INACTIVE, or BLOCKED');
      }
      const item = await masterDataService.changeSupplierStatus(req.tenant._id, req.params.id, status as any, req.user?._id);
      sendSuccess(res, item, `Supplier status updated to ${status}`);
    } catch (err) {
      next(err);
    }
  }

  async getSupplierPerformance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const metrics = await masterDataService.getSupplierPerformance(req.tenant._id, req.params.id);
      sendSuccess(res, metrics, 'Supplier performance metrics calculated');
    } catch (err) {
      next(err);
    }
  }

  async getSupplierPerformanceMatrix(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const matrix = await masterDataService.getSupplierPerformanceMatrix(req.tenant._id);
      sendSuccess(res, matrix, 'Supplier performance matrix calculated');
    } catch (err) {
      next(err);
    }
  }

  async getSupplierHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const history = await masterDataService.getSupplierHistory(req.tenant._id, req.params.id);
      sendSuccess(res, history, 'Supplier history retrieved');
    } catch (err) {
      next(err);
    }
  }

  // Customers
  async getCustomers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const search = req.query.search as string;
      const result = await masterDataService.getCustomers(req.tenant._id, page, limit, search);
      sendPaginated(res, result.items, result.total, result.page, result.limit, 'Customers retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getCustomerById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const item = await masterDataService.getCustomerById(req.tenant._id, req.params.id);
      sendSuccess(res, item, 'Customer retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const item = await masterDataService.createCustomer(req.tenant._id, req.body);
      sendCreated(res, item, 'Customer created');
    } catch (err) {
      next(err);
    }
  }

  async updateCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const item = await masterDataService.updateCustomer(req.tenant._id, req.params.id, req.body);
      sendSuccess(res, item, 'Customer updated');
    } catch (err) {
      next(err);
    }
  }

  // Departments
  async getDepartments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const items = await masterDataService.getDepartments(req.tenant._id);
      sendSuccess(res, items, 'Departments retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createDepartment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const item = await masterDataService.createDepartment(req.tenant._id, req.body);
      sendCreated(res, item, 'Department created');
    } catch (err) {
      next(err);
    }
  }

  // Tax Codes
  async getTaxCodes(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const items = await masterDataService.getTaxCodes(req.tenant._id);
      sendSuccess(res, items, 'Tax codes retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createTaxCode(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const item = await masterDataService.createTaxCode(req.tenant._id, req.body);
      sendCreated(res, item, 'Tax code created');
    } catch (err) {
      next(err);
    }
  }

  // Payment Terms
  async getPaymentTerms(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const items = await masterDataService.getPaymentTerms(req.tenant._id);
      sendSuccess(res, items, 'Payment terms retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createPaymentTerm(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const item = await masterDataService.createPaymentTerm(req.tenant._id, req.body);
      sendCreated(res, item, 'Payment term created');
    } catch (err) {
      next(err);
    }
  }

  // Currencies
  async getCurrencies(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const items = await masterDataService.getCurrencies(req.tenant._id);
      sendSuccess(res, items, 'Currencies retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createCurrency(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const item = await masterDataService.createCurrency(req.tenant._id, req.body);
      sendCreated(res, item, 'Currency created');
    } catch (err) {
      next(err);
    }
  }

  // Reasons
  async getWastageReasons(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const items = await masterDataService.getWastageReasons(req.tenant._id);
      sendSuccess(res, items, 'Wastage reasons retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createWastageReason(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const item = await masterDataService.createWastageReason(req.tenant._id, req.body);
      sendCreated(res, item, 'Wastage reason created');
    } catch (err) {
      next(err);
    }
  }

  async getStockAdjustmentReasons(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const items = await masterDataService.getStockAdjustmentReasons(req.tenant._id);
      sendSuccess(res, items, 'Stock adjustment reasons retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createStockAdjustmentReason(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const item = await masterDataService.createStockAdjustmentReason(req.tenant._id, req.body);
      sendCreated(res, item, 'Stock adjustment reason created');
    } catch (err) {
      next(err);
    }
  }

  async initializeStarterData(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const result = await masterDataService.initializeStarterData(req.tenant._id, req.user?._id);
      sendSuccess(res, result, 'Standard starter master data provisioned successfully');
    } catch (err) {
      next(err);
    }
  }

  async clearSampleData(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) throw new ForbiddenError('Tenant context required');
      const result = await masterDataService.clearSampleData(req.tenant._id);
      sendSuccess(res, result, 'Sample inventory data removed cleanly. Workspace ready for custom data.');
    } catch (err) {
      next(err);
    }
  }
}

export const masterDataController = new MasterDataController();
