import { Types } from 'mongoose';
import { Package, IPackage } from '../models/package.model';
import { SalesOrder } from '../models/salesOrder.model';
import { documentNumberService } from '../../../services/documentNumber.service';
import { auditRepository } from '../../../repositories/audit.repository';
import { AuditAction, AuditEntity } from '../../../config/constants';
import { BadRequestError, NotFoundError } from '../../../core/errors';

export class PackagingService {
  async createPackage(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    data: any
  ): Promise<IPackage> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const so = await SalesOrder.findOne({ _id: data.salesOrderId, tenantId: tId }).exec();
    if (!so) throw new NotFoundError('Sales Order not found');

    if (!['CONFIRMED', 'PARTIALLY_FULFILLED'].includes(so.status)) {
      throw new BadRequestError(`Cannot package Sales Order in '${so.status}' status. Order must be CONFIRMED first.`);
    }

    // Validate quantities against SO items: total packed cannot exceed orderedQuantity
    for (const pkgItem of data.items) {
      const soLine = so.items.find(
        (i) => i.itemId.toString() === pkgItem.itemId.toString()
      );
      if (!soLine) {
        throw new BadRequestError(`Item ${pkgItem.itemId} is not part of this Sales Order`);
      }

      const availableToPack = soLine.orderedQuantity - (soLine.packedQuantity || 0);
      if (pkgItem.quantity > availableToPack) {
        throw new BadRequestError(
          `Cannot package ${pkgItem.quantity} units for item '${soLine.description}'. Maximum remaining eligible to pack is ${availableToPack} units.`
        );
      }
    }

    const packageNumber = await documentNumberService.getNextNumber(tId, 'PACKAGE');

    const pkg = await Package.create({
      tenantId: tId,
      packageNumber,
      salesOrderId: so._id,
      customerId: so.customerId,
      warehouseId: so.warehouseId,
      items: data.items.map((i: any) => ({
        itemId: new Types.ObjectId(i.itemId),
        quantity: Number(i.quantity),
        uomId: new Types.ObjectId(i.uomId),
        batchNumber: i.batchNumber,
        serialNumbers: i.serialNumbers || [],
        weight: i.weight,
        dimensions: i.dimensions,
        remarks: i.remarks,
      })),
      totalWeight: data.totalWeight,
      dimensions: data.dimensions,
      packingMaterial: data.packingMaterial,
      status: 'DRAFT',
      notes: data.notes,
      createdBy: uId,
      updatedBy: uId,
    });

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.CREATE,
      entity: AuditEntity.SALES,
      entityId: pkg._id.toString(),
      details: `Created Package ${packageNumber} for Sales Order ${so.soNumber}`,
    });

    return pkg;
  }

  async packOrder(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    packageId: string | Types.ObjectId
  ): Promise<IPackage> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const pkg = await Package.findOne({ _id: packageId, tenantId: tId }).exec();
    if (!pkg) throw new NotFoundError('Package not found');

    if (pkg.status === 'PACKED') {
      throw new BadRequestError('Package is already packed');
    }
    if (pkg.status === 'CANCELLED') {
      throw new BadRequestError('Cannot pack a cancelled package');
    }

    const so = await SalesOrder.findOne({ _id: pkg.salesOrderId, tenantId: tId }).exec();
    if (!so) throw new NotFoundError('Associated Sales Order not found');

    // Update SO packed quantities
    for (const pkgItem of pkg.items) {
      const soLine = so.items.find(
        (i) => i.itemId.toString() === pkgItem.itemId.toString()
      );
      if (soLine) {
        soLine.packedQuantity = (soLine.packedQuantity || 0) + pkgItem.quantity;
      }
    }
    await so.save();

    pkg.status = 'PACKED';
    pkg.packedBy = uId;
    pkg.packedDate = new Date();
    pkg.updatedBy = uId;
    await pkg.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.SALES,
      entityId: pkg._id.toString(),
      details: `Packaged and sealed container ${pkg.packageNumber} for Sales Order ${so.soNumber}`,
    });

    return pkg;
  }

  async getPackages(
    tenantId: string | Types.ObjectId,
    query: any = {}
  ): Promise<{ data: IPackage[]; total: number; page: number; limit: number }> {
    const tId = new Types.ObjectId(tenantId);
    const filter: any = { tenantId: tId };

    if (query.salesOrderId) filter.salesOrderId = new Types.ObjectId(query.salesOrderId);
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.packageNumber = { $regex: query.search.trim(), $options: 'i' };
    }

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Package.find(filter)
        .populate('salesOrderId', 'soNumber status orderDate')
        .populate('customerId', 'name customerCode')
        .populate('warehouseId', 'name code')
        .populate('items.itemId', 'name sku code')
        .populate('items.uomId', 'name symbol')
        .populate('packedBy', 'name firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Package.countDocuments(filter).exec(),
    ]);

    return { data, total, page, limit };
  }

  async getPackageById(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IPackage> {
    const tId = new Types.ObjectId(tenantId);
    const pkg = await Package.findOne({ _id: id, tenantId: tId })
      .populate('salesOrderId')
      .populate('customerId')
      .populate('warehouseId')
      .populate('items.itemId')
      .populate('items.uomId')
      .populate('packedBy', 'name firstName lastName email')
      .exec();

    if (!pkg) throw new NotFoundError('Package not found');
    return pkg;
  }

  async cancelPackage(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    reason?: string
  ): Promise<IPackage> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const pkg = await Package.findOne({ _id: id, tenantId: tId }).exec();
    if (!pkg) throw new NotFoundError('Package not found');

    if (pkg.status === 'CANCELLED') {
      throw new BadRequestError('Package is already cancelled');
    }

    // If was packed, decrement SO packedQuantity
    if (pkg.status === 'PACKED') {
      const so = await SalesOrder.findOne({ _id: pkg.salesOrderId, tenantId: tId }).exec();
      if (so) {
        for (const pkgItem of pkg.items) {
          const soLine = so.items.find((i) => i.itemId.toString() === pkgItem.itemId.toString());
          if (soLine) {
            soLine.packedQuantity = Math.max(0, (soLine.packedQuantity || 0) - pkgItem.quantity);
          }
        }
        await so.save();
      }
    }

    pkg.status = 'CANCELLED';
    pkg.updatedBy = uId;
    await pkg.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.SALES,
      entityId: pkg._id.toString(),
      details: `Cancelled Package ${pkg.packageNumber}`,
    });

    return pkg;
  }
}

export const packagingService = new PackagingService();
