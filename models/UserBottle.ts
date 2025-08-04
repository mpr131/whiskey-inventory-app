import mongoose, { Schema, Document } from 'mongoose';

export interface IPour {
  date: Date;
  amount: number;
  notes?: string;
  rating?: number;
}

export interface IFillLevelAdjustment {
  date: Date;
  previousLevel: number;
  newLevel: number;
  reason: 'manual' | 'pour' | 'recalculation';
  notes?: string;
  poursSinceLastAdjustment?: number;
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
  actualAbv?: number;
  notes?: string;
  personalNotes?: string;
  purchaseNote?: string;
  deliveryDate?: Date;
  barcode?: string;
  wineBarcode?: string;
  vaultBarcode?: string;
  storeName?: string;
  storeId?: mongoose.Types.ObjectId;
  cellarTrackerId?: string;
  photos: string[];
  status: 'unopened' | 'opened' | 'finished';
  openDate?: Date;
  fillLevel?: number;
  pours: IPour[];
  fillLevelHistory: IFillLevelAdjustment[];
  lastManualAdjustment?: Date;
  averageRating?: number;
  totalPours?: number;
  lastPourDate?: Date;
  lastLabelPrintedAt?: Date;
  t8keRating?: number;
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  getTotalPours(): number;
  getTotalPoursSince(date: Date): number;
  updateFillLevel(): void;
  adjustFillLevel(newLevel: number, reason: 'manual' | 'pour' | 'recalculation', notes?: string): void;
  updatePourStats(): Promise<IUserBottle>;
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
  rating: {
    type: Number,
    min: 0,
    max: 10,
  },
});

