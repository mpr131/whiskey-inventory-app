import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import UserBottle from '@/models/UserBottle';
import PourSession from '@/models/PourSession';
import Pour from '@/models/Pour';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Prevent self-deletion
    if (params.id === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Check if user exists
    const user = await User.findById(params.id);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete all user data in order
    // 1. Delete user's pours
    await Pour.deleteMany({ userId: params.id });

    // 2. Delete user's pour sessions
    await PourSession.deleteMany({ userId: params.id });

    // 3. Delete user's bottles
    await UserBottle.deleteMany({ userId: params.id });

    // 4. Finally, delete the user
    await User.findByIdAndDelete(params.id);

    return NextResponse.json({
      success: true,
      message: 'User and all associated data deleted',
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}