import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Bottle from '@/models/Bottle';
import Location from '@/models/Location';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get('search');
    const type = searchParams.get('type');
    const isOpen = searchParams.get('isOpen');
    const sort = searchParams.get('sort') || '-createdAt';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const query: any = { owner: session.user.id };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { distillery: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    if (type) {
      query.type = type;
    }

    if (isOpen !== null) {
      query.isOpen = isOpen === 'true';
    }

    const skip = (page - 1) * limit;

    const [bottles, total] = await Promise.all([
      Bottle.find(query)
        .populate('location', 'name type')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Bottle.countDocuments(query),
    ]);

    return NextResponse.json({
      bottles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching bottles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    
    await dbConnect();

    // Verify location exists and belongs to user
    if (body.location) {
      const location = await Location.findOne({
        _id: body.location,
        owner: session.user.id,
      });

      if (!location) {
        return NextResponse.json({ error: 'Invalid location' }, { status: 400 });
      }

      // Check if location has space
      if (!location.hasSpace()) {
        return NextResponse.json({ error: 'Location is at capacity' }, { status: 400 });
      }
    }

    // Calculate ABV from proof
    if (body.proof && !body.abv) {
      body.abv = body.proof / 2;
    }

    const bottle = await Bottle.create({
      ...body,
      owner: session.user.id,
    });

    // Update location count if specified
    if (body.location && body.binNumber) {
      await Location.findOneAndUpdate(
        { _id: body.location, 'bins.number': body.binNumber },
        { $inc: { 'bins.$.currentCount': 1, currentCount: 1 } }
      );
    } else if (body.location) {
      await Location.findByIdAndUpdate(
        body.location,
        { $inc: { currentCount: 1 } }
      );
    }

    const populatedBottle = await Bottle.findById(bottle._id).populate('location', 'name type');

    return NextResponse.json({ bottle: populatedBottle }, { status: 201 });
  } catch (error) {
    console.error('Error creating bottle:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}