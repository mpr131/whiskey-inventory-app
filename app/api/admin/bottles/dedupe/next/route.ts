import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import UserBottle from '@/models/UserBottle';
import MasterBottle from '@/models/MasterBottle';

export async function GET() {
  return handleRequest();
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}

async function handleRequest(request?: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // Get skipped bottles from request body if provided
    let skippedBottles: string[] = [];
    if (request) {
      try {
        const body = await request.json();
        skippedBottles = body.skippedBottles || [];
      } catch (e) {
        // Ignore parse errors
      }
    }

    // First, get all user bottles and check which ones need processing
    const userBottles = await UserBottle.find({
      userId: session.user.id
    })
    .populate({
      path: 'masterBottleId',
      select: 'name producer category subcategory proof statedProof size externalData'
    })
    .sort({ createdAt: 1 });

    // Find the first bottle that either:
    // 1. Has no masterBottleId
    // 2. Has a masterBottleId but it's not from FWGS
    // 3. Is not in the skipped list
    const nextBottle = userBottles.find(bottle => {
      // Skip if in skipped list
      if (skippedBottles.includes((bottle._id as any).toString())) {
        return false;
      }
      
      if (!bottle.masterBottleId) return true;
      
      const masterBottle = bottle.masterBottleId as any;
      return !masterBottle.externalData?.source || masterBottle.externalData.source !== 'fwgs';
    });

    if (!nextBottle) {
      return NextResponse.json({ error: 'No more bottles to process' }, { status: 404 });
    }

    // Get stats - count bottles that need processing
    const totalCount = userBottles.length;
    
    const processedCount = userBottles.filter(bottle => {
      // Count as processed if:
      // 1. Has FWGS master bottle
      // 2. Is in skipped list
      if (skippedBottles.includes((bottle._id as any).toString())) {
        return true;
      }
      
      if (!bottle.masterBottleId) return false;
      
      const masterBottle = bottle.masterBottleId as any;
      return masterBottle.externalData?.source === 'fwgs';
    }).length;

    // Convert to plain object to access any additional fields
    const bottleObj = nextBottle.toObject() as any;
    const masterBottle = bottleObj.masterBottleId;
    
    return NextResponse.json({
      bottle: {
        _id: bottleObj._id,
        name: masterBottle?.name || 'Unknown Bottle',
        producer: masterBottle?.producer,
        category: masterBottle?.category,
        subcategory: masterBottle?.subcategory,
        purchaseDate: bottleObj.purchaseDate,
        purchasePrice: bottleObj.purchasePrice,
        purchaseLocation: bottleObj.purchaseLocation || bottleObj.storeName,
        status: bottleObj.status,
        notes: bottleObj.notes,
        location: bottleObj.location?.area ? `${bottleObj.location.area} - ${bottleObj.location.bin || ''}` : undefined,
        masterBottleId: bottleObj.masterBottleId?._id || bottleObj.masterBottleId
      },
      stats: {
        total: totalCount,
        processed: processedCount,
        remaining: totalCount - processedCount
      }
    });
  } catch (error) {
    console.error('Error getting next bottle:', error);
    return NextResponse.json(
      { error: 'Failed to get next bottle' },
      { status: 500 }
    );
  }
}