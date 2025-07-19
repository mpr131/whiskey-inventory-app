'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ChevronLeft, Wine, Calendar, MapPin, Users, Tag, Star } from 'lucide-react';

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

interface PourSession {
  _id: string;
  sessionName: string;
  date: string;
  totalPours: number;
  averageRating?: number;
  totalAmount: number;
  totalCost?: number;
  companions?: string[];
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

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        // Fetch session details
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
              {new Date(pourSession.date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>

            {pourSession.location && (
              <div className="flex items-center gap-2 text-gray-300">
                <MapPin className="w-4 h-4 text-gray-500" />
                {pourSession.location}
              </div>
            )}

            {pourSession.companions && pourSession.companions.length > 0 && (
              <div className="flex items-start gap-2">
                <Users className="w-4 h-4 text-gray-500 mt-0.5" />
                <div className="flex flex-wrap gap-2">
                  {pourSession.companions.map((companion) => (
                    <span key={companion} className="px-2 py-1 bg-gray-700 rounded-full text-xs">
                      {companion}
                    </span>
                  ))}
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
            <div key={pour._id} className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold">{pour.userBottleId.masterBottleId.name}</h4>
                  <p className="text-sm text-gray-400">{pour.userBottleId.masterBottleId.distillery}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-copper">{pour.amount}oz</div>
                  {pour.costPerPour && (
                    <div className="text-sm text-gray-400">${pour.costPerPour.toFixed(2)}</div>
                  )}
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
                {new Date(pour.date).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })}
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