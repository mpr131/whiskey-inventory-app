import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { extractAbvFromName } from '../utils/extractAbv';
import MasterBottle from '../models/MasterBottle';
import UserBottle from '../models/UserBottle';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function migrateAbvData() {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Migrate MasterBottles
    console.log('\n🥃 Starting ABV migration for MasterBottles...');
    const masterBottles = await MasterBottle.find({
      $or: [
        { abv: { $exists: false } },
        { abv: null },
        { statedProof: { $exists: false } }
      ]
    });

    console.log(`Found ${masterBottles.length} MasterBottles to process`);
    
    let masterUpdated = 0;
    let masterFound = 0;

    for (const bottle of masterBottles) {
      const extracted = extractAbvFromName(bottle.name);
      
      if (extracted.abv !== null || extracted.proof !== null) {
        masterFound++;
        
        // Update the bottle
        await MasterBottle.updateOne(
          { _id: bottle._id },
          {
            $set: {
              ...(extracted.abv !== null && !bottle.abv ? { abv: extracted.abv } : {}),
              ...(extracted.proof !== null && !bottle.proof ? { proof: extracted.proof } : {}),
              ...(extracted.statedProof !== null ? { statedProof: extracted.statedProof } : {})
            }
          }
        );
        
        masterUpdated++;
        console.log(`✅ Updated ${bottle.name}: ABV=${extracted.abv}%, Proof=${extracted.proof}, Stated="${extracted.statedProof}"`);
      }
    }

    console.log(`\n📊 MasterBottle Results:`);
    console.log(`   - Total processed: ${masterBottles.length}`);
    console.log(`   - ABV/Proof found: ${masterFound}`);
    console.log(`   - Records updated: ${masterUpdated}`);

    // Migrate UserBottles with actualProof
    console.log('\n🥃 Processing UserBottles with actualProof...');
    const userBottlesWithProof = await UserBottle.find({
      actualProof: { $exists: true, $ne: null },
      actualAbv: { $exists: false }
    });

    console.log(`Found ${userBottlesWithProof.length} UserBottles with actualProof to convert`);
    
    let userUpdated = 0;

    for (const bottle of userBottlesWithProof) {
      if (bottle.actualProof) {
        const abv = bottle.actualProof / 2;
        
        await UserBottle.updateOne(
          { _id: bottle._id },
          { $set: { actualAbv: abv } }
        );
        
        userUpdated++;
        console.log(`✅ Updated UserBottle ${bottle._id}: actualAbv=${abv}% (from proof=${bottle.actualProof})`);
      }
    }

    console.log(`\n📊 UserBottle Results:`);
    console.log(`   - Total processed: ${userBottlesWithProof.length}`);
    console.log(`   - Records updated: ${userUpdated}`);

    // Summary
    console.log('\n✨ Migration Complete!');
    console.log(`   - MasterBottles updated: ${masterUpdated}`);
    console.log(`   - UserBottles updated: ${userUpdated}`);
    console.log(`   - Total records updated: ${masterUpdated + userUpdated}`);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the migration
migrateAbvData();