import { Db } from 'mongodb';
import { cleanHTML } from './external-product-helpers';
import { IMasterBottle } from '@/models/MasterBottle';

export interface MatchResult {
  externalProduct: any;
  confidence: number;
  matchReasons: string[];
}

// Normalize names for better comparison
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Replace all non-word chars with space
    .replace(/\s+year\s+old/g, ' year old')
    .replace(/,?\s*\d+(\.\d+)?%/g, '')  // Remove proof percentages
    .replace(/straight bourbon whiskey/g, 'straight bourbon')
    .replace(/kentucky straight bourbon/g, 'straight bourbon')
    .replace(/single barrel/g, 'single brl')
    .replace(/small batch/g, 'small btch')
    .replace(/bottled in bond/g, 'bib')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract key words (usually brand is first word or two)
function getKeyWords(name: string): string {
  const words = name.split(' ').filter(w => w.length > 2);
  return words.slice(0, 2).join(' ');
}

// Check if brand appears anywhere in product name
function findBrandInName(productName: string, masterBrand: string): boolean {
  if (!productName || !masterBrand) return false;
  
  const brandWords = masterBrand.toLowerCase().split(' ').filter(w => w.length > 2);
  const productLower = productName.toLowerCase();
  
  return brandWords.every(word => productLower.includes(word));
}

// Extract numeric value from string (for proof, age, etc)
function extractNumber(str: string): number | null {
  const match = str.match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

export async function findMatches(masterBottle: IMasterBottle, externalDB: Db): Promise<MatchResult[]> {
  const matches: MatchResult[] = [];
  const allResults = new Map<string, any>();
  
  // Extract search terms from the master bottle
  const firstWord = masterBottle.name.split(' ')[0];
  const firstTwoWords = masterBottle.name.split(' ').slice(0, 2).join(' ');
  const normalizedName = normalizeName(masterBottle.name);
  
  // Multiple search strategies, from specific to broad
  const searchQueries = [
    // 1. First word of name (often the actual brand)
    { displayName: { $regex: `^${escapeRegex(firstWord)}`, $options: 'i' } },
    
    // 2. First two words
    { displayName: { $regex: escapeRegex(firstTwoWords), $options: 'i' } },
    
    // 3. Master brand anywhere in display name
    { displayName: { $regex: escapeRegex(masterBottle.brand), $options: 'i' } },
    
    // 4. Any significant word from master name (3+ chars)
    ...masterBottle.name.split(' ')
      .filter(word => word.length > 3)
      .slice(0, 3)
      .map(word => ({ displayName: { $regex: escapeRegex(word), $options: 'i' } })),
    
    // 5. External brand field exact match
    { brand: { $regex: escapeRegex(masterBottle.brand), $options: 'i' } },
    
    // 6. Distillery in display name (sometimes brand = distillery)
    { displayName: { $regex: escapeRegex(masterBottle.distillery), $options: 'i' } }
  ];
  
  // Try each search strategy
  for (const query of searchQueries) {
    try {
      const results = await externalDB
        .collection('image_price_data')
        .find(query)
        .limit(30)
        .toArray();
        
      for (const product of results) {
        if (!allResults.has(product.repositoryId)) {
          allResults.set(product.repositoryId, product);
        }
      }
    } catch (error) {
      // Skip failed queries
      console.error('Search query failed:', query, error);
    }
  }
  
  // Score each unique result
  for (const product of Array.from(allResults.values())) {
    const confidence = calculateConfidence(masterBottle, product);
    if (confidence > 35) { // Lower threshold to catch more matches
      matches.push({
        externalProduct: product,
        confidence,
        matchReasons: getMatchReasons(masterBottle, product)
      });
    }
  }
  
  // Remove duplicates and sort by confidence
  return matches
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 8); // Show top 8 matches
}

function calculateConfidence(master: IMasterBottle, external: any): number {
  let score = 0;
  
  // Name similarity (45%) - most important, using normalized names
  const nameSimilarity = getStringSimilarity(
    normalizeName(master.name),
    normalizeName(external.displayName || '')
  );
  score += nameSimilarity * 45;
  
  // Brand/First word matching (35%)
  const firstWordMaster = master.name.split(' ')[0].toLowerCase();
  const firstWordExternal = (external.displayName || '').split(' ')[0].toLowerCase();
  
  if (master.brand && external.brand && 
      master.brand.toLowerCase() === external.brand.toLowerCase()) {
    score += 35;  // Exact brand match
  } else if (firstWordMaster === firstWordExternal) {
    score += 30;  // First word match (often the brand)
  } else if (findBrandInName(external.displayName, master.brand)) {
    score += 25;  // Brand found in product name
  } else if (findBrandInName(external.displayName, master.distillery)) {
    score += 20;  // Distillery found in product name
  }
  
  // Proof match (20%)
  if (master.proof && external.b2c_proof) {
    const externalProof = parseFloat(external.b2c_proof);
    if (!isNaN(externalProof)) {
      const proofDiff = Math.abs(master.proof - externalProof);
      if (proofDiff === 0) {
        score += 20;
      } else if (proofDiff < 1) {
        score += 15;
      } else if (proofDiff < 2) {
        score += 10;
      } else if (proofDiff < 5) {
        score += 5;
      }
    }
  }
  
  // Bonus points for multiple matching elements
  const matchingElements = [];
  if (firstWordMaster === firstWordExternal) matchingElements.push('first');
  if (master.proof && external.b2c_proof && 
      Math.abs(master.proof - parseFloat(external.b2c_proof)) < 2) {
    matchingElements.push('proof');
  }
  if (nameSimilarity > 0.7) matchingElements.push('name');
  
  // Add bonus for multiple matches
  if (matchingElements.length >= 2) {
    score += 10;
  }
  
  return Math.round(score);
}

