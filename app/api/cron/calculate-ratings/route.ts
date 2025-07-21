import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import MasterBottle from '@/models/MasterBottle';
import Pour from '@/models/Pour';
import UserBottle from '@/models/UserBottle';
import mongoose from 'mongoose';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Verify CRON_SECRET
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // Starting nightly rating calculation

    // Use aggregation pipeline to efficiently calculate ratings for all master bottles
    const ratingAggregation = await Pour.aggregate([
      // Only include pours with ratings
      {
        $match: {
          rating: { $exists: true, $ne: null }
        }
      },
      // Join with UserBottle to get masterBottleId
      {
        $lookup: {
          from: 'userbottles',
          localField: 'userBottleId',
          foreignField: '_id',
          as: 'userBottle'
        }
      },
      // Unwind the userBottle array
      {
        $unwind: '$userBottle'
      },
      // Group by masterBottleId and calculate average rating
      {
        $group: {
          _id: '$userBottle.masterBottleId',
          communityRating: { $avg: '$rating' },
          communityRatingCount: { $sum: 1 }
        }
      },
      // Round the rating to 1 decimal place
      {
        $project: {
          _id: 1,
          communityRating: { $round: ['$communityRating', 1] },
          communityRatingCount: 1
        }
      }
    ]);

    // Found master bottles with ratings: ratingAggregation.length

    // Batch update all master bottles with new ratings
    const bulkOps = ratingAggregation.map(result => ({
      updateOne: {
        filter: { _id: result._id },
        update: {
          $set: {
            communityRating: result.communityRating,
            communityRatingCount: result.communityRatingCount,
            lastCalculated: new Date()
          }
        }
      }
    }));

    let updateResult = { modifiedCount: 0 };
    if (bulkOps.length > 0) {
      updateResult = await MasterBottle.bulkWrite(bulkOps);
    }

    // Clear ratings for bottles with no rated pours
    const bottlesWithRatings = ratingAggregation.map(r => r._id);
    const clearResult = await MasterBottle.updateMany(
      {
        _id: { $nin: bottlesWithRatings },
        $or: [
          { communityRating: { $exists: true } },
          { communityRatingCount: { $gt: 0 } }
        ]
      },
      {
        $unset: { communityRating: 1 },
        $set: { 
          communityRatingCount: 0,
          lastCalculated: new Date()
        }
      }
    );

    const executionTime = Date.now() - startTime;

    const response = {
      success: true,
      bottlesUpdated: updateResult.modifiedCount,
      bottlesCleared: clearResult.modifiedCount,
      totalProcessed: ratingAggregation.length,
      executionTimeMs: executionTime,
      executionTime: `${(executionTime / 1000).toFixed(2)}s`,
      timestamp: new Date().toISOString()
    };

    // Rating calculation completed

    return NextResponse.json(response);
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('[CRON] Error calculating ratings:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to calculate ratings',
      executionTimeMs: executionTime,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// GET endpoint for testing/monitoring
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // Get statistics about current ratings
    const stats = await MasterBottle.aggregate([
      {
        $facet: {
          withRatings: [
            { $match: { communityRating: { $exists: true } } },
            { $count: 'count' }
          ],
          avgRating: [
            { $match: { communityRating: { $exists: true } } },
            { $group: { _id: null, avg: { $avg: '$communityRating' } } }
          ],
          lastUpdate: [
            { $match: { lastCalculated: { $exists: true } } },
            { $sort: { lastCalculated: -1 } },
            { $limit: 1 },
            { $project: { lastCalculated: 1 } }
          ]
        }
      }
    ]);

    return NextResponse.json({
      bottlesWithRatings: stats[0].withRatings[0]?.count || 0,
      averageCommunityRating: stats[0].avgRating[0]?.avg?.toFixed(1) || 'N/A',
      lastCalculated: stats[0].lastUpdate[0]?.lastCalculated || null,
      status: 'Ready to calculate ratings'
    });
  } catch (error) {
    console.error('[CRON] Error getting rating stats:', error);
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}