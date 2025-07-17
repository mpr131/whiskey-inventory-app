import mongoose, { Schema, Document } from 'mongoose';

export interface IPour {
  date: Date;
  amount: number;
  notes?: string;
}

export interface IUserBottle extends Document {
  userId: mongoose.Types.ObjectId;
  masterBottleId: mongoose.Types.ObjectId;
  purchaseDate?: Date;
  purchasePrice?: number;
  marketValue?: number;
  myValue?: number;
  quantity: number;
  location?: {
    area: string;
    bin: string;
  };
  bottleNumber?: string;
  barrelNumber?: string;
  actualProof?: number;
  notes?: string;
  personalNotes?: string;
  purchaseNote?: string;
  deliveryDate?: Date;
  barcode?: string;
  wineBarcode?: string;
  storeId?: mongoose.Types.ObjectId;
  cellarTrackerId?: string;
  photos: string[];
  status: 'unopened' | 'opened' | 'finished';
  openDate?: Date;
  fillLevel?: number;
  pours: IPour[];
  createdAt: Date;
  updatedAt: Date;
}

const PourSchema = new Schema<IPour>({
  date: {
    type: Date,
    default: Date.now,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  notes: String,
});

const UserBottleSchema = new Schema<IUserBottle>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    masterBottleId: {
      type: Schema.Types.ObjectId,
      ref: 'MasterBottle',
      required: true,
      index: true,
    },
    purchaseDate: Date,
    purchasePrice: {
      type: Number,
      min: 0,
    },
    marketValue: {
      type: Number,
      min: 0,
    },
    myValue: {
      type: Number,
      min: 0,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 0,
    },
    location: {
      area: {
        type: String,
        trim: true,
      },
      bin: {
        type: String,
        trim: true,
      },
    },
    bottleNumber: {
      type: String,
      trim: true,
    },
    barrelNumber: {
      type: String,
      trim: true,
    },
    actualProof: {
      type: Number,
      min: 0,
      max: 200,
    },
    notes: {
      type: String,
      maxlength: 2000,
    },
    personalNotes: {
      type: String,
      maxlength: 2000,
    },
    purchaseNote: {
      type: String,
      maxlength: 500,
    },
    deliveryDate: Date,
    barcode: {
      type: String,
      trim: true,
    },
    wineBarcode: {
      type: String,
      trim: true,
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'UserStore',
      index: true,
    },
    cellarTrackerId: {
      type: String,
      trim: true,
    },
    photos: [{
      type: String,
    }],
    status: {
      type: String,
      enum: ['unopened', 'opened', 'finished'],
      default: 'unopened',
    },
    openDate: Date,
    fillLevel: {
      type: Number,
      min: 0,
      max: 100,
      default: 100,
    },
    pours: [PourSchema],
  },
  {
    timestamps: true,
  }
);

// Compound index for user's bottles
UserBottleSchema.index({ userId: 1, masterBottleId: 1 });

// Virtual populate for master bottle details
UserBottleSchema.virtual('masterBottle', {
  ref: 'MasterBottle',
  localField: 'masterBottleId',
  foreignField: '_id',
  justOne: true,
});

// Method to calculate total pours
UserBottleSchema.methods.getTotalPours = function() {
  return this.pours.reduce((total: number, pour: IPour) => total + pour.amount, 0);
};

// Method to update fill level based on pours
UserBottleSchema.methods.updateFillLevel = function() {
  if (this.status === 'opened' && this.pours.length > 0) {
    const totalPoured = this.getTotalPours();
    // Assuming a standard 750ml bottle
    const bottleSize = 750;
    this.fillLevel = Math.max(0, 100 - (totalPoured / bottleSize * 100));
  }
};

// Pre-save hook to update status
UserBottleSchema.pre('save', function(next) {
  if (this.isModified('openDate') && this.openDate && this.status === 'unopened') {
    this.status = 'opened';
  }
  
  if (this.fillLevel === 0 || (this.quantity === 0 && this.status !== 'finished')) {
    this.status = 'finished';
  }
  
  next();
});

// Handle model caching properly
const UserBottle = (() => {
  const modelName = 'UserBottle';
  
  // In development, try to delete cached model
  if (process.env.NODE_ENV === 'development' && mongoose.models[modelName]) {
    try {
      delete (mongoose as any).models[modelName];
      delete (mongoose as any).modelSchemas[modelName];
    } catch (e) {
      console.log('Could not delete cached UserBottle model');
    }
  }
  
  const model = mongoose.models[modelName] as mongoose.Model<IUserBottle> || mongoose.model<IUserBottle>(modelName, UserBottleSchema);
  
  // Debug: Log schema paths in development
  if (process.env.NODE_ENV === 'development') {
    const schemaPaths = Object.keys(model.schema.paths);
    console.log('UserBottle model initialized with paths:', schemaPaths);
    console.log('Critical fields present:', {
      barcode: schemaPaths.includes('barcode'),
      wineBarcode: schemaPaths.includes('wineBarcode'),
      storeName: schemaPaths.includes('storeName'),
      marketValue: schemaPaths.includes('marketValue'),
      cellarTrackerId: schemaPaths.includes('cellarTrackerId'),
    });
  }
  
  return model;
})();

export default UserBottle;