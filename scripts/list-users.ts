import mongoose from 'mongoose';
import User from '../models/User';
import UserBottle from '../models/UserBottle';
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

async function listUsers() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI as string);
    console.log('✅ Connected to MongoDB\n');

    // Get total count of UserBottles
    const totalUserBottles = await UserBottle.countDocuments();
    console.log(`📊 Total UserBottles in collection: ${totalUserBottles}\n`);

    // Get all users
    const users = await User.find().sort({ createdAt: 1 });
    console.log(`👥 Total Users: ${users.length}`);
    console.log('='.repeat(80));
    console.log('Email'.padEnd(30) + 'Prefix'.padEnd(10) + 'Bottles'.padEnd(10) + 'With Vault'.padEnd(12) + 'Without Vault');
    console.log('='.repeat(80));

    let totalBottlesCounted = 0;
    let totalWithVaultBarcode = 0;
    let totalWithoutVaultBarcode = 0;

    for (const user of users) {
      // Count bottles for this user
      const userBottleCount = await UserBottle.countDocuments({ userId: user._id });
      const withVaultBarcode = await UserBottle.countDocuments({ 
        userId: user._id, 
        vaultBarcode: { $exists: true, $ne: null } 
      });
      const withoutVaultBarcode = await UserBottle.countDocuments({ 
        userId: user._id,
        $or: [
          { vaultBarcode: { $exists: false } },
          { vaultBarcode: null }
        ]
      });

      console.log(
        user.email.padEnd(30) +
        (user.barcodePrefix || '-').padEnd(10) +
        userBottleCount.toString().padEnd(10) +
        withVaultBarcode.toString().padEnd(12) +
        withoutVaultBarcode.toString()
      );

      totalBottlesCounted += userBottleCount;
      totalWithVaultBarcode += withVaultBarcode;
      totalWithoutVaultBarcode += withoutVaultBarcode;
    }

    console.log('='.repeat(80));
    console.log(
      'TOTALS:'.padEnd(30) +
      ''.padEnd(10) +
      totalBottlesCounted.toString().padEnd(10) +
      totalWithVaultBarcode.toString().padEnd(12) +
      totalWithoutVaultBarcode.toString()
    );
    console.log('='.repeat(80));

    // Verify counts match
    if (totalBottlesCounted !== totalUserBottles) {
      console.log('\n⚠️  WARNING: Sum of user bottles does not match total collection count!');
      console.log(`   Sum of user bottles: ${totalBottlesCounted}`);
      console.log(`   Total in collection: ${totalUserBottles}`);
      
      // Check for orphaned bottles
      const userIds = users.map(u => u._id);
      const orphanedBottles = await UserBottle.countDocuments({
        userId: { $nin: userIds }
      });
      
      if (orphanedBottles > 0) {
        console.log(`   Orphaned bottles (no valid user): ${orphanedBottles}`);
      }
    }

    // Additional stats
    console.log('\n📈 Additional Statistics:');
    console.log(`   Users with barcode prefix: ${users.filter(u => u.barcodePrefix).length}`);
    console.log(`   Users without barcode prefix: ${users.filter(u => !u.barcodePrefix).length}`);
    
    // Show last sequence numbers for users with prefixes
    const usersWithPrefix = users.filter(u => u.barcodePrefix);
    if (usersWithPrefix.length > 0) {
      console.log('\n🔢 Last Sequence Numbers:');
      for (const user of usersWithPrefix) {
        console.log(`   ${user.barcodePrefix}: ${user.lastBarcodeSequence || 0}`);
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the script
console.log('📋 User and Bottle Count Report');
console.log('===============================\n');

listUsers()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });