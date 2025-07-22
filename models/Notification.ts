import mongoose, { Schema, model, models } from 'mongoose';

export interface INotification {
  userId: string;
  type: 'pour_reminder' | 'low_stock' | 'achievement' | 'weekly_insight' | 'new_feature' | 'system' | 'friend_request' | 'friend_request_accepted' | 'pour_cheers' | 'bottle_rating';
  priority: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: Date;
  expiresAt?: Date;
  actionUrl?: string;
  icon?: string;
}

const notificationSchema = new Schema<INotification>({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['pour_reminder', 'low_stock', 'achievement', 'weekly_insight', 'new_feature', 'system', 'friend_request', 'friend_request_accepted', 'pour_cheers', 'bottle_rating'],
    index: true,
  },
  priority: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  data: {
    type: Schema.Types.Mixed,
    default: null,
  },
  read: {
    type: Boolean,
    default: false,
    index: true,
  },
  actionUrl: {
    type: String,
    default: null,
  },
  icon: {
    type: String,
    default: null,
  },
  expiresAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

// Index for efficient queries
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

// Auto-delete expired notifications
notificationSchema.pre('find', function() {
  this.where({ $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] });
});

const Notification = models.Notification || model<INotification>('Notification', notificationSchema);

export default Notification;