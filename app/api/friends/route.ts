import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Friendship from '@/models/Friendship';

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

    // Get all accepted friendships
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
    }).populate('requester recipient', 'name email username avatar displayName bio stats');

    // Transform to get friend details
    const friends = friendships.map(friendship => {
      const isRequester = friendship.requester._id.toString() === user._id.toString();
      const friend = isRequester ? friendship.recipient : friendship.requester;
      
      return {
        friendshipId: friendship._id,
        friendId: friend._id,
        name: friend.name,
        email: friend.email,
        username: friend.username,
        displayName: friend.displayName,
        avatar: friend.avatar,
        bio: friend.bio,
        stats: friend.stats,
        friendsSince: friendship.acceptedAt || friendship.createdAt,
      };
    });

    return NextResponse.json({
      friends,
      count: friends.length,
    });
  } catch (error) {
    console.error('Get friends error:', error);
    return NextResponse.json(
      { error: 'Failed to get friends' },
      { status: 500 }
    );
  }
}