import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Pour from '@/models/Pour';
import UserBottle from '@/models/UserBottle';
import PourSession from '@/models/PourSession';
import Activity from '@/models/Activity';
import LivePour from '@/models/LivePour';
import MasterBottle from '@/models/MasterBottle';
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
  console.log('=== POUR API CALLED ===');
  console.log('Timestamp:', new Date().toISOString());
  
  try {
    console.log('Getting session...');
    const session = await getServerSession(authOptions);
    console.log('Session obtained:', { userId: session?.user?.id, userEmail: session?.user?.email });
    
    if (!session?.user?.id) {
      console.log('No session found - returning 401');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Parsing request body...');
    const body = await req.json();
    console.log('Request body:', JSON.stringify(body, null, 2));
    
    console.log('Connecting to database...');
    await dbConnect();
    console.log('Database connected');

    // Validate user owns the bottle
    console.log('Looking for bottle:', { userBottleId: body.userBottleId, userId: session.user.id });
    const bottle = await UserBottle.findOne({
      _id: body.userBottleId,
      userId: session.user.id,
    });
    console.log('Bottle query completed');

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
    
    console.log('Bottle found:', {
      _id: bottle._id,
      status: bottle.status,
      fillLevel: bottle.fillLevel,
      hasPours: !!bottle.pours,
      poursLength: bottle.pours?.length,
      hasFillLevelHistory: !!bottle.fillLevelHistory,
      fillLevelHistoryLength: bottle.fillLevelHistory?.length,
      hasUpdateFillLevel: typeof bottle.updateFillLevel === 'function',
      hasAdjustFillLevel: typeof bottle.adjustFillLevel === 'function'
    });

    // Create the pour with guaranteed session assignment
    console.log('Creating pour with session...');
    let pour, pourSession;
    try {
      const result = await createPourWithSession(
        {
          ...body,
          userId: session.user.id,
          userBottleId: body.userBottleId,
          companionTags: body.companionTags,
        },
        body.sessionId
      );
      pour = result.pour;
      pourSession = result.session;
      console.log('Pour created successfully:', { pourId: pour._id, sessionId: pourSession._id });
    } catch (pourError: any) {
      console.error('Error creating pour:', pourError);
      console.error('Pour creation stack:', pourError.stack);
      throw pourError;
    }

    // Check if bottle is opened
    console.log('Checking bottle status:', bottle.status);
    if (bottle.status !== 'opened') {
      console.log('Bottle not opened - returning error');
      return NextResponse.json({ 
        error: 'Bottle must be opened before pouring. Please open the bottle first.' 
      }, { status: 400 });
    }

    // Ensure fillLevelHistory exists
    console.log('Checking fillLevelHistory...');
    if (!bottle.fillLevelHistory) {
      console.log('fillLevelHistory not found - initializing empty array');
      bottle.fillLevelHistory = [];
    } else {
      console.log('fillLevelHistory exists with', bottle.fillLevelHistory.length, 'entries');
    }

    // Ensure bottle.pours is an array
    console.log('Checking pours array...');
    if (!bottle.pours || !Array.isArray(bottle.pours)) {
      console.log('pours not found or not array - initializing empty array');
      bottle.pours = [];
    } else {
      console.log('pours array exists with', bottle.pours.length, 'entries');
    }

    // Add to legacy pours array for backward compatibility
    console.log('Adding pour to legacy array...');
    const pourData = {
      date: pour.date,
      amount: pour.amount,
      notes: pour.notes,
      rating: pour.rating,
    };
    console.log('Pour data to add:', pourData);
    bottle.pours.push(pourData);
    console.log('Pour added to array. New length:', bottle.pours.length);

    // Update fill level with error handling
    console.log('Updating fill level...');
    console.log('Current fill level before update:', bottle.fillLevel);
    try {
      console.log('Calling bottle.updateFillLevel()...');
      if (typeof bottle.updateFillLevel !== 'function') {
        console.error('ERROR: updateFillLevel is not a function!');
        console.log('bottle methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(bottle)));
        throw new Error('updateFillLevel method not found on bottle');
      }
      bottle.updateFillLevel();
      console.log('updateFillLevel completed successfully');
      console.log('New fill level after update:', bottle.fillLevel);
    } catch (updateError: any) {
      console.error('updateFillLevel error:', updateError);
      console.error('Stack:', updateError.stack);
      
      // Fallback calculation if updateFillLevel fails
      console.log('Using fallback calculation...');
      const totalPoured = bottle.pours.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      console.log('Total poured:', totalPoured, 'oz');
      bottle.fillLevel = Math.max(0, 100 - (totalPoured / 25.36 * 100));
      
      console.log('Used fallback fill level calculation:', bottle.fillLevel);
    }

    // Check if bottle is finished
    console.log('Checking if bottle is finished...');
    if (bottle.fillLevel !== undefined && bottle.fillLevel <= 0) {
      console.log('Bottle is finished - updating status');
      bottle.status = 'finished';
    }

    console.log('Saving bottle...');
    try {
      await bottle.save();
      console.log('Bottle saved successfully');
    } catch (saveError: any) {
      console.error('Error saving bottle:', saveError);
      console.error('Save error stack:', saveError.stack);
      throw saveError;
    }

    // Update bottle statistics
    console.log('Updating bottle statistics...');
    try {
      if (typeof bottle.updatePourStats !== 'function') {
        console.error('WARNING: updatePourStats is not a function!');
      } else {
        await bottle.updatePourStats();
        console.log('Bottle statistics updated');
      }
    } catch (statsError: any) {
      console.error('Error updating bottle stats:', statsError);
      console.error('Stats error stack:', statsError.stack);
      // Don't fail the pour for stats error
    }

    // Session statistics are already updated in createPourWithSession

    // Note: Community ratings are now calculated nightly for better performance
    // Personal ratings are still calculated in real-time when viewing bottles

    // Return populated pour
    console.log('Populating pour data...');
    const populatedPour = await Pour.findById(pour._id)
      .populate({
        path: 'userBottleId',
        populate: {
          path: 'masterBottleId',
          model: 'MasterBottle'
        }
      })
      .populate('sessionId');
    console.log('Pour populated successfully');

    // Create activity for the pour
    try {
      const masterBottle = await MasterBottle.findById(bottle.masterBottleId);
      
      if (masterBottle) {
        await Activity.create({
          userId: session.user.id,
          type: 'pour',
          targetId: pour._id,
          metadata: {
            bottleName: masterBottle.name,
            bottleImage: masterBottle.imageUrl,
            pourAmount: pour.amount,
            location: pour.location,
            rating: pour.rating,
            sessionId: pour.sessionId,
          },
        });

        // Handle live pour if this is the start
        if (body.isLivePour) {
          // Start live pour
          await fetch(`${process.env.NEXTAUTH_URL}/api/feed/live`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bottleId: masterBottle._id,
              bottleName: masterBottle.name,
              bottleImage: masterBottle.imageUrl,
              location: pour.location,
              sessionId: pour.sessionId,
            }),
          });
        }
      }
    } catch (activityError) {
      console.error('Error creating activity:', activityError);
      // Don't fail the pour creation if activity fails
    }

    console.log('=== POUR API SUCCESS ===');
    console.log('Returning pour:', { pourId: populatedPour._id });
    return NextResponse.json({ pour: populatedPour }, { status: 201 });
  } catch (error: any) {
    console.error('=== POUR API ERROR ===');
    console.error('Error type:', typeof error);
    console.error('Error name:', error?.name);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    console.error('Full error object:', JSON.stringify(error, null, 2));
    
    return NextResponse.json(
      { 
        error: 'Failed to log pour', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}