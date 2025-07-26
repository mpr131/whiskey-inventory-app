import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import UserBottle from '@/models/UserBottle';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userBottleId } = await request.json();
    
    if (!userBottleId) {
      return NextResponse.json(
        { error: 'User bottle ID is required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Find the user bottle with populated master bottle
    const userBottle = await UserBottle.findById(userBottleId)
      .populate('masterBottleId');
    
    if (!userBottle) {
      return NextResponse.json({ error: 'User bottle not found' }, { status: 404 });
    }

    // Get the current master bottle data if it exists
    const currentMaster = userBottle.masterBottleId as any;

    // Create a new manual master bottle for this user bottle
    // This preserves the user's data but marks it as processed
    const manualMasterBottle = await MasterBottle.create({
      name: currentMaster?.name || 'Unknown Bottle',
      producer: currentMaster?.producer,
      category: currentMaster?.category,
      subcategory: currentMaster?.subcategory,
      proof: currentMaster?.proof || currentMaster?.statedProof,
      size: currentMaster?.size || '750 ml',
      externalData: {
        source: 'manual',
        addedBy: session.user.id,
        originalUserBottleId: userBottle._id,
        noFwgsMatch: true,
        dateAdded: new Date()
      },
      isActive: true
    });

    // Update the user bottle to reference this manual master bottle
    userBottle.masterBottleId = manualMasterBottle._id;
    
    // Add a note about no match found
    const noMatchNote = '[No FWGS match found - created manual entry]';
    userBottle.notes = userBottle.notes 
      ? `${userBottle.notes}\n\n${noMatchNote}`
      : noMatchNote;

    await userBottle.save();

    console.log(`Created manual master bottle for user bottle ${userBottleId} - no FWGS match found`);

    return NextResponse.json({
      success: true,
      userBottle: {
        _id: userBottle._id,
        masterBottleId: manualMasterBottle._id
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

// Import MasterBottle model at the top
import MasterBottle from '@/models/MasterBottle';