#!/usr/bin/env tsx

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import dbConnect from '../lib/mongodb';
import { connectToExternalDB } from '../lib/external-db';
import MasterBottle from '../models/MasterBottle';
import { cleanHTML, parseSize } from '../lib/external-product-helpers';

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const SPECIFIC_ID = process.argv.find(arg => arg.startsWith('--id='))?.split('=')[1];
const LIMIT = parseInt(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '10');

// Map FWGS categories
function mapCategory(b2cType?: string, marketingCategory?: string): string {
  const type = (b2cType || marketingCategory || '').toLowerCase();
  
  if (type.includes('bourbon')) return 'Bourbon';
  if (type.includes('rye')) return 'Rye';
  if (type.includes('scotch')) return 'Scotch';
  if (type.includes('irish')) return 'Irish';
  if (type.includes('japanese')) return 'Japanese';
  if (type.includes('canadian')) return 'Canadian Whisky';
  if (type.includes('tennessee')) return 'Tennessee Whiskey';
  if (type.includes('american whiskey')) return 'American Whiskey';
  if (type.includes('whiskey')) return 'American Whiskey';
  if (type.includes('vodka')) return 'Vodka';
  if (type.includes('rum')) return 'Rum';
  if (type.includes('gin')) return 'Gin';
  if (type.includes('tequila')) return 'Tequila';
  if (type.includes('mezcal')) return 'Mezcal';
  if (type.includes('brandy')) return 'Brandy';
  if (type.includes('cognac')) return 'Cognac';
  if (type.includes('liqueur')) return 'Liqueur';
  if (type.includes('wine')) return 'Wine';
  if (type.includes('beer')) return 'Beer';
  
  return 'Spirits';
}

// Parse proof value
function parseProof(proofStr?: string): number | null {
  if (!proofStr || proofStr === 'N/A' || proofStr === 'n/a') {
    return null;
  }
  
  const parsed = parseFloat(proofStr);
  if (isNaN(parsed) || parsed < 0 || parsed > 200) {
    return null;
  }
  
  return parsed;
}

// Parse UPCs
function parseUPCs(upcString?: string): string[] {
  if (!upcString) return [];
  
  return upcString
    .split(/\s+/)
    .filter(upc => upc.trim().length >= 12 && /^\d+$/.test(upc.trim()))
    .map(upc => upc.trim());
}

async function importProduct(fwgs: any): Promise<{ success: boolean; error?: any }> {
  try {
    const proofValue = parseProof(fwgs.b2c_proof);
    const category = mapCategory(fwgs.b2c_type, fwgs.b2c_newMarketingCategory);
    const size = parseSize(fwgs.b2c_size);
    const upcCodes = parseUPCs(fwgs.b2c_upc);
    
    const masterData = {
      name: fwgs.displayName,
      brand: fwgs.brand || fwgs.displayName.split(' ')[0],
      distillery: fwgs.brand || fwgs.displayName.split(' ')[0],
      category: category,
      type: fwgs.b2c_type || 'Spirits',
      
      ...(fwgs.b2c_age && { age: parseInt(fwgs.b2c_age) }),
      ...(proofValue && { statedProof: proofValue }),
      ...(proofValue && { proof: proofValue }),
      ...(proofValue && { abv: proofValue / 2 }),
      
      size: size,
      country: fwgs.b2c_country || 'United States',
      region: fwgs.b2c_region,
      
      description: fwgs.b2c_tastingNotes ? cleanHTML(fwgs.b2c_tastingNotes) : undefined,
      msrp: fwgs.listPrice ? parseFloat(fwgs.listPrice) : undefined,
      
      defaultImageUrl: fwgs.primaryLargeImageURL && fwgs.primaryLargeImageURL !== '/img/no-image.jpg'
        ? `https://www.finewineandgoodspirits.com${fwgs.primaryLargeImageURL}`
        : undefined,
      
      upcCodes: upcCodes.map(code => ({
        code,
        verifiedCount: 1000,
        dateAdded: new Date(),
        isAdminAdded: true
      })),
      
      externalData: {
        source: 'fwgs' as const,
        fwgsId: fwgs.repositoryId,
        sku: fwgs.id,
        importDate: new Date(),
        lastSync: new Date()
      },
      
      createdBy: 'system_import',
      active: true
    };
    
    await MasterBottle.create(masterData);
    return { success: true };
  } catch (error: any) {
    return { 
      success: false, 
      error: {
        message: error.message,
        validationErrors: error.errors ? Object.keys(error.errors).map(key => ({
          field: key,
          message: error.errors[key].message
        })) : undefined
      }
    };
  }
}

