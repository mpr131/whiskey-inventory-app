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

    // Get sent friend requests (where user is requester)
    const sentRequests = await Friendship.find({
      requester: user._id,
      status: 'pending',
    }).populate('recipient', 'name email username avatar displayName');

    // Get received friend requests (where user is recipient)
    const receivedRequests = await Friendship.find({
      recipient: user._id,
      status: 'pending',
    }).populate('requester', 'name email username avatar displayName');

    // Transform the data
    const sent = sentRequests.map(req => ({
      _id: req._id,
      user: {
        _id: req.recipient._id,
        name: req.recipient.name,
        email: req.recipient.email,
        username: req.recipient.username,
        avatar: req.recipient.avatar,
        displayName: req.recipient.displayName,
      },
      createdAt: req.createdAt,
    }));

    const received = receivedRequests.map(req => ({
      _id: req._id,
      user: {
        _id: req.requester._id,
        name: req.requester.name,
        email: req.requester.email,
        username: req.requester.username,
        avatar: req.requester.avatar,
        displayName: req.requester.displayName,
      },
      createdAt: req.createdAt,
    }));

    return NextResponse.json({
      sent,
      received,
      counts: {
        sent: sent.length,
        received: received.length,
      },
    });
  } catch (error) {
    console.error('Get pending requests error:', error);
    return NextResponse.json(
      { error: 'Failed to get pending friend requests' },
      { status: 500 }
    );
  }
}