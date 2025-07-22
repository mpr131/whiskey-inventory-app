'use client';

import { useState, useEffect } from 'react';
import { User, UserPlus, UserX, Circle, Share2, Copy, Check } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

interface Friend {
  friendshipId: string;
  friendId: string;
  name: string;
  email: string;
  username?: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  stats?: {
    bottleCount: number;
    uniqueBottles: number;
    totalPours: number;
  };
  friendsSince: Date;
  isPouring?: boolean;
}

interface PendingRequest {
  _id: string;
  user: {
    _id: string;
    name: string;
    email: string;
    username?: string;
    avatar?: string;
    displayName?: string;
  };
  createdAt: Date;
}

export default function FriendsList() {
  const { data: session } = useSession();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingReceived, setPendingReceived] = useState<PendingRequest[]>([]);
  const [pendingSent, setPendingSent] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'friends' | 'pending'>('friends');
  const [searchEmail, setSearchEmail] = useState('');
  const [searchError, setSearchError] = useState('');
  const [showShareLink, setShowShareLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [connectMessage, setConnectMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchFriends();
    fetchPendingRequests();
    
    // Check for connect_with parameter
    const params = new URLSearchParams(window.location.search);
    const connectWith = params.get('connect_with');
    
    if (connectWith && session?.user) {
      // Automatically send friend request
      sendAutoFriendRequest(connectWith);
    }
  }, [session]);
  
  const sendAutoFriendRequest = async (username: string) => {
    try {
      const response = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientUsername: username }),
      });

      if (response.ok) {
        setConnectMessage(`Friend request sent to ${username}!`);
        fetchPendingRequests();
        // Remove the parameter from URL
        window.history.replaceState({}, '', '/friends');
      } else {
        const data = await response.json();
        if (data.error.includes('Already friends')) {
          setConnectMessage(`You're already connected with ${username}!`);
        } else if (data.error.includes('pending')) {
          setConnectMessage(`Friend request to ${username} is already pending.`);
        }
      }
    } catch (error) {
      console.error('Error sending auto friend request:', error);
    }
  };

  const fetchFriends = async () => {
    try {
      const response = await fetch('/api/friends');
      if (response.ok) {
        const data = await response.json();
        setFriends(data.friends);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const response = await fetch('/api/friends/pending');
      if (response.ok) {
        const data = await response.json();
        setPendingReceived(data.received);
        setPendingSent(data.sent);
      }
    } catch (error) {
      console.error('Error fetching pending requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async () => {
    setSearchError('');
    
    if (!searchEmail.trim()) {
      setSearchError('Please enter an email, username, or user ID');
      return;
    }

    try {
      const response = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: searchEmail.includes('@') ? searchEmail : undefined,
          recipientUsername: !searchEmail.includes('@') ? searchEmail : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSearchEmail('');
        fetchPendingRequests();
      } else {
        const data = await response.json();
        if (data.code === 'USER_NO_USERNAME') {
          setSearchError(`${data.recipientName} hasn't set up their profile yet. They need to add a username before you can connect.`);
        } else {
          setSearchError(data.error || 'Failed to send friend request');
        }
      }
    } catch (error) {
      setSearchError('Failed to send friend request');
    }
  };

  const acceptRequest = async (requestId: string) => {
    try {
      const response = await fetch(`/api/friends/accept/${requestId}`, {
        method: 'PUT',
      });

      if (response.ok) {
        fetchFriends();
        fetchPendingRequests();
      }
    } catch (error) {
      console.error('Error accepting request:', error);
    }
  };

  const rejectRequest = async (requestId: string) => {
    try {
      const response = await fetch(`/api/friends/remove/${requestId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchPendingRequests();
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  };

  const removeFriend = async (friendshipId: string) => {
    if (confirm('Are you sure you want to remove this friend?')) {
      try {
        const response = await fetch(`/api/friends/remove/${friendshipId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          fetchFriends();
        }
      } catch (error) {
        console.error('Error removing friend:', error);
      }
    }
  };

  if (loading) {
    return <div className="p-6">Loading friends...</div>;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      {connectMessage && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-600 rounded-lg">
          <p className="text-green-800 dark:text-green-300">{connectMessage}</p>
        </div>
      )}
      
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Friends</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('friends')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'friends'
                ? 'bg-amber-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Friends ({friends.length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors relative ${
              activeTab === 'pending'
                ? 'bg-amber-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Pending
            {pendingReceived.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {pendingReceived.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'friends' ? (
        <div>
          {/* Add Friend Section */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">Add a Friend</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder="Enter email or username"
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-gray-800"
                onKeyPress={(e) => e.key === 'Enter' && sendFriendRequest()}
              />
              <button
                onClick={sendFriendRequest}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Send Request
              </button>
            </div>
            {searchError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{searchError}</p>
            )}
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              Search by email, username, or user ID
            </p>
            
            {/* Share Invite Link */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
              <button
                onClick={() => setShowShareLink(!showShareLink)}
                className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Share invite link
              </button>
              
              {showShareLink && session?.user?.username && (
                <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    Share this link with friends to connect:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/auth/signin?invite_from=${session.user.username}`}
                      className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/auth/signin?invite_from=${session.user.username}`
                        );
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 2000);
                      }}
                      className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors text-sm flex items-center gap-1"
                    >
                      {linkCopied ? (
                        <><Check className="w-4 h-4" /> Copied!</>
                      ) : (
                        <><Copy className="w-4 h-4" /> Copy</>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    When they sign up, you&apos;ll automatically be connected!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Friends List */}
          <div className="space-y-3">
            {friends.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                No friends yet. Start by sending a friend request!
              </p>
            ) : (
              friends.map((friend) => (
                <div
                  key={friend.friendshipId}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <Link
                    href={`/profile/${friend.username || friend.friendId}`}
                    className="flex items-center gap-3 flex-1"
                  >
                    <div className="relative">
                      {friend.avatar ? (
                        <Image
                          src={friend.avatar}
                          alt={friend.name}
                          width={48}
                          height={48}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900 rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                        </div>
                      )}
                      {friend.isPouring && (
                        <Circle className="absolute -bottom-1 -right-1 w-4 h-4 text-green-500 fill-current" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {friend.displayName || friend.name}
                      </h4>
                      {friend.stats && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {friend.stats.bottleCount} bottles · {friend.stats.totalPours} pours
                        </p>
                      )}
                    </div>
                  </Link>
                  <button
                    onClick={() => removeFriend(friend.friendshipId)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Remove friend"
                  >
                    <UserX className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div>
          {/* Pending Requests */}
          <div className="space-y-6">
            {/* Received Requests */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Received Requests</h3>
              {pendingReceived.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No pending requests</p>
              ) : (
                <div className="space-y-3">
                  {pendingReceived.map((request) => (
                    <div
                      key={request._id}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {request.user.avatar ? (
                          <Image
                            src={request.user.avatar}
                            alt={request.user.name}
                            width={48}
                            height={48}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900 rounded-full flex items-center justify-center">
                            <User className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                          </div>
                        )}
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            {request.user.displayName || request.user.name}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {request.user.username || request.user.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => acceptRequest(request._id)}
                          className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => rejectRequest(request._id)}
                          className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sent Requests */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Sent Requests</h3>
              {pendingSent.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No sent requests</p>
              ) : (
                <div className="space-y-3">
                  {pendingSent.map((request) => (
                    <div
                      key={request._id}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {request.user.avatar ? (
                          <Image
                            src={request.user.avatar}
                            alt={request.user.name}
                            width={48}
                            height={48}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900 rounded-full flex items-center justify-center">
                            <User className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                          </div>
                        )}
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            {request.user.displayName || request.user.name}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Request sent
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => rejectRequest(request._id)}
                        className="px-3 py-1 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}