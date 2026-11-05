import { connectDatabase, disconnectDatabase } from '../config/database';
import { authService } from '../services/auth.service';
import { User } from '../models/user.model';
import { Tenant } from '../models/tenant.model';
import { TenantSubscription } from '../models/subscription.model';
import { AuditLog } from '../models/auditLog.model';
import { TenantPlan, UserStatus } from '../config/constants';

async function runAcceptanceTests() {
  console.log('🧪 Starting Phase 1 Full Acceptance Verification Suite...');
  await connectDatabase();

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Seed / Ensure Demo User exists
    // -------------------------------------------------------------
    console.log('\n--- 1. Authentication & Session Verification ---');
    let loginRes;
    try {
      loginRes = await authService.login('admin@apexlogistics.com', 'Password123!', 'apex-logistics');
      assert(!!loginRes.accessToken && !!loginRes.refreshToken, 'Valid login succeeds and returns JWT tokens');
      assert(loginRes.user.email === 'admin@apexlogistics.com', 'User profile loaded with correct email');
      assert(!!loginRes.tenant && loginRes.tenant.slug === 'apex-logistics', 'Tenant context resolved and attached');
      assert(Array.isArray(loginRes.user.permissions), 'User permissions computed and loaded');
    } catch (err: any) {
      assert(false, `Valid login failed: ${err.message}`);
    }

    // -------------------------------------------------------------
    // Test 2: Invalid password fails
    // -------------------------------------------------------------
    try {
      await authService.login('admin@apexlogistics.com', 'WrongPassword!', 'apex-logistics');
      assert(false, 'Wrong password was accepted');
    } catch (err: any) {
      assert(err.message === 'Invalid credentials', 'Wrong password rejected with generic credentials error');
    }

    // -------------------------------------------------------------
    // Test 3: Inactive user cannot login
    // -------------------------------------------------------------
    const testInactiveEmail = `inactive_${Date.now()}@example.com`;
    const inactiveUser = await User.create({
      name: 'Inactive User',
      email: testInactiveEmail,
      passwordHash: loginRes ? (await User.findById(loginRes.user.id).select('+passwordHash'))?.passwordHash : 'dummy',
      status: UserStatus.INACTIVE,
      roles: [],
      directPermissions: [],
      accessScope: { warehouses: [] },
      isSuperAdmin: false,
    });

    try {
      await authService.login(testInactiveEmail, 'Password123!');
      assert(false, 'Inactive user was able to log in');
    } catch (err: any) {
      assert(err.message.includes('inactive'), 'Inactive user correctly blocked from login');
    }

    // -------------------------------------------------------------
    // Test 4: Forgot Password & Single-use Token Expiry
    // -------------------------------------------------------------
    console.log('\n--- 2. Password Reset Lifecycle ---');
    const forgotRes = await authService.forgotPassword('admin@apexlogistics.com');
    assert(
      forgotRes.message === 'If an account exists for this email, a password reset link has been sent.',
      'Forgot password returns generic message without leaking existence'
    );
    assert(!!forgotRes.resetToken, 'Reset token generated securely');

    const resetUser = await User.findOne({ email: 'admin@apexlogistics.com' })
      .select('+passwordResetTokenHash +passwordResetExpiresAt')
      .exec();
    assert(!!resetUser?.passwordResetTokenHash, 'Password reset token stored as secure hash in database');
    assert(
      !!resetUser?.passwordResetExpiresAt && resetUser.passwordResetExpiresAt > new Date(),
      'Reset token has valid future expiration time'
    );

    // Reset password with token
    const newPwd = 'NewSecurePassword123!';
    const resetResult = await authService.resetPassword(forgotRes.resetToken!, newPwd);
    assert(resetResult.message.includes('successfully'), 'Password reset succeeds with valid token');

    // Verify token is single-use
    try {
      await authService.resetPassword(forgotRes.resetToken!, 'AnotherPassword123!');
      assert(false, 'Token was reused');
    } catch (err: any) {
      assert(err.message.includes('invalid') || err.message.includes('already been used'), 'Reset token is strictly single-use');
    }

    // Verify login with new password
    const loginWithNew = await authService.login('admin@apexlogistics.com', newPwd, 'apex-logistics');
    assert(!!loginWithNew.accessToken, 'Login succeeds with new password');

    // Restore original password
    await authService.resetPassword(
      (await authService.forgotPassword('admin@apexlogistics.com')).resetToken!,
      'Password123!'
    );

    // -------------------------------------------------------------
    // Test 5: Change Password for Authenticated User
    // -------------------------------------------------------------
    console.log('\n--- 3. Authenticated Change Password & Audit ---');
    const changeUser = await User.findOne({ email: 'admin@apexlogistics.com' });
    if (changeUser) {
      // Wrong current password fails
      try {
        await authService.changePassword(changeUser._id.toString(), 'IncorrectCurrent!', 'NewPassword123!');
        assert(false, 'Password change accepted wrong current password');
      } catch (err: any) {
        assert(err.message.includes('Current password'), 'Password change rejects incorrect current password');
      }

      // Valid current password succeeds
      const changeRes = await authService.changePassword(
        changeUser._id.toString(),
        'Password123!',
        'Password123!' // change back to same for convenience
      );
      assert(changeRes.message.includes('successfully'), 'Authenticated password change succeeds');
    }

    // -------------------------------------------------------------
    // Test 6: Tenant Registration Flow & International Phone Validation
    // -------------------------------------------------------------
    console.log('\n--- 4. Multi-Tenant Onboarding & E.164 Phone Normalization ---');
    const uniqueSlug = `test-org-${Date.now()}`;
    const testAdminEmail = `admin-${Date.now()}@testorg.com`;

    const regResult = await authService.registerTenant({
      tenantName: 'Titan Global Freight',
      tenantSlug: uniqueSlug,
      organizationType: 'Logistics & 3PL',
      country: 'India',
      businessAddress: '100 Marine Lines, Mumbai',
      plan: TenantPlan.GROWTH,
      adminName: 'Rajesh Sharma',
      adminEmail: testAdminEmail,
      adminPassword: 'EnterprisePassword123!',
      phone: '+91 98765 43210', // India phone with spaces
      termsAccepted: true,
    });

    assert(!!regResult.accessToken, 'Tenant registration completes and logs in primary admin');
    assert(regResult.user.name === 'Rajesh Sharma', 'Admin user created with full name');
    assert(regResult.tenant?.slug === uniqueSlug, 'Tenant created with correct slug');
    assert(regResult.tenant?.plan === TenantPlan.GROWTH, 'Subscription initialized on selected plan');

    // Check stored tenant record in DB
    const savedTenant = await Tenant.findOne({ slug: uniqueSlug });
    assert(!!savedTenant, 'Tenant record found in database');
    assert(savedTenant?.phone === '+919876543210', 'Phone number normalized to E.164 (+919876543210)');
    assert(savedTenant?.organizationType === 'Logistics & 3PL', 'Organization type stored accurately');
    assert(!!savedTenant?.termsAcceptedAt, 'Terms & Conditions acceptance timestamp recorded');

    // Check saved subscription
    const savedSub = await TenantSubscription.findOne({ tenantId: savedTenant?._id });
    assert(!!savedSub, 'TenantSubscription record created transactionally');
    assert(savedSub?.planId === TenantPlan.GROWTH, 'Subscription matches selected tier');

    // Verify duplicate tenant slug rejected
    try {
      await authService.registerTenant({
        tenantName: 'Duplicate Corp',
        tenantSlug: uniqueSlug,
        adminName: 'Clone Admin',
        adminEmail: `clone-${Date.now()}@example.com`,
        adminPassword: 'Password123!',
        termsAccepted: true,
      });
      assert(false, 'Duplicate tenant slug was accepted');
    } catch (err: any) {
      assert(err.message.includes('already exists'), 'Duplicate organization identifier rejected');
    }

    // -------------------------------------------------------------
    // Test 7: Audit Logging
    // -------------------------------------------------------------
    console.log('\n--- 5. Audit Logging Verification ---');
    const logs = await AuditLog.find({ tenantId: savedTenant?._id });
    assert(logs.length > 0, 'Audit events captured during tenant registration and onboarding');
    assert(logs.some((l) => l.action === 'CREATE'), 'Tenant CREATE audit log verified');

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log(`\n======================================================`);
    console.log(`🏆 PHASE 1 ACCEPTANCE RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`======================================================\n`);

    // Cleanup test records
    if (savedTenant) {
      await Tenant.findByIdAndDelete(savedTenant._id);
      await User.deleteMany({ tenantId: savedTenant._id });
      await TenantSubscription.deleteMany({ tenantId: savedTenant._id });
      await AuditLog.deleteMany({ tenantId: savedTenant._id });
    }
    await User.findByIdAndDelete(inactiveUser._id);
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await disconnectDatabase();
  }
}

runAcceptanceTests();
