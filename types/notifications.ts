export type NotificationType = 
  | 'pour_reminder'
  | 'low_stock'
  | 'achievement'
  | 'weekly_insight'
  | 'new_feature'
  | 'system'
  | 'friend_request'
  | 'friend_request_accepted'
  | 'pour_cheers'
  | 'bottle_rating';

export type NotificationPriority = 'low' | 'medium' | 'high';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  data?: Record<string, any>; // Additional data like bottleId, pourId, etc.
  read: boolean;
  createdAt: Date;
  expiresAt?: Date;
  actionUrl?: string; // Where to navigate when clicked
  icon?: string; // Icon name or emoji
}

export interface NotificationPreferences {
  pourReminders: boolean;
  pourReminderDelay: number; // Hours after pour
  lowStockAlerts: boolean;
  lowStockThreshold: number; // Percentage
  achievements: boolean;
  weeklyInsights: boolean;
  weeklyInsightDay: number; // 0-6 (Sunday-Saturday)
  systemNotifications: boolean;
}