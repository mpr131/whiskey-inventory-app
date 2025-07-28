import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import UserBottle from '@/models/UserBottle';
import mongoose from 'mongoose';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    // Validate bottle ID
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid bottle ID' }, { status: 400 });
    }

    const { fillLevel, reason, notes } = await request.json();

    // Validate fill level
    if (typeof fillLevel !== 'number' || fillLevel < 0 || fillLevel > 100) {
      return NextResponse.json({ error: 'Invalid fill level' }, { status: 400 });
    }

    // Validate reason
    const validReasons = ['evaporation', 'shared', 'correction', 'other'];
    if (!reason || !validReasons.includes(reason)) {
      return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });
    }

    // Find and validate bottle ownership
    const bottle = await UserBottle.findOne({
      _id: params.id,
      userId: new mongoose.Types.ObjectId(session.user.id),
    });

    if (!bottle) {
      return NextResponse.json({ error: 'Bottle not found' }, { status: 404 });
    }

    // Only allow adjustments on opened bottles
    if (bottle.status !== 'opened') {
      return NextResponse.json({ error: 'Can only adjust fill level for opened bottles' }, { status: 400 });
    }

    // Calculate change before updating
    const previousFillLevel = bottle.fillLevel || 100;
    const change = fillLevel - previousFillLevel;

    // Create adjustment note
    const timestamp = new Date().toLocaleString();
    const reasonMap: Record<string, string> = {
      evaporation: "Evaporation (Angel's Share)",
      shared: "Shared off-site",
      correction: "Correction",
      other: "Other"
    };
    const reasonText = reasonMap[reason] || reason;

    const adjustmentNote = `[${timestamp}] Fill level adjusted from ${previousFillLevel}% to ${fillLevel}% - ${reasonText}${notes ? ` - ${notes}` : ''}`;
    
    // Add to notes
    bottle.notes = bottle.notes 
      ? `${bottle.notes}\n${adjustmentNote}` 
      : adjustmentNote;

    // Use the new adjustFillLevel method to properly track the manual adjustment
    bottle.adjustFillLevel(fillLevel, 'manual', `${reasonText}${notes ? ` - ${notes}` : ''}`);

    await bottle.save();

    // Return updated bottle
    const updatedBottle = await UserBottle.findById(bottle._id)
      .populate('masterBottleId')
      .populate({
        path: 'storeId',
        populate: {
          path: 'masterStoreId',
          model: 'MasterStore',
        },
      });

    return NextResponse.json({
      message: 'Fill level updated successfully',
      bottle: updatedBottle,
    });

  } catch (error: any) {
    console.error('Fill level update error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update fill level' },
      { status: 500 }
    );
  }
}