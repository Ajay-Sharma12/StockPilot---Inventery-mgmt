import { Types } from 'mongoose';
import { UOMConversion, IUOMConversion } from '../models/uom.model';
import { UOM } from '../models/uom.model';
import { BadRequestError } from '../core/errors';

export class UOMConversionService {
  async convert(
    tenantId: string | Types.ObjectId,
    quantity: number,
    fromUomId: string | Types.ObjectId,
    toUomId: string | Types.ObjectId
  ): Promise<{ convertedQuantity: number; factor: number }> {
    if (fromUomId.toString() === toUomId.toString()) {
      return { convertedQuantity: quantity, factor: 1 };
    }

    const tId = new Types.ObjectId(tenantId);
    const fromId = new Types.ObjectId(fromUomId);
    const toId = new Types.ObjectId(toUomId);

    // 1. Check direct conversion
    let directConv = await UOMConversion.findOne({
      tenantId: tId,
      fromUomId: fromId,
      toUomId: toId,
      status: 'ACTIVE',
    }).exec();

    if (directConv) {
      const rawQty = quantity * directConv.conversionFactor;
      const rounded = this.applyRounding(rawQty, directConv.roundingRule);
      return { convertedQuantity: rounded, factor: directConv.conversionFactor };
    }

    // 2. Check inverse conversion
    let inverseConv = await UOMConversion.findOne({
      tenantId: tId,
      fromUomId: toId,
      toUomId: fromId,
      status: 'ACTIVE',
    }).exec();

    if (inverseConv && inverseConv.conversionFactor > 0) {
      const factor = 1 / inverseConv.conversionFactor;
      const rawQty = quantity * factor;
      const rounded = this.applyRounding(rawQty, inverseConv.roundingRule);
      return { convertedQuantity: rounded, factor };
    }

    // If neither exists, fetch UOM names for descriptive error
    const [uomFrom, uomTo] = await Promise.all([
      UOM.findOne({ _id: fromId, tenantId: tId }),
      UOM.findOne({ _id: toId, tenantId: tId }),
    ]);

    throw new BadRequestError(
      `No active conversion path found between '${uomFrom?.name || fromUomId}' and '${uomTo?.name || toUomId}'.`
    );
  }

  private applyRounding(value: number, rule: 'ROUND' | 'CEIL' | 'FLOOR' = 'ROUND', precision = 4): number {
    const factor = Math.pow(10, precision);
    switch (rule) {
      case 'CEIL':
        return Math.ceil(value * factor) / factor;
      case 'FLOOR':
        return Math.floor(value * factor) / factor;
      case 'ROUND':
      default:
        return Math.round(value * factor) / factor;
    }
  }
}

export const uomConversionService = new UOMConversionService();
