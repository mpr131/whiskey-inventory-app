import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import MasterBottle from '@/models/MasterBottle';
import UserBottle from '@/models/UserBottle';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { masterBottleId } = await request.json();
    
    if (!masterBottleId) {
      return NextResponse.json(
        { error: 'Master bottle ID is required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Find the master bottle
    const masterBottle = await MasterBottle.findById(masterBottleId);
    
    if (!masterBottle) {
      return NextResponse.json({ error: 'Master bottle not found' }, { status: 404 });
    }

    // Mark this master bottle as having no FWGS match
    masterBottle.externalData = masterBottle.externalData || {};
    masterBottle.externalData.noFwgsMatch = true;
    masterBottle.externalData.noMatchMarkedAt = new Date();
    masterBottle.externalData.markedBy = session.user.id;

    await masterBottle.save();

    // Update all UserBottles that reference this master bottle with a note
    const updateResult = await UserBottle.updateMany(
      { masterBottleId: masterBottle._id },
      { 
        $push: { 
          notes: '[No FWGS match found - keeping original entry]'
        }
      }
    );

    console.log(`Marked master bottle ${masterBottleId} as no FWGS match found`);
    console.log(`Updated ${updateResult.modifiedCount} user bottles with note`);

    return NextResponse.json({
      success: true,
      masterBottle: {
        _id: masterBottle._id,
        name: masterBottle.name,
        userBottlesUpdated: updateResult.modifiedCount
      }
    });
  } catch (error) {
    console.error('Error marking no match:', error);
    return NextResponse.json(
      { error: 'Failed to process no match' },
      { status: 500 }
    );
  }
}