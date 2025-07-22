import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ILivePour extends Document {
  userId: Types.ObjectId;
  userName: string;
  userAvatar?: string;
  bottleId: Types.ObjectId;
  bottleName: string;
  bottleImage?: string;
  startedAt: Date;
  endedAt?: Date;
  location?: string;
  sessionId: string;
  isActive: boolean;
  cheersCount: number;
  cheersUsers: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const LivePourSchema = new Schema<ILivePour>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
    },
    userAvatar: String,
    bottleId: {
      type: Schema.Types.ObjectId,
      ref: 'MasterBottle',
      required: true,
    },
    bottleName: {
      type: String,
      required: true,
    },
    bottleImage: String,
    startedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    endedAt: Date,
    location: String,
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    cheersCount: {
      type: Number,
      default: 0,
    },
    cheersUsers: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
  },
  {
    timestamps: true,
  }
);

// Compound indexes
LivePourSchema.index({ isActive: 1, startedAt: -1 });
LivePourSchema.index({ userId: 1, isActive: 1 });

// TTL index to clean up old inactive pours (24 hours)
LivePourSchema.index({ endedAt: 1 }, { expireAfterSeconds: 86400 });

// Auto-expire active pours after 2 hours
LivePourSchema.index({ startedAt: 1 }, { 
  expireAfterSeconds: 7200,
  partialFilterExpression: { isActive: true }
});

// Static method to get active pours for friends
LivePourSchema.statics.getActivePours = async function(friendIds: string[]) {
  return this.find({
    userId: { $in: friendIds },
    isActive: true,
  })
    .sort({ startedAt: -1 })
    .populate('userId', 'name avatar');
};

// Static method to end a pour
LivePourSchema.statics.endPour = async function(sessionId: string) {
  return this.updateMany(
    { sessionId, isActive: true },
    { 
      $set: { 
        isActive: false,
        endedAt: new Date(),
      }
    }
  );
};

// Method to add cheers
LivePourSchema.methods.addCheers = async function(userId: string) {
  if (this.cheersUsers.includes(userId)) {
    throw new Error('User already cheered this pour');
  }
  
  this.cheersCount += 1;
  this.cheersUsers.push(userId);
  return this.save();
};

const LivePour = mongoose.models.LivePour || mongoose.model<ILivePour>('LivePour', LivePourSchema);

export default LivePour;