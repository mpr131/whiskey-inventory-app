import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import MasterBottle from '@/models/MasterBottle';
import UserBottle, { type IUserBottle } from '@/models/UserBottle';
import { connectToExternalDB } from '@/lib/external-db';
import { 
  mapCategory, 
  extractAge, 
  cleanHTML, 
  parseSize,
  type ExternalProduct 
} from '@/lib/external-product-helpers';
import mongoose from 'mongoose';

// Detect barcode type
function detectBarcodeType(barcode: string): 'vault' | 'cellartracker' | 'upc' | 'mongodb_id' {
  // Vault barcodes: WV002-000464 format (PREFIX-SEQUENCE)
  if (/^[A-Z]{2,3}\d{3}-\d{6}$/.test(barcode)) {
    return 'vault';
  }
  
  // MongoDB ObjectID partial (last 6-8 hex characters)
  if (/^[a-fA-F0-9]{6,8}$/.test(barcode)) {
    return 'mongodb_id';
  }
  
  // CellarTracker barcodes are typically 7-8 digits
  if (/^\d{7,8}$/.test(barcode)) {
    return 'cellartracker';
  }
  
  // Everything else is likely a UPC
  return 'upc';
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { barcode } = await request.json();
    
    if (!barcode) {
      return NextResponse.json({ error: 'Barcode is required' }, { status: 400 });
    }

    await dbConnect();

    // Determine barcode type
    const barcodeType = detectBarcodeType(barcode);
    console.log(`Scanning barcode: ${barcode} (Type: ${barcodeType})`);

    // Step 1: Check USER'S bottles first (highest priority)
    // Build comprehensive query to check ALL barcode fields
    const cleanedBarcode = barcode.replace(/^0+/, ''); // Remove leading zeros for UPC comparison
    const paddedBarcode = barcode.padStart(12, '0'); // Pad with zeros for full UPC
    
    const userBottleQuery: any = {
      userId: session.user.id,
      $or: [
        // Exact matches on all barcode fields
        { vaultBarcode: barcode },
        { barcode: barcode },
        { wineBarcode: barcode },
        { cellarTrackerId: barcode },
        // Handle UPCs with/without leading zeros
        { barcode: cleanedBarcode },
        { barcode: paddedBarcode },
        { wineBarcode: cleanedBarcode },
        { wineBarcode: paddedBarcode }
      ]
    };

    const userBottle = await UserBottle.findOne(userBottleQuery).populate('masterBottleId');

    if (userBottle) {
      // Determine which field matched
      let bottleType = 'Unknown';
      if (userBottle.vaultBarcode === barcode) {
        bottleType = 'Vault Barcode';
      } else if (userBottle.barcode === barcode || userBottle.barcode === cleanedBarcode || userBottle.barcode === paddedBarcode) {
        bottleType = 'Product UPC';
      } else if (userBottle.wineBarcode === barcode || userBottle.wineBarcode === cleanedBarcode || userBottle.wineBarcode === paddedBarcode) {
        bottleType = 'Wine Barcode';
      } else if (userBottle.cellarTrackerId === barcode) {
        bottleType = 'CellarTracker ID';
      }
      
      return NextResponse.json({
        type: 'user_bottle',
        userBottle,
        message: `Found in your collection (${bottleType})`,
        barcodeType,
        matchedField: bottleType
      });
    }

    // For product UPCs, check if user has any bottles of this product
    if (barcodeType === 'upc') {
      // First find the master bottle by UPC
      const masterByUPC = await MasterBottle.findOne({
        'upcCodes.code': { 
          $in: [barcode, barcode.padStart(12, '0'), barcode.replace(/^0+/, '')] 
        }
      });

      if (masterByUPC) {
        const userBottlesOfMaster = await UserBottle.find({
          userId: session.user.id,
          masterBottleId: masterByUPC._id
        }).populate('masterBottleId');

        if (userBottlesOfMaster.length > 0) {
          return NextResponse.json({
            type: 'user_bottle',
            userBottle: userBottlesOfMaster[0],
            userBottleCount: userBottlesOfMaster.length,
            message: `You have ${userBottlesOfMaster.length} bottle${userBottlesOfMaster.length !== 1 ? 's' : ''} of this product`,
            barcodeType: 'upc'
          });
        }
      }
    }

    // Step 2: Check Master bottles (including UPCs with/without leading zeros)
    const masterBottle = await MasterBottle.findOne({
      'upcCodes.code': { 
        $in: [barcode, barcode.padStart(12, '0'), barcode.replace(/^0+/, '')] 
      }
    });

    if (masterBottle) {
      // Check if user already has bottles of this master
      const userBottlesOfMaster = await UserBottle.find({
        userId: session.user.id,
        masterBottleId: masterBottle._id
      });

      return NextResponse.json({
        type: 'master_bottle',
        masterBottle,
        userHasBottles: userBottlesOfMaster.length > 0,
        userBottleCount: userBottlesOfMaster.length,
        message: 'Found in database'
      });
    }

    // Step 3: Check external database (now using all_products with 77k+ items)
    try {
      const externalDb = await connectToExternalDB();
      
      // Search with multiple UPC formats
      const externalProduct = await externalDb
        .collection<ExternalProduct>('all_products')
        .findOne({ 
          $or: [
            { 'b2c_upc': barcode },
            { 'b2c_upc': { $regex: `\\b${barcode}\\b` } }, // Match barcode as a word boundary
            { 'b2c_upc': barcode.padStart(12, '0') },
            { 'b2c_upc': barcode.replace(/^0+/, '') }
          ]
        });
      
      if (externalProduct) {
        // Handle proof properly
        const proofNum = parseFloat(externalProduct.b2c_proof || '0') || 0;
        
        // Collect image URLs
        const imageUrls: string[] = [];
        let defaultImageUrl: string | undefined;
        
        if (externalProduct.primaryLargeImageURL && externalProduct.primaryLargeImageURL !== '/img/no-image.jpg') {
          defaultImageUrl = `https://www.finewineandgoodspirits.com${externalProduct.primaryLargeImageURL}`;
          
          ['primaryLargeImageURL', 'primaryMediumImageURL', 'primarySmallImageURL'].forEach(field => {
            const url = externalProduct[field as keyof ExternalProduct] as string;
            if (url && url !== '/img/no-image.jpg') {
              imageUrls.push(`https://www.finewineandgoodspirits.com${url}`);
            }
          });
        }

        // Return external product data for preview
        return NextResponse.json({
          type: 'external_product',
          externalProduct: {
            name: externalProduct.displayName || 'Unknown',
            brand: externalProduct.brand || '',
            distillery: externalProduct.brand || '',
            category: mapCategory(externalProduct.b2c_newMarketingCategory || externalProduct.b2c_type || ''),
            type: externalProduct.b2c_type || 'Spirits',
            age: extractAge(externalProduct.b2c_age),
            statedProof: proofNum,
            proof: proofNum,
            abv: proofNum / 2,
            msrp: externalProduct.listPrice || 0,
            size: parseSize(externalProduct.b2c_size),
            description: cleanHTML(externalProduct.b2c_tastingNotes),
            region: externalProduct.b2c_region || '',
            country: externalProduct.b2c_country || 'United States',
            defaultImageUrl,
            imageUrls,
            barcode
          },
          message: 'New bottle found in external database'
        });
      }
    } catch (error) {
      console.error('Error checking external database:', error);
    }

    // Step 4: Not found anywhere
    return NextResponse.json({
      type: 'not_found',
      barcode,
      message: 'Barcode not found'
    });

  } catch (error) {
    console.error('Error in smart scan:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Create master bottle and add to user's collection
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { externalProduct, masterBottleId } = await request.json();
    
    await dbConnect();

    let masterBottle;

    // If creating from external product
    if (externalProduct) {
      masterBottle = await MasterBottle.create({
        ...externalProduct,
        upcCodes: [{
          code: externalProduct.barcode,
          submittedBy: new mongoose.Types.ObjectId(session.user.id),
          verifiedCount: 1000,
          dateAdded: new Date(),
          isAdminAdded: true
        }],
        externalData: {
          source: 'stock_data',
          externalId: externalProduct.barcode,
          importDate: new Date()
        },
        createdBy: new mongoose.Types.ObjectId(session.user.id)
      });
    } else if (masterBottleId) {
      // Just adding existing master bottle to collection
      masterBottle = await MasterBottle.findById(masterBottleId);
      if (!masterBottle) {
        return NextResponse.json({ error: 'Master bottle not found' }, { status: 404 });
      }
    } else {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Create user bottle
    const userBottle = await UserBottle.create({
      userId: session.user.id,
      masterBottleId: masterBottle._id,
      name: masterBottle.name,
      brand: masterBottle.brand,
      distillery: masterBottle.distillery,
      category: masterBottle.category,
      type: masterBottle.type,
      status: 'Sealed',
      location: 'Collection',
      addedMethod: 'barcode_scan',
      customFields: {},
      photos: []
    });

    return NextResponse.json({
      success: true,
      userBottle,
      masterBottle
    });

  } catch (error) {
    console.error('Error creating bottle:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}