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

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

async function backfillVaultBarcodes() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI as string);
    console.log('✅ Connected to MongoDB');
    
    if (isDryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be saved\n');
    }

    // Get all users
    const users = await User.find().sort({ createdAt: 1 });
    console.log(`📊 Found ${users.length} users to process\n`);

    let totalBottlesProcessed = 0;
    let totalBarcodesAssigned = 0;
    let totalBottlesSkipped = 0;
    let nextPrefixNumber = 1;

    // Process each user
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      console.log(`\n👤 Processing user ${i + 1} of ${users.length}: ${user.email}`);

      // Assign barcode prefix if user doesn't have one
      if (!user.barcodePrefix) {
        // Find the next available prefix
        let prefixAssigned = false;
        while (!prefixAssigned) {
          const proposedPrefix = `WV${nextPrefixNumber.toString().padStart(3, '0')}`;
          
          // Check if this prefix is already taken
          const existingUser = await User.findOne({ barcodePrefix: proposedPrefix });
          if (!existingUser) {
            user.barcodePrefix = proposedPrefix;
            console.log(`  📋 Assigning prefix: ${proposedPrefix}`);
            if (!isDryRun) {
              await user.save();
            }
            prefixAssigned = true;
          }
          nextPrefixNumber++;
        }
      } else {
        console.log(`  📋 Using existing prefix: ${user.barcodePrefix}`);
      }

      // Get bottle counts for this user
      const totalUserBottles = await UserBottle.countDocuments({ userId: user._id });
      const bottlesWithVaultBarcode = await UserBottle.countDocuments({
        userId: user._id,
        vaultBarcode: { $exists: true, $ne: null }
      });
      
      // Get all bottles for this user without vaultBarcode
      const bottles = await UserBottle.find({
        userId: user._id,
        vaultBarcode: { $exists: false }
      }).sort({ createdAt: 1 });

      console.log(`  📊 Total bottles: ${totalUserBottles} (${bottlesWithVaultBarcode} already have vault barcodes)`);
      totalBottlesSkipped += bottlesWithVaultBarcode;

      if (bottles.length === 0) {
        console.log(`  ✅ All bottles already have vault barcodes`);
        continue;
      }

      console.log(`  🍾 Processing ${bottles.length} bottles...`);
      
      // Get the current sequence number
      let currentSequence = user.lastBarcodeSequence || 0;
      let bottlesUpdated = 0;

      // Process each bottle
      for (const bottle of bottles) {
        currentSequence++;
        const vaultBarcode = `${user.barcodePrefix}-${currentSequence.toString().padStart(6, '0')}`;
        
        if (!isDryRun) {
          bottle.vaultBarcode = vaultBarcode;
          await bottle.save();
        }
        
        bottlesUpdated++;
        totalBarcodesAssigned++;
        
        // Show progress every 50 bottles
        if (bottlesUpdated % 50 === 0) {
          console.log(`    Progress: ${bottlesUpdated}/${bottles.length} bottles processed`);
        }
      }

      // Update user's lastBarcodeSequence
      if (!isDryRun) {
        user.lastBarcodeSequence = currentSequence;
        await user.save();
      }

      console.log(`  ✅ Assigned vault barcodes to ${bottlesUpdated} bottles`);
      totalBottlesProcessed += bottles.length;
    }

    // Get final total count
    const finalTotalBottles = await UserBottle.countDocuments();
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 BACKFILL COMPLETE');
    console.log('='.repeat(60));
    console.log(`Total bottles in database: ${finalTotalBottles}`);
    console.log(`Bottles that needed vault barcodes: ${totalBottlesProcessed}`);
    console.log(`Bottles that already had vault barcodes: ${totalBottlesSkipped}`);
    console.log(`New vault barcodes assigned: ${totalBarcodesAssigned}`);
    
    if (isDryRun) {
      console.log('\n⚠️  This was a DRY RUN - no changes were saved');
      console.log('Run without --dry-run flag to apply changes');
    }

  } catch (error) {
    console.error('\n❌ Error during backfill:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
  process.exit(1);
});

// Run the backfill
console.log('🚀 Vault Barcode Backfill Script');
console.log('================================\n');

backfillVaultBarcodes()
  .then(() => {
    console.log('\n✅ Backfill completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  });