async function main() {
  console.log('🔧 FWGS Missing Products Import');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE IMPORT'}`);
  if (SPECIFIC_ID) console.log(`Specific ID: ${SPECIFIC_ID}`);
  console.log(`Limit: ${LIMIT}`);
  console.log('================================\n');
  
  await dbConnect();
  const externalDb = await connectToExternalDB();
  
  // If specific ID provided, import just that one
  if (SPECIFIC_ID) {
    console.log(`Looking for product ${SPECIFIC_ID}...`);
    
    // Check if already exists
    const exists = await MasterBottle.findOne({ 'externalData.fwgsId': SPECIFIC_ID });
    if (exists) {
      console.log(`✅ Product already imported with ID: ${exists._id}`);
      process.exit(0);
    }
    
    // Find in all_products
    const product = await externalDb.collection('all_products').findOne({ 
      repositoryId: SPECIFIC_ID 
    });
    
    if (!product) {
      console.log(`❌ Product ${SPECIFIC_ID} not found in FWGS database`);
      process.exit(1);
    }
    
    console.log(`Found: ${product.displayName}`);
    console.log(`Proof: "${product.b2c_proof}"`);
    console.log(`Type: ${product.b2c_type}`);
    
    if (DRY_RUN) {
      console.log('\n[DRY RUN] Would import this product');
    } else {
      console.log('\nImporting...');
      const result = await importProduct(product);
      if (result.success) {
        console.log('✅ Successfully imported!');
        
        // Verify it was imported
        const imported = await MasterBottle.findOne({ 'externalData.fwgsId': SPECIFIC_ID });
        if (imported) {
          console.log(`Master bottle ID: ${imported._id}`);
        }
      } else {
        console.log('❌ Import failed:', result.error);
      }
    }
    process.exit(0);
  }
  
  // Otherwise, find missing products
  console.log('Getting all imported FWGS IDs...');
  const importedFwgsIds = await MasterBottle.distinct('externalData.fwgsId', {
    'externalData.source': 'fwgs'
  });
  const importedSet = new Set(importedFwgsIds);
  console.log(`Found ${importedSet.size} imported FWGS products\n`);
  
  console.log('Finding missing products...');
  const allProducts = await externalDb.collection('all_products')
    .find({})
    .project({ 
      repositoryId: 1, 
      displayName: 1, 
      b2c_proof: 1,
      b2c_type: 1 
    })
    .toArray();
  
  const missingProducts = allProducts.filter(p => !importedSet.has(p.repositoryId));
  console.log(`Found ${missingProducts.length} missing products\n`);
  
  // Show some examples
  console.log('Examples of missing products:');
  missingProducts.slice(0, 5).forEach(p => {
    console.log(`- ${p.repositoryId}: ${p.displayName} (Proof: ${p.b2c_proof || 'null'})`);
  });
  console.log('');
  
  // Import missing products
  const toImport = missingProducts.slice(0, LIMIT);
  console.log(`${DRY_RUN ? 'Would import' : 'Importing'} ${toImport.length} products...\n`);
  
  let success = 0;
  let failed = 0;
  const errors: any[] = [];
  
  for (const productSummary of toImport) {
    // Get full product data
    const product = await externalDb.collection('all_products').findOne({ 
      repositoryId: productSummary.repositoryId 
    });
    
    if (!product) continue;
    
    console.log(`${DRY_RUN ? '[DRY RUN] Would import' : 'Importing'}: ${product.displayName}`);
    
    if (!DRY_RUN) {
      const result = await importProduct(product);
      if (result.success) {
        success++;
        console.log('  ✅ Success');
      } else {
        failed++;
        errors.push({ product: product.displayName, error: result.error });
        console.log('  ❌ Failed:', result.error.message);
      }
    } else {
      success++;
    }
  }
  
  console.log('\n========================================');
  console.log('Summary:');
  console.log(`Total missing: ${missingProducts.length}`);
  console.log(`${DRY_RUN ? 'Would import' : 'Imported'}: ${success}`);
  if (!DRY_RUN) {
    console.log(`Failed: ${failed}`);
  }
  
  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => {
      console.log(`\n${e.product}:`);
      console.log(`  ${e.error.message}`);
      if (e.error.validationErrors) {
        e.error.validationErrors.forEach((ve: any) => {
          console.log(`  - ${ve.field}: ${ve.message}`);
        });
      }
    });
  }
  
  console.log('\nTo import more products, run with --limit=<number>');
  console.log('To import all missing products, run with --limit=9999');
  
  process.exit(0);
}

main().catch(console.error);