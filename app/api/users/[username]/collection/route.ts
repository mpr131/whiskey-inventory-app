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

    // Check privacy settings
    const isOwnProfile = currentUser?._id.toString() === user._id.toString();
    
    let canViewCollection = false;
    let isFriend = false;
    
    if (isOwnProfile) {
      canViewCollection = true;
    } else if (user.privacy?.showCollection === 'public') {
      canViewCollection = true;
    } else if (user.privacy?.showCollection === 'friends' && currentUser) {
      // Check if they are friends
      const friendship = await Friendship.findOne({
        $and: [
          { status: 'accepted' },
          {
            $or: [
              { requester: currentUser._id, recipient: user._id },
              { requester: user._id, recipient: currentUser._id },
            ],
          },
        ],
      });
      
      if (friendship) {
        canViewCollection = true;
        isFriend = true;
      }
    }

    if (!canViewCollection) {
      return NextResponse.json(
        { error: 'This collection is private' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status'); // unopened, opened, finished
    const sort = searchParams.get('sort') || 'recent'; // recent, name, rating

    // Build query
    const query: any = {
      userId: user._id,
      quantity: { $gt: 0 },
    };

    if (status) {
      query.status = status;
    }

    // Build sort options
    let sortOptions: any = {};
    switch (sort) {
      case 'name':
        sortOptions = { 'masterBottle.name': 1 };
        break;
      case 'rating':
        sortOptions = { averageRating: -1 };
        break;
      case 'recent':
      default:
        sortOptions = { createdAt: -1 };
    }

    // Get bottles
    const bottles = await UserBottle.find(query)
      .populate('masterBottleId', 'name producer type category imageUrl')
      .sort(sortOptions)
      .skip(offset)
      .limit(limit)
      .select('-purchasePrice -marketValue -myValue'); // NEVER expose monetary values

    // Get total count
    const totalCount = await UserBottle.countDocuments(query);

    // Transform bottles to remove sensitive data
    const publicBottles = bottles.map(bottle => ({
      _id: bottle._id,
      masterBottle: bottle.masterBottleId,
      status: bottle.status,
      openDate: bottle.openDate,
      fillLevel: bottle.fillLevel,
      averageRating: bottle.averageRating,
      totalPours: bottle.totalPours,
      lastPourDate: bottle.lastPourDate,
      location: bottle.location,
      notes: bottle.notes,
      photos: bottle.photos,
      createdAt: bottle.createdAt,
    }));

    return NextResponse.json({
      bottles: publicBottles,
      pagination: {
        offset,
        limit,
        total: totalCount,
        hasMore: offset + limit < totalCount,
      },
      viewerStatus: {
        isOwnProfile,
        isFriend,
        canViewCollection,
      },
    });
  } catch (error) {
    console.error('Get collection error:', error);
    return NextResponse.json(
      { error: 'Failed to get collection' },
      { status: 500 }
    );
  }
}