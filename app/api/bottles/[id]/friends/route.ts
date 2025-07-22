import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import UserBottle from '@/models/UserBottle';
import Friendship from '@/models/Friendship';
import MasterBottle from '@/models/MasterBottle';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    const masterBottleId = params.id;

    // Verify master bottle exists
    const masterBottle = await MasterBottle.findById(masterBottleId);
    if (!masterBottle) {
      return NextResponse.json({ error: 'Bottle not found' }, { status: 404 });
    }

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
      return isRequester ? f.recipient : f.requester;
    });

    // Get friend details
    const friends = await User.find({
      _id: { $in: friendIds },
    }).select('name email username avatar displayName privacy');

    // Check which friends own this bottle (respecting privacy)
    const friendsWithBottle = [];
    
    for (const friend of friends) {
      // Check if we can see their collection
      const canSeeCollection = 
        friend.privacy?.showCollection === 'public' ||
        friend.privacy?.showCollection === 'friends';
      
      if (canSeeCollection) {
        const bottle = await UserBottle.findOne({
          userId: friend._id,
          masterBottleId: masterBottleId,
          quantity: { $gt: 0 },
        }).select('status averageRating totalPours lastPourDate fillLevel');
        
        if (bottle) {
          friendsWithBottle.push({
            friend: {
              _id: friend._id,
              name: friend.name,
              username: friend.username,
              displayName: friend.displayName,
              avatar: friend.avatar,
            },
            bottle: {
              status: bottle.status,
              averageRating: bottle.averageRating,
              totalPours: bottle.totalPours,
              lastPourDate: bottle.lastPourDate,
              fillLevel: bottle.fillLevel,
            },
          });
        }
      }
    }

    // Sort by most recent pour
    friendsWithBottle.sort((a, b) => {
      const dateA = a.bottle.lastPourDate || new Date(0);
      const dateB = b.bottle.lastPourDate || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });

    return NextResponse.json({
      masterBottle: {
        _id: masterBottle._id,
        name: masterBottle.name,
        producer: masterBottle.producer,
      },
      friendsWithBottle,
      totalFriendsWithBottle: friendsWithBottle.length,
    });
  } catch (error) {
    console.error('Get friends with bottle error:', error);
    return NextResponse.json(
      { error: 'Failed to get friends with bottle' },
      { status: 500 }
    );
  }
}