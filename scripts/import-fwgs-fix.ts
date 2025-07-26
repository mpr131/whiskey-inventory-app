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
const CHECK_ONLY = process.argv.includes('--check-only');
const SPECIFIC_ID = process.argv.find(arg => arg.startsWith('--id='))?.split('=')[1];

// Map FWGS categories to our standard categories
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
  if (type.includes('whiskey')) return 'American Whiskey'; // Catch generic "Whiskey"
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
  
  return 'Spirits'; // Default fallback
}

// Parse proof value handling "N/A" and other invalid values
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

// Parse UPCs from various formats
function parseUPCs(upcString?: string): string[] {
  if (!upcString) return [];
  
  return upcString
    .split(/\s+/)
    .filter(upc => upc.trim().length >= 12 && /^\d+$/.test(upc.trim()))
    .map(upc => upc.trim());
}

async function checkOrImportProduct(fwgs: any, dryRun: boolean, checkOnly: boolean) {
  const results = {
    id: fwgs.repositoryId,
    name: fwgs.displayName,
    status: 'unknown',
    error: null as any,
    details: {} as any
  };
  
  try {
    // Check if already exists
    const existing = await MasterBottle.findOne({
      'externalData.fwgsId': fwgs.repositoryId
    });
    
    if (existing) {
      results.status = 'already_imported';
      results.details = { existingId: existing._id };
      return results;
    }
    
    // Parse values
    const proofValue = parseProof(fwgs.b2c_proof);
    const category = mapCategory(fwgs.b2c_type, fwgs.b2c_newMarketingCategory);
    const size = parseSize(fwgs.b2c_size);
    const upcCodes = parseUPCs(fwgs.b2c_upc);
    
    // Build master bottle data
    const masterData = {
      name: fwgs.displayName,
      brand: fwgs.brand || fwgs.displayName.split(' ')[0],
      distillery: fwgs.brand || fwgs.displayName.split(' ')[0],
      category: category,
      type: fwgs.b2c_type || 'Spirits',
      
      // Only set numeric fields if valid
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
    
    results.details = {
      category,
      proof: proofValue,
      originalProof: fwgs.b2c_proof,
      size,
      upcCount: upcCodes.length
    };
    
    if (checkOnly) {
      results.status = 'would_import';
      return results;
    }
    
    if (!dryRun) {
      const created = await MasterBottle.create(masterData);
      results.status = 'imported';
      results.details.newId = created._id;
    } else {
      results.status = 'dry_run_success';
    }
    
  } catch (error: any) {
    results.status = 'error';
    results.error = {
      message: error.message,
      name: error.name,
      validationErrors: error.errors ? Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      })) : undefined
    };
  }
  
  return results;
}

async function main() {
  console.log('🔧 FWGS Import Fix Tool');
  console.log(`Mode: ${CHECK_ONLY ? 'CHECK ONLY' : DRY_RUN ? 'DRY RUN' : 'LIVE IMPORT'}`);
  if (SPECIFIC_ID) console.log(`Specific ID: ${SPECIFIC_ID}`);
  console.log('================================\n');
  
  await dbConnect();
  const externalDb = await connectToExternalDB();
  
  // If specific ID provided, just check/import that one
  if (SPECIFIC_ID) {
    const product = await externalDb.collection('all_products').findOne({ 
      repositoryId: SPECIFIC_ID 
    });
    
    if (!product) {
      console.log(`❌ Product ${SPECIFIC_ID} not found in FWGS database`);
      process.exit(1);
    }
    
    console.log(`Found: ${product.displayName}`);
    const result = await checkOrImportProduct(product, DRY_RUN, CHECK_ONLY);
    console.log('\nResult:', JSON.stringify(result, null, 2));
    process.exit(0);
  }
  
  // Otherwise, find all products with "N/A" proof that haven't been imported
  console.log('Finding products with N/A proof...');
  
  const naProofProducts = await externalDb.collection('all_products')
    .find({ b2c_proof: { $in: ['N/A', 'n/a', null, ''] } })
    .toArray();
  
  console.log(`Found ${naProofProducts.length} products with N/A or missing proof\n`);
  
  // Check which ones are missing from our database
  const results = {
    alreadyImported: 0,
    wouldImport: 0,
    errors: 0,
    imported: 0,
    errorDetails: [] as any[]
  };
  
  for (const product of naProofProducts.slice(0, 10)) { // Limit to 10 for testing
    const result = await checkOrImportProduct(product, DRY_RUN, CHECK_ONLY);
    
    switch (result.status) {
      case 'already_imported':
        results.alreadyImported++;
        break;
      case 'would_import':
      case 'dry_run_success':
        results.wouldImport++;
        console.log(`✅ Would import: ${result.name}`);
        break;
      case 'imported':
        results.imported++;
        console.log(`✅ Imported: ${result.name}`);
        break;
      case 'error':
        results.errors++;
        results.errorDetails.push(result);
        console.log(`❌ Error: ${result.name} - ${result.error.message}`);
        break;
    }
  }
  
  console.log('\n========================================');
  console.log('Summary:');
  console.log(`Already imported: ${results.alreadyImported}`);
  console.log(`Would import: ${results.wouldImport}`);
  console.log(`Imported: ${results.imported}`);
  console.log(`Errors: ${results.errors}`);
  
  if (results.errorDetails.length > 0) {
    console.log('\nError Details:');
    results.errorDetails.forEach(err => {
      console.log(`\n${err.name} (${err.id}):`);
      console.log(`  Error: ${err.error.message}`);
      if (err.error.validationErrors) {
        err.error.validationErrors.forEach((ve: any) => {
          console.log(`  - ${ve.field}: ${ve.message}`);
        });
      }
    });
  }
  
  process.exit(0);
}

main().catch(console.error);