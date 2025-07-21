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

    // Calculate date ranges
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Get all stats in parallel
    const [
      totalUsers,
      activeUsers,
      totalBottles,
      newUsersThisMonth,
    ] = await Promise.all([
      // Total users
      User.countDocuments({}),
      
      // Active users (logged in last 30 days)
      User.countDocuments({
        lastLogin: { $gte: thirtyDaysAgo }
      }),
      
      // Total bottles across all users
      UserBottle.countDocuments({}),
      
      // New users this month
      User.countDocuments({
        createdAt: { $gte: startOfMonth }
      }),
    ]);

    return NextResponse.json({
      totalUsers,
      activeUsers,
      totalBottles,
      newUsersThisMonth,
    });

  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}