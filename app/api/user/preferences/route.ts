import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import UserPreferences from '@/models/UserPreferences';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    // Get user's preferences
    let preferences = await UserPreferences.findOne({ userId: session.user.id }).lean();

    // If no preferences exist, return defaults
    if (!preferences) {
      return NextResponse.json({
        preferences: {
          pourReminders: true,
          pourReminderDelay: 24,
          lowStockAlerts: true,
          lowStockThreshold: 25,
          achievements: true,
          weeklyInsights: true,
          weeklyInsightDay: 0,
          systemNotifications: true,
        }
      });
    }

    // MongoDB already uses camelCase, so no transformation needed
    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('Error in preferences API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { preferences } = body;

    if (!preferences) {
      return NextResponse.json({ error: 'Missing preferences' }, { status: 400 });
    }

    await dbConnect();
    
    // Upsert preferences
    const updatedPreferences = await UserPreferences.findOneAndUpdate(
      { userId: session.user.id },
      {
        ...preferences,
        userId: session.user.id,
        updatedAt: new Date()
      },
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    ).lean();

    if (!updatedPreferences) {
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
    }

    return NextResponse.json({ success: true, preferences: updatedPreferences });
  } catch (error) {
    console.error('Error in update preferences API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}