const FillLevelAdjustmentSchema = new Schema<IFillLevelAdjustment>({
  date: {
    type: Date,
    default: Date.now,
    required: true,
  },
  previousLevel: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  newLevel: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  reason: {
    type: String,
    enum: ['manual', 'pour', 'recalculation'],
    required: true,
  },
  notes: String,
  poursSinceLastAdjustment: {
    type: Number,
    min: 0,
  },
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
    actualAbv: {
      type: Number,
      min: 0,
      max: 100,
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
    vaultBarcode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      match: [/^[A-Z]{2,3}\d{3}-\d{6}$/, 'Vault barcode must match format: PREFIX-SEQUENCE (e.g., WV001-000001)'],
    },
    storeName: {
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
    fillLevelHistory: {
      type: [FillLevelAdjustmentSchema],
      default: [],
    },
    lastManualAdjustment: Date,
    averageRating: {
      type: Number,
      min: 0,
      max: 10,
    },
    totalPours: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastPourDate: Date,
    lastLabelPrintedAt: Date,
    t8keRating: {
      type: Number,
      min: 0,
      max: 10,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for user's bottles
UserBottleSchema.index({ userId: 1, masterBottleId: 1 });

// Index for vault barcode lookups
UserBottleSchema.index({ vaultBarcode: 1 });

// Additional indexes for analytics queries
UserBottleSchema.index({ userId: 1, status: 1 });
UserBottleSchema.index({ userId: 1, status: 1, fillLevel: 1 });
UserBottleSchema.index({ userId: 1, createdAt: -1 });

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

// Method to calculate total pours since a specific date
UserBottleSchema.methods.getTotalPoursSince = function(date: Date) {
  return this.pours
    .filter((pour: IPour) => pour.date > date)
    .reduce((total: number, pour: IPour) => total + pour.amount, 0);
};

// Method to adjust fill level manually or programmatically
UserBottleSchema.methods.adjustFillLevel = function(newLevel: number, reason: 'manual' | 'pour' | 'recalculation', notes?: string) {
  const previousLevel = this.fillLevel || 100;
  
  // Add to history
  this.fillLevelHistory.push({
    date: new Date(),
    previousLevel,
    newLevel,
    reason,
    notes,
    poursSinceLastAdjustment: reason === 'manual' ? 0 : undefined,
  });
  
  // Update fill level
  this.fillLevel = newLevel;
  
  // Track manual adjustments
  if (reason === 'manual') {
    this.lastManualAdjustment = new Date();
  }
};

// Method to update fill level based on pours
UserBottleSchema.methods.updateFillLevel = function() {
  console.log('[updateFillLevel] Method called');
  try {
    // Initialize if needed
    if (!this.fillLevelHistory) {
      console.log('[updateFillLevel] fillLevelHistory not found - initializing');
      this.fillLevelHistory = [];
    }
    if (!this.pours || !Array.isArray(this.pours)) {
      console.log('[updateFillLevel] pours not found or not array - initializing');
      this.pours = [];
    }
    
    console.log('[updateFillLevel] Status:', this.status, 'Pours length:', this.pours.length);
    
    if (this.status === 'opened' && this.pours.length > 0) {
      const bottleSize = 25.36; // Standard 750ml bottle in ounces
    
      // Find the last manual adjustment or bottle opening
      let baseLevel = 100;
      let calculateFromDate = this.openDate || new Date(0);
      
      console.log('[updateFillLevel] Initial baseLevel:', baseLevel, 'openDate:', this.openDate);
      console.log('[updateFillLevel] lastManualAdjustment:', this.lastManualAdjustment, 'fillLevelHistory length:', this.fillLevelHistory.length);
      
      if (this.lastManualAdjustment && this.fillLevelHistory.length > 0) {
        // Find the most recent manual adjustment
        console.log('[updateFillLevel] Looking for manual adjustments...');
        const lastManualAdj = this.fillLevelHistory
          .filter((adj: IFillLevelAdjustment) => adj.reason === 'manual')
          .sort((a: IFillLevelAdjustment, b: IFillLevelAdjustment) => b.date.getTime() - a.date.getTime())[0];
        
        if (lastManualAdj) {
          console.log('[updateFillLevel] Found manual adjustment:', lastManualAdj);
          baseLevel = lastManualAdj.newLevel;
          calculateFromDate = lastManualAdj.date;
        }
      }
      
      // Calculate pours since the last manual adjustment
      console.log('[updateFillLevel] Calculating pours since:', calculateFromDate);
      const poursSinceAdjustment = this.getTotalPoursSince(calculateFromDate);
      console.log('[updateFillLevel] Pours since adjustment:', poursSinceAdjustment, 'oz');
      
      // Calculate new fill level
      const fillLevelDecrease = (poursSinceAdjustment / bottleSize) * 100;
      const newFillLevel = Math.max(0, baseLevel - fillLevelDecrease);
      console.log('[updateFillLevel] Fill level decrease:', fillLevelDecrease, '%, New fill level:', newFillLevel, '%');
      
      // Only update if the fill level has changed
      if (Math.abs(newFillLevel - (this.fillLevel || 100)) > 0.01) {
        console.log('[updateFillLevel] Updating fill level from', this.fillLevel, 'to', newFillLevel);
        this.adjustFillLevel(newFillLevel, 'pour', `Calculated from ${poursSinceAdjustment.toFixed(1)}oz poured since last adjustment`);
      } else {
        console.log('[updateFillLevel] No significant change - keeping fill level at', this.fillLevel);
      }
    } else {
      console.log('[updateFillLevel] Skipping - bottle not opened or no pours');
    }
  } catch (error: any) {
    console.error('[updateFillLevel] Error:', error);
    console.error('[updateFillLevel] Error stack:', error.stack);
    // Don't throw - just leave fill level as is
  }
};

// Method to update pour statistics from the new Pour model
UserBottleSchema.methods.updatePourStats = async function() {
  const Pour = mongoose.model('Pour');
  const pours = await Pour.find({ userBottleId: this._id });
  
  this.totalPours = pours.length;
  
  // Calculate average rating
  const ratedPours = pours.filter((pour: any) => pour.rating !== undefined && pour.rating !== null);
  if (ratedPours.length > 0) {
    const totalRating = ratedPours.reduce((sum: number, pour: any) => sum + pour.rating, 0);
    this.averageRating = Math.round((totalRating / ratedPours.length) * 10) / 10;
  }
  
  // Update last pour date
  if (pours.length > 0) {
    const latestPour = pours.reduce((latest: any, pour: any) => 
      pour.date > latest.date ? pour : latest
    );
    this.lastPourDate = latestPour.date;
  }
  
  return this.save();
};

// Pre-save hook to update status
UserBottleSchema.pre('save', function(next) {
  if (this.isModified('openDate') && this.openDate && this.status === 'unopened') {
    this.status = 'opened';
    
    // Add initial fill level history entry when bottle is opened
    if (this.fillLevelHistory.length === 0) {
      this.fillLevelHistory.push({
        date: this.openDate,
        previousLevel: 100,
        newLevel: 100,
        reason: 'manual',
        notes: 'Bottle opened',
        poursSinceLastAdjustment: 0,
      });
    }
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