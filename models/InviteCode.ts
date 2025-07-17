import mongoose, { Schema, Document } from 'mongoose';

export interface IInviteCode extends Document {
  code: string;
  usedBy?: string;
  createdBy: string;
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InviteCodeSchema = new Schema<IInviteCode>(
  {
    code: {
      type: String,
      required: [true, 'Code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9]{8}$/, 'Code must be 8 alphanumeric characters'],
    },
    usedBy: {
      type: String,
      default: null,
    },
    createdBy: {
      type: String,
      required: [true, 'Creator email is required'],
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration date is required'],
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

InviteCodeSchema.index({ expiresAt: 1 });
InviteCodeSchema.index({ isActive: 1, expiresAt: 1 });

InviteCodeSchema.methods.isValid = function (): boolean {
  return this.isActive && this.expiresAt > new Date() && !this.usedBy;
};

InviteCodeSchema.statics.generateCode = function (): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
};

const InviteCode = mongoose.models.InviteCode || mongoose.model<IInviteCode>('InviteCode', InviteCodeSchema);

export default InviteCode;