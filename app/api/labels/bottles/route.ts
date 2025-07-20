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

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'new';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Get user's last print session date
    const user = await User.findById(session.user.id);
    const lastPrintSessionDate = user?.lastPrintSessionDate;

    let query: any = { userId: session.user.id };

    switch (filter) {
      case 'new':
        // Bottles added since last print session
        if (lastPrintSessionDate) {
          query.createdAt = { $gte: lastPrintSessionDate };
        }
        // Exclude bottles with existing CellarTracker labels
        query.barcode = { $exists: false };
        break;

      case 'never':
        // Bottles that have never been printed
        query.lastLabelPrintedAt = { $exists: false };
        query.barcode = { $exists: false };
        break;

      case 'missing':
        // Bottles without any labels
        query.$and = [
          { $or: [{ barcode: { $exists: false } }, { barcode: '' }] },
          { $or: [{ vaultBarcode: { $exists: false } }, { vaultBarcode: '' }] }
        ];
        break;

      case 'dateRange':
        // Custom date range
        if (startDate && endDate) {
          query.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          };
        }
        break;

      case 'all':
        // All bottles
        break;
    }

    const bottles = await UserBottle.find(query)
      .populate('masterBottleId')
      .sort({ createdAt: -1 });

    return NextResponse.json({
      bottles,
      lastPrintSessionDate,
      count: bottles.length,
    });
  } catch (error) {
    console.error('Error fetching bottles for labels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bottles' },
      { status: 500 }
    );
  }
}

// Update last print session date
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const { bottleIds } = await req.json();

    if (!Array.isArray(bottleIds) || bottleIds.length === 0) {
      return NextResponse.json({ error: 'Invalid bottle IDs' }, { status: 400 });
    }

    // Update lastLabelPrintedAt for selected bottles
    await UserBottle.updateMany(
      {
        _id: { $in: bottleIds },
        userId: session.user.id,
      },
      {
        lastLabelPrintedAt: new Date(),
      }
    );

    // Update user's last print session date
    await User.findByIdAndUpdate(session.user.id, {
      lastPrintSessionDate: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating print session:', error);
    return NextResponse.json(
      { error: 'Failed to update print session' },
      { status: 500 }
    );
  }
}