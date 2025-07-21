import MasterBottle from '@/models/MasterBottle';
import Pour from '@/models/Pour';
import UserBottle from '@/models/UserBottle';
import { Types } from 'mongoose';
import dbConnect from '@/lib/mongodb';

export async function updateMasterBottleRating(masterBottleId: Types.ObjectId | string) {
  try {
    await dbConnect();
    
    // Find all UserBottles for this MasterBottle
    const userBottles = await UserBottle.find({ masterBottleId });
    
    if (!userBottles || userBottles.length === 0) {
      return;
    }

    // Get all UserBottle IDs
    const userBottleIds = userBottles.map(ub => ub._id);

    // Find all rated pours for these bottles
    const ratedPours = await Pour.find({
      userBottleId: { $in: userBottleIds },
      rating: { $exists: true, $ne: null }
    });

    if (ratedPours.length === 0) {
      // No ratings to calculate
      await MasterBottle.findByIdAndUpdate(masterBottleId, {
        communityRating: undefined,
        communityRatingCount: 0,
        lastCalculated: new Date()
      });
      return;
    }

    // Calculate average rating
    const totalRating = ratedPours.reduce((sum, pour) => sum + (pour.rating || 0), 0);
    const averageRating = Math.round((totalRating / ratedPours.length) * 10) / 10; // Round to 1 decimal

    // Update MasterBottle with new ratings
    await MasterBottle.findByIdAndUpdate(masterBottleId, {
      communityRating: averageRating,
      communityRatingCount: ratedPours.length,
      lastCalculated: new Date()
    });

    return {
      communityRating: averageRating,
      communityRatingCount: ratedPours.length
    };
  } catch (error) {
    console.error('Error updating master bottle rating:', error);
    throw error;
  }
}

export async function getUserBottleRating(userId: Types.ObjectId | string, masterBottleId: Types.ObjectId | string) {
  try {
    await dbConnect();
    
    // Use aggregation pipeline for efficient calculation
    const result = await Pour.aggregate([
      // Match pours for this user with ratings
      {
        $match: {
          userId: new Types.ObjectId(userId.toString()),
          rating: { $exists: true, $ne: null }
        }
      },
      // Join with UserBottle to filter by masterBottleId
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
      // Filter by masterBottleId
      {
        $match: {
          'userBottle.masterBottleId': new Types.ObjectId(masterBottleId.toString())
        }
      },
      // Group and calculate average
      {
        $group: {
          _id: null,
          personalRating: { $avg: '$rating' },
          pourCount: { $sum: 1 }
        }
      },
      // Round to 1 decimal place
      {
        $project: {
          _id: 0,
          personalRating: { $round: ['$personalRating', 1] },
          pourCount: 1
        }
      }
    ]);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Error getting user bottle rating:', error);
    return null;
  }
}

export async function recalculateAllMasterBottleRatings() {
  try {
    await dbConnect();
    
    const masterBottles = await MasterBottle.find({});
    const results = [];

    for (const bottle of masterBottles) {
      const result = await updateMasterBottleRating(bottle._id.toString());
      results.push({ bottleId: bottle._id.toString(), ...result });
    }

    return results;
  } catch (error) {
    console.error('Error recalculating all master bottle ratings:', error);
    throw error;
  }
}