import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Pour from '@/models/Pour';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const searchParams = req.nextUrl.searchParams;
    const hours = parseInt(searchParams.get('hours') || '24');
    
    const sinceDate = new Date();
    sinceDate.setHours(sinceDate.getHours() - hours);

    // Get pours without sessions
    const orphanedPours = await Pour.find({
      userId: session.user.id,
      sessionId: { $exists: false },
      createdAt: { $gte: sinceDate }
    })
    .populate({
      path: 'userBottleId',
      populate: {
        path: 'masterBottleId',
        model: 'MasterBottle'
      }
    })
    .sort({ createdAt: -1 })
    .lean();

    // Calculate stats
    const totalAmount = orphanedPours.reduce((sum, pour) => sum + pour.amount, 0);
    const totalCost = orphanedPours.reduce((sum, pour) => sum + (pour.costPerPour || 0), 0);
    const ratedPours = orphanedPours.filter(pour => pour.rating !== undefined && pour.rating !== null);
    const avgRating = ratedPours.length > 0 
      ? ratedPours.reduce((sum, pour) => sum + pour.rating!, 0) / ratedPours.length 
      : undefined;

    return NextResponse.json({
      pours: orphanedPours,
      stats: {
        totalPours: orphanedPours.length,
        totalAmount: Math.round(totalAmount * 10) / 10,
        totalCost: Math.round(totalCost * 100) / 100,
        averageRating: avgRating ? Math.round(avgRating * 10) / 10 : undefined,
      }
    });

  } catch (error) {
    console.error('Error fetching orphaned pours:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}