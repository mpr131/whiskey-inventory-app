import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import UserBottle from '@/models/UserBottle';
import MasterBottle from '@/models/MasterBottle';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userBottleId, masterBottleId, isStorePick } = await request.json();
    
    if (!userBottleId || !masterBottleId) {
      return NextResponse.json(
        { error: 'User bottle ID and master bottle ID are required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Find the user bottle
    const userBottle = await UserBottle.findById(userBottleId);
    if (!userBottle) {
      return NextResponse.json({ error: 'User bottle not found' }, { status: 404 });
    }

    // Find the FWGS master bottle
    const masterBottle = await MasterBottle.findById(masterBottleId);
    if (!masterBottle) {
      return NextResponse.json({ error: 'Master bottle not found' }, { status: 404 });
    }

    // Update the user bottle with the master bottle reference
    userBottle.masterBottleId = masterBottle._id;
    
    // Add a note about the deduplication with store pick info
    const dedupeNote = isStorePick 
      ? `[Store Pick - Linked to FWGS base product: ${masterBottle.name}]`
      : `[Deduplicated with FWGS product: ${masterBottle.name}]`;
    userBottle.notes = userBottle.notes 
      ? `${userBottle.notes}\n\n${dedupeNote}`
      : dedupeNote;

    await userBottle.save();

    // Log the merge for tracking
    console.log(`Merged user bottle ${userBottleId} with FWGS master bottle ${masterBottleId}`);

    return NextResponse.json({
      success: true,
      userBottle: {
        _id: userBottle._id,
        masterBottleId: masterBottle._id,
        masterBottleName: masterBottle.name
      }
    });
  } catch (error) {
    console.error('Error merging bottles:', error);
    return NextResponse.json(
      { error: 'Failed to merge bottles' },
      { status: 500 }
    );
  }
}