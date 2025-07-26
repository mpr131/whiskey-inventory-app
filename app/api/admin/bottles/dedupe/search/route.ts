import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import MasterBottle from '@/models/MasterBottle';

// Extract brand name from bottle name (usually first word or two)
function extractBrandName(name: string): string {
  // Remove common patterns like quotes, parentheses
  const cleaned = name
    .replace(/['"]/g, '')
    .replace(/\([^)]*\)/g, '')
    .trim();
  
  // Common patterns for brand extraction
  const words = cleaned.split(/\s+/);
  
  // For possessive forms like "Blanton's", keep the possessive
  if (words[0]?.endsWith("'s") || words[0]?.endsWith("s'")) {
    return words[0];
  }
  
  // Check if first two words form a brand (e.g., "Four Roses", "Wild Turkey")
  if (words.length >= 2) {
    const firstTwo = words.slice(0, 2).join(' ').toLowerCase();
    const commonTwoPart = [
      'four roses', 'wild turkey', 'eagle rare', 'jim beam', 'jack daniel',
      'old forester', 'buffalo trace', 'maker\'s mark', 'woodford reserve',
      'elijah craig', 'henry mckenna', 'old grand', 'very old', 'old fitzgerald'
    ];
    if (commonTwoPart.some(brand => firstTwo.includes(brand))) {
      return words.slice(0, 2).join(' ');
    }
  }
  
  // Default to first word
  return words[0] || '';
}

// Calculate match score with brand prioritization
function calculateMatchScore(searchName: string, targetName: string, targetBrand?: string): number {
  const searchLower = searchName.toLowerCase();
  const targetLower = targetName.toLowerCase();
  
  // Extract brand from search query
  const searchBrand = extractBrandName(searchName).toLowerCase();
  const searchBrandClean = searchBrand.replace(/[^a-z0-9]/g, ''); // Remove apostrophes, etc.
  
  let score = 0;
  
  // Priority 1: Exact brand match (100 points)
  if (targetBrand) {
    const targetBrandLower = targetBrand.toLowerCase();
    const targetBrandClean = targetBrandLower.replace(/[^a-z0-9]/g, '');
    
    if (targetBrandLower === searchBrand || targetBrandClean === searchBrandClean) {
      score += 100;
    } else if (targetBrandLower.includes(searchBrandClean) || searchBrandClean.includes(targetBrandClean)) {
      score += 80;
    }
  }
  
  // Priority 2: Brand in product name (80 points)
  const targetWords = targetLower.split(/\s+/);
  const targetFirstWord = targetWords[0]?.replace(/[^a-z0-9]/g, '');
  
  if (targetFirstWord === searchBrandClean) {
    score += 80;
  } else if (targetLower.includes(searchBrandClean)) {
    score += 60;
  }
  
  // Priority 3: Full name similarity (up to 40 points)
  const searchWords = searchLower.split(/\s+/);
  const commonWords = searchWords.filter(word => {
    return word.length > 2 && targetLower.includes(word);
  });
  
  const wordMatchRatio = commonWords.length / Math.max(searchWords.length, 1);
  score += Math.round(wordMatchRatio * 40);
  
  // Penalty for very different names (unless brand matches)
  if (score < 60) {
    const lengthRatio = Math.min(searchName.length, targetName.length) / 
                       Math.max(searchName.length, targetName.length);
    if (lengthRatio < 0.5) {
      score = Math.max(0, score - 20);
    }
  }
  
  return Math.min(100, score);
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name } = await request.json();
    
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    await dbConnect();
    
    // Strip parenthetical content for better matching
    const nameWithoutParens = name.replace(/\([^)]*\)/g, '').trim();

    // Extract brand for focused search (use name without parentheses)
    const brandName = extractBrandName(nameWithoutParens);
    const brandNameClean = brandName.replace(/[^a-z0-9]/gi, '').toLowerCase();
    
    // ALSO search with spaces preserved for multi-word brands
    const brandNameWithSpaces = brandName.toLowerCase();
    
    // Escape special regex characters
    const escapeRegex = (str: string) => {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };
    
    console.log('=== SEARCH DEBUG ===');
    console.log('Original query:', name);
    console.log('Without parentheses:', nameWithoutParens);
    console.log('Extracted brand:', brandName);
    console.log('Clean brand:', brandNameClean);
    console.log('Brand with spaces:', brandNameWithSpaces);
    
    // Build the MongoDB query - search for BOTH versions
    const brandNameEscaped = escapeRegex(brandNameWithSpaces); // Use version WITH spaces
    const brandQuery = {
      'externalData.source': 'fwgs',
      $or: [
        { name: new RegExp(brandNameEscaped, 'i') },
        { brand: new RegExp(brandNameEscaped, 'i') }
      ]
    };
    
    console.log('MongoDB query:', {
      'externalData.source': 'fwgs',
      '$or': [
        { name: `RegExp(/${brandNameEscaped}/i)` },
        { brand: `RegExp(/${brandNameEscaped}/i)` }
      ]
    });
    
    // First, try simple contains search for the brand
    let potentialMatches = await MasterBottle.find(brandQuery)
    .limit(100)
    .select('name brand producer category subcategory proof statedProof size defaultImageUrl upcCodes externalData');
    
    console.log(`Found ${potentialMatches.length} matches for brand: ${brandNameClean}`);
    
    // Debug: Show first few matches
    if (potentialMatches.length > 0) {
      console.log('First 3 matches:');
      potentialMatches.slice(0, 3).forEach(m => {
        console.log(`  - ${m.name} (Brand: ${m.brand || 'N/A'}, FWGS ID: ${m.externalData?.fwgsId})`);
      });
    }
    
    // If no matches, try broader search with individual words
    if (potentialMatches.length === 0) {
      const searchWords = nameWithoutParens.split(/\s+/).filter((w: string) => w.length > 2);
      console.log('No brand matches, trying words:', searchWords);
      
      const wordQueries = searchWords.map((word: string) => ({
        $or: [
          { name: new RegExp(escapeRegex(word), 'i') },
          { brand: new RegExp(escapeRegex(word), 'i') }
        ]
      }));
      
      if (wordQueries.length > 0) {
        potentialMatches = await MasterBottle.find({
          'externalData.source': 'fwgs',
          $and: wordQueries
        })
        .limit(50)
        .select('name brand producer category subcategory proof statedProof size defaultImageUrl upcCodes externalData');
        
        console.log(`Found ${potentialMatches.length} matches with word search`);
      }
    }
    
    // If still no matches, try even broader search
    if (potentialMatches.length === 0) {
      const firstWord = nameWithoutParens.split(/\s+/)[0];
      console.log('Still no matches, trying first word only:', firstWord);
      
      potentialMatches = await MasterBottle.find({
        'externalData.source': 'fwgs',
        name: new RegExp(escapeRegex(firstWord), 'i')
      })
      .limit(30)
      .select('name brand producer category subcategory proof statedProof size defaultImageUrl upcCodes externalData');
      
      console.log(`Found ${potentialMatches.length} matches with first word search`);
    }

    // Calculate match scores and sort
    const scoredMatches = potentialMatches.map(bottle => {
      try {
        const score = calculateMatchScore(name, bottle.name, bottle.brand);
        const bottleObj = bottle.toObject();
        return {
          ...bottleObj,
          matchScore: score
        };
      } catch (err) {
        console.error('Error processing bottle:', err);
        console.error('Bottle:', bottle);
        throw err;
      }
    });
    
    // Debug scoring
    console.log('Score distribution:');
    const scoreRanges = { '0-10': 0, '11-20': 0, '21-50': 0, '51-100': 0 };
    scoredMatches.forEach((m: any) => {
      if (m.matchScore <= 10) scoreRanges['0-10']++;
      else if (m.matchScore <= 20) scoreRanges['11-20']++;
      else if (m.matchScore <= 50) scoreRanges['21-50']++;
      else scoreRanges['51-100']++;
    });
    console.log(scoreRanges);
    
    // Show some examples regardless of score
    console.log('Sample matches with scores:');
    scoredMatches.slice(0, 10).forEach((m: any) => {
      console.log(`  - ${m.name} (Score: ${m.matchScore}, FWGS: ${m.externalData?.fwgsId})`);
    });
    
    // Check for specific bottle
    const targetBottle = scoredMatches.find((m: any) => m.externalData?.fwgsId === '000083922');
    if (targetBottle) {
      console.log(`\nFOUND TARGET: Old Forester Single Barrel (000083922) with score: ${targetBottle.matchScore}`);
    } else {
      console.log('\nNOT FOUND: Old Forester Single Barrel (000083922) not in search results');
    }
    
    const matchesWithScores = scoredMatches
      .filter((match: any) => match.matchScore >= 0) // Accept ALL scores for debugging
      .sort((a: any, b: any) => b.matchScore - a.matchScore)
      .slice(0, 30); // Return more matches

    console.log(`Returning ${matchesWithScores.length} scored matches (from ${potentialMatches.length} found)`);
    if (matchesWithScores.length > 0) {
      console.log('Top 3 matches:');
      matchesWithScores.slice(0, 3).forEach((m: any) => {
        console.log(`  - ${m.name} (${m.brand}) - Score: ${m.matchScore}`);
      });
    }

    return NextResponse.json({
      matches: matchesWithScores,
      searchInfo: {
        originalQuery: name,
        extractedBrand: brandName,
        cleanBrand: brandNameClean,
        totalFound: potentialMatches.length,
        debug: {
          fwgsProductCount: await MasterBottle.countDocuments({ 'externalData.source': 'fwgs' })
        }
      }
    });
  } catch (error: any) {
    console.error('Error searching for matches:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: 'Failed to search for matches',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}