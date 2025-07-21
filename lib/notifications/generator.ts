import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import Notification from '@/models/Notification';
import UserBottle from '@/models/UserBottle';
import Pour from '@/models/Pour';
import UserPreferences from '@/models/UserPreferences';
import type { NotificationType, NotificationPriority } from '@/types/notifications';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message: string;
  data?: Record<string, any>;
  actionUrl?: string;
  icon?: string;
  expiresAt?: Date;
}

export async function createNotification(params: CreateNotificationParams) {
  await dbConnect();
  
  try {
    await Notification.create({
      userId: params.userId,
      type: params.type,
      priority: params.priority || 'medium',
      title: params.title,
      message: params.message,
      data: params.data || null,
      read: false,
      actionUrl: params.actionUrl || null,
      icon: params.icon || null,
      expiresAt: params.expiresAt || null
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

export async function checkPourReminders() {
  try {
    await dbConnect();
    
    // Get pours that haven't been rated and are older than the reminder delay
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const unratedPours = await Pour.find({
      rating: null,
      notes: null,
      createdAt: { $lt: oneDayAgo }
    }).populate('userBottleId');

  for (const pour of unratedPours) {
    if (!pour.userBottleId || typeof pour.userBottleId === 'string') continue;
    
    // Get the bottle details
    const UserBottle = mongoose.model('UserBottle');
    const userBottle = await UserBottle.findById(pour.userBottleId).populate('masterBottleId');
    if (!userBottle || !userBottle.masterBottleId) continue;
    
    // Check if reminder already sent
    const existingNotification = await Notification.findOne({
      userId: pour.userId.toString(),
      type: 'pour_reminder',
      'data.pourId': pour._id.toString()
    });

    if (!existingNotification) {
      // Check user preferences
      const preferences = await UserPreferences.findOne({ userId: pour.userId.toString() });
      if (preferences?.pourReminders ?? true) {
        const reminderDelay = preferences?.pourReminderDelay || 24;
        const reminderTime = new Date(pour.createdAt.getTime() + reminderDelay * 60 * 60 * 1000);
        
        if (new Date() >= reminderTime) {
          await createNotification({
            userId: pour.userId.toString(),
            type: 'pour_reminder',
            priority: 'low',
            title: 'Rate Your Pour',
            message: `How was the ${userBottle.masterBottleId.name}? Add your rating and tasting notes.`,
            data: { pourId: pour._id.toString(), bottleId: userBottle._id.toString() },
            actionUrl: `/pours/${pour._id}/rate`
          });
        }
      }
    }
  }
  } catch (error) {
    console.error('Error checking pour reminders:', error);
    throw error;
  }
}

export async function checkLowStock() {
  try {
    await dbConnect();
    
    // Get all unique user IDs who have bottles
    const users = await UserBottle.distinct('userId');
  
  for (const userId of users) {
    // Check user preferences
    const preferences = await UserPreferences.findOne({ userId });
    if (!(preferences?.lowStockAlerts ?? true)) continue;
    
    const threshold = preferences?.lowStockThreshold || 25;
    
    // Get bottles with low fill level for this user
    const lowStockBottles = await UserBottle.find({
      userId: userId,
      fillLevel: { $lt: threshold, $gt: 0 },
      status: 'opened'
    }).populate('masterBottleId');

    for (const bottle of lowStockBottles as any[]) {
      // Check if low stock alert already sent recently (within 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentNotification = await Notification.findOne({
        userId: bottle.userId.toString(),
        type: 'low_stock',
        'data.bottleId': bottle._id.toString(),
        createdAt: { $gt: sevenDaysAgo }
      });

      if (!recentNotification && bottle.masterBottleId) {
        const masterBottle = typeof bottle.masterBottleId === 'object' ? bottle.masterBottleId : null;
        if (masterBottle) {
          await createNotification({
            userId: bottle.userId.toString(),
            type: 'low_stock',
            priority: 'medium',
            title: 'Low Stock Alert',
            message: `${masterBottle.name} is running low (${bottle.fillLevel}% remaining)`,
            data: { bottleId: bottle._id.toString() },
            actionUrl: `/bottles/${bottle._id}`
          });
        }
      }
    }
  }
  } catch (error) {
    console.error('Error checking low stock:', error);
    throw error;
  }
}

export async function createAchievementNotification(
  userId: string,
  achievement: {
    title: string;
    description: string;
    type: string;
    data?: Record<string, any>;
  }
) {
  const preferences = await UserPreferences.findOne({ userId });
  if (!(preferences?.achievements ?? true)) return;
  
  await createNotification({
    userId,
    type: 'achievement',
    priority: 'high',
    title: `🏆 ${achievement.title}`,
    message: achievement.description,
    data: { achievementType: achievement.type, ...achievement.data },
    actionUrl: '/profile/achievements'
  });
}

export async function generateWeeklyInsights(userId: string) {
  await dbConnect();
  
  const preferences = await UserPreferences.findOne({ userId });
  if (!(preferences?.weeklyInsights ?? true)) return;
  
  // Get stats for the past week
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const weeklyPours = await Pour.find({
    userId,
    createdAt: { $gt: weekAgo }
  }).populate('bottle');

  if (weeklyPours.length === 0) {
    return;
  }

  // Calculate insights
  const totalPours = weeklyPours.length;
  const totalAmount = weeklyPours.reduce((sum, pour) => sum + (pour.amount || 0), 0);
  const ratedPours = weeklyPours.filter(p => p.rating !== null);
  const avgRating = ratedPours.length > 0
    ? ratedPours.reduce((sum, p) => sum + (p.rating || 0), 0) / ratedPours.length
    : 0;

  const categories = weeklyPours
    .map(p => p.bottle?.category)
    .filter(Boolean);
  
  const categoryCount: Record<string, number> = {};
  categories.forEach(cat => {
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
  });
  
  const favoriteCategory = Object.entries(categoryCount)
    .sort(([, a], [, b]) => b - a)[0]?.[0];

  await createNotification({
    userId,
    type: 'weekly_insight',
    priority: 'low',
    title: 'Your Weekly Whiskey Insights',
    message: `${totalPours} pours totaling ${totalAmount.toFixed(1)}oz. Average rating: ${avgRating.toFixed(1)}/5${
      favoriteCategory ? `. Favorite: ${favoriteCategory}` : ''
    }`,
    data: {
      totalPours,
      totalAmount,
      avgRating,
      favoriteCategory
    },
    actionUrl: '/analytics'
  });
}

export async function checkAndGenerateAllNotifications() {
  try {
    await Promise.all([
      checkPourReminders(),
      checkLowStock()
    ]);

    // Check if it's Sunday for weekly insights
    const today = new Date();
    if (today.getDay() === 0) { // Sunday
      const users = await UserPreferences.find({ weeklyInsights: true });
      await Promise.all(
        users.map(user => generateWeeklyInsights(user.userId))
      );
    }
  } catch (error) {
    console.error('Error generating notifications:', error);
  }
}