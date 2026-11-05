import { Types } from 'mongoose';
import { ProductionBatch, IProductionBatch, ProductionBatchStatus } from '../models/productionBatch.model';
import { NotFoundError } from '../../../core/errors';

export class ProductionBatchService {
  async getBatches(
    tenantId: string | Types.ObjectId,
    query: {
      page?: number;
      limit?: number;
      status?: ProductionBatchStatus;
      itemId?: string;
      search?: string;
    } = {}
  ): Promise<{ data: IProductionBatch[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: any = { tenantId: new Types.ObjectId(tenantId) };
    if (query.status) filter.status = query.status;
    if (query.itemId) filter.itemId = new Types.ObjectId(query.itemId);
    if (query.search) {
      filter.batchNumber = { $regex: query.search.trim(), $options: 'i' };
    }

    const [data, total] = await Promise.all([
      ProductionBatch.find(filter)
        .populate('itemId', 'sku name itemCode')
        .populate('productionOrderId', 'productionOrderNumber status')
        .populate('uomId', 'code name')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      ProductionBatch.countDocuments(filter).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getBatchById(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IProductionBatch> {
    const batch = await ProductionBatch.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    })
      .populate('itemId', 'sku name itemCode standardCost')
      .populate('productionOrderId', 'productionOrderNumber status')
      .populate('uomId', 'code name')
      .populate('createdBy', 'name email')
      .exec();

    if (!batch) throw new NotFoundError('Production Batch not found');
    return batch;
  }
}

export const productionBatchService = new ProductionBatchService();
