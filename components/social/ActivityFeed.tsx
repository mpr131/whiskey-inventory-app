'use client';

import { useState, useEffect, useCallback } from 'react';
import { Wine, Star, Package, Trophy, Heart, MapPin, Clock, Plus } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface Activity {
  _id: string;
  userId: {
    _id: string;
    name: string;
    username?: string;
    avatar?: string;
    displayName?: string;
  };
  type: 'pour' | 'rating' | 'new_bottle' | 'achievement' | 'live_pour_start' | 'live_pour_end';
  targetId: string;
  metadata: {
    bottleName?: string;
    bottleImage?: string;
    rating?: number;
    pourAmount?: number;
    location?: string;
    achievement?: string;
    cheersCount?: number;
  };
  createdAt: string;
  hasUserCheered: boolean;
  isOwnActivity: boolean;
}

interface ActivityFeedProps {
  filter?: 'all' | 'pours' | 'ratings' | 'new_bottles';
}

export default function ActivityFeed({ filter = 'all' }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const fetchActivities = useCallback(async (reset = false) => {
    try {
      const currentOffset = reset ? 0 : offset;
      const response = await fetch(
        `/api/feed?limit=${limit}&offset=${currentOffset}&filter=${filter}`
      );
      
      if (response.ok) {
        const data = await response.json();
        
        if (reset) {
          setActivities(data.activities);
          setOffset(limit);
        } else {
          setActivities(prev => [...prev, ...data.activities]);
          setOffset(prev => prev + limit);
        }
        
        setHasMore(data.pagination.hasMore);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  }, [offset, filter]);

  useEffect(() => {
    fetchActivities(true);
  }, [filter, fetchActivities]);

  const handleCheers = async (activityId: string, pourId: string) => {
    try {
      const response = await fetch(`/api/pours/${pourId}/cheers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'activity' }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update the activity with new cheers count
        setActivities(prev =>
          prev.map(activity =>
            activity._id === activityId
              ? {
                  ...activity,
                  hasUserCheered: true,
                  metadata: {
                    ...activity.metadata,
                    cheersCount: data.cheersCount,
                  },
                }
              : activity
          )
        );
      }
    } catch (error) {
      console.error('Error adding cheers:', error);
    }
  };

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'pour':
      case 'live_pour_start':
      case 'live_pour_end':
        return <Wine className="w-5 h-5" />;
      case 'rating':
        return <Star className="w-5 h-5" />;
      case 'new_bottle':
        return <Package className="w-5 h-5" />;
      case 'achievement':
        return <Trophy className="w-5 h-5" />;
      default:
        return <Wine className="w-5 h-5" />;
    }
  };

  const getActivityText = (activity: Activity) => {
    const userName = activity.userId.displayName || activity.userId.name;
    const profileUrl = activity.userId.username 
      ? `/profile/${activity.userId.username}`
      : `/profile/${activity.userId._id}`;
    
    switch (activity.type) {
      case 'pour':
        return (
          <>
            <Link
              href={profileUrl}
              className="font-semibold hover:underline"
            >
              {userName}
            </Link>
            {' poured '}
            <span className="font-medium">{activity.metadata.bottleName}</span>
            {activity.metadata.pourAmount && (
              <span className="text-gray-600 dark:text-gray-400 ml-1">
                ({activity.metadata.pourAmount} oz)
              </span>
            )}
            {activity.metadata.rating && (
              <span className="text-amber-600 dark:text-amber-400 ml-2">
                ★ {activity.metadata.rating}
              </span>
            )}
          </>
        );
      case 'rating':
        return (
          <>
            <Link
              href={profileUrl}
              className="font-semibold hover:underline"
            >
              {userName}
            </Link>
            {' rated '}
            <span className="font-medium">{activity.metadata.bottleName}</span>
            {activity.metadata.rating && (
              <span className="text-amber-600 dark:text-amber-400 ml-2">
                ★ {activity.metadata.rating}
              </span>
            )}
          </>
        );
      case 'new_bottle':
        return (
          <>
            <Link
              href={profileUrl}
              className="font-semibold hover:underline"
            >
              {userName}
            </Link>
            {' added '}
            <span className="font-medium">{activity.metadata.bottleName}</span>
            {' to their collection'}
          </>
        );
      case 'live_pour_start':
        return (
          <>
            <Link
              href={profileUrl}
              className="font-semibold hover:underline"
            >
              {userName}
            </Link>
            {' is pouring '}
            <span className="font-medium">{activity.metadata.bottleName}</span>
            <span className="text-green-600 dark:text-green-400 ml-2">● Live</span>
          </>
        );
      case 'live_pour_end':
        return (
          <>
            <Link
              href={profileUrl}
              className="font-semibold hover:underline"
            >
              {userName}
            </Link>
            {' finished pouring '}
            <span className="font-medium">{activity.metadata.bottleName}</span>
            {activity.metadata.pourAmount && (
              <span className="text-gray-600 dark:text-gray-400 ml-1">
                ({activity.metadata.pourAmount} oz)
              </span>
            )}
          </>
        );
      case 'achievement':
        return (
          <>
            <Link
              href={profileUrl}
              className="font-semibold hover:underline"
            >
              {userName}
            </Link>
            {' earned '}
            <span className="font-medium">{activity.metadata.achievement}</span>
          </>
        );
      default:
        return null;
    }
  };

  if (loading && activities.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Activity Feed</h2>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {activities.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-gray-500 dark:text-gray-400 mb-4">
              No activities yet. Connect with friends to see their whiskey journey!
            </div>
            {process.env.NODE_ENV === 'development' && (
              <button
                onClick={async () => {
                  try {
                    const response = await fetch('/api/activities/test-data', {
                      method: 'POST',
                    });
                    if (response.ok) {
                      fetchActivities(true);
                    }
                  } catch (error) {
                    console.error('Error creating test data:', error);
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Generate Test Activities
              </button>
            )}
          </div>
        ) : (
          activities.map((activity) => {
            try {
              return (
                <div key={activity._id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex gap-3">
                {/* User Avatar */}
                <Link href={activity.userId.username ? `/profile/${activity.userId.username}` : `/profile/${activity.userId._id}`}>
                  {activity.userId.avatar ? (
                    <Image
                      src={activity.userId.avatar}
                      alt={activity.userId.name}
                      width={48}
                      height={48}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900 rounded-full flex items-center justify-center">
                      <span className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                        {activity.userId.name[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                </Link>

                {/* Activity Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-gray-900 dark:text-white">
                        {getActivityText(activity)}
                      </p>
                      
                      {/* Metadata */}
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                        </span>
                        
                        {activity.metadata.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {activity.metadata.location}
                          </span>
                        )}
                        
                        {activity.metadata.pourAmount && activity.type !== 'pour' && activity.type !== 'live_pour_end' && (
                          <span>{activity.metadata.pourAmount} oz</span>
                        )}
                      </div>
                    </div>

                    {/* Activity Icon */}
                    <div className="ml-4 text-gray-400 dark:text-gray-600">
                      {getActivityIcon(activity.type)}
                    </div>
                  </div>

                  {/* Bottle Image */}
                  {activity.metadata.bottleImage && (
                    <div className="mt-3">
                      <Image
                        src={activity.metadata.bottleImage}
                        alt={activity.metadata.bottleName || ''}
                        width={100}
                        height={150}
                        className="rounded-lg"
                      />
                    </div>
                  )}

                  {/* Actions */}
                  {activity.type === 'pour' && !activity.isOwnActivity && (
                    <div className="mt-3">
                      <button
                        onClick={() => handleCheers(activity._id, activity.targetId)}
                        disabled={activity.hasUserCheered}
                        className={`flex items-center gap-2 px-3 py-1 rounded-lg transition-colors ${
                          activity.hasUserCheered
                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 cursor-default'
                            : 'bg-gray-100 dark:bg-gray-700 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <Heart
                          className={`w-4 h-4 ${
                            activity.hasUserCheered ? 'fill-current' : ''
                          }`}
                        />
                        <span className="text-sm font-medium">
                          {activity.metadata.cheersCount || 0} Cheers
                        </span>
                      </button>
                    </div>
                  )}
                  </div>
                </div>
              </div>
            );
          } catch (error) {
            console.error('Error rendering activity:', activity._id, error);
            return (
              <div key={activity._id} className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                Error displaying activity
              </div>
            );
          }
        })
        )}
      </div>

      {/* Load More */}
      {hasMore && activities.length > 0 && (
        <div className="p-6 text-center">
          <button
            onClick={() => fetchActivities()}
            disabled={loading}
            className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}