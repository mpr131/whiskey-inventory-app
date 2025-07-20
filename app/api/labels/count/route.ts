import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import UserBottle from '@/models/UserBottle';
import User from '@/models/User';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // Get user's last print session date
    const user = await User.findById(session.user.id);
    const lastPrintSessionDate = user?.lastPrintSessionDate;

    // Count bottles that need labels (new since last print session and without existing barcode)
    let query: any = { userId: session.user.id };
    
    if (lastPrintSessionDate) {
      query.createdAt = { $gte: lastPrintSessionDate };
    }
    
    // Exclude bottles with existing CellarTracker labels
    query.barcode = { $exists: false };

    const count = await UserBottle.countDocuments(query);

    return NextResponse.json({ count });
  } catch (error) {
    console.error('Error getting label count:', error);
    return NextResponse.json(
      { error: 'Failed to get label count' },
      { status: 500 }
    );
  }
}