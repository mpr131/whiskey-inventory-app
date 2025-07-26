#!/usr/bin/env tsx

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import dbConnect from '../lib/mongodb';
import { connectToExternalDB } from '../lib/external-db';
import MasterBottle from '../models/MasterBottle';

async function main() {
  console.log('🔍 FWGS Import Gap Analysis');
  console.log('================================\n');
  
  await dbConnect();
  const externalDb = await connectToExternalDB();
  
  // 1. Get counts
  const allProductsCount = await externalDb.collection('all_products').countDocuments({});
  const masterBottlesCount = await MasterBottle.countDocuments({});
  const fwgsMasterBottlesCount = await MasterBottle.countDocuments({ 'externalData.source': 'fwgs' });
  
  console.log('📊 Overall Stats:');
  console.log(`Total products in all_products: ${allProductsCount.toLocaleString()}`);
  console.log(`Total products in masterbottles: ${masterBottlesCount.toLocaleString()}`);
  console.log(`FWGS products in masterbottles: ${fwgsMasterBottlesCount.toLocaleString()}`);
  console.log(`Expected gap: ${(allProductsCount - fwgsMasterBottlesCount).toLocaleString()}\n`);
  
  // 2. Check Blanton's specifically
  console.log('🥃 Checking Blanton\'s (000006946):');
  const blantons = await externalDb.collection('all_products').findOne({ repositoryId: '000006946' });
  if (blantons) {
    console.log(`Found in all_products: ${blantons.displayName}`);
    console.log(`Proof value: "${blantons.b2c_proof}"`);
    
    const blantonsImported = await MasterBottle.findOne({ 'externalData.fwgsId': '000006946' });
    console.log(`Imported to masterbottles: ${blantonsImported ? 'YES' : 'NO'}`);
    if (blantonsImported) {
      console.log(`Master bottle ID: ${blantonsImported._id}`);
    }
  } else {
    console.log('NOT found in all_products');
  }
  console.log('');
  
  // 3. Analyze N/A proof products
  console.log('📈 N/A Proof Analysis:');
  const naProofCount = await externalDb.collection('all_products').countDocuments({ 
    b2c_proof: { $in: ['N/A', 'n/a', null, ''] } 
  });
  console.log(`Products with N/A or missing proof: ${naProofCount.toLocaleString()}`);
  
  // Get sample of N/A products to check if they're imported
  const naProofSample = await externalDb.collection('all_products')
    .find({ b2c_proof: { $in: ['N/A', 'n/a'] } })
    .limit(100)
    .toArray();
  
  let naImportedCount = 0;
  for (const product of naProofSample) {
    const imported = await MasterBottle.findOne({ 'externalData.fwgsId': product.repositoryId });
    if (imported) naImportedCount++;
  }
  
  const naImportRate = (naImportedCount / naProofSample.length) * 100;
  console.log(`Sample check: ${naImportedCount}/${naProofSample.length} N/A proof products were imported (${naImportRate.toFixed(1)}%)`);
  console.log(`Estimated N/A products already imported: ${Math.round(naProofCount * naImportRate / 100).toLocaleString()}\n`);
  
  // 4. Find actual missing products
  console.log('🔎 Finding actual missing products...');
  
  // Get all FWGS IDs that have been imported
  const importedFwgsIds = await MasterBottle.distinct('externalData.fwgsId', {
    'externalData.source': 'fwgs'
  });
  console.log(`Unique FWGS IDs imported: ${importedFwgsIds.length.toLocaleString()}`);
  
  // Sample check for missing products
  const sampleSize = 1000;
  const randomProducts = await externalDb.collection('all_products')
    .aggregate([{ $sample: { size: sampleSize } }])
    .toArray();
  
  const missingProducts = [];
  for (const product of randomProducts) {
    if (!importedFwgsIds.includes(product.repositoryId)) {
      missingProducts.push({
        id: product.repositoryId,
        name: product.displayName,
        proof: product.b2c_proof,
        type: product.b2c_type
      });
    }
  }
  
  const missingRate = (missingProducts.length / sampleSize) * 100;
  console.log(`Sample: ${missingProducts.length}/${sampleSize} products are missing (${missingRate.toFixed(1)}%)`);
  console.log(`Estimated total missing: ${Math.round(allProductsCount * missingRate / 100).toLocaleString()}`);
  
  // 5. Show some missing products
  console.log('\n📋 Sample of missing products:');
  missingProducts.slice(0, 10).forEach(p => {
    console.log(`- ${p.id}: ${p.name} (Proof: ${p.proof || 'null'}, Type: ${p.type})`);
  });
  
  // 6. Analyze proof values of missing products
  console.log('\n📊 Proof values of missing products:');
  const proofGroups: Record<string, number> = {};
  missingProducts.forEach(p => {
    const proof = p.proof || 'null';
    proofGroups[proof] = (proofGroups[proof] || 0) + 1;
  });
  
  Object.entries(proofGroups)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([proof, count]) => {
      console.log(`  ${proof}: ${count} products`);
    });
  
  // 7. Double-check by trying a direct count
  console.log('\n🔢 Direct missing count (first 10k products):');
  const first10k = await externalDb.collection('all_products')
    .find({})
    .limit(10000)
    .project({ repositoryId: 1 })
    .toArray();
  
  let directMissing = 0;
  for (const product of first10k) {
    const exists = await MasterBottle.exists({ 'externalData.fwgsId': product.repositoryId });
    if (!exists) directMissing++;
  }
  
  console.log(`Direct check: ${directMissing}/10000 missing (${(directMissing/100).toFixed(1)}%)`);
  console.log(`Extrapolated total missing: ${Math.round(allProductsCount * directMissing / 10000).toLocaleString()}`);
  
  process.exit(0);
}

main().catch(console.error);