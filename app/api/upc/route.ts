import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import MasterBottle from '@/models/MasterBottle';
import UserBottle from '@/models/UserBottle';
import mongoose from 'mongoose';
import { connectToExternalDB } from '@/lib/external-db';
import { 
  mapCategory, 
  extractAge, 
  cleanHTML, 
  parseSize,
  type ExternalProduct 
} from '@/lib/external-product-helpers';

// Cache for UPC API results to minimize API calls
const upcCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

interface UpcApiResponse {
  code: string;
  total: number;
  items: Array<{
    title: string;
    brand: string;
    description: string;
    category?: string;
    size?: string;
  }>;
}

async function fetchFromUpcApi(upcCode: string): Promise<UpcApiResponse | null> {
  // Check cache first
  const cached = upcCache.get(upcCode);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const response = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${upcCode}`,
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('UPC API error:', response.status);
      return null;
    }

    const data = await response.json();
    
    // Cache the result
    upcCache.set(upcCode, { data, timestamp: Date.now() });
    
    return data;
  } catch (error) {
    console.error('Error fetching from UPC API:', error);
    return null;
  }
}

// Fuzzy string matching using Levenshtein distance
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + 1
        );
      }
    }
  }

  return dp[m][n];
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(s1, s2);
  return 1 - (distance / maxLen);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const barcode = searchParams.get('barcode');

    if (!barcode) {
      return NextResponse.json({ error: 'Barcode is required' }, { status: 400 });
    }

    await dbConnect();

    // Step 1: Check if it's a WV code (vault barcode)
    if (barcode.startsWith('WV')) {
      const userBottle = await UserBottle.findOne({
        userId: session.user.id,
        vaultBarcode: barcode,
      }).populate('masterBottleId');

      if (userBottle) {
        return NextResponse.json({
          type: 'vault',
          bottle: userBottle,
        });
      }
    }

    // Step 2: Check UserBottle.barcode field (CellarTracker codes)
    const userBottle = await UserBottle.findOne({
      userId: session.user.id,
      $or: [
        { barcode: barcode },
        { cellarTrackerId: barcode },
        { wineBarcode: barcode },
      ],
    }).populate('masterBottleId');

    if (userBottle) {
      return NextResponse.json({
        type: 'user',
        bottle: userBottle,
      });
    }

    // Step 3: Check MasterBottle.upcCodes array
    const masterBottleWithUpc = await MasterBottle.findOne({
      'upcCodes.code': barcode,
    });

    if (masterBottleWithUpc) {
      // Find all user bottles for this master bottle
      const userBottles = await UserBottle.find({
        userId: session.user.id,
        masterBottleId: masterBottleWithUpc._id,
      }).populate('masterBottleId');

      return NextResponse.json({
        type: 'upc',
        masterBottle: masterBottleWithUpc,
        userBottles: userBottles,
      });
    }

    // Step 4: Check external database for UPC
    try {
      const externalDb = await connectToExternalDB();
      const externalProduct = await externalDb
        .collection<ExternalProduct>('image_price_data')
        .findOne({ 'b2c_upc': barcode });
      
      if (externalProduct) {
        // Handle proof properly - it's a string in the external DB
        const proofNum = parseFloat(externalProduct.b2c_proof || '0') || 0;
        
        // Collect image URLs if available
        const imageUrls: string[] = [];
        let defaultImageUrl: string | undefined;
        
        if (externalProduct.primaryLargeImageURL && externalProduct.primaryLargeImageURL !== '/img/no-image.jpg') {
          defaultImageUrl = `https://www.finewineandgoodspirits.com${externalProduct.primaryLargeImageURL}`;
          
          // Collect all available image sizes
          ['primaryLargeImageURL', 'primaryMediumImageURL', 'primarySmallImageURL'].forEach(field => {
            const url = externalProduct[field as keyof ExternalProduct] as string;
            if (url && url !== '/img/no-image.jpg') {
              imageUrls.push(`https://www.finewineandgoodspirits.com${url}`);
            }
          });
        }
        
        // Create new MasterBottle from external data
        const masterBottle = await MasterBottle.create({
          name: externalProduct.displayName || 'Unknown',
          brand: externalProduct.brand || '',
          distillery: externalProduct.brand || '', // Use brand as distillery fallback
          category: mapCategory(externalProduct.b2c_newMarketingCategory || externalProduct.b2c_type || ''),
          type: externalProduct.b2c_type || 'Spirits',
          age: extractAge(externalProduct.b2c_age),
          statedProof: proofNum,
          proof: proofNum,
          abv: proofNum / 2, // Calculate ABV from proof
          msrp: externalProduct.listPrice || 0,
          size: parseSize(externalProduct.b2c_size),
          description: cleanHTML(externalProduct.b2c_tastingNotes),
          region: externalProduct.b2c_region || '',
          country: externalProduct.b2c_country || 'United States',
          defaultImageUrl,
          imageUrls,
          
          // Add the UPC with high trust score
          upcCodes: [{
            code: barcode,
            submittedBy: new mongoose.Types.ObjectId(session.user.id),
            verifiedCount: 1000, // High trust for external data
            dateAdded: new Date(),
            isAdminAdded: true
          }],
          
          // Store original external data for reference
          externalData: {
            source: 'stock_data',
            externalId: externalProduct.repositoryId,
            importDate: new Date()
          }
        });

        // Find all user bottles for this newly created master bottle
        const userBottles = await UserBottle.find({
          userId: session.user.id,
          masterBottleId: masterBottle._id,
        }).populate('masterBottleId');

        return NextResponse.json({
          type: 'upc',
          masterBottle: masterBottle,
          userBottles: userBottles,
          fromExternal: true
        });
      }
    } catch (error) {
      console.error('Error checking external database:', error);
      // Continue with UPC API fallback if external DB fails
    }

    // Step 5: New UPC - Call API and find matches
    const upcData = await fetchFromUpcApi(barcode);
    
    if (!upcData || upcData.items.length === 0) {
      return NextResponse.json({
        type: 'not_found',
        message: 'No product found for this barcode',
      });
    }

    const upcItem = upcData.items[0];
    const searchName = upcItem.title || '';
    const searchBrand = upcItem.brand || '';

    // Find potential matches using fuzzy matching
    const allMasterBottles = await MasterBottle.find({}).limit(1000);
    
    const matches = allMasterBottles
      .map(bottle => {
        const nameMatch = calculateSimilarity(
          `${bottle.name} ${bottle.brand}`,
          `${searchName} ${searchBrand}`
        );
        const distilleryMatch = calculateSimilarity(
          bottle.distillery,
          searchBrand
        );
        const similarity = Math.max(nameMatch, distilleryMatch);
        
        return {
          bottle,
          similarity,
          nameMatch,
          distilleryMatch,
        };
      })
      .filter(match => match.similarity >= 0.7)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);

    return NextResponse.json({
      type: 'new_upc',
      upcInfo: upcItem,
      barcode: barcode,
      potentialMatches: matches.map(m => ({
        masterBottle: m.bottle,
        similarity: Math.round(m.similarity * 100),
        matchDetails: {
          name: Math.round(m.nameMatch * 100),
          distillery: Math.round(m.distilleryMatch * 100),
        },
      })),
    });

  } catch (error) {
    console.error('Error in UPC route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Add UPC to master bottle
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { masterBottleId, upcCode, isAdminAdded = false } = body;

    if (!masterBottleId || !upcCode) {
      return NextResponse.json(
        { error: 'Master bottle ID and UPC code are required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Check if UPC already exists on any bottle
    const existingUpc = await MasterBottle.findOne({
      'upcCodes.code': upcCode,
    });

    if (existingUpc) {
      return NextResponse.json(
        { 
          error: 'UPC already exists',
          existingBottle: existingUpc,
        },
        { status: 409 }
      );
    }

    // Add UPC to master bottle
    const updatedBottle = await MasterBottle.findByIdAndUpdate(
      masterBottleId,
      {
        $push: {
          upcCodes: {
            code: upcCode,
            submittedBy: new mongoose.Types.ObjectId(session.user.id),
            verifiedCount: isAdminAdded ? 100 : 1, // Admin-added UPCs are automatically verified
            dateAdded: new Date(),
            isAdminAdded: isAdminAdded,
          },
        },
      },
      { new: true }
    );

    if (!updatedBottle) {
      return NextResponse.json(
        { error: 'Master bottle not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      masterBottle: updatedBottle,
    });

  } catch (error) {
    console.error('Error adding UPC:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}