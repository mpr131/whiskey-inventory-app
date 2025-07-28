import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import UserBottle from '@/models/UserBottle';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fillLevel, notes } = await req.json();

    if (fillLevel === undefined || fillLevel < 0 || fillLevel > 100) {
      return NextResponse.json({ error: 'Invalid fill level. Must be between 0 and 100.' }, { status: 400 });
    }

    await dbConnect();

    const bottle = await UserBottle.findOne({
      _id: params.id,
      userId: session.user.id,
    }).populate('masterBottleId');

    if (!bottle) {
      return NextResponse.json({ error: 'Bottle not found' }, { status: 404 });
    }

    if (bottle.status === 'unopened') {
      return NextResponse.json({ error: 'Cannot adjust fill level on unopened bottle' }, { status: 400 });
    }

    // Use the adjustFillLevel method to properly track the manual adjustment
    const previousLevel = bottle.fillLevel || 100;
    bottle.adjustFillLevel(fillLevel, 'manual', notes || `Manual adjustment from ${previousLevel.toFixed(2)}% to ${fillLevel.toFixed(2)}%`);

    // Update status if bottle is finished
    if (fillLevel <= 0) {
      bottle.status = 'finished';
    } else if (bottle.status === 'finished' && fillLevel > 0) {
      bottle.status = 'opened';
    }

    await bottle.save();

    return NextResponse.json({
      bottle,
      adjustment: {
        previousLevel,
        newLevel: fillLevel,
        date: new Date(),
        notes: notes || `Manual adjustment from ${previousLevel.toFixed(2)}% to ${fillLevel.toFixed(2)}%`
      }
    });
  } catch (error) {
    console.error('Error adjusting fill level:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const bottle = await UserBottle.findOne({
      _id: params.id,
      userId: session.user.id,
    }).populate('masterBottleId');

    if (!bottle) {
      return NextResponse.json({ error: 'Bottle not found' }, { status: 404 });
    }

    if (bottle.status === 'unopened') {
      return NextResponse.json({ error: 'Cannot recalculate fill level on unopened bottle' }, { status: 400 });
    }

    // Reset fill level to 100% and recalculate based on all pours
    const previousLevel = bottle.fillLevel || 100;
    bottle.fillLevel = 100;
    bottle.lastManualAdjustment = undefined;
    
    // Clear history and recalculate
    bottle.fillLevelHistory = [];
    bottle.updateFillLevel();
    
    // Add a note about the recalculation
    bottle.adjustFillLevel(bottle.fillLevel, 'recalculation', `Fill level recalculated from all pours. Previous level was ${previousLevel.toFixed(2)}%`);

    await bottle.save();

    return NextResponse.json({
      bottle,
      message: 'Fill level recalculated based on all pours',
      previousLevel,
      newLevel: bottle.fillLevel
    });
  } catch (error) {
    console.error('Error recalculating fill level:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}