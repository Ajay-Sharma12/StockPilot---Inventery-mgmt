import mongoose from 'mongoose';
import { User } from '../models/user.model';
import { Role } from '../models/role.model';
import { SYSTEM_ROLE_SLUGS } from '../config/constants';
import { PERMISSIONS } from '../config/permissions.config';

async function check() {
  await mongoose.connect('mongodb://localhost:27017/stockpilot');
  const user = await User.findOne({ email: 'production@apexlogistics.com' }).populate('roles');
  console.log('User roles:', (user as any)?.roles?.map((r: any) => ({ name: r.name, slug: r.slug, perms: r.permissions })));
  
  // Also check if prod supervisor has ai.insights and analytics.view
  const prodRole = await Role.findOne({ slug: SYSTEM_ROLE_SLUGS.PRODUCTION_SUPERVISOR });
  console.log('prodRole in DB has ai.insights:', prodRole?.permissions.includes('ai.insights'));
  console.log('prodRole in DB has analytics.view:', prodRole?.permissions.includes('analytics.view'));
  console.log('prodRole in DB has production:read:', prodRole?.permissions.includes('production:read'));

  await mongoose.disconnect();
}
check();
