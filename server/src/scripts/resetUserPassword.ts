/**
 * resetUserPassword.ts
 * Utility script to directly reset a user's password in the database.
 * Usage: npx ts-node -e "require('./src/scripts/resetUserPassword')"
 *   OR: npx tsx src/scripts/resetUserPassword.ts
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/user.model';

// ─── CONFIGURE THESE ────────────────────────────────────────────────────────
const TARGET_EMAIL = 'ajaysuman51603@gmail.com';
const NEW_PASSWORD = 'Ajju@1234';
// ────────────────────────────────────────────────────────────────────────────

async function resetPassword() {
  try {
    await mongoose.connect('mongodb://localhost:27017/stockpilot');
    console.log('✅ Connected to MongoDB');

    const user = await User.findOne({ email: TARGET_EMAIL.toLowerCase().trim() })
      .select('+passwordHash')
      .exec();

    if (!user) {
      console.error(`❌ No user found with email: ${TARGET_EMAIL}`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.name} (${user.email}), status: ${user.status}, tenantId: ${user.tenantId}`);

    // Hash the new password
    const newPasswordHash = await bcrypt.hash(NEW_PASSWORD, 12);
    user.passwordHash = newPasswordHash;
    await user.save();

    console.log(`✅ Password successfully reset for ${user.email}`);
    console.log(`   New password: ${NEW_PASSWORD}`);

    // Verify it works
    const verifyOk = await bcrypt.compare(NEW_PASSWORD, user.passwordHash);
    console.log(`✅ Password verification: ${verifyOk ? 'PASS' : 'FAIL'}`);

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

resetPassword();
