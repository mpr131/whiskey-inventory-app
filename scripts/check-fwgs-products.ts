#!/usr/bin/env tsx

import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

import dbConnect from '@/lib/mongodb';
import MasterBottle from '@/models/MasterBottle';

async function checkFWGSProducts() {
  await dbConnect();
  
  console.log('Checking FWGS products for Blanton\'s...\n');
  
  // Search for any Blanton's products
  const blantonProducts = await MasterBottle.find({
    'externalData.source': 'fwgs',
    name: { $regex: 'blanton', $options: 'i' }
  }).select('name brand producer category subcategory');
  
  console.log(`Found ${blantonProducts.length} Blanton's products:`);
  blantonProducts.forEach(p => {
    console.log(`- ${p.name} (${p.brand || p.producer})`);
  });
  
  // Also check for common misspellings
  console.log('\nChecking for variations...');
  const variations = ['blanton', 'blantons', 'blanten', 'blanten\'s'];
  
  for (const variant of variations) {
    const count = await MasterBottle.countDocuments({
      'externalData.source': 'fwgs',
      name: { $regex: variant, $options: 'i' }
    });
    console.log(`"${variant}": ${count} products`);
  }
  
  // Check total FWGS products
  const totalFWGS = await MasterBottle.countDocuments({
    'externalData.source': 'fwgs'
  });
  console.log(`\nTotal FWGS products: ${totalFWGS}`);
  
  // Sample some products to see what's there
  console.log('\nSample of FWGS products:');
  const sample = await MasterBottle.find({
    'externalData.source': 'fwgs'
  }).limit(10).select('name brand');
  
  sample.forEach(p => {
    console.log(`- ${p.name} (${p.brand || 'No brand'})`);
  });
  
  process.exit(0);
}

checkFWGSProducts().catch(console.error);