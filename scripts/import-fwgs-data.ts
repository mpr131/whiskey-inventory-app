#!/usr/bin/env tsx

// FIRST: Load environment variables
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Add debugging
console.log('Current directory:', process.cwd());
console.log('MONGODB_URI from env:', process.env.MONGODB_URI);

// THEN: Import everything else
import { Db } from 'mongodb';
import dbConnect from '../lib/mongodb';
import { connectToExternalDB } from '../lib/external-db';
import MasterBottle from '../models/MasterBottle';
import { 
  createMasterFromFWGS, 
  mergeFWGSData, 
  findPotentialMatches,
  ImportStats,
  PotentialMatch
} from '../lib/fwgs-import-helpers';

// Configuration
const BATCH_SIZE = 100;
const MERGE_CONFIDENCE_THRESHOLD = 85;
const DRY_RUN = process.argv.includes('--dry-run');

async function importFWGSData() {
  console.log('🚀 Starting FWGS Data Import');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('================================\n');
  
  await dbConnect();
  const externalDb = await connectToExternalDB();
  
  // Debug: Check existing master bottles
  const existingMasterCount = await MasterBottle.countDocuments({});
  const existingFWGSCount = await MasterBottle.countDocuments({ 'externalData.source': 'fwgs' });
  console.log(`\nExisting master bottles: ${existingMasterCount}`);
  console.log(`Already imported from FWGS: ${existingFWGSCount}\n`);
  
  // Initialize statistics
  const stats: ImportStats = {
    totalFWGSProducts: 0,
    alreadyImported: 0,
    newImports: 0,
    merged: 0,
    failed: 0,
    startTime: new Date(),
    errors: []
  };
  
  try {
    // Debug: Check database and collections
    console.log('Connected to database:', externalDb.databaseName);
    const collections = await externalDb.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));
    
    // Get total count from ALL_PRODUCTS collection
    const totalCount = await externalDb.collection('all_products').countDocuments({});
    stats.totalFWGSProducts = totalCount;
    console.log(`Found ${totalCount} products in FWGS all_products collection\n`);
    
    // Debug: Get sample of products
    const sampleProducts = await externalDb.collection('all_products').find({}).limit(5).toArray();
    console.log(`Sample of products:`, sampleProducts.map(p => p.displayName || p.name).slice(0, 3));
    console.log(`Sample product structure:`, JSON.stringify(sampleProducts[0], null, 2).slice(0, 500));
    
    // Process in batches
    let processed = 0;
    let batch = 0;
    
    while (processed < totalCount) {
      batch++;
      console.log(`\nProcessing batch ${batch} (${processed + 1}-${Math.min(processed + BATCH_SIZE, totalCount)} of ${totalCount})`);
      
      const products = await externalDb
        .collection('all_products')
        .find({})
        .skip(processed)
        .limit(BATCH_SIZE)
        .toArray();
      
      for (const fwgs of products) {
        try {
          await processProduct(fwgs, externalDb, stats, DRY_RUN);
        } catch (error) {
          console.error(`Error processing ${fwgs.displayName}:`, error);
          stats.failed++;
          stats.errors.push({
            fwgsId: fwgs.repositoryId,
            name: fwgs.displayName,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      processed += products.length;
      
      // Show progress
      if (processed % 1000 === 0) {
        showProgress(stats, processed, totalCount);
      }
    }
    
    stats.endTime = new Date();
    showFinalReport(stats);
    
  } catch (error) {
    console.error('Fatal error during import:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

async function processProduct(
  fwgs: any, 
  externalDb: Db, 
  stats: ImportStats,
  dryRun: boolean
): Promise<void> {
  // Debug: Check what ID we're looking for
  if (stats.alreadyImported + stats.newImports + stats.merged < 3) {
    console.log(`\nChecking if already imported:`);
    console.log(`  FWGS repositoryId: ${fwgs.repositoryId}`);
    console.log(`  FWGS displayName: ${fwgs.displayName}`);
  }
  
  // Check if already imported
  const existing = await MasterBottle.findOne({
    'externalData.fwgsId': fwgs.repositoryId
  });
  
  if (existing) {
    stats.alreadyImported++;
    // Debug: Show why it's skipping
    if (stats.alreadyImported <= 5) {
      console.log(`ERROR: Found existing with fwgsId ${fwgs.repositoryId}:`);
      console.log(`  Existing name: ${existing.name}`);
      console.log(`  Existing externalData:`, existing.externalData);
      console.log(`  This should not happen if you haven't imported yet!`);
    }
    return;
  }
  
  // Debug first few products
  if (stats.newImports + stats.merged < 5) {
    console.log(`\nProcessing: ${fwgs.displayName || 'Unknown'} (ID: ${fwgs.repositoryId})`);
  }
  
  // Find potential matches
  const matches: PotentialMatch[] = await findPotentialMatches(fwgs, externalDb);
  
  if (matches.length > 0 && matches[0].confidence >= MERGE_CONFIDENCE_THRESHOLD) {
    // High confidence match - merge
    const topMatch = matches[0];
    console.log(`  📎 Merging: ${fwgs.displayName} → ${topMatch.bottle.name} (${topMatch.confidence}% match)`);
    
    if (!dryRun) {
      const bottleId = (topMatch.bottle as any)._id;
      await mergeFWGSData(bottleId.toString(), fwgs);
    }
    stats.merged++;
  } else {
    // No good match - create new
    console.log(`  ✨ Creating: ${fwgs.displayName}`);
    
    if (!dryRun) {
      const created = await createMasterFromFWGS(fwgs);
      if (created) {
        stats.newImports++;
      } else {
        console.log(`  ⚠️  Failed to create: ${fwgs.displayName} - likely validation error`);
        stats.failed++;
      }
    } else {
      stats.newImports++;
    }
  }
}

function showProgress(stats: ImportStats, processed: number, total: number) {
  const percent = Math.round((processed / total) * 100);
  const elapsed = (Date.now() - stats.startTime.getTime()) / 1000;
  const rate = processed / elapsed;
  const eta = (total - processed) / rate;
  
  console.log(`\n📊 Progress: ${percent}% (${processed}/${total})`);
  console.log(`   Already imported: ${stats.alreadyImported}`);
  console.log(`   New imports: ${stats.newImports}`);
  console.log(`   Merged: ${stats.merged}`);
  console.log(`   Failed: ${stats.failed}`);
  console.log(`   Rate: ${rate.toFixed(1)} products/sec`);
  console.log(`   ETA: ${formatTime(eta)}`);
}

function showFinalReport(stats: ImportStats) {
  const duration = stats.endTime ? (stats.endTime.getTime() - stats.startTime.getTime()) / 1000 : 0;
  
  console.log('\n\n========================================');
  console.log('📈 IMPORT COMPLETE');
  console.log('========================================');
  console.log(`Total FWGS products: ${stats.totalFWGSProducts}`);
  console.log(`Already imported: ${stats.alreadyImported}`);
  console.log(`New imports: ${stats.newImports}`);
  console.log(`Merged with existing: ${stats.merged}`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Duration: ${formatTime(duration)}`);
  
  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    stats.errors.slice(0, 10).forEach(err => {
      console.log(`  - ${err.name}: ${err.error}`);
    });
    if (stats.errors.length > 10) {
      console.log(`  ... and ${stats.errors.length - 10} more errors`);
    }
  }
  
  console.log('\n✅ Import completed successfully!');
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// Run the import
importFWGSData().catch(console.error);