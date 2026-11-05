import { Types } from 'mongoose';
import { Warehouse, IWarehouse, Zone, IZone, Rack, IRack, Bin, IBin } from '../models/warehouse.model';
import { BadRequestError, NotFoundError, ForbiddenError } from '../core/errors';

export class WarehouseService {
  async getWarehouses(tenantId: string | Types.ObjectId, warehouseScope: string[] = []): Promise<IWarehouse[]> {
    const filter: any = { tenantId: new Types.ObjectId(tenantId) };
    if (warehouseScope.length > 0) {
      const validIds = warehouseScope.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
      filter.$or = [
        ...(validIds.length > 0 ? [{ _id: { $in: validIds } }] : []),
        { code: { $in: warehouseScope } },
      ];
    }
    return Warehouse.find(filter).populate('managerId', 'name email').sort({ name: 1 }).exec();
  }

  async getWarehouseById(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    warehouseScope: string[] = []
  ): Promise<IWarehouse> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Warehouse not found');
    }
    const wh = await Warehouse.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    }).populate('managerId', 'name email').exec();

    if (!wh) throw new NotFoundError('Warehouse not found');

    if (
      warehouseScope.length > 0 &&
      !warehouseScope.includes(wh._id.toString()) &&
      !warehouseScope.includes(wh.code)
    ) {
      throw new ForbiddenError('You do not have access to view this warehouse');
    }
    return wh;
  }

  async createWarehouse(tenantId: string | Types.ObjectId, data: Partial<IWarehouse>): Promise<IWarehouse> {
    const existing = await Warehouse.findOne({
      tenantId: new Types.ObjectId(tenantId),
      code: data.code?.toUpperCase().trim(),
    }).exec();

    if (existing) {
      throw new BadRequestError(`Warehouse code '${data.code}' already exists`);
    }

    return Warehouse.create({
      ...data,
      code: data.code?.toUpperCase().trim(),
      tenantId: new Types.ObjectId(tenantId),
    });
  }

  async updateWarehouse(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    data: Partial<IWarehouse>,
    warehouseScope: string[] = []
  ): Promise<IWarehouse> {
    if (warehouseScope.length > 0 && !warehouseScope.includes(id.toString())) {
      throw new ForbiddenError('You do not have access to modify this warehouse');
    }

    const wh = await Warehouse.findOneAndUpdate(
      { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) },
      { $set: data },
      { new: true }
    ).exec();

    if (!wh) throw new NotFoundError('Warehouse not found');
    return wh;
  }

  // --- ZONES ---
  async getZones(tenantId: string | Types.ObjectId, warehouseId: string | Types.ObjectId): Promise<IZone[]> {
    return Zone.find({
      tenantId: new Types.ObjectId(tenantId),
      warehouseId: new Types.ObjectId(warehouseId),
    }).sort({ code: 1 }).exec();
  }

  async createZone(tenantId: string | Types.ObjectId, data: Partial<IZone>): Promise<IZone> {
    const existing = await Zone.findOne({
      tenantId: new Types.ObjectId(tenantId),
      warehouseId: data.warehouseId,
      code: data.code?.toUpperCase().trim(),
    }).exec();

    if (existing) throw new BadRequestError(`Zone code '${data.code}' already exists in this warehouse`);

    return Zone.create({
      ...data,
      code: data.code?.toUpperCase().trim(),
      tenantId: new Types.ObjectId(tenantId),
    });
  }

  // --- RACKS ---
  async getRacks(tenantId: string | Types.ObjectId, zoneId: string | Types.ObjectId): Promise<IRack[]> {
    return Rack.find({
      tenantId: new Types.ObjectId(tenantId),
      zoneId: new Types.ObjectId(zoneId),
    }).sort({ code: 1 }).exec();
  }

  async createRack(tenantId: string | Types.ObjectId, data: Partial<IRack>): Promise<IRack> {
    const existing = await Rack.findOne({
      tenantId: new Types.ObjectId(tenantId),
      zoneId: data.zoneId,
      code: data.code?.toUpperCase().trim(),
    }).exec();

    if (existing) throw new BadRequestError(`Rack code '${data.code}' already exists in this zone`);

    return Rack.create({
      ...data,
      code: data.code?.toUpperCase().trim(),
      tenantId: new Types.ObjectId(tenantId),
    });
  }

  // --- BINS ---
  async getBins(
    tenantId: string | Types.ObjectId,
    filter: { warehouseId?: string | Types.ObjectId; rackId?: string | Types.ObjectId; zoneId?: string | Types.ObjectId }
  ): Promise<IBin[]> {
    const queryFilter: any = { tenantId: new Types.ObjectId(tenantId) };
    if (filter.warehouseId) queryFilter.warehouseId = new Types.ObjectId(filter.warehouseId);
    if (filter.zoneId) queryFilter.zoneId = new Types.ObjectId(filter.zoneId);
    if (filter.rackId) queryFilter.rackId = new Types.ObjectId(filter.rackId);

    return Bin.find(queryFilter).sort({ code: 1 }).exec();
  }

  async createBin(tenantId: string | Types.ObjectId, data: Partial<IBin>): Promise<IBin> {
    const existing = await Bin.findOne({
      tenantId: new Types.ObjectId(tenantId),
      rackId: data.rackId,
      code: data.code?.toUpperCase().trim(),
    }).exec();

    if (existing) throw new BadRequestError(`Bin code '${data.code}' already exists in this rack`);

    return Bin.create({
      ...data,
      code: data.code?.toUpperCase().trim(),
      tenantId: new Types.ObjectId(tenantId),
    });
  }

  // --- HIERARCHY TREE ---
  async getWarehouseHierarchyTree(tenantId: string | Types.ObjectId, warehouseId: string | Types.ObjectId) {
    const tId = new Types.ObjectId(tenantId);
    const whId = new Types.ObjectId(warehouseId);

    const [warehouse, zones, racks, bins] = await Promise.all([
      Warehouse.findOne({ _id: whId, tenantId: tId }).exec(),
      Zone.find({ warehouseId: whId, tenantId: tId }).exec(),
      Rack.find({ warehouseId: whId, tenantId: tId }).exec(),
      Bin.find({ warehouseId: whId, tenantId: tId }).exec(),
    ]);

    if (!warehouse) throw new NotFoundError('Warehouse not found');

    const tree = {
      id: warehouse._id,
      code: warehouse.code,
      name: warehouse.name,
      type: warehouse.type,
      zones: zones.map((z) => ({
        id: z._id,
        code: z.code,
        name: z.name,
        racks: racks
          .filter((r) => r.zoneId.toString() === z._id.toString())
          .map((r) => ({
            id: r._id,
            code: r.code,
            name: r.name,
            bins: bins
              .filter((b) => b.rackId.toString() === r._id.toString())
              .map((b) => ({
                id: b._id,
                code: b.code,
                name: b.name,
                capacity: b.capacity,
              })),
          })),
      })),
    };

    return tree;
  }
}

export const warehouseService = new WarehouseService();
