import mongoose from 'mongoose';
import dotenv from 'dotenv';
import MasterStore from '../models/MasterStore';
import UserStore from '../models/UserStore';
import UserBottle from '../models/UserBottle';

// Load environment variables
dotenv.config({ path: '.env.local' });

interface DuplicateGroup {
  canonicalName: string;
  stores: any[];
}

async function cleanupDuplicateStores() {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all master stores
    const allStores = await MasterStore.find().sort('name');
    console.log(`Found ${allStores.length} total stores`);

    // Group stores by normalized name (case-insensitive)
    const storeGroups = new Map<string, DuplicateGroup>();
    
    for (const store of allStores) {
      const normalizedName = store.name.toLowerCase().trim();
      
      if (!storeGroups.has(normalizedName)) {
        storeGroups.set(normalizedName, {
          canonicalName: store.name, // First occurrence becomes canonical
          stores: []
        });
      }
      
      storeGroups.get(normalizedName)!.stores.push(store);
    }

    // Find groups with duplicates
    const duplicateGroups = Array.from(storeGroups.values()).filter(group => group.stores.length > 1);
    console.log(`\nFound ${duplicateGroups.length} groups with duplicates`);

    let totalMerged = 0;
    let totalDeleted = 0;

    for (const group of duplicateGroups) {
      console.log(`\n🏪 Processing "${group.canonicalName}" (${group.stores.length} variants):`);
      
      // Sort stores by creation date, keep the oldest as canonical
      group.stores.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      const canonical = group.stores[0];
      const duplicates = group.stores.slice(1);
      
      console.log(`  Canonical: "${canonical.name}" (ID: ${canonical._id})`);
      for (const dup of duplicates) {
        console.log(`  Duplicate: "${dup.name}" (ID: ${dup._id})`);
      }

      // Update all UserStores to point to canonical master store
      for (const duplicate of duplicates) {
        // Find all UserStores pointing to this duplicate
        const userStores = await UserStore.find({ masterStoreId: duplicate._id });
        
        for (const userStore of userStores) {
          // Check if user already has a relationship with the canonical store
          const existingCanonical = await UserStore.findOne({
            userId: userStore.userId,
            masterStoreId: canonical._id
          });

          if (existingCanonical) {
            // User already has the canonical store, just delete this duplicate relationship
            await UserStore.deleteOne({ _id: userStore._id });
            console.log(`  ✅ Deleted duplicate UserStore relationship for user ${userStore.userId}`);
          } else {
            // Update to point to canonical store
            await UserStore.updateOne(
              { _id: userStore._id },
              { $set: { masterStoreId: canonical._id } }
            );
            console.log(`  ✅ Updated UserStore ${userStore._id} to use canonical store`);
          }
          totalMerged++;
        }

        // Delete the duplicate MasterStore
        await MasterStore.deleteOne({ _id: duplicate._id });
        totalDeleted++;
        console.log(`  ✅ Deleted duplicate MasterStore "${duplicate.name}"`);
      }
    }

    console.log('\n✨ Cleanup Complete!');
    console.log(`   - Store groups processed: ${duplicateGroups.length}`);
    console.log(`   - UserStore relationships updated: ${totalMerged}`);
    console.log(`   - Duplicate MasterStores deleted: ${totalDeleted}`);

    // Verify cleanup
    const remainingStores = await MasterStore.find().sort('name');
    console.log(`\n📊 Final store count: ${remainingStores.length} (was ${allStores.length})`);

  } catch (error) {
    console.error('Cleanup failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the cleanup
cleanupDuplicateStores();