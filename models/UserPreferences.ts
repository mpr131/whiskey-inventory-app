import mongoose, { Schema, model, models } from 'mongoose';

export interface IUserPreferences {
  userId: string;
  pourReminders: boolean;
  pourReminderDelay: number; // hours
  lowStockAlerts: boolean;
  lowStockThreshold: number; // percentage
  achievements: boolean;
  weeklyInsights: boolean;
  weeklyInsightDay: number; // 0-6 (Sunday-Saturday)
  systemNotifications: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userPreferencesSchema = new Schema<IUserPreferences>({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  pourReminders: {
    type: Boolean,
    default: true,
  },
  pourReminderDelay: {
    type: Number,
    default: 24, // 24 hours
    min: 1,
    max: 168, // 1 week
  },
  lowStockAlerts: {
    type: Boolean,
    default: true,
  },
  lowStockThreshold: {
    type: Number,
    default: 25, // 25%
    min: 5,
    max: 50,
  },
  achievements: {
    type: Boolean,
    default: true,
  },
  weeklyInsights: {
    type: Boolean,
    default: true,
  },
  weeklyInsightDay: {
    type: Number,
    default: 0, // Sunday
    min: 0,
    max: 6,
  },
  systemNotifications: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

const UserPreferences = models.UserPreferences || model<IUserPreferences>('UserPreferences', userPreferencesSchema);

export default UserPreferences;