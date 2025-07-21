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

    // Get all users with bottle counts
    const users = await User.find({})
      .select('name email createdAt lastLogin isAdmin')
      .sort({ createdAt: -1 })
      .lean();

    // Get bottle counts
    const bottleCounts = await UserBottle.aggregate([
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]);

    const bottleCountMap = new Map(
      bottleCounts.map(bc => [bc._id.toString(), bc.count])
    );

    // Create CSV content
    const csvRows = [
      // Header row
      ['Name', 'Email', 'Join Date', 'Last Login', 'Bottle Count', 'Admin Status'].join(','),
    ];

    // Data rows
    users.forEach((user: any) => {
      const bottleCount = bottleCountMap.get(user._id.toString()) || 0;
      const row = [
        `"${user.name}"`,
        `"${user.email}"`,
        new Date(user.createdAt).toISOString().split('T')[0],
        user.lastLogin ? new Date(user.lastLogin).toISOString().split('T')[0] : 'Never',
        bottleCount.toString(),
        user.isAdmin ? 'Yes' : 'No',
      ].join(',');
      csvRows.push(row);
    });

    const csvContent = csvRows.join('\n');

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="users-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });

  } catch (error) {
    console.error('Error exporting users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}