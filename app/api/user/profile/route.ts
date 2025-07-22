import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const user = await User.findOne({ email: session.user.email })
      .select('username displayName bio avatar privacy stats');

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      username: user.username,
      displayName: user.displayName || user.name,
      bio: user.bio,
      avatar: user.avatar,
      privacy: user.privacy || {
        showCollection: 'friends',
        showPours: 'friends',
        showRatings: 'friends',
        showValue: 'never'
      },
      stats: user.stats,
      hasUsername: !!user.username
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { error: 'Failed to get profile' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
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

    const updates = await request.json();
    
    // Validate username if provided
    if (updates.username) {
      // Check if username is already taken
      const existingUser = await User.findOne({ 
        username: updates.username.toLowerCase(),
        _id: { $ne: user._id }
      });

      if (existingUser) {
        return NextResponse.json(
          { error: 'Username already taken' },
          { status: 400 }
        );
      }

      user.username = updates.username.toLowerCase();
    }

    // Update other profile fields
    if (updates.displayName !== undefined) user.displayName = updates.displayName;
    if (updates.bio !== undefined) user.bio = updates.bio;
    if (updates.avatar !== undefined) user.avatar = updates.avatar;
    
    // Update privacy settings
    if (updates.privacy) {
      user.privacy = {
        ...user.privacy,
        ...updates.privacy,
        showValue: 'never' // Always enforce this
      };
    }

    await user.save();

    return NextResponse.json({
      message: 'Profile updated',
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatar: user.avatar,
      privacy: user.privacy
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}