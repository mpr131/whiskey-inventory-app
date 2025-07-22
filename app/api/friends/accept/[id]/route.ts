import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Friendship from '@/models/Friendship';

export async function PUT(
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

    const friendshipId = params.id;

    // Find the friendship request
    const friendship = await Friendship.findById(friendshipId);
    
    if (!friendship) {
      return NextResponse.json({ error: 'Friend request not found' }, { status: 404 });
    }

    // Verify the current user is the recipient
    if (friendship.recipient.toString() !== user._id.toString()) {
      return NextResponse.json({ error: 'Unauthorized to accept this request' }, { status: 403 });
    }

    // Check if already accepted
    if (friendship.status === 'accepted') {
      return NextResponse.json({ error: 'Friend request already accepted' }, { status: 400 });
    }

    if (friendship.status === 'blocked') {
      return NextResponse.json({ error: 'Cannot accept blocked request' }, { status: 400 });
    }

    // Accept the friend request
    friendship.status = 'accepted';
    friendship.acceptedAt = new Date();
    await friendship.save();

    // Create notification for requester
    try {
      const Notification = await import('@/models/Notification').then(m => m.default);
      await Notification.create({
        userId: friendship.requester,
        type: 'friend_request_accepted',
        priority: 'medium',
        title: 'Friend Request Accepted',
        message: `${user.name} accepted your friend request`,
        data: {
          accepterId: user._id,
          accepterName: user.name,
          friendshipId: friendship._id,
        },
        actionUrl: `/profile/${user.username || user._id}`,
        read: false,
      });
    } catch (notifError) {
      console.error('Failed to create notification:', notifError);
      // Don't fail the request if notification fails
    }

    // Populate requester details for response
    await friendship.populate('requester', 'name email username avatar');

    return NextResponse.json({
      message: 'Friend request accepted',
      friendship: {
        _id: friendship._id,
        requester: friendship.requester,
        status: friendship.status,
        acceptedAt: friendship.acceptedAt,
      },
    });
  } catch (error) {
    console.error('Accept friend request error:', error);
    return NextResponse.json(
      { error: 'Failed to accept friend request' },
      { status: 500 }
    );
  }
}