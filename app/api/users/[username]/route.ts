import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import UserBottle from '@/models/UserBottle';
import Friendship from '@/models/Friendship';

export async function GET(
  request: Request,
  { params }: { params: { username: string } }
) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    const currentUser = session?.user?.email
      ? await User.findOne({ email: session.user.email })
      : null;

    // Find user by username
    const user = await User.findOne({ username: params.username.toLowerCase() });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if users are friends
    let isFriend = false;
    let friendshipStatus = null;
    
    if (currentUser && currentUser._id.toString() !== user._id.toString()) {
      const friendship = await Friendship.findOne({
        $or: [
          { requester: currentUser._id, recipient: user._id },
          { requester: user._id, recipient: currentUser._id },
        ],
      });
      
      if (friendship) {
        isFriend = friendship.status === 'accepted';
        friendshipStatus = friendship.status;
      }
    }

    const isOwnProfile = currentUser?._id.toString() === user._id.toString();

    // Build profile response based on privacy settings
    const profile: any = {
      _id: user._id,
      username: user.username,
      displayName: user.displayName || user.name,
      avatar: user.avatar,
      bio: user.bio,
      createdAt: user.createdAt,
      isOwnProfile,
      isFriend,
      friendshipStatus,
    };

    // Add stats if visible
    const canSeeStats =
      isOwnProfile ||
      (user.privacy?.showCollection === 'public') ||
      (user.privacy?.showCollection === 'friends' && isFriend);

    if (canSeeStats) {
      // Calculate real stats
      const bottleCount = await UserBottle.countDocuments({
        userId: user._id,
        quantity: { $gt: 0 },
      });

      const uniqueBottles = await UserBottle.distinct('masterBottleId', {
        userId: user._id,
        quantity: { $gt: 0 },
      });

      profile.stats = {
        bottleCount,
        uniqueBottles: uniqueBottles.length,
        totalPours: user.stats?.totalPours || 0,
        favoriteBrand: user.stats?.favoriteBrand,
      };
    }

    // Add privacy settings for own profile
    if (isOwnProfile) {
      profile.privacy = user.privacy;
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { error: 'Failed to get user profile' },
      { status: 500 }
    );
  }
}

// Update profile
export async function PUT(
  request: Request,
  { params }: { params: { username: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const currentUser = await User.findOne({ email: session.user.email });
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify user is updating their own profile
    if (currentUser.username !== params.username.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const updates = await request.json();
    
    // Allowed fields to update
    const allowedFields = [
      'displayName',
      'bio',
      'avatar',
      'privacy.showCollection',
      'privacy.showPours',
      'privacy.showRatings',
    ];

    // Build update object
    const updateObj: any = {};
    
    if (updates.displayName !== undefined) {
      updateObj.displayName = updates.displayName;
    }
    
    if (updates.bio !== undefined) {
      updateObj.bio = updates.bio;
    }
    
    if (updates.avatar !== undefined) {
      updateObj.avatar = updates.avatar;
    }
    
    if (updates.privacy) {
      if (updates.privacy.showCollection) {
        updateObj['privacy.showCollection'] = updates.privacy.showCollection;
      }
      if (updates.privacy.showPours) {
        updateObj['privacy.showPours'] = updates.privacy.showPours;
      }
      if (updates.privacy.showRatings) {
        updateObj['privacy.showRatings'] = updates.privacy.showRatings;
      }
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      currentUser._id,
      updateObj,
      { new: true, runValidators: true }
    );

    return NextResponse.json({
      message: 'Profile updated',
      profile: {
        username: updatedUser.username,
        displayName: updatedUser.displayName,
        bio: updatedUser.bio,
        avatar: updatedUser.avatar,
        privacy: updatedUser.privacy,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}