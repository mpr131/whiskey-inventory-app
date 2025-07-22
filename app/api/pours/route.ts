import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Pour from '@/models/Pour';
import UserBottle from '@/models/UserBottle';
import PourSession from '@/models/PourSession';
import mongoose from 'mongoose';
import { createPourWithSession } from '@/lib/pour-session-manager';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const searchParams = req.nextUrl.searchParams;
    const userBottleId = searchParams.get('userBottleId');
    const sessionId = searchParams.get('sessionId');
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');

    let query: any = { userId: session.user.id };

    if (userBottleId) {
      query.userBottleId = userBottleId;
    }

    if (sessionId) {
      query.sessionId = sessionId;
    }

    const skip = (page - 1) * limit;

    const [pours, total] = await Promise.all([
      Pour.find(query)
        .populate({
          path: 'userBottleId',
          populate: {
            path: 'masterBottleId',
            model: 'MasterBottle'
          }
        })
        .sort('-date')
        .skip(skip)
        .limit(limit),
      Pour.countDocuments(query),
    ]);

    return NextResponse.json({
      pours,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching pours:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    
    await dbConnect();

    // Validate user owns the bottle
    const bottle = await UserBottle.findOne({
      _id: body.userBottleId,
      userId: session.user.id,
    });

    if (!bottle) {
      console.error('Bottle not found:', {
        userBottleId: body.userBottleId,
        userId: session.user.id,
      });
      
      // Check if bottle exists but belongs to different user
      const bottleExists = await UserBottle.findById(body.userBottleId);
      if (bottleExists) {
        console.error('Bottle exists but belongs to different user:', bottleExists.userId);
      }
      
      return NextResponse.json({ error: 'Bottle not found' }, { status: 404 });
    }

    // Create the pour with guaranteed session assignment
    const { pour, session: pourSession } = await createPourWithSession(
      {
        ...body,
        userId: session.user.id,
        userBottleId: body.userBottleId,
      },
      body.sessionId
    );

    // Update bottle fill level and stats
    if (bottle.status === 'unopened') {
      bottle.status = 'opened';
      bottle.openDate = new Date();
    }

    // Update fill level (assuming 750ml = 25.36 oz)
    const totalPoured = bottle.pours.reduce((sum: number, p: any) => sum + p.amount, 0) + body.amount;
    bottle.fillLevel = Math.max(0, 100 - (totalPoured / 25.36 * 100));

    // Add to legacy pours array for backward compatibility
    bottle.pours.push({
      date: pour.date,
      amount: pour.amount,
      notes: pour.notes,
      rating: pour.rating,
    });

    // Check if bottle is finished
    if (bottle.fillLevel <= 0) {
      bottle.status = 'finished';
    }

    await bottle.save();

    // Update bottle statistics
    await bottle.updatePourStats();

    // Session statistics are already updated in createPourWithSession

    // Note: Community ratings are now calculated nightly for better performance
    // Personal ratings are still calculated in real-time when viewing bottles

    // Return populated pour
    const populatedPour = await Pour.findById(pour._id)
      .populate({
        path: 'userBottleId',
        populate: {
          path: 'masterBottleId',
          model: 'MasterBottle'
        }
      })
      .populate('sessionId');

    return NextResponse.json({ pour: populatedPour }, { status: 201 });
  } catch (error) {
    console.error('Error creating pour:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}