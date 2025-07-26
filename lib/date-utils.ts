/**
 * Date utility functions for consistent date/time formatting across the app
 */

/**
 * Format a date for display in the UI
 * @param date - The date to format (string or Date object)
 * @param options - Formatting options
 * @returns Formatted date string
 */
export function formatDate(date: string | Date, options: {
  includeTime?: boolean;
  includeWeekday?: boolean;
  relative?: boolean;
} = {}) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const opts = { includeTime: false, includeWeekday: false, relative: false, ...options };

  // Check if date is today
  const isToday = dateObj.toDateString() === now.toDateString();
  
  // Check if date is yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = dateObj.toDateString() === yesterday.toDateString();

  // For relative dates
  if (opts.relative && (isToday || isYesterday)) {
    const timeStr = dateObj.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    if (isToday) {
      return opts.includeTime ? `Today at ${timeStr}` : 'Today';
    } else {
      return opts.includeTime ? `Yesterday at ${timeStr}` : 'Yesterday';
    }
  }

  // Build format options
  const formatOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };

  if (opts.includeWeekday) {
    formatOptions.weekday = 'short';
  }

  if (opts.includeTime) {
    formatOptions.hour = 'numeric';
    formatOptions.minute = '2-digit';
    formatOptions.hour12 = true;
  }

  return dateObj.toLocaleDateString('en-US', formatOptions);
}

/**
 * Format time only
 * @param date - The date to extract time from
 * @returns Formatted time string
 */
export function formatTime(date: string | Date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format date and time separately (for headers)
 * @param date - The date to format
 * @returns Object with formatted date and time
 */
export function formatDateTime(date: string | Date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return {
    date: formatDate(dateObj, { includeWeekday: true }),
    time: formatTime(dateObj),
  };
}

/**
 * Check if two dates are on the same day
 * @param date1 - First date
 * @param date2 - Second date
 * @returns True if dates are on the same day
 */
export function isSameDay(date1: string | Date, date2: string | Date): boolean {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  
  return d1.toDateString() === d2.toDateString();
}

/**
 * Get relative time description (e.g., "2 hours ago")
 * @param date - The date to compare
 * @returns Relative time string
 */
export function getRelativeTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  
  return formatDate(dateObj);
}

/**
 * Format date for display in pour context
 * Shows time only if it's the same day as the session, otherwise shows date + time
 * @param pourDate - The pour date
 * @param sessionDate - The session date for comparison
 * @returns Formatted date/time string
 */
export function formatPourDateTime(pourDate: string | Date, sessionDate: string | Date): string {
  if (isSameDay(pourDate, sessionDate)) {
    // Same day - show time only
    return formatTime(pourDate);
  } else {
    // Different day - show full date and time
    return formatDate(pourDate, { includeTime: true });
  }
}