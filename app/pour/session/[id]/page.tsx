'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ChevronLeft, Wine, Calendar, MapPin, Users, Tag, Star, UserPlus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { formatDate, formatTime, formatPourDateTime } from '@/lib/date-utils';

interface Pour {
  _id: string;
  amount: number;
  rating?: number;
  notes?: string;
  companions?: string[];
  tags?: string[];
  location?: string;
  costPerPour?: number;
  date: string;
  userBottleId: {
    _id: string;
    masterBottleId: {
      name: string;
      distillery: string;
    };
  };
}

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
}

export default function PourSessionPage() {
  const { id } = useParams();
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [pourSession, setPourSession] = useState<PourSession | null>(null);
  const [pours, setPours] = useState<Pour[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingPour, setDeletingPour] = useState<string | null>(null);

  const handleDeletePour = async (pourId: string) => {
    if (!confirm('Are you sure you want to delete this pour?')) {
      return;
    }

    setDeletingPour(pourId);
    try {
      const response = await fetch(`/api/pours/${pourId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Remove the deleted pour from the list
        setPours(pours.filter(p => p._id !== pourId));

        // Update session statistics if needed
        if (pourSession) {
          const deletedPour = pours.find(p => p._id === pourId);
          if (deletedPour) {
            setPourSession({
              ...pourSession,
              totalPours: pourSession.totalPours - 1,
              totalAmount: pourSession.totalAmount - deletedPour.amount,
              totalCost: pourSession.totalCost ?
                pourSession.totalCost - (deletedPour.costPerPour || 0) : undefined,
              averageRating: pourSession.averageRating ?
                calculateNewAverage(pours.filter(p => p._id !== pourId)) : undefined
            });
          }
        }
      } else {
        const error = await response.json();
        alert(`Failed to delete pour: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting pour:', error);
      alert('Failed to delete pour. Please try again.');
    } finally {
      setDeletingPour(null);
    }
  };

  const calculateNewAverage = (remainingPours: Pour[]) => {
    const ratedPours = remainingPours.filter(p => p.rating);
    if (ratedPours.length === 0) return undefined;
    const sum = ratedPours.reduce((acc, p) => acc + (p.rating || 0), 0);
    return parseFloat((sum / ratedPours.length).toFixed(1));
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        // Handle orphaned pours virtual session
        if (id === 'orphaned-pours') {
          const orphanedResponse = await fetch('/api/pours/orphaned');
          if (orphanedResponse.ok) {
            const orphanedData = await orphanedResponse.json();
            
            // Create virtual session object
            setPourSession({
              _id: 'orphaned-pours',
              sessionName: 'Ungrouped Pours (Last 24h)',
              date: new Date().toISOString(),
              totalPours: orphanedData.stats.totalPours,
              averageRating: orphanedData.stats.averageRating,
              totalAmount: orphanedData.stats.totalAmount,
              totalCost: orphanedData.stats.totalCost,
            });
            
            setPours(orphanedData.pours);
          }
        } else {
          // Fetch regular session details
          const sessionResponse = await fetch(`/api/pour-sessions/${id}`);
          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            setPourSession(sessionData.session);
          }

          // Fetch pours in this session
          const poursResponse = await fetch(`/api/pours?sessionId=${id}`);
          if (poursResponse.ok) {
            const poursData = await poursResponse.json();
            setPours(poursData.pours);
          }
        }
      } catch (error) {
        console.error('Error fetching session:', error);
      } finally {
        setLoading(false);
      }
    };

    if (id && session?.user) {
      fetchSession();
    }
  }, [id, session]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-copper animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!pourSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Session not found</p>
          <Link href="/bottles" className="text-copper hover:text-copper-light">
            Back to Bottles
          </Link>
        </div>
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
          <h1 className="text-xl font-bold text-copper">Pour Session</h1>
          <Link
            href="/pour/quick"
            className="p-2 -mr-2 text-gray-400 hover:text-copper"
          >
            <Wine className="w-6 h-6" />
          </Link>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto">
        {/* Session Summary */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">{pourSession.sessionName}</h2>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-700/50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-copper">{pourSession.totalPours}</div>
              <div className="text-sm text-gray-400">Pours</div>
            </div>
            
            <div className="bg-gray-700/50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-copper">{pourSession.totalAmount.toFixed(1)}oz</div>
              <div className="text-sm text-gray-400">Total</div>
            </div>
            
            {pourSession.averageRating && (
              <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-copper">{pourSession.averageRating}</div>
                <div className="text-sm text-gray-400">Avg Rating</div>
              </div>
            )}
            
            {pourSession.totalCost && (
              <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-copper">${pourSession.totalCost.toFixed(2)}</div>
                <div className="text-sm text-gray-400">Total Cost</div>
              </div>
            )}
          </div>

          {/* Session Details */}
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-gray-300">
              <Calendar className="w-4 h-4 text-gray-500" />
              {formatDate(pourSession.date, { includeWeekday: true })} at {formatTime(pourSession.date)}
            </div>

            {pourSession.location && (
              <div className="flex items-center gap-2 text-gray-300">
                <MapPin className="w-4 h-4 text-gray-500" />
                {pourSession.location}
              </div>
            )}

            {((pourSession.companionTags && pourSession.companionTags.length > 0) || 
              (pourSession.companions && pourSession.companions.length > 0)) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-300">
                  <Users className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">Poured with</span>
                </div>
                <div className="flex flex-wrap gap-2 ml-6">
                  {pourSession.companionTags && pourSession.companionTags.length > 0 ? (
                    pourSession.companionTags.map((companion: Companion, index: number) => {
                      const friend = companion.friendId;
                      const isPopulated = friend && typeof friend === 'object';
                      
                      return (
                        <div 
                          key={`${companion.type}-${companion.friendId || companion.name}-${index}`} 
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                            companion.type === 'friend' 
                              ? 'bg-copper/20 text-copper border border-copper/30' 
                              : 'bg-gray-700 text-gray-300 border border-gray-600'
                          }`}
                        >
                          {companion.type === 'friend' && isPopulated && friend.avatar ? (
                            <Image
                              src={friend.avatar}
                              alt={friend.displayName || friend.name}
                              width={20}
                              height={20}
                              className="rounded-full"
                            />
                          ) : companion.type === 'friend' ? (
                            <div className="w-5 h-5 bg-copper/30 rounded-full flex items-center justify-center">
                              <Users className="w-3 h-3" />
                            </div>
                          ) : null}
                          
                          <span>
                            {companion.type === 'friend' 
                              ? (isPopulated 
                                ? friend.displayName || friend.name || companion.name
                                : companion.name)
                              : `"${companion.name}"`}
                          </span>
                          
                          {companion.type === 'text' && (
                            <button
                              onClick={() => {
                                // TODO: Implement quick add friend
                                console.log('Add friend:', companion.name);
                              }}
                              className="ml-1 p-1 hover:bg-gray-600 rounded-full transition-colors"
                              title="Add as friend"
                            >
                              <UserPlus className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  ) : pourSession.companions ? (
                    pourSession.companions.map((companion: string) => (
                      <div key={companion} className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-700 rounded-full text-sm">
                        <span>{companion}</span>
                        <button
                          onClick={() => {
                            // TODO: Implement quick add friend
                            console.log('Add friend:', companion);
                          }}
                          className="ml-1 p-1 hover:bg-gray-600 rounded-full transition-colors"
                          title="Add as friend"
                        >
                          <UserPlus className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  ) : null}
                </div>
              </div>
            )}

            {pourSession.tags && pourSession.tags.length > 0 && (
              <div className="flex items-start gap-2">
                <Tag className="w-4 h-4 text-gray-500 mt-0.5" />
                <div className="flex flex-wrap gap-2">
                  {pourSession.tags.map((tag) => (
                    <span key={tag} className="px-2 py-1 bg-copper/20 text-copper rounded-full text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pour List */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold mb-4">Pours in this Session</h3>
          
          {pours.map((pour) => (
            <div key={pour._id} className="bg-gray-800 rounded-lg p-4 relative">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-semibold">{pour.userBottleId.masterBottleId.name}</h4>
                  <p className="text-sm text-gray-400">{pour.userBottleId.masterBottleId.distillery}</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="text-right">
                    <div className="text-lg font-bold text-copper">{pour.amount}oz</div>
                    {pour.costPerPour && (
                      <div className="text-sm text-gray-400">${pour.costPerPour.toFixed(2)}</div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeletePour(pour._id)}
                    disabled={deletingPour === pour._id}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete this pour"
                  >
                    {deletingPour === pour._id ? (
                      <div className="w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
              
              {pour.rating && (
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-copper" />
                  <span className="text-copper font-medium">{pour.rating}/10</span>
                </div>
              )}
              
              {pour.notes && (
                <p className="text-sm text-gray-300 mt-2">{pour.notes}</p>
              )}
              
              <div className="text-xs text-gray-500 mt-2">
                {formatPourDateTime(pour.date, pourSession.date)}
              </div>
            </div>
          ))}
        </div>

        {/* Add Another Pour */}
        <div className="mt-8 text-center">
          <Link
            href="/pour/quick"
            className="inline-flex items-center gap-2 bg-copper hover:bg-copper-light text-white font-medium py-3 px-6 rounded-lg transition-all"
          >
            <Wine className="w-5 h-5" />
            Add Another Pour
          </Link>
        </div>
      </main>
    </div>
  );
}