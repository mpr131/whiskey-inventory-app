import mongoose, { Schema, Document } from 'mongoose';

export interface IMasterBottle extends Document {
  name: string;
  brand: string;
  distillery: string;
  region?: string;
  category: string;
  type: string;
  age?: number;
  proof?: number;
  abv?: number;
  statedProof?: string;
  msrp?: number;
  description?: string;
  isStorePick: boolean;
  storePickDetails?: {
    store: string;
    pickDate?: Date;
    barrel?: string;
  };
  communityRating?: number;
  communityRatingCount?: number;
  lastCalculated?: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MasterBottleSchema = new Schema<IMasterBottle>(
  {
    name: {
      type: String,
      required: [true, 'Bottle name is required'],
      trim: true,
      index: true,
    },
    brand: {
      type: String,
      required: [true, 'Brand is required'],
      trim: true,
      index: true,
    },
    distillery: {
      type: String,
      required: [true, 'Distillery is required'],
      trim: true,
      index: true,
    },
    region: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: ['Bourbon', 'Rye', 'Scotch', 'Irish', 'Japanese', 'Other'],
      default: 'Bourbon',
    },
    type: {
      type: String,
      trim: true,
    },
    age: {
      type: Number,
      min: 0,
    },
    proof: {
      type: Number,
      min: 0,
      max: 200,
    },
    abv: {
      type: Number,
      min: 0,
      max: 100,
    },
    statedProof: {
      type: String,
      trim: true,
    },
    msrp: {
      type: Number,
      min: 0,
    },
    description: {
      type: String,
      maxlength: 2000,
    },
    isStorePick: {
      type: Boolean,
      default: false,
    },
    storePickDetails: {
      store: String,
      pickDate: Date,
      barrel: String,
    },
    communityRating: {
      type: Number,
      min: 0,
      max: 10,
      default: undefined,
    },
    communityRatingCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    lastCalculated: {
      type: Date,
      default: undefined,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for uniqueness
MasterBottleSchema.index({ name: 1, distillery: 1, isStorePick: 1 }, { unique: true });

// Text search index
MasterBottleSchema.index({ name: 'text', brand: 'text', distillery: 'text' });

// Method to check if a similar bottle exists
MasterBottleSchema.statics.findSimilar = async function(name: string, distillery: string) {
  return this.find({
    $or: [
      { name: new RegExp(name, 'i') },
      { distillery: new RegExp(distillery, 'i') }
    ]
  }).limit(10);
};

let MasterBottle: mongoose.Model<IMasterBottle>;

try {
  MasterBottle = mongoose.model<IMasterBottle>('MasterBottle');
} catch {
  MasterBottle = mongoose.model<IMasterBottle>('MasterBottle', MasterBottleSchema);
}

export default MasterBottle;