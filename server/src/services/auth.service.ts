import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import crypto from 'crypto';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { env } from '../config/env.config';
import { TenantPlan, TenantStatus, UserStatus, AuditAction, AuditEntity, SYSTEM_ROLE_SLUGS, DEFAULT_PLAN_ENTITLEMENTS } from '../config/constants';
import { BadRequestError, UnauthorizedError, ForbiddenError, ConflictError } from '../core/errors';
import { TokenPayload, AuthenticatedUser } from '../core/types';
import { User, IUser } from '../models/user.model';
import { Tenant, ITenant } from '../models/tenant.model';
import { Role, IRole } from '../models/role.model';
import { RefreshToken } from '../models/refreshToken.model';
import { TenantSubscription } from '../models/subscription.model';
import { userRepository } from '../repositories/user.repository';
import { tenantRepository } from '../repositories/tenant.repository';
import { roleRepository } from '../repositories/role.repository';
import { auditRepository } from '../repositories/audit.repository';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    tenantId?: string | null;
    roles: any[];
    permissions: string[];
    accessScope: any;
    isSuperAdmin: boolean;
  };
  tenant?: {
    id: string;
    name: string;
    slug: string;
    plan: TenantPlan;
    status: TenantStatus;
    contactEmail?: string;
    phone?: string;
    organizationType?: string;
    country?: string;
    address?: any;
    settings: any;
    features?: Record<string, boolean>;
    quotas?: Record<string, number>;
  } | null;
}

