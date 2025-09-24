'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, X, Wine, TrendingDown, Trophy, BarChart3, Sparkles, AlertCircle, Users, Heart, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { haptic } from '@/utils/haptics';
import type { Notification, NotificationType } from '@/types/notifications';

interface NotificationCenterProps {
  userId: string;
}

export default function NotificationCenter({ userId }: NotificationCenterProps) {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every minute
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [userId]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      console.log('Fetching notifications...');
      const response = await fetch('/api/notifications');
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Notifications data:', data);
        
        // Add null checks
        const notificationsList = data.notifications || [];
        console.log('Notifications list:', notificationsList);
        
        setNotifications(notificationsList);
        setUnreadCount(notificationsList.filter((n: Notification) => !n.read).length);
      } else {
        const errorData = await response.json();
        console.error('API error:', errorData);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
      });
      
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    haptic.light();
    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      });
      
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      haptic.success();
    } catch (error) {
      console.error('Error deleting notification:', error);
      haptic.error();
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    haptic.light();
    markAsRead(notification.id);
    
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
      setIsOpen(false);
    }
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'pour_reminder':
        return <Wine className="w-5 h-5" />;
      case 'low_stock':
        return <TrendingDown className="w-5 h-5" />;
      case 'achievement':
        return <Trophy className="w-5 h-5" />;
      case 'weekly_insight':
        return <BarChart3 className="w-5 h-5" />;
      case 'new_feature':
        return <Sparkles className="w-5 h-5" />;
      case 'system':
        return <AlertCircle className="w-5 h-5" />;
      case 'friend_request':
      case 'friend_request_accepted':
        return <Users className="w-5 h-5" />;
      case 'pour_cheers':
        return <Heart className="w-5 h-5" />;
      case 'bottle_rating':
        return <Star className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const getNotificationColor = (type: NotificationType) => {
    switch (type) {
      case 'pour_reminder':
        return 'text-amber-500';
      case 'low_stock':
        return 'text-red-500';
      case 'achievement':
        return 'text-yellow-500';
      case 'weekly_insight':
        return 'text-blue-500';
      case 'new_feature':
        return 'text-purple-500';
      case 'system':
        return 'text-gray-500';
      case 'friend_request':
      case 'friend_request_accepted':
        return 'text-green-500';
      case 'pour_cheers':
        return 'text-pink-500';
      case 'bottle_rating':
        return 'text-amber-500';
      default:
        return 'text-copper';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell */}
      <button
        onClick={() => {
          haptic.light();
          console.log('Bell clicked, current isOpen:', isOpen);
          setIsOpen(!isOpen);
          console.log('Setting isOpen to:', !isOpen);
        }}
        className="relative p-2 text-gray-400 hover:text-white transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <div
            className="fixed inset-0 z-40 md:hidden"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Panel */}
          <div className="fixed md:absolute left-0 md:left-auto right-0 md:right-0 mt-2 md:w-96 max-h-[600px] bg-gray-900 border border-gray-800 rounded-lg shadow-2xl z-[9999] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Notifications</h2>
              <button
                onClick={() => {
                  haptic.light();
                  setIsOpen(false);
                }}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500">
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                  <p className="text-gray-500">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-800/50 cursor-pointer transition-colors ${
                        !notification.read ? 'bg-gray-800/30' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 ${getNotificationColor(notification.type)}`}>
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-white">
                            {notification.title}
                          </h3>
                          <p className="text-sm text-gray-400 mt-1">
                            {notification.message}
                          </p>
                          
                          {/* Friend Request Actions */}
                          {notification.type === 'friend_request' && notification.data?.friendshipId && (
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  haptic.medium();
                                  try {
                                    const response = await fetch(`/api/friends/accept/${notification.data!.friendshipId}`, {
                                      method: 'PUT',
                                    });
                                    if (response.ok) {
                                      haptic.success();
                                      await fetchNotifications();
                                    }
                                  } catch (error) {
                                    haptic.error();
                                  }
                                }}
                                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
                              >
                                Accept
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  haptic.light();
                                  try {
                                    const response = await fetch(`/api/friends/remove/${notification.data!.friendshipId}`, {
                                      method: 'DELETE',
                                    });
                                    if (response.ok) {
                                      haptic.success();
                                      await fetchNotifications();
                                    }
                                  } catch (error) {
                                    haptic.error();
                                  }
                                }}
                                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-medium rounded-lg transition-colors"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                          
                          <p className="text-xs text-gray-500 mt-2">
                            {new Date(notification.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-copper rounded-full absolute left-2 top-1/2 -translate-y-1/2" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-4 border-t border-gray-800">
                <button
                  onClick={async () => {
                    haptic.medium();
                    setLoading(true);
                    try {
                      await fetch('/api/notifications/read-all', {
                        method: 'PATCH',
                      });
                      await fetchNotifications();
                      haptic.success();
                    } catch (error) {
                      haptic.error();
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="w-full btn-secondary text-sm"
                  disabled={unreadCount === 0}
                >
                  Mark all as read
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}