import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import UserBottle from '@/models/UserBottle';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const adminFilter = searchParams.get('adminFilter') || 'all';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const skip = (page - 1) * limit;

    // Build query
    let query: any = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (adminFilter === 'admin') {
      query.isAdmin = true;
    } else if (adminFilter === 'user') {
      query.isAdmin = { $ne: true };
    }

    // Get total count for pagination
    const totalUsers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / limit);

    // Build sort
    const sortOptions: any = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get users
    const users = await User.find(query)
      .select('name email createdAt lastLogin isAdmin')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean();

    // Get bottle counts for each user
    const userIds = users.map(u => u._id);
    const bottleCounts = await UserBottle.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]);

    const bottleCountMap = new Map(
      bottleCounts.map(bc => [bc._id.toString(), bc.count])
    );

    // Combine user data with bottle counts
    const usersWithCounts = users.map((user: any) => ({
      ...user,
      bottleCount: bottleCountMap.get(user._id.toString()) || 0,
    }));

    // Sort by bottle count if needed (since it's calculated after query)
    if (sortBy === 'bottleCount') {
      usersWithCounts.sort((a, b) => {
        if (sortOrder === 'asc') {
          return a.bottleCount - b.bottleCount;
        }
        return b.bottleCount - a.bottleCount;
      });
    }

    return NextResponse.json({
      users: usersWithCounts,
      totalPages,
      currentPage: page,
      totalUsers,
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}