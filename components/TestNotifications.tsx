'use client';

import { useState } from 'react';
import { Bell, Users, Wine, Trophy, Star } from 'lucide-react';
import { haptic } from '@/utils/haptics';

export default function TestNotifications() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const testNotifications = async () => {
    setLoading(true);
    setMessage('Creating test notifications...');
    haptic.medium();

    try {
      // Test friend request notification
      const friendRequest = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'friend_request',
          title: 'New Friend Request',
          message: 'Test User wants to be your friend',
          data: { friendshipId: 'test-friendship-123' },
          priority: 'high'
        })
      });
      console.log('Friend request notification:', await friendRequest.json());

      // Test pour reminder notification
      const pourReminder = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'pour_reminder',
          title: 'Time for a Pour!',
          message: 'You haven\'t logged a pour in 7 days',
          priority: 'medium'
        })
      });
      console.log('Pour reminder notification:', await pourReminder.json());

      // Test achievement notification
      const achievement = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'achievement',
          title: 'Achievement Unlocked!',
          message: 'You\'ve earned the "Whiskey Explorer" badge',
          data: { achievementId: 'whiskey-explorer' },
          priority: 'low',
          actionUrl: '/profile'
        })
      });
      console.log('Achievement notification:', await achievement.json());

      // Test bottle rating notification
      const bottleRating = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'bottle_rating',
          title: 'Rate Your Recent Pour',
          message: 'How was the Macallan 12 Year?',
          data: { bottleId: 'test-bottle-123' },
          priority: 'medium',
          actionUrl: '/bottles/test-bottle-123'
        })
      });
      console.log('Bottle rating notification:', await bottleRating.json());

      setMessage('Test notifications created! Refresh to see them.');
      haptic.success();
      
      // Refresh the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Error creating test notifications:', error);
      setMessage('Error creating notifications. Check console.');
      haptic.error();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Test Notifications</h3>
      <p className="text-gray-400 text-sm mb-4">
        Click the button below to create test notifications of various types.
      </p>
      
      <button
        onClick={testNotifications}
        disabled={loading}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        <Bell className="w-4 h-4" />
        {loading ? 'Creating...' : 'Create Test Notifications'}
      </button>

      {message && (
        <p className="mt-4 text-sm text-center text-gray-400">
          {message}
        </p>
      )}

      <div className="mt-6 space-y-2">
        <p className="text-xs text-gray-500">Will create:</p>
        <ul className="text-xs text-gray-400 space-y-1">
          <li className="flex items-center gap-2">
            <Users className="w-3 h-3 text-green-500" />
            Friend request notification
          </li>
          <li className="flex items-center gap-2">
            <Wine className="w-3 h-3 text-amber-500" />
            Pour reminder notification
          </li>
          <li className="flex items-center gap-2">
            <Trophy className="w-3 h-3 text-yellow-500" />
            Achievement notification
          </li>
          <li className="flex items-center gap-2">
            <Star className="w-3 h-3 text-amber-500" />
            Bottle rating notification
          </li>
        </ul>
      </div>
    </div>
  );
}