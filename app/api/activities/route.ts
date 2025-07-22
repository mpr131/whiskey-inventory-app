import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Activity from '@/models/Activity';
import MasterBottle from '@/models/MasterBottle';
import UserBottle from '@/models/UserBottle';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { type, targetId, metadata, visibility } = await request.json();

    // Validate activity type
    const validTypes = ['pour', 'rating', 'new_bottle', 'achievement', 'live_pour_start', 'live_pour_end'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid activity type' }, { status: 400 });
    }

    // Build activity data
    const activityData: any = {
      userId: user._id,
      type,
      targetId,
      visibility: visibility || user.privacy?.showPours || 'friends',
      metadata: metadata || {},
    };

    // Enhance metadata based on type
    if (type === 'pour' || type === 'rating' || type === 'new_bottle') {
      // Get bottle details
      const userBottle = await UserBottle.findById(targetId).populate('masterBottleId');
      if (userBottle && userBottle.masterBottleId && typeof userBottle.masterBottleId === 'object') {
        activityData.metadata.bottleName = (userBottle.masterBottleId as any).name;
        activityData.metadata.bottleImage = (userBottle.masterBottleId as any).imageUrl;
      }
    }

    // Create the activity
    const activity = await Activity.create(activityData);

    // Populate user details for response
    await activity.populate('userId', 'name email username avatar displayName');

    return NextResponse.json({
      message: 'Activity created',
      activity,
    });
  } catch (error) {
    console.error('Create activity error:', error);
    return NextResponse.json(
      { error: 'Failed to create activity' },
      { status: 500 }
    );
  }
}