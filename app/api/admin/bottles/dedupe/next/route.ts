import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import MasterBottle from '@/models/MasterBottle';
import UserBottle from '@/models/UserBottle';

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

    // Get skipped master bottles from request body if provided
    let skippedMasterBottles: string[] = [];
    if (request) {
      try {
        const body = await request.json();
        skippedMasterBottles = body.skippedBottles || [];
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Query MasterBottles with source 'user' or 'manual' (the original 276)
    // Exclude bottles that have already been merged or marked as no match
    const masterBottlesQuery = {
      'externalData.source': { $in: ['user', 'manual'] },
      'externalData.mergedTo': { $exists: false },
      'externalData.noFwgsMatch': { $ne: true },
      _id: { $nin: skippedMasterBottles }
    };

    // Get next unprocessed master bottle
    const nextMasterBottle = await MasterBottle.findOne(masterBottlesQuery)
      .sort({ createdAt: 1 });

    if (!nextMasterBottle) {
      return NextResponse.json({ error: 'No more bottles to process' }, { status: 404 });
    }

    // Get total counts for stats
    const totalCount = await MasterBottle.countDocuments({
      'externalData.source': { $in: ['user', 'manual'] }
    });
    
    // Count processed bottles (merged or marked as no match)
    const processedCount = await MasterBottle.countDocuments({
      'externalData.source': { $in: ['user', 'manual'] },
      $or: [
        { 'externalData.mergedTo': { $exists: true } },
        { 'externalData.noFwgsMatch': true }
      ]
    });
    
    const remainingCount = totalCount - processedCount - skippedMasterBottles.length;

    // Count how many UserBottles will benefit from this match
    const userBottleCount = await UserBottle.countDocuments({
      masterBottleId: nextMasterBottle._id
    });
    
    return NextResponse.json({
      bottle: {
        _id: nextMasterBottle._id,
        name: nextMasterBottle.name,
        producer: nextMasterBottle.producer,
        brand: nextMasterBottle.brand,
        category: nextMasterBottle.category,
        subcategory: nextMasterBottle.subcategory,
        proof: nextMasterBottle.proof,
        statedProof: nextMasterBottle.statedProof,
        size: nextMasterBottle.size,
        externalData: nextMasterBottle.externalData,
        userBottleCount: userBottleCount,
        isMasterBottle: true
      },
      stats: {
        total: totalCount,
        processed: processedCount,
        remaining: remainingCount
      }
    });
  } catch (error) {
    console.error('Error getting next master bottle:', error);
    return NextResponse.json(
      { error: 'Failed to get next bottle' },
      { status: 500 }
    );
  }
}