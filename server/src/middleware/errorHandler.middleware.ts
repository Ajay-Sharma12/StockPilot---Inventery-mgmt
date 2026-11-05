import { Request, Response, NextFunction } from 'express';
import { AppError } from '../core/errors';
import { logger } from '../core/logger';
import { env } from '../config/env.config';
import { AuthenticatedRequest } from '../core/types';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  const authReq = req as AuthenticatedRequest;
  const requestId = authReq.requestId || 'no-request-id';

  // Handle AppError instances
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(`[${requestId}] Operational 500 Error: ${err.message}`, {
        stack: err.stack,
        details: err.details,
      });
    }

    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details ? { errors: err.details } : {}),
      requestId,
    });
  }

  // Handle Mongoose Duplicate Key Error (E11000)
  if (err.code === 11000) {
    const keyPattern = err.keyPattern || {};
    const keyValue = err.keyValue || {};

    // In multi-tenant compound indexes like { tenantId: 1, sku: 1 }, ignore tenantId to identify the real business field
    const nonTenantKeys = Object.keys(keyPattern).filter((k) => k !== 'tenantId');
    const field = nonTenantKeys[0] || Object.keys(keyPattern)[0] || 'field';
    const value = keyValue[field] !== undefined ? ` '${keyValue[field]}'` : '';

    const friendlyFieldNames: Record<string, string> = {
      sku: 'SKU code',
      itemCode: 'Item code',
      email: 'Email address',
      code: 'Code identifier',
      name: 'Name',
      slug: 'Slug identifier',
      supplierCode: 'Supplier code',
      customerCode: 'Customer code',
      batchNumber: 'Batch number',
      poNumber: 'Purchase Order number',
      grnNumber: 'GRN number',
      qcNumber: 'QC inspection number',
      transferNumber: 'Transfer number',
      adjustmentNumber: 'Adjustment number',
      countNumber: 'Stock count number',
      wastageNumber: 'Wastage report number',
    };

    const displayField = friendlyFieldNames[field] || field;

    logger.warn(`[${requestId}] Duplicate Key Conflict (E11000) on field '${field}':`, {
      keyPattern,
      keyValue,
    });

    return res.status(409).json({
      success: false,
      message: `A record with this ${displayField}${value} already exists in your organization.`,
      field,
      requestId,
    });
  }

  // Handle Mongoose CastError (Invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid format for resource identifier: ${err.value}`,
      requestId,
    });
  }

  // Unhandled / Internal Server Error
  logger.error(`[${requestId}] Unhandled Exception: ${err.message}`, {
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  return res.status(500).json({
    success: false,
    message: env.NODE_ENV === 'production' ? 'An unexpected internal error occurred' : err.message,
    ...(env.NODE_ENV !== 'production' ? { stack: err.stack } : {}),
    requestId,
  });
};
