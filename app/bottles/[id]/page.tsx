'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Bottle {
  _id: string;
  name: string;
  distillery: string;
  type: string;
  age?: number;
  proof: number;
  abv: number;
  size: string;
  vintage?: number;
  bottledDate?: string;
  purchaseDate: string;
  purchasePrice: number;
  currentValue?: number;
  location?: {
    _id: string;
    name: string;
    type: string;
    bins?: { number: string; capacity: number; currentCount: number }[];
  };
  binNumber?: string;
  notes?: string;
  rating?: number;
  isOpen: boolean;
  openedDate?: string;
  finishedDate?: string;
  fillLevel?: number;
  images: string[];
  barcode?: string;
  isStorePick: boolean;
  storePickDetails?: {
    store: string;
    barrel?: string;
    rickhouse?: string;
    floor?: string;
    bottleNumber?: string;
    totalBottles?: string;
  };
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export default function BottleDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const [bottle, setBottle] = useState<Bottle | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated' && params.id) {
      fetchBottle();
    }
  }, [status, params.id, router]);

  const fetchBottle = async () => {
    try {
      const response = await fetch(`/api/bottles/${params.id}`);
      const data = await response.json();

      if (response.ok) {
        setBottle(data.bottle);
      } else {
        router.push('/bottles');
      }
    } catch (error) {
      console.error('Error fetching bottle:', error);
      router.push('/bottles');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this bottle? This action cannot be undone.')) return;

    try {
      const response = await fetch(`/api/bottles/${params.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/bottles');
      }
    } catch (error) {
      console.error('Error deleting bottle:', error);
    }
  };

  const toggleOpen = async () => {
    try {
      const response = await fetch(`/api/bottles/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isOpen: !bottle?.isOpen,
          openedDate: !bottle?.isOpen ? new Date().toISOString() : bottle.openedDate,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setBottle(data.bottle);
      }
    } catch (error) {
      console.error('Error updating bottle:', error);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-copper animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!bottle) return null;

  return (
    <div className="min-h-screen pb-20">
      <nav className="glass-dark border-b border-white/10 mb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/bottles" className="text-gray-300 hover:text-white transition-colors flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Collection
            </Link>
            <div className="flex gap-2">
              <Link
                href={`/bottles/${params.id}/edit`}
                className="btn-secondary text-sm px-4 py-2"
              >
                Edit
              </Link>
              <button
                onClick={handleDelete}
                className="glass border-red-500/30 text-red-400 px-4 py-2 rounded-lg hover:bg-red-500/10 hover:border-red-500/50 transition-all duration-300 text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card-premium">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-gradient mb-2">{bottle.name}</h1>
                  <p className="text-xl text-gray-300">{bottle.distillery}</p>
                </div>
                <div className="text-right">
                  {bottle.isOpen ? (
                    <span className="inline-flex items-center glass bg-green-500/20 text-green-400 px-3 py-1 rounded-full">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2h-2.5V7a2.5 2.5 0 10-5 0v2H5V7a5 5 0 015-5zm3 11v3H7v-3h6z"/>
                      </svg>
                      Open
                    </span>
                  ) : (
                    <span className="inline-flex items-center glass bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                      </svg>
                      Sealed
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="glass-dark rounded-lg p-4">
                  <p className="text-sm text-gray-500 mb-1">Type</p>
                  <p className="text-lg font-semibold text-white">{bottle.type}</p>
                </div>
                <div className="glass-dark rounded-lg p-4">
                  <p className="text-sm text-gray-500 mb-1">Age</p>
                  <p className="text-lg font-semibold text-white">
                    {bottle.age ? `${bottle.age} Years` : 'NAS'}
                  </p>
                </div>
                <div className="glass-dark rounded-lg p-4">
                  <p className="text-sm text-gray-500 mb-1">Proof / ABV</p>
                  <p className="text-lg font-semibold text-white">
                    {bottle.proof} / {bottle.abv}%
                  </p>
                </div>
                <div className="glass-dark rounded-lg p-4">
                  <p className="text-sm text-gray-500 mb-1">Size</p>
                  <p className="text-lg font-semibold text-white">{bottle.size}</p>
                </div>
                <div className="glass-dark rounded-lg p-4">
                  <p className="text-sm text-gray-500 mb-1">Purchase Price</p>
                  <p className="text-lg font-semibold text-copper-light">${bottle.purchasePrice}</p>
                </div>
                {bottle.currentValue && (
                  <div className="glass-dark rounded-lg p-4">
                    <p className="text-sm text-gray-500 mb-1">Current Value</p>
                    <p className="text-lg font-semibold text-green-400">${bottle.currentValue}</p>
                  </div>
                )}
              </div>

              <button
                onClick={toggleOpen}
                className={`w-full mt-6 ${bottle.isOpen ? 'btn-secondary' : 'btn-primary'}`}
              >
                {bottle.isOpen ? 'Mark as Sealed' : 'Mark as Open'}
              </button>
            </div>

            {/* Store Pick Details */}
            {bottle.isStorePick && bottle.storePickDetails && (
              <div className="card-premium">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                  <svg className="w-6 h-6 mr-2 text-copper" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  Store Pick Details
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  {bottle.storePickDetails.store && (
                    <div>
                      <p className="text-sm text-gray-500">Store</p>
                      <p className="text-white">{bottle.storePickDetails.store}</p>
                    </div>
                  )}
                  {bottle.storePickDetails.barrel && (
                    <div>
                      <p className="text-sm text-gray-500">Barrel</p>
                      <p className="text-white">{bottle.storePickDetails.barrel}</p>
                    </div>
                  )}
                  {bottle.storePickDetails.rickhouse && (
                    <div>
                      <p className="text-sm text-gray-500">Rickhouse</p>
                      <p className="text-white">{bottle.storePickDetails.rickhouse}</p>
                    </div>
                  )}
                  {bottle.storePickDetails.floor && (
                    <div>
                      <p className="text-sm text-gray-500">Floor</p>
                      <p className="text-white">{bottle.storePickDetails.floor}</p>
                    </div>
                  )}
                  {bottle.storePickDetails.bottleNumber && (
                    <div>
                      <p className="text-sm text-gray-500">Bottle #</p>
                      <p className="text-white">
                        {bottle.storePickDetails.bottleNumber}
                        {bottle.storePickDetails.totalBottles && ` of ${bottle.storePickDetails.totalBottles}`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {bottle.notes && (
              <div className="card-premium">
                <h2 className="text-xl font-semibold text-white mb-4">Notes</h2>
                <p className="text-gray-300 whitespace-pre-wrap">{bottle.notes}</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Location */}
            <div className="card-premium">
              <h3 className="text-lg font-semibold text-white mb-4">Storage Location</h3>
              {bottle.location ? (
                <div className="space-y-2">
                  <p className="text-gray-300">{bottle.location.name}</p>
                  <p className="text-sm text-gray-500">{bottle.location.type}</p>
                  {bottle.binNumber && (
                    <p className="text-sm text-gray-500">Bin: {bottle.binNumber}</p>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">No location assigned</p>
              )}
            </div>

            {/* Rating */}
            {bottle.rating && (
              <div className="card-premium">
                <h3 className="text-lg font-semibold text-white mb-4">Rating</h3>
                <div className="flex items-center">
                  <div className="text-3xl font-bold text-yellow-500">{bottle.rating}</div>
                  <div className="text-gray-500 ml-2">/ 100</div>
                </div>
              </div>
            )}

            {/* Tags */}
            {bottle.tags.length > 0 && (
              <div className="card-premium">
                <h3 className="text-lg font-semibold text-white mb-4">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {bottle.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="glass bg-copper/20 text-copper-light px-3 py-1 rounded-full text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="card-premium">
              <h3 className="text-lg font-semibold text-white mb-4">Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Purchase Date</span>
                  <span className="text-gray-300">
                    {new Date(bottle.purchaseDate).toLocaleDateString()}
                  </span>
                </div>
                {bottle.openedDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Opened Date</span>
                    <span className="text-gray-300">
                      {new Date(bottle.openedDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {bottle.barcode && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Barcode</span>
                    <span className="text-gray-300">{bottle.barcode}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Added</span>
                  <span className="text-gray-300">
                    {new Date(bottle.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}