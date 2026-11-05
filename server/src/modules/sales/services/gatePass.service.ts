import { Types } from 'mongoose';
import { GatePass, IGatePass } from '../models/gatePass.model';
import { Dispatch } from '../models/dispatch.model';
import { SalesOrder } from '../models/salesOrder.model';
import { documentNumberService } from '../../../services/documentNumber.service';
import { auditRepository } from '../../../repositories/audit.repository';
import { AuditAction, AuditEntity } from '../../../config/constants';
import { BadRequestError, NotFoundError } from '../../../core/errors';

export class GatePassService {
  async createGatePass(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    data: any
  ): Promise<IGatePass> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const dispatch = await Dispatch.findOne({ _id: data.dispatchId, tenantId: tId }).exec();
    if (!dispatch) throw new NotFoundError('Dispatch not found');

    const so = await SalesOrder.findOne({ _id: data.salesOrderId || dispatch.salesOrderId, tenantId: tId }).exec();
    if (!so) throw new NotFoundError('Sales Order not found');

    const gatePassNumber = await documentNumberService.getNextNumber(tId, 'GATE_PASS');

    const gatePass = await GatePass.create({
      tenantId: tId,
      gatePassNumber,
      salesOrderId: so._id,
      dispatchId: dispatch._id,
      invoiceId: data.invoiceId ? new Types.ObjectId(data.invoiceId) : undefined,
      customerId: so.customerId,
      warehouseId: so.warehouseId,
      vehicleNumber: data.vehicleNumber || dispatch.vehicleNumber,
      driverName: data.driverName || dispatch.driverName,
      driverContact: data.driverContact || dispatch.driverContact,
      packageIds: dispatch.packageIds,
      items: so.items.map((i) => ({
        itemId: i.itemId,
        description: i.description,
        quantity: i.dispatchedQuantity || i.orderedQuantity,
        uomId: i.uomId,
      })),
      status: 'READY',
      remarks: data.remarks,
      createdBy: uId,
      updatedBy: uId,
    });

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.CREATE,
      entity: AuditEntity.SALES,
      entityId: gatePass._id.toString(),
      details: `Generated Gate Pass ${gatePassNumber} for Dispatch ${dispatch.dispatchNumber}`,
    });

    return gatePass;
  }

  async approveGatePass(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IGatePass> {
    const tId = new Types.ObjectId(tenantId);
    const uId = new Types.ObjectId(userId);

    const gp = await GatePass.findOne({ _id: id, tenantId: tId }).exec();
    if (!gp) throw new NotFoundError('Gate Pass not found');

    if (gp.status !== 'READY') {
      throw new BadRequestError(`Cannot approve Gate Pass in '${gp.status}' status`);
    }

    gp.status = 'APPROVED';
    gp.updatedBy = uId;
    await gp.save();

    await auditRepository.create({
      tenantId: tId,
      userId: uId,
      action: AuditAction.APPROVE,
      entity: AuditEntity.SALES,
      entityId: gp._id.toString(),
      details: `Approved Gate Pass ${gp.gatePassNumber} for vehicle departure`,
    });

    return gp;
  }

  async recordGateOut(
    tenantId: string | Types.ObjectId,
    securityOfficerId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    notes?: string
  ): Promise<IGatePass> {
    const tId = new Types.ObjectId(tenantId);
    const secId = new Types.ObjectId(securityOfficerId);

    const gp = await GatePass.findOne({ _id: id, tenantId: tId }).exec();
    if (!gp) throw new NotFoundError('Gate Pass not found');

    if (gp.status === 'GATE_OUT' || gp.status === 'CLOSED') {
      throw new BadRequestError('Gate Out event has already been recorded for this pass');
    }

    gp.status = 'GATE_OUT';
    gp.gateOutTime = new Date();
    gp.securityOfficerId = secId;
    if (notes) gp.remarks = `${gp.remarks || ''} | Gate Out Note: ${notes}`.trim();
    gp.updatedBy = secId;
    await gp.save();

    await auditRepository.create({
      tenantId: tId,
      userId: secId,
      action: AuditAction.STATUS_CHANGE,
      entity: AuditEntity.SALES,
      entityId: gp._id.toString(),
      details: `Vehicle ${gp.vehicleNumber || 'N/A'} completed Gate Out clearance at ${gp.gateOutTime.toISOString()} [Gate Pass: ${gp.gatePassNumber}]`,
    });

    return gp;
  }

  async getGatePasses(
    tenantId: string | Types.ObjectId,
    query: any = {}
  ): Promise<{ data: IGatePass[]; total: number; page: number; limit: number }> {
    const tId = new Types.ObjectId(tenantId);
    const filter: any = { tenantId: tId };

    if (query.dispatchId) filter.dispatchId = new Types.ObjectId(query.dispatchId);
    if (query.salesOrderId) filter.salesOrderId = new Types.ObjectId(query.salesOrderId);
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { gatePassNumber: { $regex: query.search.trim(), $options: 'i' } },
        { vehicleNumber: { $regex: query.search.trim(), $options: 'i' } },
        { driverName: { $regex: query.search.trim(), $options: 'i' } },
      ];
    }

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      GatePass.find(filter)
        .populate('salesOrderId', 'soNumber')
        .populate('dispatchId', 'dispatchNumber trackingNumber')
        .populate('customerId', 'name customerCode')
        .populate('warehouseId', 'name code')
        .populate('securityOfficerId', 'name firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      GatePass.countDocuments(filter).exec(),
    ]);

    return { data, total, page, limit };
  }

  async getGatePassById(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<IGatePass> {
    const tId = new Types.ObjectId(tenantId);
    const gp = await GatePass.findOne({ _id: id, tenantId: tId })
      .populate('salesOrderId')
      .populate('dispatchId')
      .populate('customerId')
      .populate('warehouseId')
      .populate('packageIds')
      .populate('securityOfficerId', 'name firstName lastName email')
      .exec();

    if (!gp) throw new NotFoundError('Gate Pass not found');
    return gp;
  }
}

export const gatePassService = new GatePassService();
