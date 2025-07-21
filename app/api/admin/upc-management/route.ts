import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import MasterBottle from '@/models/MasterBottle';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // Get recent bottles with UPCs
    const recentBottles = await MasterBottle.find({
      'upcCodes.0': { $exists: true }
    })
      .sort({ 'upcCodes.dateAdded': -1 })
      .limit(10)
      .select('name brand distillery upcCodes');

    // Get user-submitted UPCs (not admin-added) for review
    const pendingSubmissions = await MasterBottle.aggregate([
      { $unwind: '$upcCodes' },
      { $match: { 'upcCodes.isAdminAdded': false } },
      { $sort: { 'upcCodes.dateAdded': -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: 'users',
          localField: 'upcCodes.submittedBy',
          foreignField: '_id',
          as: 'submitter'
        }
      },
      { $unwind: '$submitter' },
      {
        $project: {
          _id: 1,
          code: '$upcCodes.code',
          masterBottle: {
            _id: '$_id',
            name: '$name',
            brand: '$brand',
            distillery: '$distillery'
          },
          submittedBy: {
            _id: '$submitter._id',
            name: '$submitter.name',
            email: '$submitter.email'
          },
          dateAdded: '$upcCodes.dateAdded',
          verifiedCount: '$upcCodes.verifiedCount',
          isAdminAdded: '$upcCodes.isAdminAdded'
        }
      }
    ]);

    return NextResponse.json({
      recentBottles,
      pendingSubmissions
    });

  } catch (error) {
    console.error('Error fetching UPC data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { bottleId, upcCode } = body;

    if (!bottleId || !upcCode) {
      return NextResponse.json(
        { error: 'Bottle ID and UPC code are required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Remove UPC from bottle
    const result = await MasterBottle.findByIdAndUpdate(
      bottleId,
      {
        $pull: {
          upcCodes: { code: upcCode }
        }
      },
      { new: true }
    );

    if (!result) {
      return NextResponse.json(
        { error: 'Bottle not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'UPC removed successfully'
    });

  } catch (error) {
    console.error('Error removing UPC:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Merge duplicate bottles
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sourceBottleId, targetBottleId } = body;

    if (!sourceBottleId || !targetBottleId) {
      return NextResponse.json(
        { error: 'Source and target bottle IDs are required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Get both bottles
    const [sourceBottle, targetBottle] = await Promise.all([
      MasterBottle.findById(sourceBottleId),
      MasterBottle.findById(targetBottleId)
    ]);

    if (!sourceBottle || !targetBottle) {
      return NextResponse.json(
        { error: 'One or both bottles not found' },
        { status: 404 }
      );
    }

    // Merge UPC codes from source to target
    const existingUpcCodes = new Set(targetBottle.upcCodes?.map((upc: any) => upc.code) || []);
    const newUpcCodes = sourceBottle.upcCodes?.filter((upc: any) => !existingUpcCodes.has(upc.code)) || [];

    if (newUpcCodes.length > 0) {
      await MasterBottle.findByIdAndUpdate(
        targetBottleId,
        {
          $push: {
            upcCodes: { $each: newUpcCodes }
          }
        }
      );
    }

    // TODO: Update all UserBottles that reference sourceBottle to reference targetBottle
    // This would require updating the UserBottle collection

    return NextResponse.json({
      success: true,
      message: `Merged ${newUpcCodes.length} UPC codes`,
      mergedUpcCount: newUpcCodes.length
    });

  } catch (error) {
    console.error('Error merging bottles:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}