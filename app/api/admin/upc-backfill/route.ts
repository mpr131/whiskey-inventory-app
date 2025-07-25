import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import MasterBottle from '@/models/MasterBottle';
import { connectToExternalDB } from '@/lib/external-db';
import { findMatches, getBackfillStats } from '@/lib/upc-matching';
import mongoose from 'mongoose';

// GET: Load bottles without UPCs and stats
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const externalDb = await connectToExternalDB();

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    // Get overall stats
    if (action === 'stats') {
      const stats = await getBackfillStats(externalDb);
      return NextResponse.json(stats);
    }

    // Debug: Check bottle counts
    if (action === 'debug') {
      const withoutUPC = await MasterBottle.find({
        'upcCodes.0': { $exists: false }
      }).limit(10).select('name brand upcCodes');
      
      const count = await MasterBottle.countDocuments({
        'upcCodes.0': { $exists: false }
      });
      
      return NextResponse.json({
        count,
        samples: withoutUPC,
        message: `Found ${count} bottles without UPCs`
      });
    }

    // Get next bottle without UPC
    if (action === 'next') {
      const skipIds = searchParams.get('skipIds')?.split(',').filter(Boolean) || [];
      const reviewedIds = searchParams.get('reviewedIds')?.split(',').filter(Boolean) || [];
      
      // Simple query - just check if first element exists
      const query: any = {
        'upcCodes.0': { $exists: false }
      };

      // Exclude already reviewed bottles in this session
      const allExcludedIds = Array.from(new Set([...skipIds, ...reviewedIds])).filter(Boolean);
      if (allExcludedIds.length > 0) {
        try {
          query._id = { $nin: allExcludedIds.map(id => new mongoose.Types.ObjectId(id)) };
          console.log(`Excluding ${allExcludedIds.length} bottles from query`);
        } catch (error) {
          console.error('Error creating ObjectIds for exclusion:', error);
        }
      }

      // Count total remaining
      const totalRemaining = await MasterBottle.countDocuments(query);
      console.log(`Bottles without UPC remaining: ${totalRemaining}`);

      const bottle = await MasterBottle.findOne(query)
        .sort({ communityRatingCount: -1, name: 1 }) // Prioritize popular bottles
        .lean();

      if (!bottle) {
        // Debug: check what's happening
        const debugInfo = {
          excludedCount: allExcludedIds.length,
          excludedIds: allExcludedIds,
          totalWithoutUPC: await MasterBottle.countDocuments({ 'upcCodes.0': { $exists: false } }),
          sampleWithoutUPC: await MasterBottle.find({ 'upcCodes.0': { $exists: false } })
            .limit(5)
            .select('name brand')
            .lean()
        };
        
        console.log('No bottle found. Debug info:', debugInfo);
        
        return NextResponse.json({ 
          message: 'No more bottles without UPCs',
          completed: true,
          totalRemaining: 0,
          debugInfo
        });
      }

      // Find matches for this bottle
      let matches: any[] = [];
      try {
        matches = await findMatches(bottle as any, externalDb);
      } catch (error) {
        console.error('Error finding matches:', error);
        // Continue even if matching fails
      }

      return NextResponse.json({
        bottle,
        matches,
        completed: false,
        totalRemaining
      });
    }

    // Get list of bottles without UPCs
    const page = parseInt(searchParams.get('page') || '1');
    const limit = 50;
    const skip = (page - 1) * limit;

    const bottles = await MasterBottle.find({
      $or: [
        { upcCodes: { $exists: false } },
        { upcCodes: { $size: 0 } }
      ]
    })
      .sort({ communityRatingCount: -1, name: 1 })
      .skip(skip)
      .limit(limit)
      .select('name brand distillery category proof')
      .lean();

    const total = await MasterBottle.countDocuments({
      $or: [
        { upcCodes: { $exists: false } },
        { upcCodes: { $size: 0 } }
      ]
    });

    return NextResponse.json({
      bottles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error in UPC backfill GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Approve a match
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('POST request body:', JSON.stringify(body, null, 2));
    
    const { masterBottleId, externalProduct } = body;

    console.log(`Approving UPC for bottle ${masterBottleId}`);
    console.log(`External product UPC field: "${externalProduct.b2c_upc}"`);
    console.log(`External product name: ${externalProduct.displayName}`);

    if (!masterBottleId || !externalProduct || !externalProduct.b2c_upc) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Check if UPC already exists on another bottle
    const existingUpc = await MasterBottle.findOne({
      'upcCodes.code': externalProduct.b2c_upc
    });

    if (existingUpc) {
      return NextResponse.json(
        { 
          error: 'UPC already exists on another bottle',
          existingBottle: existingUpc
        },
        { status: 409 }
      );
    }

    // First get the bottle to check if it has region/country
    const existingBottle = await MasterBottle.findById(masterBottleId);
    
    if (!existingBottle) {
      return NextResponse.json(
        { error: 'Master bottle not found' },
        { status: 404 }
      );
    }

    // Parse multiple UPCs if present (space-separated)
    const upcCodes: string[] = [];
    if (externalProduct.b2c_upc) {
      // Split by space and filter valid UPCs (12+ digits)
      const codes = externalProduct.b2c_upc
        .split(/\s+/)
        .filter((upc: string) => upc.trim().length >= 12 && /^\d+$/.test(upc.trim()));
      
      // IMPORTANT: Take only the first UPC to avoid adding multiple at once
      // This prevents the issue where all UPCs get added when user clicks one match
      if (codes.length > 0) {
        upcCodes.push(codes[0]);
        console.log(`Found ${codes.length} UPC codes, using first one: ${codes[0]}`);
        if (codes.length > 1) {
          console.log(`Note: Additional UPCs found but not added: ${codes.slice(1).join(', ')}`);
        }
      }
    }

    if (upcCodes.length === 0) {
      return NextResponse.json(
        { error: 'No valid UPC codes found' },
        { status: 400 }
      );
    }

    // Add each UPC to master bottle
    const updateData: any = {
      $addToSet: {
        upcCodes: {
          $each: upcCodes.map(code => ({
            code: code.trim(),
            submittedBy: new mongoose.Types.ObjectId(session.user.id),
            verifiedCount: 1000, // High trust for admin-approved backfill
            dateAdded: new Date(),
            isAdminAdded: true
          }))
        }
      }
    };

    // Also update any missing fields from external data
    const setData: any = {};
    if (externalProduct.primaryLargeImageURL && 
        externalProduct.primaryLargeImageURL !== '/img/no-image.jpg' && 
        !existingBottle.defaultImageUrl) {
      setData.defaultImageUrl = `https://www.finewineandgoodspirits.com${externalProduct.primaryLargeImageURL}`;
    }
    if (externalProduct.b2c_region && !existingBottle.region) {
      setData.region = externalProduct.b2c_region;
    }
    if (externalProduct.b2c_country && !existingBottle.country) {
      setData.country = externalProduct.b2c_country;
    }

    if (Object.keys(setData).length > 0) {
      updateData.$set = setData;
    }

    const updatedBottle = await MasterBottle.findByIdAndUpdate(
      masterBottleId,
      updateData,
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
      updatedBottle,
      message: `UPC ${upcCodes[0]} added successfully`,
      addedCodes: upcCodes
    });

  } catch (error) {
    console.error('Error approving match:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT: Mark as reviewed (skip or no match)
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { masterBottleId, action } = await request.json();

    if (!masterBottleId || !['skip', 'no_match'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    await dbConnect();

    // For now, we'll just log this action
    // In the future, you might want to track which bottles have been reviewed
    console.log(`Bottle ${masterBottleId} marked as ${action} by ${session.user.email}`);

    // Could add a field to track reviewed bottles:
    // await MasterBottle.findByIdAndUpdate(masterBottleId, {
    //   $set: { 
    //     upcBackfillReviewed: true,
    //     upcBackfillReviewedBy: session.user.id,
    //     upcBackfillReviewedAt: new Date(),
    //     upcBackfillResult: action
    //   }
    // });

    return NextResponse.json({
      success: true,
      message: `Bottle marked as ${action}`
    });

  } catch (error) {
    console.error('Error marking bottle:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}