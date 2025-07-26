#!/usr/bin/env tsx

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import dbConnect from '../lib/mongodb';
import { connectToExternalDB } from '../lib/external-db';
import MasterBottle from '../models/MasterBottle';

async function main() {
  const productId = process.argv[2];
  
  if (!productId) {
    console.log('Usage: tsx scripts/check-fwgs-product.ts <fwgs-id>');
    console.log('Example: tsx scripts/check-fwgs-product.ts 000006946');
    process.exit(1);
  }
  
  await dbConnect();
  const externalDb = await connectToExternalDB();
  
  console.log(`\n🔍 Checking FWGS Product: ${productId}\n`);
  
  // Check in all_products
  const fwgsProduct = await externalDb.collection('all_products').findOne({ 
    repositoryId: productId 
  });
  
  if (!fwgsProduct) {
    console.log('❌ NOT found in all_products collection');
    process.exit(1);
  }
  
  console.log('✅ Found in all_products:');
  console.log(`   Name: ${fwgsProduct.displayName}`);
  console.log(`   Brand: ${fwgsProduct.brand}`);
  console.log(`   Type: ${fwgsProduct.b2c_type}`);
  console.log(`   Proof: "${fwgsProduct.b2c_proof}"`);
  console.log(`   Size: ${fwgsProduct.b2c_size}`);
  console.log(`   UPC: ${fwgsProduct.b2c_upc}`);
  console.log(`   Price: $${fwgsProduct.listPrice}`);
  console.log('');
  
  // Check in masterbottles
  const masterBottle = await MasterBottle.findOne({ 
    'externalData.fwgsId': productId 
  });
  
  if (masterBottle) {
    console.log('✅ Found in masterbottles:');
    console.log(`   ID: ${masterBottle._id}`);
    console.log(`   Name: ${masterBottle.name}`);
    console.log(`   Brand: ${masterBottle.brand}`);
    console.log(`   Category: ${masterBottle.category}`);
    console.log(`   Proof: ${masterBottle.proof || 'null'}`);
    console.log(`   Import Date: ${masterBottle.externalData?.importDate}`);
  } else {
    console.log('❌ NOT found in masterbottles');
    
    // Try to find by name
    const nameSearch = await MasterBottle.findOne({
      name: new RegExp(fwgsProduct.displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    });
    
    if (nameSearch) {
      console.log('\n⚠️  Found potential match by name:');
      console.log(`   ID: ${nameSearch._id}`);
      console.log(`   Name: ${nameSearch.name}`);
      console.log(`   Source: ${nameSearch.externalData?.source || 'manual'}`);
      console.log(`   FWGS ID: ${nameSearch.externalData?.fwgsId || 'none'}`);
    }
  }
  
  // Check total counts
  console.log('\n📊 Database Stats:');
  const totalAllProducts = await externalDb.collection('all_products').countDocuments({});
  const totalMasterBottles = await MasterBottle.countDocuments({});
  const fwgsMasterBottles = await MasterBottle.countDocuments({ 'externalData.source': 'fwgs' });
  
  console.log(`   Total in all_products: ${totalAllProducts.toLocaleString()}`);
  console.log(`   Total in masterbottles: ${totalMasterBottles.toLocaleString()}`);
  console.log(`   FWGS in masterbottles: ${fwgsMasterBottles.toLocaleString()}`);
  
  process.exit(0);
}

main().catch(console.error);