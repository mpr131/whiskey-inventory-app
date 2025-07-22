import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Friendship from '@/models/Friendship';
import Activity from '@/models/Activity';

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const filter = searchParams.get('filter'); // 'all' | 'pours' | 'ratings' | 'new_bottles'

    // Get user's friends
    const friendships = await Friendship.find({
      $and: [
        { status: 'accepted' },
        {
          $or: [
            { requester: user._id },
            { recipient: user._id },
          ],
        },
      ],
    });

    const friendIds = friendships.map(f => {
      const isRequester = f.requester.toString() === user._id.toString();
      return isRequester ? f.recipient.toString() : f.requester.toString();
    });

    // Build query
    let query: any = {
      $or: [
        // User's own activities
        { userId: user._id },
        // Friends' activities that are visible to friends
        {
          userId: { $in: friendIds },
          visibility: { $in: ['public', 'friends'] },
        },
      ],
    };

    // Apply filter if specified
    if (filter && filter !== 'all') {
      const typeMap: Record<string, string[]> = {
        pours: ['pour', 'live_pour_start', 'live_pour_end'],
        ratings: ['rating'],
        new_bottles: ['new_bottle'],
      };
      
      if (typeMap[filter]) {
        query.type = { $in: typeMap[filter] };
      }
    }

    // Get activities
    const activities = await Activity.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate('userId', 'name email username avatar displayName')
      .lean();

    // Get total count for pagination
    const totalCount = await Activity.countDocuments(query);

    // Check if current user has cheered each activity
    const activitiesWithUserStatus = activities.map(activity => ({
      ...activity,
      hasUserCheered: activity.metadata.cheersUsers?.includes(user._id.toString()),
      isOwnActivity: activity.userId._id.toString() === user._id.toString(),
    }));

    return NextResponse.json({
      activities: activitiesWithUserStatus,
      pagination: {
        offset,
        limit,
        total: totalCount,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    console.error('Get feed error:', error);
    return NextResponse.json(
      { error: 'Failed to get activity feed' },
      { status: 500 }
    );
  }
}