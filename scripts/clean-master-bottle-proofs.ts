import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb';
import MasterBottle from '../models/MasterBottle';

async function cleanMasterBottleProofs() {
  try {
    await dbConnect();
    console.log('Connected to MongoDB');

    // Find all master bottles with string proof values
    const problematicBottles = await MasterBottle.find({
      $or: [
        { proof: { $type: 'string' } },
        { statedProof: { $type: 'string' } },
        { abv: { $type: 'string' } }
      ]
    });

    console.log(`Found ${problematicBottles.length} master bottles with proof issues`);

    let fixed = 0;
    let failed = 0;

    for (const bottle of problematicBottles) {
      try {
        let updated = false;
        const update: any = {};

        console.log(`\nChecking bottle: ${bottle.name}`);
        console.log(`  - proof: ${bottle.proof} (type: ${typeof bottle.proof})`);
        console.log(`  - statedProof: ${bottle.statedProof} (type: ${typeof bottle.statedProof})`);
        console.log(`  - abv: ${(bottle as any).abv} (type: ${typeof (bottle as any).abv})`);

        // Clean proof
        if (bottle.proof !== undefined && typeof bottle.proof === 'string') {
          const cleaned = cleanProofValue(bottle.proof);
          console.log(`  - Cleaning proof: '${bottle.proof}' -> ${cleaned}`);
          update.proof = cleaned;
          updated = true;
        }

        // Clean statedProof
        if (bottle.statedProof !== undefined && typeof bottle.statedProof === 'string') {
          const cleaned = cleanProofValue(bottle.statedProof);
          console.log(`  - Cleaning statedProof: '${bottle.statedProof}' -> ${cleaned}`);
          update.statedProof = cleaned;
          updated = true;
        }

        // Clean abv if it exists
        if ((bottle as any).abv !== undefined && typeof (bottle as any).abv === 'string') {
          const cleaned = cleanProofValue((bottle as any).abv);
          console.log(`  - Cleaning abv: '${(bottle as any).abv}' -> ${cleaned}`);
          update.abv = cleaned;
          updated = true;
        }

        if (updated) {
          await MasterBottle.findByIdAndUpdate(
            bottle._id,
            { $set: update },
            { runValidators: true }
          );
          console.log(`Fixed: ${bottle.name} - Updated values:`, update);
          fixed++;
        }
      } catch (error) {
        console.error(`Failed to fix bottle ${bottle.name}:`, error);
        failed++;
      }
    }

    console.log(`\nMigration complete:`);
    console.log(`- Fixed: ${fixed} bottles`);
    console.log(`- Failed: ${failed} bottles`);
    console.log(`- Total processed: ${problematicBottles.length} bottles`);

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

function cleanProofValue(value: any): number | null {
  if (!value) return null;
  if (value === 'N/A' || value === 'n/a') return null;
  
  // Convert to string and clean
  const strValue = value.toString();
  const cleaned = strValue.replace('%', '').trim();
  const parsed = parseFloat(cleaned);
  
  // Validate the parsed value
  if (isNaN(parsed) || parsed < 0 || parsed > 200) {
    return null;
  }
  
  return parsed;
}

// Run the migration
cleanMasterBottleProofs();