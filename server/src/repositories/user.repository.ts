import { Types } from 'mongoose';
import { BaseRepository } from './base.repository';
import { IUser, User } from '../models/user.model';

export class UserRepository extends BaseRepository<IUser> {
  constructor() {
    super(User);
  }

  async findByEmailWithPassword(email: string, tenantId?: string | Types.ObjectId | null): Promise<IUser | null> {
    const filter: any = { email: email.toLowerCase() };
    if (tenantId !== undefined) {
      filter.tenantId = tenantId;
    }
    return this.model.findOne(filter).select('+passwordHash').populate('roles').exec();
  }

  async findByEmail(email: string, tenantId?: string | Types.ObjectId | null): Promise<IUser | null> {
    const filter: any = { email: email.toLowerCase() };
    if (tenantId !== undefined) {
      filter.tenantId = tenantId;
    }
    return this.model.findOne(filter).populate('roles').exec();
  }

  async findByIdPopulated(id: string | Types.ObjectId, tenantId?: string | Types.ObjectId | null): Promise<IUser | null> {
    const filter: any = { _id: id };
    if (tenantId) {
      filter.tenantId = tenantId;
    }
    return this.model.findOne(filter).populate('roles').exec();
  }

  async findUsersWithRoles(
    tenantId: string | Types.ObjectId,
    filter: any = {},
    page = 1,
    limit = 20
  ): Promise<{ items: IUser[]; total: number; page: number; limit: number }> {
    const queryFilter = { ...filter, tenantId };
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.model.find(queryFilter).populate('roles').sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(queryFilter).exec(),
    ]);

    return { items, total, page, limit };
  }
}

export const userRepository = new UserRepository();
