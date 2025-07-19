import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPourSession extends Document {
  userId: Types.ObjectId;
  sessionName: string;
  date: Date;
  totalPours: number;
  averageRating?: number;
  totalAmount: number; // total ounces poured
  totalCost?: number;
  companions?: string[];
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
        return `Session ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
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
  
  pours.forEach(pour => {
    pour.companions?.forEach(c => allCompanions.add(c));
    pour.tags?.forEach(t => allTags.add(t));
  });
  
  this.companions = Array.from(allCompanions);
  this.tags = Array.from(allTags);
  
  return this.save();
};

const PourSession = mongoose.models.PourSession || mongoose.model<IPourSession>('PourSession', PourSessionSchema);

export default PourSession;