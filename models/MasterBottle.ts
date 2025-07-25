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
  statedProof?: number;
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
  upcCodes?: Array<{
    code: string;
    submittedBy: mongoose.Types.ObjectId | string;
    verifiedCount: number;
    dateAdded: Date;
    isAdminAdded: boolean;
  }>;
  createdBy?: mongoose.Types.ObjectId | 'system_import';
  createdAt: Date;
  updatedAt: Date;
  size?: string;
  country?: string;
  externalData?: {
    source: 'fwgs' | 'manual' | 'user';
    fwgsId?: string;  // repositoryId from FWGS
    sku?: string;     // id from FWGS
    externalId?: string; // Keep for backwards compatibility
    lastSync?: Date;
    importDate?: Date;
  };
  defaultImageUrl?: string;
  imageUrls?: string[];
  duplicateOf?: mongoose.Types.ObjectId;
  active?: boolean;
  communityPhotos?: Array<{
    url: string;
    uploadedBy: mongoose.Types.ObjectId;
    uploadedAt: Date;
  }>;
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
      enum: ['Bourbon', 'Rye', 'Scotch', 'Irish', 'Japanese', 'American Whiskey', 'Canadian Whisky', 'Tennessee Whiskey', 'Irish Whiskey', 'Japanese Whiskey', 'Rye Whiskey', 'Vodka', 'Rum', 'Gin', 'Tequila', 'Mezcal', 'Brandy', 'Cognac', 'Liqueur', 'Wine', 'Beer', 'Spirits', 'Other'],
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
      type: Number,
      min: 0,
      max: 200,
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
    upcCodes: [{
      code: {
        type: String,
        required: true,
        trim: true,
      },
      submittedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: false, // Allow null for system imports
      },
      verifiedCount: {
        type: Number,
        default: 0,
        min: 0,
      },
      dateAdded: {
        type: Date,
        default: Date.now,
      },
      isAdminAdded: {
        type: Boolean,
        default: false,
      },
    }],
    createdBy: {
      type: Schema.Types.Mixed,  // Can be ObjectId or 'system_import'
      ref: 'User',
      required: false,
    },
    size: {
      type: String,
      trim: true,
      default: '750ML',
    },
    country: {
      type: String,
      trim: true,
      default: 'United States',
    },
    externalData: {
      source: {
        type: String,
        enum: ['fwgs', 'manual', 'user'],
        default: 'manual'
      },
      fwgsId: {
        type: String,
        trim: true,
        sparse: true
      },
      sku: {
        type: String,
        trim: true
      },
      externalId: {
        type: String,
        trim: true
      },
      lastSync: {
        type: Date
      },
      importDate: {
        type: Date
      }
    },
    defaultImageUrl: {
      type: String,
      trim: true,
    },
    duplicateOf: {
      type: Schema.Types.ObjectId,
      ref: 'MasterBottle'
    },
    active: {
      type: Boolean,
      default: true
    },
    imageUrls: [{
      type: String,
      trim: true,
    }],
    communityPhotos: [{
      url: {
        type: String,
        required: true,
        trim: true,
      },
      uploadedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    }],
  },
  {
    timestamps: true,
  }
);

// Compound index for uniqueness
MasterBottleSchema.index({ name: 1, distillery: 1, isStorePick: 1 }, { unique: true });

// Text search index
MasterBottleSchema.index({ name: 'text', brand: 'text', distillery: 'text' });

// Index for rating queries
MasterBottleSchema.index({ communityRating: -1 });
MasterBottleSchema.index({ lastCalculated: 1 });

// Index for UPC code lookups
MasterBottleSchema.index({ 'upcCodes.code': 1 });

// Index for external data lookups
MasterBottleSchema.index({ 'externalData.fwgsId': 1 });
MasterBottleSchema.index({ 'externalData.source': 1 });
MasterBottleSchema.index({ active: 1 });

// Method to check if a similar bottle exists
MasterBottleSchema.statics.findSimilar = async function(name: string, distillery: string) {
  return this.find({
    $or: [
      { name: new RegExp(name, 'i') },
      { distillery: new RegExp(distillery, 'i') }
    ]
  }).limit(10);
};

const MasterBottle = mongoose.models.MasterBottle || mongoose.model<IMasterBottle>('MasterBottle', MasterBottleSchema);

export default MasterBottle;