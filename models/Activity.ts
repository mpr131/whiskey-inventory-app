import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IActivity extends Document {
  userId: Types.ObjectId;
  type: 'pour' | 'rating' | 'new_bottle' | 'achievement' | 'live_pour_start' | 'live_pour_end';
  targetId: Types.ObjectId; // bottleId, pourId, userBottleId, etc
  visibility: 'public' | 'friends' | 'private';
  metadata: {
    bottleName?: string;
    bottleImage?: string;
    rating?: number;
    pourAmount?: number;
    location?: string;
    sessionId?: string;
    achievement?: string;
    cheersCount?: number;
    cheersUsers?: Types.ObjectId[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const ActivitySchema = new Schema<IActivity>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['pour', 'rating', 'new_bottle', 'achievement', 'live_pour_start', 'live_pour_end'],
      required: true,
      index: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    visibility: {
      type: String,
      enum: ['public', 'friends', 'private'],
      default: 'friends',
      index: true,
    },
    metadata: {
      bottleName: String,
      bottleImage: String,
      rating: {
        type: Number,
        min: 0,
        max: 10,
      },
      pourAmount: {
        type: Number,
        min: 0,
      },
      location: String,
      sessionId: String,
      achievement: String,
      cheersCount: {
        type: Number,
        default: 0,
      },
      cheersUsers: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
      }],
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient feed queries
ActivitySchema.index({ userId: 1, createdAt: -1 });
ActivitySchema.index({ createdAt: -1, visibility: 1 });
ActivitySchema.index({ type: 1, createdAt: -1 });
ActivitySchema.index({ 'metadata.sessionId': 1 });

// TTL index to auto-delete old activities (optional, 90 days)
// ActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

// Virtual populate for user details
ActivitySchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

// Static method to create activity from pour
ActivitySchema.statics.createFromPour = async function(pour: any, userBottle: any, masterBottle: any) {
  return this.create({
    userId: pour.userId,
    type: 'pour',
    targetId: pour._id,
    metadata: {
      bottleName: masterBottle.name,
      bottleImage: masterBottle.imageUrl,
      pourAmount: pour.amount,
      location: pour.location,
      rating: pour.rating,
      sessionId: pour.sessionId,
    },
  });
};

// Static method to get feed for user
ActivitySchema.statics.getFeedForUser = async function(userId: string, friendIds: string[], limit = 50) {
  return this.find({
    $or: [
      // User's own activities
      { userId: userId },
      // Friends' activities that are visible to friends
      {
        userId: { $in: friendIds },
        visibility: { $in: ['public', 'friends'] },
      },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('user', 'name email');
};

// Static method to add cheers
ActivitySchema.statics.addCheers = async function(activityId: string, userId: string) {
  const activity = await this.findById(activityId);
  if (!activity) throw new Error('Activity not found');
  
  // Check if user already cheered
  if (activity.metadata.cheersUsers?.includes(userId as any)) {
    throw new Error('User already cheered this activity');
  }
  
  return this.findByIdAndUpdate(
    activityId,
    {
      $inc: { 'metadata.cheersCount': 1 },
      $push: { 'metadata.cheersUsers': userId },
    },
    { new: true }
  );
};

const Activity = mongoose.models.Activity || mongoose.model<IActivity>('Activity', ActivitySchema);

export default Activity;