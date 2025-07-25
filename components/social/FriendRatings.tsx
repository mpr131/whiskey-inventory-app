'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star, Users, TrendingUp, TrendingDown } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface FriendBottleInfo {
  friend: {
    _id: string;
    name: string;
    username?: string;
    displayName?: string;
    avatar?: string;
  };
  bottle: {
    status: 'unopened' | 'opened' | 'finished';
    averageRating?: number;
    totalPours?: number;
    lastPourDate?: string;
    fillLevel?: number;
  };
}

interface FriendRatingsProps {
  masterBottleId: string;
  currentUserRating?: number;
}

export default function FriendRatings({ masterBottleId, currentUserRating }: FriendRatingsProps) {
  const [friendsData, setFriendsData] = useState<FriendBottleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFriendsWithBottle = useCallback(async () => {
    try {
      const response = await fetch(`/api/bottles/${masterBottleId}/friends`);
      
      if (response.ok) {
        const data = await response.json();
        setFriendsData(data.friendsWithBottle);
      } else if (response.status === 401) {
        // User not logged in
        setError('Login to see friends\' ratings');
      } else {
        setError('Failed to load friends\' ratings');
      }
    } catch (error) {
      console.error('Error fetching friends with bottle:', error);
      setError('Failed to load friends\' ratings');
    } finally {
      setLoading(false);
    }
  }, [masterBottleId]);

  useEffect(() => {
    fetchFriendsWithBottle();
  }, [masterBottleId, fetchFriendsWithBottle]);

  const getRatingDifference = (friendRating?: number) => {
    if (!currentUserRating || !friendRating) return null;
    return friendRating - currentUserRating;
  };

  const getRatingColor = (rating?: number) => {
    if (!rating) return 'text-gray-400';
    if (rating >= 8) return 'text-green-600 dark:text-green-400';
    if (rating >= 6) return 'text-amber-600 dark:text-amber-400';
    if (rating >= 4) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4" />
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 mt-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <Users className="w-5 h-5" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (friendsData.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          Friends Who Own This Bottle
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          None of your friends have this bottle in their collection yet.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        Friends Who Own This Bottle
        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
          ({friendsData.length})
        </span>
      </h3>

      <div className="space-y-4">
        {friendsData.map(({ friend, bottle }) => {
          const ratingDiff = getRatingDifference(bottle.averageRating);
          
          return (
            <div
              key={friend._id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Link
                href={`/profile/${friend.username || friend._id}`}
                className="flex items-center gap-3 flex-1"
              >
                {/* Avatar */}
                {friend.avatar ? (
                  <Image
                    src={friend.avatar}
                    alt={friend.name}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                      {friend.name[0].toUpperCase()}
                    </span>
                  </div>
                )}

                {/* Friend Info */}
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {friend.displayName || friend.name}
                  </p>
                  <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                    {bottle.totalPours ? (
                      <span>{bottle.totalPours} pours</span>
                    ) : null}
                    {bottle.status === 'finished' && (
                      <span className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded">
                        Finished
                      </span>
                    )}
                  </div>
                </div>
              </Link>

              {/* Rating */}
              <div className="flex items-center gap-2">
                {bottle.averageRating && (
                  <div className="flex items-center gap-1">
                    <Star className={`w-4 h-4 fill-current ${getRatingColor(bottle.averageRating)}`} />
                    <span className={`font-semibold ${getRatingColor(bottle.averageRating)}`}>
                      {bottle.averageRating.toFixed(1)}
                    </span>
                  </div>
                )}

                {/* Rating Difference */}
                {ratingDiff !== null && ratingDiff !== 0 && (
                  <div
                    className={`flex items-center gap-0.5 text-xs ${
                      ratingDiff > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}
                    title={`${Math.abs(ratingDiff).toFixed(1)} points ${ratingDiff > 0 ? 'higher' : 'lower'} than your rating`}
                  >
                    {ratingDiff > 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {Math.abs(ratingDiff).toFixed(1)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Average Friend Rating */}
      {friendsData.some(f => f.bottle.averageRating) && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Average friend rating:</span>
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-current text-amber-600 dark:text-amber-400" />
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {(
                  friendsData
                    .filter(f => f.bottle.averageRating)
                    .reduce((sum, f) => sum + (f.bottle.averageRating || 0), 0) /
                  friendsData.filter(f => f.bottle.averageRating).length
                ).toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}