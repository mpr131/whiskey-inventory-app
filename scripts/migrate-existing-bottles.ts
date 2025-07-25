#!/usr/bin/env tsx

// FIRST: Load environment variables
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Add debugging
console.log('Current directory:', process.cwd());
console.log('MONGODB_URI from env:', process.env.MONGODB_URI);

// THEN: Import everything else
import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb';
import MasterBottle from '../models/MasterBottle';
import UserBottle from '../models/UserBottle';

const DRY_RUN = process.argv.includes('--dry-run');

interface MigrationStats {
  totalBottles: number;
  fwgsBottles: number;
  customBottles: number;
  duplicatesFound: number;
  userBottlesUpdated: number;
  errors: number;
}

async function migrateExistingBottles() {
  console.log('🔄 Starting Existing Bottle Migration');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('=====================================\n');
  
  await dbConnect();
  
  const stats: MigrationStats = {
    totalBottles: 0,
    fwgsBottles: 0,
    customBottles: 0,
    duplicatesFound: 0,
    userBottlesUpdated: 0,
    errors: 0
  };
  
  try {
    // Step 1: Update existing bottles without external data source
    console.log('Step 1: Marking existing bottles as manual/user created...');
    const bottlesWithoutSource = await MasterBottle.find({
      $or: [
        { 'externalData.source': { $exists: false } },
        { 'externalData.source': null }
      ]
    });
    
    for (const bottle of bottlesWithoutSource) {
      try {
        const updates: any = {
          externalData: {
            ...bottle.externalData,
            source: bottle.createdBy ? 'user' : 'manual'
          }
        };
        
        // Clean up proof fields if they have % signs or are strings
        if (bottle.statedProof !== undefined && bottle.statedProof !== null) {
          const stringValue = bottle.statedProof.toString();
          if (stringValue.includes('%') || typeof bottle.statedProof === 'string') {
            const cleanValue = stringValue.replace('%', '').trim();
            const numValue = parseFloat(cleanValue);
            if (!isNaN(numValue)) {
              updates.statedProof = numValue;
              console.log(`  Fixed statedProof for ${bottle.name}: "${bottle.statedProof}" → ${numValue}`);
            }
          }
        }
        
        if (bottle.proof !== undefined && bottle.proof !== null) {
          const stringValue = bottle.proof.toString();
          if (stringValue.includes('%') || typeof bottle.proof === 'string') {
            const cleanValue = stringValue.replace('%', '').trim();
            const numValue = parseFloat(cleanValue);
            if (!isNaN(numValue)) {
              updates.proof = numValue;
              console.log(`  Fixed proof for ${bottle.name}: "${bottle.proof}" → ${numValue}`);
            }
          }
        }
        
        if (bottle.abv !== undefined && bottle.abv !== null) {
          const stringValue = bottle.abv.toString();
          if (stringValue.includes('%') || typeof bottle.abv === 'string') {
            const cleanValue = stringValue.replace('%', '').trim();
            const numValue = parseFloat(cleanValue);
            if (!isNaN(numValue)) {
              updates.abv = numValue;
              console.log(`  Fixed abv for ${bottle.name}: "${bottle.abv}" → ${numValue}`);
            }
          }
        }
        
        if (!DRY_RUN) {
          // Use updateOne to avoid validation issues
          await MasterBottle.updateOne(
            { _id: bottle._id },
            { $set: updates }
          );
        }
        stats.customBottles++;
      } catch (error) {
        console.error(`  ❌ Error processing bottle "${bottle.name}":`, error);
        stats.errors++;
      }
    }
    
    console.log(`  ✓ Marked ${stats.customBottles} bottles as manual/user created\n`);
    
    // Step 2: Find duplicates between FWGS and custom bottles
    console.log('Step 2: Finding duplicates between FWGS and custom bottles...');
    
    const fwgsBottles = await MasterBottle.find({ 'externalData.source': 'fwgs' });
    stats.fwgsBottles = fwgsBottles.length;
    
    const customBottles = await MasterBottle.find({ 
      'externalData.source': { $in: ['manual', 'user'] },
      active: { $ne: false }
    });
    
    for (const customBottle of customBottles) {
      try {
        // Clean up data before processing - use updateOne if needed
        const proofUpdates: any = {};
        let needsProofUpdate = false;
        
        if (customBottle.statedProof !== undefined && customBottle.statedProof !== null) {
          const stringValue = customBottle.statedProof.toString();
          if (stringValue.includes('%') || typeof customBottle.statedProof === 'string') {
            const numValue = parseFloat(stringValue.replace('%', '').trim());
            if (!isNaN(numValue)) {
              proofUpdates.statedProof = numValue;
              customBottle.statedProof = numValue; // Update local object for comparison
              needsProofUpdate = true;
            }
          }
        }
        
        if (customBottle.proof !== undefined && customBottle.proof !== null) {
          const stringValue = customBottle.proof.toString();
          if (stringValue.includes('%') || typeof customBottle.proof === 'string') {
            const numValue = parseFloat(stringValue.replace('%', '').trim());
            if (!isNaN(numValue)) {
              proofUpdates.proof = numValue;
              customBottle.proof = numValue; // Update local object for comparison
              needsProofUpdate = true;
            }
          }
        }
        
        if (needsProofUpdate && !DRY_RUN) {
          await MasterBottle.updateOne(
            { _id: customBottle._id },
            { $set: proofUpdates }
          );
        }
        
        // Find potential FWGS match
        const fwgsMatch = await findFWGSMatch(customBottle, fwgsBottles);
        
        if (fwgsMatch) {
          console.log(`  🔗 Found duplicate: "${customBottle.name}" → "${fwgsMatch.name}"`);
          stats.duplicatesFound++;
          
          if (!DRY_RUN) {
            // Update all user bottles to point to FWGS master
            const updateResult = await UserBottle.updateMany(
              { masterBottleId: customBottle._id },
              { masterBottleId: fwgsMatch._id }
            );
            
            stats.userBottlesUpdated += updateResult.modifiedCount;
            
            // Mark custom bottle as duplicate
            customBottle.duplicateOf = fwgsMatch._id;
            customBottle.active = false;
            await customBottle.save();
            
            console.log(`     Updated ${updateResult.modifiedCount} user bottles`);
          }
        }
      } catch (error) {
        console.error(`  ❌ Error processing duplicate check for "${customBottle.name}":`, error);
        stats.errors++;
      }
    }
    
    // Step 3: Report on special bottles that should remain custom
    console.log('\nStep 3: Identifying special bottles to keep as custom...');
    
    const specialBottles = await MasterBottle.find({
      'externalData.source': { $in: ['manual', 'user'] },
      active: { $ne: false },
      $or: [
        { isStorePick: true },
        { 'storePickDetails.store': { $exists: true } },
        { name: { $regex: /limited|special|private|exclusive|single barrel|store pick/i } }
      ]
    });
    
    console.log(`  📦 Found ${specialBottles.length} special bottles to keep:`);
    specialBottles.slice(0, 10).forEach(bottle => {
      console.log(`     - ${bottle.name}${bottle.isStorePick ? ' (Store Pick)' : ''}`);
    });
    if (specialBottles.length > 10) {
      console.log(`     ... and ${specialBottles.length - 10} more`);
    }
    
    // Final report
    showFinalReport(stats);
    
  } catch (error) {
    console.error('Fatal error during migration:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

async function findFWGSMatch(customBottle: any, fwgsBottles: any[]): Promise<any> {
  // First check UPC match
  if (customBottle.upcCodes && customBottle.upcCodes.length > 0) {
    const upcCodes = customBottle.upcCodes.map((u: any) => u.code);
    const upcMatch = fwgsBottles.find(fwgs => 
      fwgs.upcCodes?.some((u: any) => upcCodes.includes(u.code))
    );
    if (upcMatch) return upcMatch;
  }
  
  // Check name and proof match
  const normalizedName = customBottle.name.toLowerCase().replace(/[^\w\s]/g, '');
  const firstWord = normalizedName.split(' ')[0];
  
  const matches = fwgsBottles.filter(fwgs => {
    const fwgsNormalized = fwgs.name.toLowerCase().replace(/[^\w\s]/g, '');
    
    // Must start with same word
    if (!fwgsNormalized.startsWith(firstWord)) return false;
    
    // Check proof if available
    if (customBottle.proof && fwgs.proof) {
      const proofDiff = Math.abs(customBottle.proof - fwgs.proof);
      if (proofDiff > 2) return false;
    }
    
    // Calculate similarity
    const similarity = calculateSimilarity(normalizedName, fwgsNormalized);
    return similarity > 0.85;
  });
  
  // Return best match
  return matches.length > 0 ? matches[0] : null;
}

function calculateSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const maxLen = Math.max(len1, len2);
  
  if (maxLen === 0) return 1;
  
  // Simple character-based similarity
  let matches = 0;
  const minLen = Math.min(len1, len2);
  
  for (let i = 0; i < minLen; i++) {
    if (str1[i] === str2[i]) matches++;
  }
  
  return matches / maxLen;
}

function showFinalReport(stats: MigrationStats) {
  console.log('\n\n=====================================');
  console.log('📊 MIGRATION COMPLETE');
  console.log('=====================================');
  console.log(`Total bottles processed: ${stats.customBottles}`);
  console.log(`FWGS bottles in database: ${stats.fwgsBottles}`);
  console.log(`Duplicates found and merged: ${stats.duplicatesFound}`);
  console.log(`User bottles updated: ${stats.userBottlesUpdated}`);
  console.log(`Errors: ${stats.errors}`);
  
  if (DRY_RUN) {
    console.log('\n⚠️  This was a DRY RUN - no changes were made');
    console.log('Run without --dry-run to apply changes');
  } else {
    console.log('\n✅ Migration completed successfully!');
  }
}

// Run the migration
migrateExistingBottles().catch(console.error);