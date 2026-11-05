import { User } from '../../../models/user.model';
import { ForbiddenError } from '../../../core/errors';

export interface SalesApprovalCheckResult {
  allowed: boolean;
  reason?: string;
  amount: number;
  userLimit: number;
}

export class SalesOrderApprovalService {
  async canUserApproveSO(userId: string, soGrandTotal: number): Promise<SalesApprovalCheckResult> {
    const user = await User.findById(userId).populate('roles').exec();
    if (!user) {
      throw new ForbiddenError('User not found');
    }

    if (user.isSuperAdmin) {
      return { allowed: true, amount: soGrandTotal, userLimit: Infinity };
    }

    const roles = (user.roles as any[]) || [];
    const isTenantAdmin = roles.some((r) => r.slug === 'tenant-admin');
    if (isTenantAdmin) {
      return { allowed: true, amount: soGrandTotal, userLimit: Infinity };
    }

    const userLimit = user.accessScope?.maxApprovalLimit ?? 0;

    if (soGrandTotal > userLimit) {
      return {
        allowed: false,
        reason: `Sales Order amount ($${soGrandTotal.toLocaleString()}) exceeds your authorized approval limit ($${userLimit.toLocaleString()}). Requires Operations Manager or Tenant Admin sign-off.`,
        amount: soGrandTotal,
        userLimit,
      };
    }

    return {
      allowed: true,
      amount: soGrandTotal,
      userLimit,
    };
  }
}

export const salesOrderApprovalService = new SalesOrderApprovalService();
