import { Db } from 'mongodb';
import MasterBottle, { IMasterBottle } from '@/models/MasterBottle';
import { cleanHTML, parseSize } from './external-product-helpers';
import { findMatches } from './upc-matching';
import mongoose from 'mongoose';

// Map FWGS categories to our standard categories
export function mapCategory(b2cType?: string, marketingCategory?: string): string {
  const type = (b2cType || marketingCategory || '').toLowerCase();
  
  if (type.includes('bourbon')) return 'Bourbon';
  if (type.includes('rye')) return 'Rye';
  if (type.includes('scotch')) return 'Scotch';
  if (type.includes('irish')) return 'Irish';
  if (type.includes('japanese')) return 'Japanese';
  if (type.includes('canadian')) return 'Canadian Whisky';
  if (type.includes('tennessee')) return 'Tennessee Whiskey';
  if (type.includes('american whiskey')) return 'American Whiskey';
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

// Normalize size string
export function normalizeSize(sizeStr?: string): string {
  if (!sizeStr) return '750 ml';
  return parseSize(sizeStr);
}

// Extract numeric value from string
export function extractNumber(str?: string): number | undefined {
  if (!str) return undefined;
  const match = str.match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : undefined;
}

// Parse multiple UPCs from space-separated string
export function parseUPCs(upcString?: string): string[] {
  if (!upcString) return [];
  
  return upcString
    .split(/\s+/)
    .filter(upc => upc.trim().length >= 12 && /^\d+$/.test(upc.trim()))
    .map(upc => upc.trim());
}

// Create master bottle from FWGS data
export async function createMasterFromFWGS(fwgs: any): Promise<IMasterBottle | null> {
  try {
  const upcCodes = parseUPCs(fwgs.b2c_upc);
  
  // Parse proof values safely
  const proofValue = fwgs.b2c_proof ? parseFloat(fwgs.b2c_proof) : null;
  const validProof = proofValue && !isNaN(proofValue) ? proofValue : null;
  const validAbv = validProof ? validProof / 2 : null;
  
  const masterData = {
    name: fwgs.displayName,
    brand: fwgs.brand || fwgs.displayName.split(' ')[0], // Use first word as brand fallback
    distillery: fwgs.brand || fwgs.displayName.split(' ')[0],
    category: mapCategory(fwgs.b2c_type, fwgs.b2c_newMarketingCategory),
    type: fwgs.b2c_type || 'Spirits',
    
    // Specs - only set if valid numbers
    age: extractNumber(fwgs.b2c_age),
    ...(validProof && { statedProof: validProof }),
    ...(validProof && { proof: validProof }),
    ...(validAbv && { abv: validAbv }),
    size: normalizeSize(fwgs.b2c_size),
    
    // Origin
    country: fwgs.b2c_country || 'United States',
    region: fwgs.b2c_region,
    
    // Content
    description: fwgs.b2c_tastingNotes ? cleanHTML(fwgs.b2c_tastingNotes) : undefined,
    msrp: fwgs.listPrice ? parseFloat(fwgs.listPrice) : undefined,
    
    // Images
    defaultImageUrl: fwgs.primaryLargeImageURL && fwgs.primaryLargeImageURL !== '/img/no-image.jpg'
      ? `https://www.finewineandgoodspirits.com${fwgs.primaryLargeImageURL}`
      : undefined,
    
    // UPCs - don't set submittedBy to avoid validation error
    upcCodes: upcCodes.map(code => ({
      code,
      verifiedCount: 1000,
      dateAdded: new Date(),
      isAdminAdded: true
    })),
    
    // CRITICAL - Store FWGS reference
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
  
  return await MasterBottle.create(masterData);
  } catch (error) {
    console.error(`Failed to create master bottle for ${fwgs.displayName}:`, error);
    return null;
  }
}

// Merge FWGS data into existing master bottle
export async function mergeFWGSData(masterBottleId: string, fwgs: any): Promise<IMasterBottle | null> {
  const updateData: any = {
    $set: {
      'externalData.source': 'fwgs',
      'externalData.fwgsId': fwgs.repositoryId,
      'externalData.sku': fwgs.id,
      'externalData.lastSync': new Date()
    }
  };
  
  // Only update fields if they're missing
  const bottle = await MasterBottle.findById(masterBottleId);
  if (!bottle) return null;
  
  const setIfMissing: any = {};
  
  if (!bottle.description && fwgs.b2c_tastingNotes) {
    setIfMissing.description = cleanHTML(fwgs.b2c_tastingNotes);
  }
  
  if (!bottle.defaultImageUrl && fwgs.primaryLargeImageURL && fwgs.primaryLargeImageURL !== '/img/no-image.jpg') {
    setIfMissing.defaultImageUrl = `https://www.finewineandgoodspirits.com${fwgs.primaryLargeImageURL}`;
  }
  
  if (!bottle.msrp && fwgs.listPrice) {
    setIfMissing.msrp = parseFloat(fwgs.listPrice);
  }
  
  if (!bottle.country && fwgs.b2c_country) {
    setIfMissing.country = fwgs.b2c_country;
  }
  
  if (!bottle.region && fwgs.b2c_region) {
    setIfMissing.region = fwgs.b2c_region;
  }
  
  if (Object.keys(setIfMissing).length > 0) {
    Object.assign(updateData.$set, setIfMissing);
  }
  
  // Add any new UPCs
  const newUPCs = parseUPCs(fwgs.b2c_upc);
  if (newUPCs.length > 0) {
    updateData.$addToSet = {
      upcCodes: {
        $each: newUPCs.map(code => ({
          code,
          // Don't set submittedBy to avoid validation error
          verifiedCount: 1000,
          dateAdded: new Date(),
          isAdminAdded: true
        }))
      }
    };
  }
  
  return await MasterBottle.findByIdAndUpdate(
    masterBottleId,
    updateData,
    { new: true }
  );
}

// Match result interface
export interface PotentialMatch {
  bottle: IMasterBottle;
  confidence: number;
}

// Find potential matches for FWGS product
export async function findPotentialMatches(fwgs: any, externalDb: Db): Promise<PotentialMatch[]> {
  // First check for exact UPC match
  const upcCodes = parseUPCs(fwgs.b2c_upc);
  if (upcCodes.length > 0) {
    const upcMatch = await MasterBottle.findOne({
      'upcCodes.code': { $in: upcCodes },
      'externalData.source': { $ne: 'fwgs' } // Don't match already imported FWGS bottles
    });
    
    if (upcMatch) {
      return [{ bottle: upcMatch, confidence: 100 }];
    }
  }
  
  // Try name matching
  const nameMatches = await MasterBottle.find({
    'externalData.source': { $ne: 'fwgs' },
    $or: [
      // Exact name match
      { name: fwgs.displayName },
      // Name starts with same word
      { name: { $regex: `^${escapeRegex(fwgs.displayName.split(' ')[0])}`, $options: 'i' } }
    ]
  }).limit(10);
  
  // Score each match
  const scoredMatches = nameMatches.map(bottle => {
    let score = 0;
    
    // Name similarity
    if (bottle.name.toLowerCase() === fwgs.displayName.toLowerCase()) {
      score += 50;
    } else if (bottle.name.toLowerCase().includes(fwgs.displayName.toLowerCase()) || 
               fwgs.displayName.toLowerCase().includes(bottle.name.toLowerCase())) {
      score += 30;
    }
    
    // Brand match
    if (bottle.brand && fwgs.brand && bottle.brand.toLowerCase() === fwgs.brand.toLowerCase()) {
      score += 30;
    }
    
    // Proof match
    if (bottle.proof && fwgs.b2c_proof) {
      const proofDiff = Math.abs(bottle.proof - parseFloat(fwgs.b2c_proof));
      if (proofDiff === 0) score += 20;
      else if (proofDiff < 2) score += 10;
    }
    
    return { bottle, confidence: score };
  });
  
  return scoredMatches
    .filter(m => m.confidence > 50)
    .sort((a, b) => b.confidence - a.confidence);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Import statistics
export interface ImportStats {
  totalFWGSProducts: number;
  alreadyImported: number;
  newImports: number;
  merged: number;
  failed: number;
  startTime: Date;
  endTime?: Date;
  errors: Array<{
    fwgsId: string;
    name: string;
    error: string;
  }>;
}