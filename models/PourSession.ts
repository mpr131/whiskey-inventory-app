import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICompanion {
  type: 'friend' | 'text';
  friendId?: Types.ObjectId;
  name: string;
}

export interface IPourSession extends Document {
  userId: Types.ObjectId;
  sessionName: string;
  date: Date;
  totalPours: number;
  averageRating?: number;
  totalAmount: number; // total ounces poured
  totalCost?: number;
  companions?: string[]; // Legacy field for backward compatibility
  companionTags?: ICompanion[]; // New structured field
  location?: string;
  tags?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PourSessionSchema = new Schema<IPourSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sessionName: {
      type: String,
      required: true,
      trim: true,
      default: function() {
        const date = new Date();
        // Use ISO format for consistent server-side generation
        return `Session ${date.toISOString().split('T')[0]} ${date.toISOString().split('T')[1].substring(0, 5)}`;
      },
    },
    date: {
      type: Date,
      default: Date.now,
      required: true,
    },
    totalPours: {
      type: Number,
      default: 0,
      min: 0,
    },
    averageRating: {
      type: Number,
      min: 0,
      max: 10,
    },
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    companions: [{
      type: String,
      trim: true,
    }],
    companionTags: [{
      type: {
        type: String,
        enum: ['friend', 'text'],
        required: true,
      },
      friendId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      name: {
        type: String,
        required: true,
        trim: true,
      },
    }],
    location: {
      type: String,
      trim: true,
    },
    tags: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
PourSessionSchema.index({ userId: 1, date: -1 });
PourSessionSchema.index({ tags: 1 });

// Method to update session statistics
PourSessionSchema.methods.updateStats = async function() {
  const Pour = mongoose.model('Pour');
  const pours = await Pour.find({ sessionId: this._id });
  
  this.totalPours = pours.length;
  this.totalAmount = pours.reduce((sum, pour) => sum + pour.amount, 0);
  this.totalCost = pours.reduce((sum, pour) => sum + (pour.costPerPour || 0), 0);
  
  // Calculate average rating
  const ratedPours = pours.filter(pour => pour.rating !== undefined && pour.rating !== null);
  if (ratedPours.length > 0) {
    const totalRating = ratedPours.reduce((sum, pour) => sum + pour.rating!, 0);
    this.averageRating = Math.round((totalRating / ratedPours.length) * 10) / 10;
  }
  
  // Collect unique companions and tags
  const allCompanions = new Set<string>();
  const allTags = new Set<string>();
  const companionTagsMap = new Map<string, ICompanion>();
  
  pours.forEach(pour => {
    // Legacy companions
    pour.companions?.forEach((c: string) => allCompanions.add(c));
    
    // New companionTags structure
    pour.companionTags?.forEach((companion: ICompanion) => {
      const key = companion.type === 'friend' 
        ? `friend-${companion.friendId}` 
        : `text-${companion.name}`;
      companionTagsMap.set(key, companion);
    });
    
    pour.tags?.forEach((t: string) => allTags.add(t));
  });
  
  this.companions = Array.from(allCompanions);
  this.companionTags = Array.from(companionTagsMap.values());
  this.tags = Array.from(allTags);
  
  return this.save();
};

const PourSession = mongoose.models.PourSession || mongoose.model<IPourSession>('PourSession', PourSessionSchema);

export default PourSession;