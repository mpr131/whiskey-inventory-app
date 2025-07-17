import mongoose, { Schema, Document } from 'mongoose';

export interface IBottle extends Document {
  name: string;
  distillery: string;
  type: 'Bourbon' | 'Scotch' | 'Irish' | 'Rye' | 'Japanese' | 'Other';
  age?: number;
  proof: number;
  abv: number;
  size: string;
  vintage?: number;
  bottledDate?: Date;
  purchaseDate: Date;
  purchasePrice: number;
  currentValue?: number;
  location: mongoose.Types.ObjectId;
  binNumber?: string;
  notes?: string;
  rating?: number;
  isOpen: boolean;
  openedDate?: Date;
  finishedDate?: Date;
  fillLevel?: number;
  images: string[];
  barcode?: string;
  customFields?: Record<string, any>;
  isStorePick: boolean;
  storePickDetails?: {
    store: string;
    barrel?: string;
    rickhouse?: string;
    floor?: string;
    bottleNumber?: string;
    totalBottles?: string;
  };
  owner: mongoose.Types.ObjectId;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const BottleSchema = new Schema<IBottle>(
  {
    name: {
      type: String,
      required: [true, 'Bottle name is required'],
      trim: true,
      maxlength: [200, 'Name cannot exceed 200 characters'],
    },
    distillery: {
      type: String,
      required: [true, 'Distillery is required'],
      trim: true,
      maxlength: [100, 'Distillery name cannot exceed 100 characters'],
    },
    type: {
      type: String,
      required: [true, 'Type is required'],
      enum: ['Bourbon', 'Scotch', 'Irish', 'Rye', 'Japanese', 'Other'],
    },
    age: {
      type: Number,
      min: [0, 'Age cannot be negative'],
      max: [100, 'Age cannot exceed 100 years'],
    },
    proof: {
      type: Number,
      required: [true, 'Proof is required'],
      min: [0, 'Proof cannot be negative'],
      max: [200, 'Proof cannot exceed 200'],
    },
    abv: {
      type: Number,
      required: [true, 'ABV is required'],
      min: [0, 'ABV cannot be negative'],
      max: [100, 'ABV cannot exceed 100%'],
    },
    size: {
      type: String,
      required: [true, 'Size is required'],
      enum: ['50ml', '200ml', '375ml', '500ml', '700ml', '750ml', '1L', '1.75L', 'Other'],
    },
    vintage: {
      type: Number,
      min: [1800, 'Vintage year seems too old'],
      max: [new Date().getFullYear(), 'Vintage cannot be in the future'],
    },
    bottledDate: Date,
    purchaseDate: {
      type: Date,
      required: [true, 'Purchase date is required'],
      validate: {
        validator: function(v: Date) {
          return v <= new Date();
        },
        message: 'Purchase date cannot be in the future',
      },
    },
    purchasePrice: {
      type: Number,
      required: [true, 'Purchase price is required'],
      min: [0, 'Purchase price cannot be negative'],
    },
    currentValue: {
      type: Number,
      min: [0, 'Current value cannot be negative'],
    },
    location: {
      type: Schema.Types.ObjectId,
      ref: 'Location',
      required: [true, 'Location is required'],
    },
    binNumber: {
      type: String,
      trim: true,
      maxlength: [50, 'Bin number cannot exceed 50 characters'],
    },
    notes: {
      type: String,
      maxlength: [2000, 'Notes cannot exceed 2000 characters'],
    },
    rating: {
      type: Number,
      min: [0, 'Rating cannot be less than 0'],
      max: [100, 'Rating cannot exceed 100'],
    },
    isOpen: {
      type: Boolean,
      default: false,
    },
    openedDate: {
      type: Date,
      validate: {
        validator: function(this: IBottle, v: Date) {
          return !v || (this.isOpen && v <= new Date());
        },
        message: 'Opened date must be in the past and bottle must be marked as open',
      },
    },
    finishedDate: {
      type: Date,
      validate: {
        validator: function(this: IBottle, v: Date) {
          return !v || (this.openedDate && v >= this.openedDate && v <= new Date());
        },
        message: 'Finished date must be after opened date and not in the future',
      },
    },
    fillLevel: {
      type: Number,
      min: [0, 'Fill level cannot be negative'],
      max: [100, 'Fill level cannot exceed 100%'],
      default: 100,
    },
    images: {
      type: [String],
      validate: [
        {
          validator: function(v: string[]) {
            return v.length <= 10;
          },
          message: 'Cannot have more than 10 images',
        },
      ],
    },
    barcode: {
      type: String,
      trim: true,
      maxlength: [100, 'Barcode cannot exceed 100 characters'],
    },
    customFields: {
      type: Map,
      of: Schema.Types.Mixed,
    },
    isStorePick: {
      type: Boolean,
      default: false,
    },
    storePickDetails: {
      store: String,
      barrel: String,
      rickhouse: String,
      floor: String,
      bottleNumber: String,
      totalBottles: String,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner is required'],
    },
    tags: {
      type: [String],
      validate: [
        {
          validator: function(v: string[]) {
            return v.length <= 20;
          },
          message: 'Cannot have more than 20 tags',
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

BottleSchema.index({ owner: 1, name: 1 });
BottleSchema.index({ owner: 1, distillery: 1 });
BottleSchema.index({ owner: 1, type: 1 });
BottleSchema.index({ owner: 1, isOpen: 1 });
BottleSchema.index({ owner: 1, createdAt: -1 });
BottleSchema.index({ barcode: 1 });
BottleSchema.index({ tags: 1 });

BottleSchema.virtual('ageStatement').get(function() {
  if (this.age) {
    return `${this.age} Year`;
  }
  return 'NAS';
});

BottleSchema.virtual('displaySize').get(function() {
  return this.size === 'Other' ? 'Custom Size' : this.size;
});

const Bottle = mongoose.models.Bottle || mongoose.model<IBottle>('Bottle', BottleSchema);

export default Bottle;