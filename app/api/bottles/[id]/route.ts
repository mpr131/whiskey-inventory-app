import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Bottle from '@/models/Bottle';
import Location from '@/models/Location';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const bottle = await Bottle.findOne({
      _id: params.id,
      owner: session.user.id,
    }).populate('location', 'name type bins');

    if (!bottle) {
      return NextResponse.json({ error: 'Bottle not found' }, { status: 404 });
    }

    return NextResponse.json({ bottle });
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
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    
    await dbConnect();

    const bottle = await Bottle.findOne({
      _id: params.id,
      owner: session.user.id,
    });

    if (!bottle) {
      return NextResponse.json({ error: 'Bottle not found' }, { status: 404 });
    }

    // Handle location change
    if (body.location && body.location !== bottle.location?.toString()) {
      // Verify new location
      const newLocation = await Location.findOne({
        _id: body.location,
        owner: session.user.id,
      });

      if (!newLocation) {
        return NextResponse.json({ error: 'Invalid location' }, { status: 400 });
      }

      // Update old location count
      if (bottle.location) {
        if (bottle.binNumber) {
          await Location.findOneAndUpdate(
            { _id: bottle.location, 'bins.number': bottle.binNumber },
            { $inc: { 'bins.$.currentCount': -1, currentCount: -1 } }
          );
        } else {
          await Location.findByIdAndUpdate(
            bottle.location,
            { $inc: { currentCount: -1 } }
          );
        }
      }

      // Update new location count
      if (body.binNumber) {
        await Location.findOneAndUpdate(
          { _id: body.location, 'bins.number': body.binNumber },
          { $inc: { 'bins.$.currentCount': 1, currentCount: 1 } }
        );
      } else {
        await Location.findByIdAndUpdate(
          body.location,
          { $inc: { currentCount: 1 } }
        );
      }
    }

    // Calculate ABV from proof if needed
    if (body.proof && !body.abv) {
      body.abv = body.proof / 2;
    }

    // Update bottle
    Object.assign(bottle, body);
    await bottle.save();

    const updatedBottle = await Bottle.findById(bottle._id).populate('location', 'name type');

    return NextResponse.json({ bottle: updatedBottle });
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
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const bottle = await Bottle.findOne({
      _id: params.id,
      owner: session.user.id,
    });

    if (!bottle) {
      return NextResponse.json({ error: 'Bottle not found' }, { status: 404 });
    }

    // Update location count
    if (bottle.location) {
      if (bottle.binNumber) {
        await Location.findOneAndUpdate(
          { _id: bottle.location, 'bins.number': bottle.binNumber },
          { $inc: { 'bins.$.currentCount': -1, currentCount: -1 } }
        );
      } else {
        await Location.findByIdAndUpdate(
          bottle.location,
          { $inc: { currentCount: -1 } }
        );
      }
    }

    await bottle.deleteOne();

    return NextResponse.json({ message: 'Bottle deleted successfully' });
  } catch (error) {
    console.error('Error deleting bottle:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}