import mongoose, { Schema, Document } from 'mongoose';

export interface IUserStore extends Document {
  userId: mongoose.Types.ObjectId;
  masterStoreId: mongoose.Types.ObjectId;
  nickname?: string;
  notes?: string;
  isFavorite: boolean;
  lastVisited?: Date;
  customAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserStoreSchema = new Schema<IUserStore>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    masterStoreId: {
      type: Schema.Types.ObjectId,
      ref: 'MasterStore',
      required: true,
      index: true,
    },
    nickname: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    notes: {
      type: String,
      maxlength: 1000,
    },
    isFavorite: {
      type: Boolean,
      default: false,
    },
    lastVisited: Date,
    customAddress: {
      street: {
        type: String,
        trim: true,
      },
      city: {
        type: String,
        trim: true,
      },
      state: {
        type: String,
        trim: true,
        maxlength: 2,
      },
      zip: {
        type: String,
        trim: true,
        maxlength: 10,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure one relationship per user-store combination
UserStoreSchema.index({ userId: 1, masterStoreId: 1 }, { unique: true });

// Virtual populate for master store details
UserStoreSchema.virtual('masterStore', {
  ref: 'MasterStore',
  localField: 'masterStoreId',
  foreignField: '_id',
  justOne: true,
});

// Handle model caching properly
const UserStore = (() => {
  const modelName = 'UserStore';
  
  // In development, try to delete cached model
  if (process.env.NODE_ENV === 'development' && mongoose.models[modelName]) {
    try {
      delete (mongoose as any).models[modelName];
      delete (mongoose as any).modelSchemas[modelName];
    } catch (e) {
      console.log('Could not delete cached UserStore model');
    }
  }
  
  return mongoose.models[modelName] as mongoose.Model<IUserStore> || mongoose.model<IUserStore>(modelName, UserStoreSchema);
})();

export default UserStore;