export class AuthService {
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateTokens(payload: TokenPayload): { accessToken: string; rawRefreshToken: string } {
    const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as any,
    });

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');

    return { accessToken, rawRefreshToken };
  }

  private computePermissions(roles: IRole[], directPermissions: string[] = []): string[] {
    const permissionSet = new Set<string>(directPermissions);
    for (const role of roles) {
      if (Array.isArray(role.permissions)) {
        role.permissions.forEach((perm) => permissionSet.add(perm));
      }
    }
    return Array.from(permissionSet);
  }

  async login(
    email: string,
    password: string,
    tenantSlug?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResult> {
    const cleanEmail = email.trim().toLowerCase();
    let tenant: ITenant | null = null;
    let user: IUser | null = null;

    // 1. Find all users matching this email address across all tenants
    const matchingUsers = await User.find({ email: cleanEmail })
      .select('+passwordHash')
      .populate('roles')
      .exec();

    if (!matchingUsers || matchingUsers.length === 0) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // 2. Select target user:
    // If only one user account exists with this email, use it directly (resilient to stale tenantSlug)
    if (matchingUsers.length === 1) {
      user = matchingUsers[0];
    } else {
      // Multiple accounts exist with this email across tenants
      if (tenantSlug && tenantSlug.trim()) {
        const cleanSlug = tenantSlug.trim().toLowerCase();
        const slugTenant = await tenantRepository.findBySlug(cleanSlug);
        if (slugTenant) {
          const tenantMatch = matchingUsers.find((u) => u.tenantId && u.tenantId.toString() === slugTenant._id.toString());
          if (tenantMatch) {
            user = tenantMatch;
          }
        }
      }

      // If tenantSlug did not resolve or wasn't provided, find the account whose password matches
      if (!user) {
        for (const candidate of matchingUsers) {
          const isMatch = await bcrypt.compare(password, candidate.passwordHash);
          if (isMatch) {
            user = candidate;
            break;
          }
        }
      }

      // If only one user matched this email, pick that user
      if (!user && matchingUsers.length === 1) {
        user = matchingUsers[0];
      }
    }

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // 3. Resolve and verify tenant if user belongs to one
    if (user.tenantId) {
      tenant = await tenantRepository.findById(user.tenantId);
      if (!tenant) {
        throw new UnauthorizedError('Associated organization not found');
      }
      if (tenant.status === TenantStatus.SUSPENDED) {
        throw new ForbiddenError('Organization account is suspended. Please contact support.');
      }
    } else {
      tenant = null;
    }

    // Verify user account status
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError(`User account is ${user.status.toLowerCase()}. Please contact administrator.`);
    }

    // 4. Verify password strictly with bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Populate roles if needed
    const populatedUser = await User.findById(user._id).populate<{ roles: IRole[] }>('roles').exec();
    const roles = populatedUser?.roles || [];
    const roleObjects = roles.map((r) => ({
      id: r._id?.toString() || r.slug,
      name: r.name || r.slug,
      slug: r.slug,
    }));
    const roleSlugs = roles.map((r) => r.slug);
    const permissions = user.isSuperAdmin
      ? ['*']
      : this.computePermissions(roles, user.directPermissions);

    const tokenPayload: TokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      tenantId: user.tenantId ? user.tenantId.toString() : null,
      roles: roleSlugs,
      permissions,
      isSuperAdmin: user.isSuperAdmin,
    };

    const { accessToken, rawRefreshToken } = this.generateTokens(tokenPayload);

    // Save refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await RefreshToken.create({
      userId: user._id,
      tenantId: user.tenantId,
      tokenHash: this.hashToken(rawRefreshToken),
      expiresAt,
      ipAddress,
      userAgent,
    });

    // Update lastLoginAt
    await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });

    // Fetch subscription details if tenant exists
    let subscriptionData = null;
    if (tenant) {
      const sub = await TenantSubscription.findOne({ tenantId: tenant._id }).exec();
      const planConfig = DEFAULT_PLAN_ENTITLEMENTS[tenant.plan] || DEFAULT_PLAN_ENTITLEMENTS[TenantPlan.FREE];
      const features = sub?.features
        ? Object.fromEntries(sub.features.entries())
        : planConfig.features;
      const quotas = sub?.quotas
        ? Object.fromEntries(sub.quotas.entries())
        : planConfig.quotas;

      subscriptionData = {
        id: tenant._id.toString(),
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        status: tenant.status,
        contactEmail: tenant.contactEmail,
        phone: tenant.phone,
        organizationType: tenant.organizationType,
        country: tenant.country,
        address: tenant.address,
        settings: tenant.settings,
        features,
        quotas,
      };
    }

    // Record audit log
    await auditRepository.create({
      tenantId: user.tenantId,
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      action: AuditAction.LOGIN,
      entity: AuditEntity.AUTH,
      entityId: user._id.toString(),
      details: `Successful login for ${user.email}`,
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        tenantId: user.tenantId ? user.tenantId.toString() : null,
        roles: roleObjects as any,
        permissions,
        accessScope: user.accessScope,
        isSuperAdmin: user.isSuperAdmin,
      },
      tenant: subscriptionData,
    };
  }

  async refreshToken(
    rawRefreshToken: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const tokenDoc = await RefreshToken.findOne({ tokenHash }).exec();

    if (!tokenDoc) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (tokenDoc.revokedAt) {
      // Possible token reuse attack! Revoke all tokens for this user
      await RefreshToken.updateMany({ userId: tokenDoc.userId }, { revokedAt: new Date() });
      throw new UnauthorizedError('Revoked refresh token presented. Security alert: session terminated.');
    }

    if (tokenDoc.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token expired. Please log in again.');
    }

    const user = await User.findById(tokenDoc.userId).populate<{ roles: IRole[] }>('roles').exec();
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError('User account not found or inactive');
    }

    // Revoke current token and generate replacement (Token Rotation)
    const roles = user.roles || [];
    const roleSlugs = roles.map((r) => r.slug);
    const permissions = user.isSuperAdmin
      ? ['*']
      : this.computePermissions(roles, user.directPermissions);

    const tokenPayload: TokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      tenantId: user.tenantId ? user.tenantId.toString() : null,
      roles: roleSlugs,
      permissions,
      isSuperAdmin: user.isSuperAdmin,
    };

    const { accessToken, rawRefreshToken: newRawRefreshToken } = this.generateTokens(tokenPayload);

    tokenDoc.revokedAt = new Date();
    tokenDoc.replacedByToken = this.hashToken(newRawRefreshToken);
    await tokenDoc.save();

    await RefreshToken.create({
      userId: user._id,
      tenantId: user.tenantId,
      tokenHash: this.hashToken(newRawRefreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
    };
  }

  async logout(rawRefreshToken?: string, userId?: string): Promise<void> {
    if (rawRefreshToken) {
      const tokenHash = this.hashToken(rawRefreshToken);
      await RefreshToken.findOneAndUpdate({ tokenHash }, { revokedAt: new Date() });
    } else if (userId) {
      await RefreshToken.updateMany({ userId: new Types.ObjectId(userId) }, { revokedAt: new Date() });
    }
  }

  async forgotPassword(
    email: string,
    tenantSlug?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ message: string; resetToken?: string; resetUrl?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    let targetTenantId: Types.ObjectId | null = null;

    if (tenantSlug && tenantSlug.trim()) {
      const tenant = await tenantRepository.findBySlug(tenantSlug.trim().toLowerCase());
      if (tenant) {
        targetTenantId = tenant._id;
      }
    }

    let user = targetTenantId ? await userRepository.findByEmail(cleanEmail, targetTenantId) : null;
    if (!user) {
      user = await User.findOne({ email: cleanEmail }).exec();
    }

    const genericMessage = 'If an account exists for this email, a password reset link has been sent.';

    if (!user || user.status !== UserStatus.ACTIVE) {
      // Security: Return generic message without revealing if email exists
      return { message: genericMessage };
    }

    // Generate secure single-use token (32 random bytes)
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawResetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiration

    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpiresAt = expiresAt;
    await user.save();

    await auditRepository.create({
      tenantId: user.tenantId,
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      action: AuditAction.PASSWORD_RESET,
      entity: AuditEntity.AUTH,
      entityId: user._id.toString(),
      details: `Password reset link requested for ${user.email}`,
      ipAddress,
      userAgent,
    });

    const resetUrl = `${env.CLIENT_URL}/reset-password?token=${rawResetToken}`;

    // Dispatch transactional email via emailService
    const { emailService } = await import('./email.service');
    await emailService.sendPasswordReset(user.email, resetUrl);

    return {
      message: genericMessage,
      resetToken: rawResetToken,
      resetUrl,
    };
  }

  async resetPassword(
    token: string,
    newPassword: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ message: string }> {
    if (!token || !token.trim()) {
      throw new BadRequestError('This password reset link is invalid.');
    }

    const tokenHash = this.hashToken(token.trim());
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
    }).select('+passwordResetTokenHash +passwordResetExpiresAt').exec();

    if (!user) {
      throw new BadRequestError('This password reset link is invalid or has already been used.');
    }

    if (!user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      user.passwordResetTokenHash = undefined;
      user.passwordResetExpiresAt = undefined;
      await user.save();
      throw new BadRequestError('This password reset link has expired. Please request a new one.');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    user.passwordHash = newPasswordHash;
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();

    // Revoke all existing sessions for this user across devices
    await RefreshToken.updateMany({ userId: user._id }, { revokedAt: new Date() });

    await auditRepository.create({
      tenantId: user.tenantId,
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      action: AuditAction.PASSWORD_RESET,
      entity: AuditEntity.AUTH,
      entityId: user._id.toString(),
      details: `Password reset completed successfully for ${user.email}`,
      ipAddress,
      userAgent,
    });

    return { message: 'Password reset successfully. Please sign in with your new password.' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ message: string }> {
    const user = await User.findById(userId).select('+passwordHash').exec();
    if (!user) {
      throw new UnauthorizedError('User session expired. Please sign in again.');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestError('Current password does not match.');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    user.passwordHash = newPasswordHash;
    await user.save();

    await auditRepository.create({
      tenantId: user.tenantId,
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      action: AuditAction.PASSWORD_CHANGE,
      entity: AuditEntity.AUTH,
      entityId: user._id.toString(),
      details: `Password successfully changed by user ${user.email}`,
      ipAddress,
      userAgent,
    });

    return { message: 'Password changed successfully.' };
  }

  async registerTenant(input: {
    tenantName: string;
    tenantSlug: string;
    organizationType?: string;
    country?: string;
    businessAddress?: string;
    plan?: TenantPlan;
    adminName: string;
    adminEmail: string;
    adminPassword: string;
    phone?: string;
    termsAccepted?: boolean;
  }): Promise<LoginResult> {
    const cleanSlug = input.tenantSlug.toLowerCase().trim();
    const cleanAdminEmail = input.adminEmail.toLowerCase().trim();

    const existingTenant = await tenantRepository.findBySlug(cleanSlug);
    if (existingTenant) {
      throw new ConflictError(`An organization with identifier '${cleanSlug}' already exists`);
    }

    // Uniqueness validation for admin email
    const existingUser = await User.findOne({ email: cleanAdminEmail }).exec();
    if (existingUser) {
      throw new ConflictError('An account with this email address already exists. Please sign in or use password recovery.');
    }

    // Normalize phone number to E.164 if valid
    let normalizedPhone = input.phone?.trim() || '';
    if (normalizedPhone) {
      try {
        const parsed = parsePhoneNumberFromString(normalizedPhone);
        if (parsed && parsed.isValid()) {
          normalizedPhone = parsed.number; // normalized international format E.164
        }
      } catch {
        // preserve trimmed value
      }
    }

    const plan = input.plan || TenantPlan.FREE;
    const now = new Date();

    // 1. Create Tenant
    const tenant = await tenantRepository.create({
      name: input.tenantName.trim(),
      slug: cleanSlug,
      status: TenantStatus.ACTIVE,
      plan,
      contactEmail: cleanAdminEmail,
      phone: normalizedPhone,
      organizationType: input.organizationType || 'Other',
      country: input.country || '',
      termsAcceptedAt: now,
      address: {
        street: input.businessAddress || '',
        country: input.country || '',
      },
      settings: {
        currency: 'USD',
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
        fiscalYearStartMonth: 1,
      },
    });

    try {
      // 2. Setup Subscription & Entitlements
      const planDefaults = DEFAULT_PLAN_ENTITLEMENTS[plan] || DEFAULT_PLAN_ENTITLEMENTS[TenantPlan.FREE];
      await TenantSubscription.create({
        tenantId: tenant._id,
        planId: plan,
        status: 'ACTIVE',
        features: new Map(Object.entries(planDefaults.features)),
        quotas: new Map(Object.entries(planDefaults.quotas)),
        billingCycle: 'MONTHLY',
      });

      // 3. Find Tenant Admin Role
      let tenantAdminRole = await roleRepository.findBySlug(SYSTEM_ROLE_SLUGS.TENANT_ADMIN);
      if (!tenantAdminRole) {
        tenantAdminRole = await Role.create({
          name: 'Tenant Admin',
          slug: SYSTEM_ROLE_SLUGS.TENANT_ADMIN,
          description: 'Full administrative access to the tenant organization',
          permissions: ['*'],
          isSystemRole: true,
        });
      }

      // 4. Hash Admin Password & Create Tenant Admin User
      const passwordHash = await bcrypt.hash(input.adminPassword, 12);
      const adminUser = await userRepository.create({
        tenantId: tenant._id,
        name: input.adminName.trim(),
        email: cleanAdminEmail,
        passwordHash,
        phone: normalizedPhone,
        status: UserStatus.ACTIVE,
        roles: [tenantAdminRole._id],
        directPermissions: [],
        termsAcceptedAt: now,
        accessScope: {
          warehouses: [],
          department: 'Executive Administration',
        },
        isSuperAdmin: false,
      });

      // 5. Create Audit Log
      await auditRepository.create({
        tenantId: tenant._id,
        userId: adminUser._id,
        userName: adminUser.name,
        userEmail: adminUser.email,
        action: AuditAction.CREATE,
        entity: AuditEntity.TENANT,
        entityId: tenant._id.toString(),
        details: `New organization registered: ${tenant.name} (${tenant.slug}) on ${plan} plan with admin ${adminUser.email}`,
      });

      // 6. Automatically provision clean starter Master Data (Categories, UOMs, Main Warehouse, Reasons)
      const { masterDataService } = await import('./masterData.service');
      await masterDataService.initializeStarterData(tenant._id, adminUser._id);

      // 7. Login newly created admin and return complete authenticated session
      return this.login(adminUser.email, input.adminPassword, tenant.slug);
    } catch (err) {
      // Clean up orphaned records if any downstream step fails
      await Tenant.findByIdAndDelete(tenant._id).exec();
      await TenantSubscription.deleteMany({ tenantId: tenant._id }).exec();
      throw err;
    }
  }
}

export const authService = new AuthService();
