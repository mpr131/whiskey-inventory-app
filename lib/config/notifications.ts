// Notification System Configuration
// All values can be overridden via environment variables

export const notificationConfig = {
  // Polling and Display
  pollInterval: parseInt(process.env.NOTIFICATION_POLL_INTERVAL || '60000'), // 1 minute
  fetchLimit: parseInt(process.env.NOTIFICATION_FETCH_LIMIT || '50'),
  maxUnreadDisplay: parseInt(process.env.NOTIFICATION_MAX_UNREAD_DISPLAY || '9'),
  
  // Pour Reminder Settings
  pourReminder: {
    defaultDelayHours: parseInt(process.env.DEFAULT_POUR_REMINDER_DELAY_HOURS || '24'),
    minDelayHours: parseInt(process.env.MIN_POUR_REMINDER_DELAY_HOURS || '1'),
    maxDelayHours: parseInt(process.env.MAX_POUR_REMINDER_DELAY_HOURS || '168'), // 1 week
    checkThresholdHours: parseInt(process.env.POUR_REMINDER_CHECK_THRESHOLD_HOURS || '24'),
  },
  
  // Low Stock Settings
  lowStock: {
    defaultThresholdPercent: parseInt(process.env.DEFAULT_LOW_STOCK_THRESHOLD_PERCENT || '25'),
    minThresholdPercent: parseInt(process.env.MIN_LOW_STOCK_THRESHOLD_PERCENT || '5'),
    maxThresholdPercent: parseInt(process.env.MAX_LOW_STOCK_THRESHOLD_PERCENT || '50'),
    notificationCooldownDays: parseInt(process.env.LOW_STOCK_NOTIFICATION_COOLDOWN_DAYS || '7'),
  },
  
  // Weekly Insights Settings
  weeklyInsights: {
    defaultDay: parseInt(process.env.DEFAULT_WEEKLY_INSIGHT_DAY || '0'), // 0 = Sunday
    lookbackDays: parseInt(process.env.WEEKLY_INSIGHTS_LOOKBACK_DAYS || '7'),
  },
  
  // Cron Job Settings
  cron: {
    intervalSeconds: parseInt(process.env.NOTIFICATION_CRON_INTERVAL_SECONDS || '3600'), // 1 hour
    ratingCalculationHour: parseInt(process.env.RATING_CALCULATION_HOUR || '2'),
    ratingCalculationMinute: parseInt(process.env.RATING_CALCULATION_MINUTE || '0'),
  },
  
  // Other Settings
  preferenceSaveDebounceMs: parseInt(process.env.PREFERENCE_SAVE_DEBOUNCE_MS || '500'),
};

// Helper functions to convert hours/days to milliseconds
export const hoursToMs = (hours: number) => hours * 60 * 60 * 1000;
export const daysToMs = (days: number) => days * 24 * 60 * 60 * 1000;