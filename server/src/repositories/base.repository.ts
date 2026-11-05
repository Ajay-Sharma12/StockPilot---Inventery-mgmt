import { Model, Document, FilterQuery, UpdateQuery, QueryOptions, Types } from 'mongoose';

export abstract class BaseRepository<T extends Document> {
  protected model: Model<T>;

  constructor(model: Model<T>) {
    this.model = model;
  }

  async findById(id: string | Types.ObjectId, tenantId?: string | Types.ObjectId | null): Promise<T | null> {
    const filter: any = { _id: id };
    if (tenantId) {
      filter.tenantId = tenantId;
    }
    return this.model.findOne(filter).exec();
  }

  async findOne(filter: FilterQuery<T>, tenantId?: string | Types.ObjectId | null): Promise<T | null> {
    const queryFilter: any = { ...filter };
    if (tenantId) {
      queryFilter.tenantId = tenantId;
    }
    return this.model.findOne(queryFilter).exec();
  }

  async find(
    filter: FilterQuery<T> = {},
    tenantId?: string | Types.ObjectId | null,
    options: QueryOptions = {}
  ): Promise<T[]> {
    const queryFilter: any = { ...filter };
    if (tenantId) {
      queryFilter.tenantId = tenantId;
    }
    return this.model.find(queryFilter, null, options).exec();
  }

  async findPaginated(
    filter: FilterQuery<T> = {},
    tenantId?: string | Types.ObjectId | null,
    page = 1,
    limit = 20,
    sort: Record<string, 1 | -1> = { createdAt: -1 }
  ): Promise<{ items: T[]; total: number; page: number; limit: number }> {
    const queryFilter: any = { ...filter };
    if (tenantId) {
      queryFilter.tenantId = tenantId;
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.model.find(queryFilter).sort(sort).skip(skip).limit(limit).exec(),
      this.model.countDocuments(queryFilter).exec(),
    ]);

    return { items, total, page, limit };
  }

  async create(doc: Partial<T>): Promise<T> {
    return this.model.create(doc as any);
  }

  async updateById(
    id: string | Types.ObjectId,
    update: UpdateQuery<T>,
    tenantId?: string | Types.ObjectId | null
  ): Promise<T | null> {
    const filter: any = { _id: id };
    if (tenantId) {
      filter.tenantId = tenantId;
    }
    return this.model.findOneAndUpdate(filter, update, { new: true, runValidators: true }).exec();
  }

  async deleteById(id: string | Types.ObjectId, tenantId?: string | Types.ObjectId | null): Promise<boolean> {
    const filter: any = { _id: id };
    if (tenantId) {
      filter.tenantId = tenantId;
    }
    const result = await this.model.deleteOne(filter).exec();
    return result.deletedCount === 1;
  }

  async count(filter: FilterQuery<T> = {}, tenantId?: string | Types.ObjectId | null): Promise<number> {
    const queryFilter: any = { ...filter };
    if (tenantId) {
      queryFilter.tenantId = tenantId;
    }
    return this.model.countDocuments(queryFilter).exec();
  }
}
