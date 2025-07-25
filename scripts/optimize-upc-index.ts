#!/usr/bin/env tsx

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import dbConnect from '../lib/mongodb';
import MasterBottle from '../models/MasterBottle';

async function optimizeUPCIndex() {
  console.log('🔧 Optimizing UPC Index for Fast Searches');
  console.log('=========================================\n');
  
  await dbConnect();
  
  try {
    // Drop existing index if it exists
    try {
      await MasterBottle.collection.dropIndex('upcCodes.code_1');
      console.log('Dropped existing UPC index');
    } catch (error) {
      console.log('No existing UPC index to drop');
    }
    
    // Create optimized index for UPC searches
    await MasterBottle.collection.createIndex(
      { 'upcCodes.code': 1 },
      { 
        name: 'upc_code_optimized',
        background: true,
        sparse: true // Only index documents that have UPC codes
      }
    );
    console.log('✅ Created optimized UPC index');
    
    // Get index stats
    const stats = await MasterBottle.collection.indexStats();
    console.log('\nIndex Statistics:');
    const upcIndex = stats.find((idx: any) => idx.name === 'upc_code_optimized');
    if (upcIndex) {
      console.log(`  Size: ${(upcIndex.storageSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Documents indexed: ${upcIndex.ops || 'N/A'}`);
    }
    
    // Count bottles with UPCs
    const totalBottles = await MasterBottle.countDocuments({});
    const bottlesWithUPCs = await MasterBottle.countDocuments({ 'upcCodes.0': { $exists: true } });
    
    console.log('\nUPC Coverage:');
    console.log(`  Total bottles: ${totalBottles.toLocaleString()}`);
    console.log(`  Bottles with UPCs: ${bottlesWithUPCs.toLocaleString()}`);
    console.log(`  Coverage: ${((bottlesWithUPCs / totalBottles) * 100).toFixed(1)}%`);
    
    // Test query performance
    console.log('\nTesting query performance...');
    const testUPC = '088076184923'; // Example UPC
    
    const startTime = Date.now();
    const result = await MasterBottle.findOne({ 'upcCodes.code': testUPC });
    const queryTime = Date.now() - startTime;
    
    console.log(`  Query time: ${queryTime}ms`);
    console.log(`  Result: ${result ? 'Found' : 'Not found'}`);
    
    console.log('\n✅ UPC index optimization complete!');
    
  } catch (error) {
    console.error('Error optimizing index:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the optimization
optimizeUPCIndex().catch(console.error);