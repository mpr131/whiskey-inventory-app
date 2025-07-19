import mongoose, { Schema, Document } from 'mongoose';

export interface ILocation extends Document {
  name: string;
  description?: string;
  type: 'Cabinet' | 'Shelf' | 'Box' | 'Cellar' | 'Display' | 'Other';
  capacity?: number;
  currentCount: number;
  bins?: {
    number: string;
    capacity: number;
    currentCount: number;
    description?: string;
  }[];
  temperature?: number;
  humidity?: number;
  isTemperatureControlled: boolean;
  owner: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema = new Schema<ILocation>(
  {
    name: {
      type: String,
      required: [true, 'Location name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    type: {
      type: String,
      required: [true, 'Location type is required'],
      enum: ['Cabinet', 'Shelf', 'Box', 'Cellar', 'Display', 'Other'],
    },
    capacity: {
      type: Number,
      min: [0, 'Capacity cannot be negative'],
      max: [10000, 'Capacity seems unrealistic'],
    },
    currentCount: {
      type: Number,
      default: 0,
      min: [0, 'Current count cannot be negative'],
    },
    bins: [{
      number: {
        type: String,
        required: true,
        trim: true,
        maxlength: [50, 'Bin number cannot exceed 50 characters'],
      },
      capacity: {
        type: Number,
        required: true,
        min: [1, 'Bin capacity must be at least 1'],
        max: [1000, 'Bin capacity seems unrealistic'],
      },
      currentCount: {
        type: Number,
        default: 0,
        min: [0, 'Current count cannot be negative'],
      },
      description: {
        type: String,
        maxlength: [200, 'Bin description cannot exceed 200 characters'],
      },
    }],
    temperature: {
      type: Number,
      min: [-50, 'Temperature seems too low'],
      max: [150, 'Temperature seems too high'],
    },
    humidity: {
      type: Number,
      min: [0, 'Humidity cannot be negative'],
      max: [100, 'Humidity cannot exceed 100%'],
    },
    isTemperatureControlled: {
      type: Boolean,
      default: false,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner is required'],
    },
  },
  {
    timestamps: true,
  }
);

LocationSchema.index({ owner: 1, name: 1 });
LocationSchema.index({ owner: 1, type: 1 });
LocationSchema.index({ 'bins.number': 1 });

LocationSchema.pre('save', function(next) {
  if (this.bins && this.bins.length > 0) {
    this.currentCount = this.bins.reduce((sum, bin) => sum + bin.currentCount, 0);
  }
  next();
});

LocationSchema.methods.hasSpace = function(): boolean {
  if (!this.capacity) return true;
  return this.currentCount < this.capacity;
};

LocationSchema.methods.findAvailableBin = function() {
  if (!this.bins || this.bins.length === 0) return null;
  
  return this.bins.find((bin: any) => bin.currentCount < bin.capacity);
};

const Location = mongoose.models.Location || mongoose.model<ILocation>('Location', LocationSchema);

export default Location;