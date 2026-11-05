import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { tenantContext } from '../../../middleware/tenantContext.middleware';
import { requireFeature } from '../../../middleware/entitlement.middleware';
import { requirePermissions } from '../../../middleware/rbac.middleware';
import { validateWarehouseScope } from '../../../middleware/abac.middleware';
import { validateRequest } from '../../../middleware/validate.middleware';
import { PERMISSIONS } from '../../../config/permissions.config';
import { productionOrderController } from '../controllers/productionOrder.controller';
import { productionMaterialController } from '../controllers/productionMaterial.controller';
import {
  createProductionOrderSchema,
  updateProductionOrderSchema,
  cancelProductionOrderSchema,
  recordOutputSchema,
  consumeMaterialSchema,
  returnMaterialSchema,
} from '../validators/production.validator';

const router = Router();

router.use(authenticate, tenantContext, requireFeature('production'));

router.get(
  '/',
  requirePermissions([PERMISSIONS.PRODUCTION_READ, PERMISSIONS.PROD_VIEW], false),
  productionOrderController.getProductionOrders
);

router.get(
  '/:id',
  requirePermissions([PERMISSIONS.PRODUCTION_READ, PERMISSIONS.PROD_VIEW], false),
  productionOrderController.getProductionOrderById
);

router.post(
  '/',
  requirePermissions([PERMISSIONS.PRODUCTION_CREATE, PERMISSIONS.PROD_CREATE], false),
  validateRequest({ body: createProductionOrderSchema }),
  validateWarehouseScope('warehouseId', 'body'),
  productionOrderController.createProductionOrder
);

router.patch(
  '/:id',
  requirePermissions([PERMISSIONS.PRODUCTION_UPDATE, PERMISSIONS.PROD_EDIT], false),
  validateRequest({ body: updateProductionOrderSchema }),
  productionOrderController.updateProductionOrder
);

router.put(
  '/:id',
  requirePermissions([PERMISSIONS.PRODUCTION_UPDATE, PERMISSIONS.PROD_EDIT], false),
  validateRequest({ body: updateProductionOrderSchema }),
  productionOrderController.updateProductionOrder
);

router.post(
  '/:id/submit',
  requirePermissions([PERMISSIONS.PRODUCTION_UPDATE, PERMISSIONS.PROD_SUBMIT], false),
  productionOrderController.submitProductionOrder
);

router.post(
  '/:id/approve',
  requirePermissions([PERMISSIONS.PRODUCTION_UPDATE, PERMISSIONS.PROD_APPROVE], false),
  productionOrderController.approveProductionOrder
);

router.post(
  '/:id/release',
  requirePermissions([PERMISSIONS.PRODUCTION_UPDATE, PERMISSIONS.PROD_RELEASE], false),
  productionOrderController.releaseProductionOrder
);

router.post(
  '/:id/start',
  requirePermissions([PERMISSIONS.PRODUCTION_UPDATE, PERMISSIONS.PROD_START], false),
  productionOrderController.startProduction
);

router.post(
  '/:id/pause',
  requirePermissions([PERMISSIONS.PRODUCTION_UPDATE, PERMISSIONS.PROD_PAUSE], false),
  productionOrderController.pauseProduction
);

router.post(
  '/:id/resume',
  requirePermissions([PERMISSIONS.PRODUCTION_UPDATE, PERMISSIONS.PROD_RESUME], false),
  productionOrderController.resumeProduction
);

router.post(
  ['/:id/output', '/:id/record-output'],
  requirePermissions([PERMISSIONS.PRODUCTION_UPDATE, PERMISSIONS.PROD_COMPLETE], false),
  validateRequest({ body: recordOutputSchema }),
  productionOrderController.recordOutput
);

router.post(
  '/:id/consume',
  requirePermissions([PERMISSIONS.PRODUCTION_UPDATE, PERMISSIONS.PROD_CONSUME], false),
  validateRequest({ body: consumeMaterialSchema }),
  productionMaterialController.consumeMaterial
);

router.post(
  '/:id/return',
  requirePermissions([PERMISSIONS.PRODUCTION_UPDATE, PERMISSIONS.PROD_CONSUME], false),
  validateRequest({ body: returnMaterialSchema }),
  productionMaterialController.returnMaterial
);

router.post(
  '/:id/cancel',
  requirePermissions([PERMISSIONS.PRODUCTION_UPDATE, PERMISSIONS.PROD_CANCEL], false),
  validateRequest({ body: cancelProductionOrderSchema }),
  productionOrderController.cancelProductionOrder
);

router.get(
  '/:id/costing',
  requirePermissions([PERMISSIONS.PRODUCTION_READ, PERMISSIONS.PROD_VIEW], false),
  productionOrderController.getCosting
);

export { router as productionOrderRoutes };