function getMatchReasons(master: IMasterBottle, external: any): string[] {
  const reasons: string[] = [];
  
  // First word comparison
  const firstWordMaster = master.name.split(' ')[0].toLowerCase();
  const firstWordExternal = (external.displayName || '').split(' ')[0].toLowerCase();
  if (firstWordMaster === firstWordExternal) {
    reasons.push('First word match');
  }
  
  // Brand comparison
  if (master.brand && external.brand && 
      master.brand.toLowerCase() === external.brand.toLowerCase()) {
    reasons.push('Brand match');
  } else if (findBrandInName(external.displayName, master.brand)) {
    reasons.push('Brand in product name');
  } else if (findBrandInName(external.displayName, master.distillery)) {
    reasons.push('Distillery in product name');
  }
  
  // Name comparison with normalized names
  const nameSimilarity = getStringSimilarity(
    normalizeName(master.name),
    normalizeName(external.displayName || '')
  );
  if (nameSimilarity > 0.85) {
    reasons.push('Very high name similarity');
  } else if (nameSimilarity > 0.7) {
    reasons.push('High name similarity');
  } else if (nameSimilarity > 0.6) {
    reasons.push('Good name similarity');
  }
  
  // Proof comparison
  if (master.proof && external.b2c_proof) {
    const externalProof = parseFloat(external.b2c_proof);
    if (!isNaN(externalProof)) {
      const proofDiff = Math.abs(master.proof - externalProof);
      if (proofDiff === 0) {
        reasons.push(`Exact ${master.proof}° proof`);
      } else if (proofDiff < 1) {
        reasons.push('Nearly exact proof');
      } else if (proofDiff < 2) {
        reasons.push('Similar proof');
      }
    }
  }
  
  // Key words match
  const masterKeyWords = getKeyWords(master.name).toLowerCase();
  const externalKeyWords = getKeyWords(external.displayName || '').toLowerCase();
  if (masterKeyWords && externalKeyWords && masterKeyWords === externalKeyWords) {
    reasons.push('Key words match');
  }
  
  return reasons;
}

// Levenshtein distance-based similarity
function getStringSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  // Quick exact match check
  if (str1 === str2) return 1;
  
  // Create distance matrix
  const matrix: number[][] = [];
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  // Calculate distances
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,    // deletion
          matrix[i][j - 1] + 1,    // insertion
          matrix[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }
  
  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return maxLen === 0 ? 1 : 1 - (distance / maxLen);
}

function getCategoryMatch(masterCategory: string, externalCategory: string): number {
  const masterLower = masterCategory.toLowerCase();
  const externalLower = externalCategory.toLowerCase();
  
  // Exact match
  if (masterLower === externalLower) return 1;
  
  // Check if one contains the other
  if (masterLower.includes(externalLower) || externalLower.includes(masterLower)) {
    return 0.8;
  }
  
  // Common category mappings
  const categoryMap: Record<string, string[]> = {
    'bourbon': ['bourbon', 'kentucky', 'straight bourbon'],
    'scotch': ['scotch', 'single malt', 'blended scotch', 'scotland'],
    'irish': ['irish', 'irish whiskey'],
    'japanese': ['japanese', 'japan'],
    'rye': ['rye', 'rye whiskey', 'straight rye'],
    'american whiskey': ['american', 'whiskey', 'tennessee', 'american whiskey'],
  };
  
  // Check mappings
  for (const [key, values] of Object.entries(categoryMap)) {
    const masterMatches = values.some(v => masterLower.includes(v));
    const externalMatches = values.some(v => externalLower.includes(v));
    if (masterMatches && externalMatches) {
      return 0.7;
    }
  }
  
  return 0;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Stats for backfill progress
export async function getBackfillStats(db: Db): Promise<{
  totalMasterBottles: number;
  bottlesWithUPC: number;
  bottlesWithoutUPC: number;
  percentComplete: number;
}> {
  const MasterBottle = (await import('@/models/MasterBottle')).default;
  
  const totalMasterBottles = await MasterBottle.countDocuments({});
  const bottlesWithUPC = await MasterBottle.countDocuments({
    'upcCodes.0': { $exists: true }
  });
  const bottlesWithoutUPC = totalMasterBottles - bottlesWithUPC;
  const percentComplete = totalMasterBottles > 0 
    ? Math.round((bottlesWithUPC / totalMasterBottles) * 100) 
    : 0;
  
  return {
    totalMasterBottles,
    bottlesWithUPC,
    bottlesWithoutUPC,
    percentComplete
  };
}