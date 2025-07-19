import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPour extends Document {
  userId: Types.ObjectId;
  userBottleId: Types.ObjectId;
  sessionId?: Types.ObjectId;
  date: Date;
  amount: number; // in ounces
  rating?: number; // t8ke scale 0-10 with decimals
  companions?: string[];
  tags?: string[];
  location?: string;
  photo?: string;
  notes?: string;
  costPerPour?: number; // calculated from bottle price
  createdAt: Date;
  updatedAt: Date;
}

const PourSchema = new Schema<IPour>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userBottleId: {
      type: Schema.Types.ObjectId,
      ref: 'UserBottle',
      required: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'PourSession',
    },
    date: {
      type: Date,
      default: Date.now,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.1,
      max: 10, // reasonable max pour size in ounces
    },
    rating: {
      type: Number,
      min: 0,
      max: 10,
      validate: {
        validator: function(v: number) {
          // Allow one decimal place
          return Math.round(v * 10) / 10 === v;
        },
        message: 'Rating must have at most one decimal place',
      },
    },
    companions: [{
      type: String,
      trim: true,
    }],
    tags: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
    location: {
      type: String,
      trim: true,
      enum: ['Home', 'Bar', 'Restaurant', 'Tasting', 'Friend\'s Place', 'Event', 'Other'],
    },
    photo: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    costPerPour: {
      type: Number,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
PourSchema.index({ userId: 1, date: -1 });
PourSchema.index({ userBottleId: 1, date: -1 });
PourSchema.index({ sessionId: 1 });
PourSchema.index({ tags: 1 });
PourSchema.index({ rating: 1 });
// Additional index for analytics queries
PourSchema.index({ userId: 1, createdAt: -1 });
PourSchema.index({ userId: 1, userBottleId: 1, createdAt: -1 });

// Calculate cost per pour before saving
PourSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('amount')) {
    try {
      const UserBottle = mongoose.model('UserBottle');
      const bottle = await UserBottle.findById(this.userBottleId);
      
      if (bottle && bottle.purchasePrice) {
        // Standard bottle is 25.36 oz (750ml)
        const bottleOunces = 25.36;
        this.costPerPour = (bottle.purchasePrice / bottleOunces) * this.amount;
      }
    } catch (error) {
      console.error('Error calculating cost per pour:', error);
    }
  }
  next();
});

const Pour = mongoose.models.Pour || mongoose.model<IPour>('Pour', PourSchema);

export default Pour;