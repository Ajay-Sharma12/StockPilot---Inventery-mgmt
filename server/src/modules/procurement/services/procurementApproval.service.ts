import { User, IUser } from '../../../models/user.model';
import { ForbiddenError } from '../../../core/errors';

export interface ApprovalCheckResult {
  allowed: boolean;
  reason?: string;
  amount: number;
  userLimit: number;
}

export class ProcurementApprovalService {
  async canUserApprovePO(
    userId: string,
    poTotalAmount: number
  ): Promise<ApprovalCheckResult> {
    const user = await User.findById(userId).populate('roles').exec();
    if (!user) {
      throw new ForbiddenError('User not found');
    }

    if (user.isSuperAdmin) {
      return { allowed: true, amount: poTotalAmount, userLimit: Infinity };
    }

    const roles = (user.roles as any[]) || [];
    const isTenantAdmin = roles.some((r) => r.slug === 'tenant-admin');
    if (isTenantAdmin) {
      return { allowed: true, amount: poTotalAmount, userLimit: Infinity };
    }

    const userLimit = user.accessScope?.maxApprovalLimit ?? 0;

    if (poTotalAmount > userLimit) {
      return {
        allowed: false,
        reason: `Purchase Order amount ($${poTotalAmount.toLocaleString()}) exceeds your authorized approval limit ($${userLimit.toLocaleString()}). Requires higher management sign-off.`,
        amount: poTotalAmount,
        userLimit,
      };
    }

    return {
      allowed: true,
      amount: poTotalAmount,
      userLimit,
    };
  }
}

export const procurementApprovalService = new ProcurementApprovalService();
