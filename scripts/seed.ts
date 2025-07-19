import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import InviteCode from '../models/InviteCode';
import User from '../models/User';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI is not defined in .env.local');
  console.error('Please create a .env.local file with your MongoDB connection string');
  process.exit(1);
}

async function seedDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI as string);
    console.log('✅ Connected to MongoDB');

    // Create initial invite code
    const inviteCode = await InviteCode.create({
      code: 'ADMIN001',
      createdBy: 'system',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      isActive: true,
    });
    console.log('Created invite code:', inviteCode.code);

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 12);
    const adminUser = await User.create({
      email: 'admin@whiskeyvault.com',
      password: hashedPassword,
      name: 'Admin User',
      isAdmin: true,
      inviteCodeUsed: inviteCode.code,
    });

    // Mark invite code as used
    inviteCode.usedBy = adminUser.email;
    inviteCode.isActive = false;
    await inviteCode.save();

    console.log('✅ Created admin user:', adminUser.email);
    console.log('\n========================================');
    console.log('🎉 Seed completed successfully!');
    console.log('========================================');
    console.log('You can now login with:');
    console.log('📧 Email: admin@whiskeyvault.com');
    console.log('🔑 Password: admin123');
    console.log('========================================\n');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedDatabase();