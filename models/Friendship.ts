import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IFriendship extends Document {
  requester: Types.ObjectId;
  recipient: Types.ObjectId;
  status: 'pending' | 'accepted' | 'blocked';
  createdAt: Date;
  acceptedAt?: Date;
  updatedAt: Date;
}

const FriendshipSchema = new Schema<IFriendship>(
  {
    requester: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'blocked'],
      default: 'pending',
      index: true,
    },
    acceptedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
FriendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });
FriendshipSchema.index({ recipient: 1, status: 1 });
FriendshipSchema.index({ requester: 1, status: 1 });

// Ensure no duplicate friendships (prevent A->B and B->A)
FriendshipSchema.pre('save', async function(next) {
  if (this.isNew) {
    const existingFriendship = await mongoose.model('Friendship').findOne({
      $or: [
        { requester: this.requester, recipient: this.recipient },
        { requester: this.recipient, recipient: this.requester },
      ],
    });
    
    if (existingFriendship) {
      const error = new Error('Friendship already exists');
      return next(error);
    }
  }
  
  // Set acceptedAt when status changes to accepted
  if (this.isModified('status') && this.status === 'accepted' && !this.acceptedAt) {
    this.acceptedAt = new Date();
  }
  
  next();
});

// Static method to get all friends for a user
FriendshipSchema.statics.getFriendsForUser = async function(userId: string) {
  return this.find({
    $and: [
      { status: 'accepted' },
      {
        $or: [
          { requester: userId },
          { recipient: userId },
        ],
      },
    ],
  }).populate('requester recipient', 'name email');
};

// Static method to check if two users are friends
FriendshipSchema.statics.areFriends = async function(userId1: string, userId2: string) {
  const friendship = await this.findOne({
    $and: [
      { status: 'accepted' },
      {
        $or: [
          { requester: userId1, recipient: userId2 },
          { requester: userId2, recipient: userId1 },
        ],
      },
    ],
  });
  
  return !!friendship;
};

const Friendship = mongoose.models.Friendship || mongoose.model<IFriendship>('Friendship', FriendshipSchema);

export default Friendship;