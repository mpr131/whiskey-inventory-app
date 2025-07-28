import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Pour from '@/models/Pour';
import PourSession from '@/models/PourSession';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const friendId = searchParams.get('friendId');
    
    await dbConnect();

    if (friendId) {
      // Get stats for a specific friend
      const stats = await PourSession.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(session.user.id),
            'companionTags.friendId': new mongoose.Types.ObjectId(friendId),
          },
        },
        {
          $group: {
            _id: null,
            sessionCount: { $sum: 1 },
            firstSession: { $min: '$date' },
            lastSession: { $max: '$date' },
            totalPours: { $sum: '$totalPours' },
            totalAmount: { $sum: '$totalAmount' },
          },
        },
      ]);

      return NextResponse.json({
        friendId,
        stats: stats[0] || {
          sessionCount: 0,
          firstSession: null,
          lastSession: null,
          totalPours: 0,
          totalAmount: 0,
        },
      });
    } else {
      // Get overall companion stats
      const companionStats = await PourSession.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(session.user.id),
            companionTags: { $exists: true, $ne: [] },
          },
        },
        { $unwind: '$companionTags' },
        {
          $group: {
            _id: {
              type: '$companionTags.type',
              friendId: '$companionTags.friendId',
              name: '$companionTags.name',
            },
            sessionCount: { $sum: 1 },
            lastSession: { $max: '$date' },
            totalPours: { $sum: '$totalPours' },
          },
        },
        { $sort: { sessionCount: -1 } },
        { $limit: 10 },
      ]);

      // Also get stats from legacy companions field
      const legacyStats = await PourSession.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(session.user.id),
            companions: { $exists: true, $ne: [] },
            companionTags: { $exists: false },
          },
        },
        { $unwind: '$companions' },
        {
          $group: {
            _id: '$companions',
            sessionCount: { $sum: 1 },
            lastSession: { $max: '$date' },
          },
        },
        { $sort: { sessionCount: -1 } },
        { $limit: 10 },
      ]);

      return NextResponse.json({
        topCompanions: companionStats.map(stat => ({
          type: stat._id.type,
          friendId: stat._id.friendId,
          name: stat._id.name,
          sessionCount: stat.sessionCount,
          lastSession: stat.lastSession,
          totalPours: stat.totalPours,
        })),
        legacyCompanions: legacyStats.map(stat => ({
          name: stat._id,
          sessionCount: stat.sessionCount,
          lastSession: stat.lastSession,
        })),
      });
    }
    
  } catch (error) {
    console.error('Error fetching friend stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}