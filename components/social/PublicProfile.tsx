'use client';

import { useState, useEffect } from 'react';
import { User, Package, Wine, Star, Settings, UserPlus, UserCheck, Lock } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface ProfileData {
  _id: string;
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  createdAt: string;
  isOwnProfile: boolean;
  isFriend: boolean;
  friendshipStatus: 'none' | 'pending' | 'accepted' | 'blocked' | null;
  stats?: {
    bottleCount: number;
    uniqueBottles: number;
    totalPours: number;
    favoriteBrand?: string;
  };
  privacy?: {
    showCollection: 'public' | 'friends' | 'private';
    showPours: 'public' | 'friends' | 'private';
    showRatings: 'public' | 'friends' | 'private';
    showValue: 'never';
  };
}

interface PublicProfileProps {
  username: string;
}

export default function PublicProfile({ username }: PublicProfileProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bottles, setBottles] = useState<any[]>([]);
  const [bottlesLoading, setBottlesLoading] = useState(false);
  const [canViewCollection, setCanViewCollection] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [username]);

  useEffect(() => {
    if (profile && canViewCollection) {
      fetchBottles();
    }
  }, [profile, canViewCollection]);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`/api/users/${username}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('User not found');
        } else {
          setError('Failed to load profile');
        }
        return;
      }

      const data = await response.json();
      setProfile(data);

      // Check if we can view the collection
      const canView = 
        data.isOwnProfile ||
        data.privacy?.showCollection === 'public' ||
        (data.privacy?.showCollection === 'friends' && data.isFriend);
      
      setCanViewCollection(canView);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchBottles = async () => {
    setBottlesLoading(true);
    try {
      const response = await fetch(`/api/users/${username}/collection?limit=12`);
      
      if (response.ok) {
        const data = await response.json();
        setBottles(data.bottles);
      }
    } catch (error) {
      console.error('Error fetching bottles:', error);
    } finally {
      setBottlesLoading(false);
    }
  };

  const sendFriendRequest = async () => {
    try {
      const response = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientUsername: username }),
      });

      if (response.ok) {
        // Refresh profile to update friendship status
        fetchProfile();
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="animate-pulse">
          <div className="flex items-center gap-6 mb-8">
            <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <div className="flex-1">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-2" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-64" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">{error || 'Profile not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Profile Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {profile.avatar ? (
              <Image
                src={profile.avatar}
                alt={profile.displayName}
                width={96}
                height={96}
                className="rounded-full"
              />
            ) : (
              <div className="w-24 h-24 bg-amber-100 dark:bg-amber-900 rounded-full flex items-center justify-center">
                <User className="w-12 h-12 text-amber-600 dark:text-amber-400" />
              </div>
            )}
          </div>

          {/* Profile Info */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {profile.displayName}
                </h1>
                <p className="text-gray-600 dark:text-gray-400">@{profile.username}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {profile.isOwnProfile ? (
                  <Link
                    href="/settings/profile"
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    Edit Profile
                  </Link>
                ) : session && (
                  <>
                    {profile.friendshipStatus === 'none' && (
                      <button
                        onClick={sendFriendRequest}
                        className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2"
                      >
                        <UserPlus className="w-4 h-4" />
                        Add Friend
                      </button>
                    )}
                    {profile.friendshipStatus === 'pending' && (
                      <button
                        disabled
                        className="px-4 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed flex items-center gap-2"
                      >
                        <UserCheck className="w-4 h-4" />
                        Request Pending
                      </button>
                    )}
                    {profile.friendshipStatus === 'accepted' && (
                      <button
                        disabled
                        className="px-4 py-2 bg-green-600 text-white rounded-lg cursor-not-allowed flex items-center gap-2"
                      >
                        <UserCheck className="w-4 h-4" />
                        Friends
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="text-gray-700 dark:text-gray-300 mb-4">{profile.bio}</p>
            )}

            {/* Stats */}
            {profile.stats && (
              <div className="flex flex-wrap gap-6 text-sm">
                {profile.stats.bottleCount !== undefined && (
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="font-semibold">{profile.stats.bottleCount}</span>
                    <span className="text-gray-600 dark:text-gray-400">bottles</span>
                  </div>
                )}
                {profile.stats.uniqueBottles !== undefined && (
                  <div className="flex items-center gap-2">
                    <Wine className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="font-semibold">{profile.stats.uniqueBottles}</span>
                    <span className="text-gray-600 dark:text-gray-400">unique</span>
                  </div>
                )}
                {profile.stats.totalPours !== undefined && (
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="font-semibold">{profile.stats.totalPours}</span>
                    <span className="text-gray-600 dark:text-gray-400">pours</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Collection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          Collection
        </h2>

        {canViewCollection ? (
          bottlesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                </div>
              ))}
            </div>
          ) : bottles.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bottles.map((bottle) => (
                  <div
                    key={bottle._id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg transition-shadow"
                  >
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                      {bottle.masterBottle.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {bottle.masterBottle.producer}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        bottle.status === 'unopened'
                          ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                          : bottle.status === 'opened'
                          ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}>
                        {bottle.status}
                      </span>
                      {bottle.averageRating && (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-current text-amber-600 dark:text-amber-400" />
                          <span className="font-medium">{bottle.averageRating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {bottles.length >= 12 && (
                <div className="mt-6 text-center">
                  <Link
                    href={`/profile/${username}/collection`}
                    className="text-amber-600 dark:text-amber-400 hover:underline"
                  >
                    View full collection →
                  </Link>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">No bottles in collection yet.</p>
          )
        ) : (
          <div className="text-center py-8">
            <Lock className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {profile.isOwnProfile
                ? 'Your collection is set to private'
                : profile.privacy?.showCollection === 'friends'
                ? 'This collection is only visible to friends'
                : 'This collection is private'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}