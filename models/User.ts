import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  isAdmin: boolean;
  inviteCodeUsed: string;
  barcodePrefix?: string;
  lastBarcodeSequence: number;
  lastPrintSessionDate?: Date;
  labelPrintPreferences?: {
    defaultFormat?: 'dymo' | 'avery5160' | 'avery5163' | 'custom';
    customSize?: {
      width: string;
      height: string;
    };
  };
  lastLogin?: Date;
  resetPasswordToken?: string;
  resetPasswordExpiry?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot be more than 100 characters'],
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    inviteCodeUsed: {
      type: String,
      required: [true, 'Invite code is required'],
    },
    barcodePrefix: {
      type: String,
      unique: true,
      sparse: true,
      match: [/^[A-Z]{2,3}\d{3}$/, 'Barcode prefix must be 2-3 uppercase letters followed by 3 digits (e.g., WV001)'],
    },
    lastBarcodeSequence: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastPrintSessionDate: Date,
    labelPrintPreferences: {
      defaultFormat: {
        type: String,
        enum: ['dymo', 'avery5160', 'avery5163', 'custom'],
        default: 'dymo',
      },
      customSize: {
        width: String,
        height: String,
      },
    },
    lastLogin: {
      type: Date,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpiry: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;