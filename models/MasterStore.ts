import mongoose, { Schema, Document } from 'mongoose';

export interface IMasterStore extends Document {
  name: string;
  fullName?: string;
  type: 'State Store' | 'Private Store' | 'Online' | 'Warehouse' | 'Other';
  state?: string;
  country: string;
  website?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MasterStoreSchema = new Schema<IMasterStore>(
  {
    name: {
      type: String,
      required: [true, 'Store name is required'],
      trim: true,
      index: true,
    },
    fullName: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      required: [true, 'Store type is required'],
      enum: ['State Store', 'Private Store', 'Online', 'Warehouse', 'Other'],
      default: 'Private Store',
    },
    state: {
      type: String,
      trim: true,
      maxlength: 2, // US state codes
    },
    country: {
      type: String,
      default: 'US',
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for uniqueness
MasterStoreSchema.index({ name: 1, state: 1, type: 1 }, { unique: true });

// Text search index
MasterStoreSchema.index({ name: 'text', fullName: 'text' });

// Handle model caching properly
const MasterStore = (() => {
  const modelName = 'MasterStore';
  
  // In development, try to delete cached model
  if (process.env.NODE_ENV === 'development' && mongoose.models[modelName]) {
    try {
      delete (mongoose as any).models[modelName];
      delete (mongoose as any).modelSchemas[modelName];
    } catch (e) {
      console.log('Could not delete cached MasterStore model');
    }
  }
  
  return mongoose.models[modelName] as mongoose.Model<IMasterStore> || mongoose.model<IMasterStore>(modelName, MasterStoreSchema);
})();

export default MasterStore;