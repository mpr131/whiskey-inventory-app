import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Friendship from '@/models/Friendship';

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

    const { recipientId, recipientEmail, recipientUsername } = await request.json();

    // Find recipient by ID, email, or username
    let recipient;
    if (recipientId) {
      recipient = await User.findById(recipientId);
    } else if (recipientEmail) {
      recipient = await User.findOne({ email: recipientEmail.toLowerCase() });
    } else if (recipientUsername) {
      recipient = await User.findOne({ username: recipientUsername.toLowerCase() });
    }

    if (!recipient) {
      return NextResponse.json({ 
        error: 'No user found with that email or username',
        code: 'USER_NOT_FOUND'
      }, { status: 404 });
    }
    
    // Check if recipient has username
    if (!recipient.username) {
      return NextResponse.json({ 
        error: 'User found but hasn\'t set up their profile yet',
        code: 'USER_NO_USERNAME',
        recipientName: recipient.name
      }, { status: 400 });
    }

    // Can't friend yourself
    if (recipient._id.toString() === user._id.toString()) {
      return NextResponse.json({ error: 'Cannot send friend request to yourself' }, { status: 400 });
    }

    // Check if friendship already exists
    const existingFriendship = await Friendship.findOne({
      $or: [
        { requester: user._id, recipient: recipient._id },
        { requester: recipient._id, recipient: user._id },
      ],
    });

    if (existingFriendship) {
      if (existingFriendship.status === 'pending') {
        return NextResponse.json({ error: 'Friend request already pending' }, { status: 400 });
      } else if (existingFriendship.status === 'accepted') {
        return NextResponse.json({ error: 'Already friends' }, { status: 400 });
      } else if (existingFriendship.status === 'blocked') {
        return NextResponse.json({ error: 'Cannot send friend request' }, { status: 400 });
      }
    }

    // Create friend request
    const friendship = await Friendship.create({
      requester: user._id,
      recipient: recipient._id,
      status: 'pending',
    });

    // Create notification for recipient
    try {
      const Notification = await import('@/models/Notification').then(m => m.default);
      await Notification.create({
        userId: recipient._id,
        type: 'friend_request',
        priority: 'medium',
        title: 'New Friend Request',
        message: `${user.name} sent you a friend request`,
        data: {
          requesterId: user._id,
          requesterName: user.name,
          friendshipId: friendship._id,
        },
        actionUrl: '/friends',
        read: false,
      });
    } catch (notifError) {
      console.error('Failed to create notification:', notifError);
      // Don't fail the request if notification fails
    }

    return NextResponse.json({
      message: 'Friend request sent',
      friendship: {
        _id: friendship._id,
        recipient: {
          _id: recipient._id,
          name: recipient.name,
          email: recipient.email,
          username: recipient.username,
        },
        status: friendship.status,
        createdAt: friendship.createdAt,
      },
    });
  } catch (error) {
    console.error('Friend request error:', error);
    return NextResponse.json(
      { error: 'Failed to send friend request' },
      { status: 500 }
    );
  }
}