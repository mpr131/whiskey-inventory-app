/**
 * Haptic feedback utility for mobile devices
 * Provides subtle vibration feedback for better UX
 */

export const haptic = {
  /**
   * Light tap feedback - for button presses, navigation
   */
  light: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  },

  /**
   * Medium feedback - for important actions like adding items
   */
  medium: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }
  },

  /**
   * Heavy feedback - for significant actions or errors
   */
  heavy: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(30);
    }
  },

  /**
   * Success pattern - for achievements, completions
   */
  success: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([10, 10, 10]); // Short bursts
    }
  },

  /**
   * Warning pattern - for alerts, low stock
   */
  warning: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([20, 10, 20]); // Medium-short-medium
    }
  },

  /**
   * Error pattern - for failures, validation errors
   */
  error: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([30, 10, 30, 10, 30]); // Three strong pulses
    }
  },

  /**
   * Selection feedback - for selecting items from lists
   */
  selection: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(5); // Very light
    }
  }
};

// Check if haptic feedback is supported
export const isHapticSupported = () => 'vibrate' in navigator;