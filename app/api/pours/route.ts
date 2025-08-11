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

    // CRITICAL FIX: Update fill level BEFORE adding the pour to the array
    // This prevents double-counting the pour in the calculation
    console.log('=== FILL LEVEL UPDATE SEQUENCE ===');
    console.log('Current fill level before update:', bottle.fillLevel);
    console.log('Current pours in array:', bottle.pours.length);
    console.log('New pour amount to be added:', pour.amount, 'oz');
    
    // Store the current fill level for verification
    const currentFillLevel = bottle.fillLevel || 100;
    const bottleSize = 25.36; // 750ml in ounces
    const pourPercentage = (pour.amount / bottleSize) * 100;
    const expectedNewFillLevel = Math.max(0, currentFillLevel - pourPercentage);
    
    console.log('Expected calculation:');
    console.log(`  Current: ${currentFillLevel.toFixed(2)}%`);
    console.log(`  Pour: ${pour.amount}oz = ${pourPercentage.toFixed(2)}% of bottle`);
    console.log(`  Expected new: ${expectedNewFillLevel.toFixed(2)}%`);
    
    // Update fill level FIRST (before adding pour to array)
    console.log('Updating fill level with new pour method...');
    try {
      if (typeof bottle.updateFillLevelForNewPour !== 'function') {
        console.error('WARNING: updateFillLevelForNewPour not found, using legacy method');
        // Legacy approach: calculate manually
        const newLevel = Math.max(0, currentFillLevel - pourPercentage);
        bottle.adjustFillLevel(newLevel, 'pour', `Pour of ${pour.amount}oz`);
      } else {
        // Use the new method that handles the pour correctly
        bottle.updateFillLevelForNewPour(pour.amount);
      }
      console.log('Fill level updated successfully');
      console.log('New fill level after update:', bottle.fillLevel);
      
      // Verify the calculation is correct
      if (Math.abs((bottle.fillLevel || 0) - expectedNewFillLevel) > 0.1) {
        console.error('WARNING: Fill level calculation mismatch!');
        console.error(`  Expected: ${expectedNewFillLevel.toFixed(2)}%`);
        console.error(`  Actual: ${bottle.fillLevel}%`);
        console.error('fillLevelHistory:', JSON.stringify(bottle.fillLevelHistory, null, 2));
      } else {
        console.log('Fill level calculation verified - matches expected value');
      }
    } catch (updateError: any) {
      console.error('Fill level update error:', updateError);
      console.error('Stack:', updateError.stack);
      
      // Fallback: Simple calculation from current level
      console.log('Using simple fallback calculation...');
      bottle.fillLevel = Math.max(0, currentFillLevel - pourPercentage);
      console.log('Fallback fill level:', bottle.fillLevel);
    }
    
    // NOW add to legacy pours array for backward compatibility
    console.log('Adding pour to legacy array...');
    const pourData = {
      date: pour.date,
      amount: pour.amount,
      notes: pour.notes,
      rating: pour.rating,
    };
    bottle.pours.push(pourData);
    console.log('Pour added to array. New length:', bottle.pours.length);
    
    console.log('=== END FILL LEVEL UPDATE ===');

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