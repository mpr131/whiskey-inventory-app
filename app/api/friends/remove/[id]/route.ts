import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Friendship from '@/models/Friendship';

export async function DELETE(
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

    // Find the friendship
    const friendship = await Friendship.findById(friendshipId);
    
    if (!friendship) {
      return NextResponse.json({ error: 'Friendship not found' }, { status: 404 });
    }

    // Verify the current user is either requester or recipient
    const isRequester = friendship.requester.toString() === user._id.toString();
    const isRecipient = friendship.recipient.toString() === user._id.toString();
    
    if (!isRequester && !isRecipient) {
      return NextResponse.json({ error: 'Unauthorized to remove this friendship' }, { status: 403 });
    }

    // Handle different scenarios
    let message = '';
    
    if (friendship.status === 'pending') {
      if (isRequester) {
        message = 'Friend request cancelled';
      } else {
        message = 'Friend request rejected';
      }
    } else if (friendship.status === 'accepted') {
      message = 'Friend removed';
    }

    // Delete the friendship
    await Friendship.findByIdAndDelete(friendshipId);

    // TODO: Send notification to the other party

    return NextResponse.json({ message });
  } catch (error) {
    console.error('Remove friend error:', error);
    return NextResponse.json(
      { error: 'Failed to remove friend' },
      { status: 500 }
    );
  }
}