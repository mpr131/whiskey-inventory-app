'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Wine, Calendar, MapPin, Users, Tag, Star, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate, formatTime } from '@/lib/date-utils';

interface Companion {
  type: 'friend' | 'text';
  friendId?: string | {
    _id: string;
    name: string;
    displayName?: string;
    username?: string;
    avatar?: string;
  };
  name: string;
}

interface PourSession {
  _id: string;
  sessionName: string;
  date: string;
  totalPours: number;
  averageRating?: number;
  totalAmount: number;
  totalCost?: number;
  companions?: string[];
  companionTags?: Companion[];
  location?: string;
  tags?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  isVirtual?: boolean;
}

export default function PourSessionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [sessions, setSessions] = useState<PourSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch(`/api/pour-sessions?page=${page}&limit=20`);
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions);
        setTotalPages(data.pagination.pages);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to load pour sessions');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetchSessions();
    }
  }, [session, page, fetchSessions]);


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-copper animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 text-gray-400 hover:text-white"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-copper">Pour Sessions</h1>
          <Link
            href="/pour/quick"
            className="p-2 -mr-2 text-gray-400 hover:text-copper"
          >
            <Plus className="w-6 h-6" />
          </Link>
        </div>
      </header>

      <main className="p-4 max-w-4xl mx-auto">
        {sessions.length === 0 ? (
          <div className="text-center py-16">
            <Wine className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-400 mb-2">No Pour Sessions Yet</h2>
            <p className="text-gray-500 mb-6">Start tracking your whiskey journey</p>
            <Link
              href="/pour/quick"
              className="inline-flex items-center gap-2 bg-copper hover:bg-copper-light text-white font-medium py-3 px-6 rounded-lg transition-all"
            >
              <Wine className="w-5 h-5" />
              Start First Session
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <Link
                key={session._id}
                href={session.isVirtual ? '/pour/quick' : `/pour/session/${session._id}`}
                className={`block ${session.isVirtual ? 'bg-amber-900/20 border border-amber-800/50' : 'bg-gray-800'} hover:bg-gray-750 rounded-xl p-6 transition-all`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">{session.sessionName}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Calendar className="w-4 h-4" />
                      {formatDate(session.date, { includeWeekday: true })} at {formatTime(session.date)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-copper">{session.totalPours}</div>
                    <div className="text-xs text-gray-400">pours</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                    <div className="text-lg font-semibold text-white">{session.totalAmount.toFixed(1)}oz</div>
                    <div className="text-xs text-gray-400">Total</div>
                  </div>
                  
                  {session.averageRating && (
                    <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                      <div className="text-lg font-semibold text-copper flex items-center justify-center gap-1">
                        <Star className="w-4 h-4" />
                        {session.averageRating.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-400">Avg Rating</div>
                    </div>
                  )}
                  
                  {session.totalCost !== undefined && (
                    <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                      <div className="text-lg font-semibold text-white">${session.totalCost.toFixed(2)}</div>
                      <div className="text-xs text-gray-400">Cost</div>
                    </div>
                  )}
                  
                  {session.location && (
                    <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                      <div className="text-lg font-semibold text-white flex items-center justify-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {session.location}
                      </div>
                      <div className="text-xs text-gray-400">Location</div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {/* Display companionTags (new format) or companions (legacy) */}
                  {((session.companionTags && session.companionTags.length > 0) || 
                    (session.companions && session.companions.length > 0)) && (
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-gray-500" />
                      <div className="flex flex-wrap gap-1">
                        {session.companionTags && session.companionTags.length > 0 ? (
                          session.companionTags.map((companion: Companion, index: number) => {
                            const friend = companion.friendId;
                            const isPopulated = friend && typeof friend === 'object';
                            
                            return (
                              <span 
                                key={`${companion.type}-${companion.friendId || companion.name}-${index}`}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                                  companion.type === 'friend' 
                                    ? 'bg-copper/20 text-copper' 
                                    : 'bg-gray-700 text-gray-300'
                                }`}
                              >
                                {companion.type === 'friend' 
                                  ? (isPopulated 
                                    ? friend.displayName || friend.name || companion.name
                                    : companion.name)
                                  : `"${companion.name}"`}
                              </span>
                            );
                          })
                        ) : (
                          // Legacy companions display
                          <span className="text-gray-400">{session.companions!.join(', ')}</span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {session.tags && session.tags.map((tag) => (
                    <span key={tag} className="text-xs px-2 py-1 bg-copper/20 text-copper rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex justify-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <div className="flex items-center px-4">
              Page {page} of {totalPages}
            </div>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
}