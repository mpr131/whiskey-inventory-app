import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import PourSession from '@/models/PourSession';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');

    const query = { userId: session.user.id };
    const skip = (page - 1) * limit;

    // Get sessions with their pours populated
    const [sessions, total] = await Promise.all([
      PourSession.find(query)
        .sort('-date')
        .skip(skip)
        .limit(limit),
      PourSession.countDocuments(query),
    ]);

    // Also get orphaned pours (pours without sessions) from the last 24 hours
    const Pour = mongoose.model('Pour');
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    
    const orphanedPours = await Pour.find({
      userId: session.user.id,
      sessionId: { $exists: false },
      createdAt: { $gte: twentyFourHoursAgo }
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

    // If there are orphaned pours, create a virtual session for them
    let virtualSession = null;
    if (orphanedPours.length > 0) {
      const totalAmount = orphanedPours.reduce((sum, pour) => sum + pour.amount, 0);
      const totalCost = orphanedPours.reduce((sum, pour) => sum + (pour.costPerPour || 0), 0);
      const ratedPours = orphanedPours.filter(pour => pour.rating !== undefined && pour.rating !== null);
      const avgRating = ratedPours.length > 0 
        ? ratedPours.reduce((sum, pour) => sum + pour.rating!, 0) / ratedPours.length 
        : undefined;

      virtualSession = {
        _id: 'orphaned-pours',
        sessionName: 'Ungrouped Pours (Last 24h)',
        date: new Date(),
        totalPours: orphanedPours.length,
        averageRating: avgRating ? Math.round(avgRating * 10) / 10 : undefined,
        totalAmount: Math.round(totalAmount * 10) / 10,
        totalCost: Math.round(totalCost * 100) / 100,
        isVirtual: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    // Combine sessions with virtual session if it exists
    const allSessions = virtualSession ? [virtualSession, ...sessions] : sessions;

    return NextResponse.json({
      sessions: allSessions,
      orphanedPoursCount: orphanedPours.length,
      pagination: {
        page,
        limit,
        total: total + (virtualSession ? 1 : 0),
        pages: Math.ceil((total + (virtualSession ? 1 : 0)) / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching pour sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    
    await dbConnect();

    const pourSession = await PourSession.create({
      ...body,
      userId: new mongoose.Types.ObjectId(session.user.id),
    });

    return NextResponse.json({ session: pourSession }, { status: 201 });
  } catch (error) {
    console.error('Error creating pour session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}