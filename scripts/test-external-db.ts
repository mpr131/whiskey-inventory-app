#!/usr/bin/env tsx

import { connectToExternalDB } from '../lib/external-db';
import { ExternalProduct } from '../lib/external-product-helpers';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testExternalDB() {
  console.log('Testing external database connection...\n');
  
  try {
    // Test connection
    const db = await connectToExternalDB();
    console.log('✅ Successfully connected to external database');
    
    // Get collection info
    const collection = db.collection<ExternalProduct>('image_price_data');
    const count = await collection.estimatedDocumentCount();
    console.log(`📊 Total products in external database: ${count.toLocaleString()}`);
    
    // Test UPC lookup
    const testUPCs = [
      '086003262225', // Example UPC - replace with actual test UPCs
      '080480015022',
      '812459010014'
    ];
    
    console.log('\n🔍 Testing UPC lookups:');
    for (const upc of testUPCs) {
      const product = await collection.findOne({ 'b2c_upc': upc });
      if (product) {
        console.log(`\n✅ Found UPC ${upc}:`);
        console.log(`   Name: ${product.displayName}`);
        console.log(`   Brand: ${product.brand}`);
        console.log(`   Type: ${product.b2c_type}`);
        console.log(`   Category: ${product.b2c_newMarketingCategory || product.b2c_type}`);
        console.log(`   Size: ${product.b2c_size}`);
        console.log(`   Price: $${product.listPrice}`);
        console.log(`   Proof: ${product.b2c_proof}`);
        if (product.primaryLargeImageURL && product.primaryLargeImageURL !== '/img/no-image.jpg') {
          console.log(`   Image: https://www.finewineandgoodspirits.com${product.primaryLargeImageURL}`);
        }
      } else {
        console.log(`❌ UPC ${upc} not found`);
      }
    }
    
    // Sample some products
    console.log('\n📦 Sample products from database:');
    const samples = await collection
      .find({ b2c_upc: { $exists: true, $ne: '' } })
      .limit(5)
      .toArray();
    
    samples.forEach((product, index) => {
      console.log(`\n${index + 1}. ${product.displayName}`);
      console.log(`   UPC: ${product.b2c_upc}`);
      console.log(`   Brand: ${product.brand}`);
      console.log(`   Type: ${product.b2c_type}`);
    });
    
    // Test query performance
    console.log('\n⚡ Testing query performance:');
    const start = Date.now();
    const testUPC = samples[0]?.b2c_upc;
    if (testUPC) {
      await collection.findOne({ 'b2c_upc': testUPC });
      const elapsed = Date.now() - start;
      console.log(`Query time for UPC lookup: ${elapsed}ms`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error testing external database:', error);
    process.exit(1);
  }
}

testExternalDB();