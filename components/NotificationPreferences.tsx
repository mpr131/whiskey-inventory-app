'use client';

import { useState, useEffect } from 'react';
import { Bell, Wine, TrendingDown, Trophy, BarChart3, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import { haptic } from '@/utils/haptics';
import type { NotificationPreferences } from '@/types/notifications';

interface NotificationPreferencesProps {
  userId: string;
}

const defaultPreferences: NotificationPreferences = {
  pourReminders: true,
  pourReminderDelay: 24,
  lowStockAlerts: true,
  lowStockThreshold: 25,
  achievements: true,
  weeklyInsights: true,
  weeklyInsightDay: 0,
  systemNotifications: true,
};

const weekDays = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 
  'Thursday', 'Friday', 'Saturday'
];

export default function NotificationPreferencesComponent({ userId }: NotificationPreferencesProps) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, [userId]);

  const fetchPreferences = async () => {
    try {
      const response = await fetch('/api/user/preferences');
      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences || defaultPreferences);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: any) => {
    haptic.light();
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    
    // Debounced save
    clearTimeout((window as any).preferenceSaveTimeout);
    (window as any).preferenceSaveTimeout = setTimeout(() => savePreferences(newPreferences), 500);
  };

  const savePreferences = async (prefs: NotificationPreferences) => {
    setSaving(true);
    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: prefs }),
      });

      if (response.ok) {
        haptic.success();
        toast.success('Notification preferences saved');
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (error) {
      haptic.error();
      toast.error('Failed to save preferences');
      console.error('Error saving preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card-premium">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded w-48 mb-4"></div>
          <div className="space-y-3">
            <div className="h-12 bg-gray-700 rounded"></div>
            <div className="h-12 bg-gray-700 rounded"></div>
            <div className="h-12 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-premium">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Bell className="w-5 h-5 text-copper" />
          Notification Preferences
        </h2>
        {saving && (
          <span className="text-sm text-gray-400">Saving...</span>
        )}
      </div>

      <div className="space-y-6">
        {/* Pour Reminders */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wine className="w-5 h-5 text-amber-500" />
              <div>
                <h3 className="font-medium text-white">Pour Reminders</h3>
                <p className="text-sm text-gray-400">Get reminded to rate your pours</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.pourReminders}
                onChange={(e) => updatePreference('pourReminders', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-copper"></div>
            </label>
          </div>
          
          {preferences.pourReminders && (
            <div className="ml-8 flex items-center gap-2">
              <label className="text-sm text-gray-400">Remind after</label>
              <select
                value={preferences.pourReminderDelay}
                onChange={(e) => updatePreference('pourReminderDelay', parseInt(e.target.value))}
                className="input-premium py-1 px-2 text-sm w-20"
              >
                <option value={12}>12h</option>
                <option value={24}>24h</option>
                <option value={48}>48h</option>
                <option value={72}>72h</option>
              </select>
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingDown className="w-5 h-5 text-red-500" />
              <div>
                <h3 className="font-medium text-white">Low Stock Alerts</h3>
                <p className="text-sm text-gray-400">Know when bottles are running low</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.lowStockAlerts}
                onChange={(e) => updatePreference('lowStockAlerts', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-copper"></div>
            </label>
          </div>
          
          {preferences.lowStockAlerts && (
            <div className="ml-8 flex items-center gap-2">
              <label className="text-sm text-gray-400">Alert when below</label>
              <select
                value={preferences.lowStockThreshold}
                onChange={(e) => updatePreference('lowStockThreshold', parseInt(e.target.value))}
                className="input-premium py-1 px-2 text-sm w-24"
              >
                <option value={10}>10%</option>
                <option value={25}>25%</option>
                <option value={33}>33%</option>
                <option value={50}>50%</option>
              </select>
            </div>
          )}
        </div>

        {/* Achievements */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <div>
              <h3 className="font-medium text-white">Achievements</h3>
              <p className="text-sm text-gray-400">Celebrate milestones and accomplishments</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.achievements}
              onChange={(e) => updatePreference('achievements', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-copper"></div>
          </label>
        </div>

        {/* Weekly Insights */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              <div>
                <h3 className="font-medium text-white">Weekly Insights</h3>
                <p className="text-sm text-gray-400">Get a summary of your weekly activity</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.weeklyInsights}
                onChange={(e) => updatePreference('weeklyInsights', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-copper"></div>
            </label>
          </div>
          
          {preferences.weeklyInsights && (
            <div className="ml-8 flex items-center gap-2">
              <label className="text-sm text-gray-400">Send on</label>
              <select
                value={preferences.weeklyInsightDay}
                onChange={(e) => updatePreference('weeklyInsightDay', parseInt(e.target.value))}
                className="input-premium py-1 px-2 text-sm"
              >
                {weekDays.map((day, index) => (
                  <option key={index} value={index}>{day}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* System Notifications */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-gray-500" />
            <div>
              <h3 className="font-medium text-white">System Notifications</h3>
              <p className="text-sm text-gray-400">Updates and important announcements</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.systemNotifications}
              onChange={(e) => updatePreference('systemNotifications', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-copper"></div>
          </label>
        </div>
      </div>
    </div>
  );
}