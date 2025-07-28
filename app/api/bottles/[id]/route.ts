import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import UserBottle from '@/models/UserBottle';
import MasterBottle from '@/models/MasterBottle';
import UserStore from '@/models/UserStore';
import MasterStore from '@/models/MasterStore';
import mongoose from 'mongoose';
import { findOrCreateStore } from '@/utils/storeHelpers';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    const searchParams = req.nextUrl.searchParams;
    const view = searchParams.get('view'); // 'master' for master bottle view

    if (view === 'master') {
      // Return all user bottles for this master bottle
      const userBottles = await UserBottle.find({
        masterBottleId: params.id,
        userId: session.user.id,
      })
        .populate('masterBottleId')
        .populate({
          path: 'storeId',
          populate: {
            path: 'masterStoreId',
            model: 'MasterStore'
          }
        })
        .sort('createdAt');
      
      if (userBottles.length === 0) {
        return NextResponse.json({ error: 'No bottles found' }, { status: 404 });
      }
      
      // Group by location for easier scanning
      const locationGroups = new Map<string, any[]>();
      const masterBottle = userBottles[0].masterBottleId;
      
      for (const bottle of userBottles) {
        const locationKey = bottle.location?.area || 'No Location';
        if (!locationGroups.has(locationKey)) {
          locationGroups.set(locationKey, []);
        }
        locationGroups.get(locationKey)!.push(bottle);
      }
      
      const groupedBottles = Array.from(locationGroups.entries()).map(([location, bottles]) => ({
        location,
        bottles: bottles.sort((a, b) => (a.location?.bin || '').localeCompare(b.location?.bin || ''))
      }));
      
      return NextResponse.json({
        masterBottle,
        userBottles,
        groupedBottles,
        totalCount: userBottles.length,
        openedCount: userBottles.filter(b => b.status === 'opened').length,
        unopenedCount: userBottles.filter(b => b.status === 'unopened').length,
        finishedCount: userBottles.filter(b => b.status === 'finished').length,
      });
    } else {
      // Return individual bottle
      const bottle = await UserBottle.findOne({
        _id: params.id,
        userId: session.user.id,
      })
        .populate('masterBottleId')
        .populate({
          path: 'storeId',
          populate: {
            path: 'masterStoreId',
            model: 'MasterStore'
          }
        });

      if (!bottle) {
        return NextResponse.json({ error: 'Bottle not found' }, { status: 404 });
      }
      

      return NextResponse.json(bottle);
    }
  } catch (error) {
    console.error('Error fetching bottle:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    
    await dbConnect();

    const bottle = await UserBottle.findOne({
      _id: params.id,
      userId: session.user.id,
    });

    if (!bottle) {
      return NextResponse.json({ error: 'Bottle not found' }, { status: 404 });
    }

    // Handle purchase location (store) with case-insensitive matching
    if (body.purchaseLocation !== undefined) {
      if (body.purchaseLocation) {
        const storeResult = await findOrCreateStore(body.purchaseLocation, session.user.id);
        body.storeId = storeResult.userStoreId;
      } else {
        body.storeId = null;
      }
      delete body.purchaseLocation;
    }

    // Handle master bottle updates if provided
    if (body.masterBottleUpdate) {
      const { masterBottleUpdate } = body;
      delete body.masterBottleUpdate;
      
      await MasterBottle.findByIdAndUpdate(
        bottle.masterBottleId,
        {
          isStorePick: masterBottleUpdate.isStorePick,
          storePickDetails: masterBottleUpdate.storePickDetails,
        }
      );
    }

    // Handle fill level updates separately to track in history
    if (body.fillLevel !== undefined && body.fillLevel !== bottle.fillLevel) {
      const previousLevel = bottle.fillLevel || 100;
      bottle.adjustFillLevel(
        body.fillLevel, 
        'manual', 
        body.fillLevelNote || `Fill level adjusted from ${previousLevel.toFixed(2)}% to ${body.fillLevel.toFixed(2)}%`
      );
      delete body.fillLevel;
      delete body.fillLevelNote;
    }

    // Update bottle with new data
    Object.assign(bottle, body);
    await bottle.save();

    const updatedBottle = await UserBottle.findById(bottle._id)
      .populate('masterBottleId')
      .populate({
        path: 'storeId',
        populate: {
          path: 'masterStoreId',
          model: 'MasterStore'
        }
      });

    return NextResponse.json(updatedBottle);
  } catch (error) {
    console.error('Error updating bottle:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
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
    });

    if (!bottle) {
      return NextResponse.json({ error: 'Bottle not found' }, { status: 404 });
    }

    await bottle.deleteOne();

    return NextResponse.json({ message: 'Bottle deleted successfully' });
  } catch (error) {
    console.error('Error deleting bottle:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}