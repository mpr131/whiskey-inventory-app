import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Friendship from '@/models/Friendship';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '10');
    
    if (!query || query.length < 1) {
      return NextResponse.json({ friends: [] });
    }

    await dbConnect();

    // Get all accepted friendships for the user
    const friendships = await Friendship.find({
      $and: [
        { status: 'accepted' },
        {
          $or: [
            { requester: session.user.id },
            { recipient: session.user.id },
          ],
        },
      ],
    });

    // Extract friend IDs
    const friendIds = friendships.map(friendship => {
      const requesterId = friendship.requester.toString();
      const recipientId = friendship.recipient.toString();
      return requesterId === session.user.id ? recipientId : requesterId;
    });

    // Search friends by name or username
    const friends = await User.find({
      _id: { $in: friendIds },
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { displayName: { $regex: query, $options: 'i' } },
        { username: { $regex: query, $options: 'i' } },
      ],
    })
      .select('_id name displayName username avatar')
      .limit(limit)
      .sort('name');

    // Also get recent companions from pour sessions for suggestions
    const PourSession = mongoose.model('PourSession');
    const recentSessions = await PourSession.find({
      userId: session.user.id,
      companions: { $exists: true, $ne: [] },
    })
      .sort('-date')
      .limit(10)
      .select('companions');

    // Extract unique companion names that aren't already friends
    const recentCompanions = new Set<string>();
    recentSessions.forEach(session => {
      session.companions?.forEach((companion: string) => {
        if (companion.toLowerCase().includes(query.toLowerCase())) {
          recentCompanions.add(companion);
        }
      });
    });

    // Get pour stats for each friend
    const friendsWithStats = await Promise.all(
      friends.map(async (friend) => {
        const stats = await PourSession.aggregate([
          {
            $match: {
              userId: new mongoose.Types.ObjectId(session.user.id),
              'companionTags.friendId': friend._id,
            },
          },
          {
            $group: {
              _id: null,
              sessionCount: { $sum: 1 },
            },
          },
        ]);
        
        return {
          id: friend._id,
          name: friend.displayName || friend.name,
          username: friend.username,
          avatar: friend.avatar,
          type: 'friend' as const,
          pourCount: stats[0]?.sessionCount || 0,
        };
      })
    );

    return NextResponse.json({
      friends: friendsWithStats,
      recentCompanions: Array.from(recentCompanions).slice(0, 5),
    });
    
  } catch (error) {
    console.error('Error searching friends:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}