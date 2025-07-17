'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Bottle {
  _id: string;
  name: string;
  distillery: string;
  type: string;
  age?: number;
  proof: number;
  size: string;
  purchasePrice: number;
  currentValue?: number;
  isOpen: boolean;
  rating?: number;
  location?: {
    name: string;
    type: string;
  };
  images: string[];
  createdAt: string;
}

export default function BottlesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [bottles, setBottles] = useState<Bottle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [openFilter, setOpenFilter] = useState('');
  const [sortBy, setSortBy] = useState('-createdAt');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    fetchBottles();
  }, [search, typeFilter, openFilter, sortBy]);

  const fetchBottles = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (typeFilter) params.append('type', typeFilter);
      if (openFilter) params.append('isOpen', openFilter);
      params.append('sort', sortBy);

      const response = await fetch(`/api/bottles?${params}`);
      const data = await response.json();

      if (response.ok) {
        setBottles(data.bottles);
      }
    } catch (error) {
      console.error('Error fetching bottles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bottle?')) return;

    try {
      const response = await fetch(`/api/bottles/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setBottles(bottles.filter(b => b._id !== id));
      }
    } catch (error) {
      console.error('Error deleting bottle:', error);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-copper animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <nav className="glass-dark border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link href="/dashboard" className="text-2xl font-bold text-gradient">
                Whiskey Vault
              </Link>
              <div className="hidden md:flex space-x-4">
                <Link href="/dashboard" className="text-gray-300 hover:text-white transition-colors">
                  Dashboard
                </Link>
                <Link href="/bottles" className="text-copper-light">
                  Bottles
                </Link>
                <Link href="/locations" className="text-gray-300 hover:text-white transition-colors">
                  Locations
                </Link>
              </div>
            </div>
            <Link href="/bottles/add" className="btn-primary text-sm px-4 py-2">
              Add Bottle
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-4 md:mb-0">My Collection</h1>
          
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            <input
              type="text"
              placeholder="Search bottles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-premium md:w-64"
            />
            
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input-premium"
            >
              <option value="">All Types</option>
              <option value="Bourbon">Bourbon</option>
              <option value="Scotch">Scotch</option>
              <option value="Irish">Irish</option>
              <option value="Rye">Rye</option>
              <option value="Japanese">Japanese</option>
              <option value="Other">Other</option>
            </select>

            <select
              value={openFilter}
              onChange={(e) => setOpenFilter(e.target.value)}
              className="input-premium"
            >
              <option value="">All Bottles</option>
              <option value="true">Open</option>
              <option value="false">Sealed</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input-premium"
            >
              <option value="-createdAt">Newest First</option>
              <option value="createdAt">Oldest First</option>
              <option value="name">Name (A-Z)</option>
              <option value="-name">Name (Z-A)</option>
              <option value="-purchasePrice">Price (High-Low)</option>
              <option value="purchasePrice">Price (Low-High)</option>
              <option value="-rating">Rating (High-Low)</option>
            </select>
          </div>
        </div>

        {bottles.length === 0 ? (
          <div className="card-premium text-center py-16">
            <svg className="w-24 h-24 text-copper/30 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No bottles found</h3>
            <p className="text-gray-500 mb-6">Start building your collection by adding your first bottle</p>
            <Link href="/bottles/add" className="btn-primary inline-flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Your First Bottle
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bottles.map((bottle) => (
              <div key={bottle._id} className="card-premium group hover:border-copper/30 transition-all duration-300">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white group-hover:text-copper-light transition-colors">
                      {bottle.name}
                    </h3>
                    <p className="text-gray-400">{bottle.distillery}</p>
                  </div>
                  {bottle.isOpen && (
                    <span className="glass bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full">
                      Open
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Type:</span>
                    <span className="text-gray-300">{bottle.type}</span>
                  </div>
                  {bottle.age && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Age:</span>
                      <span className="text-gray-300">{bottle.age} Years</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Proof:</span>
                    <span className="text-gray-300">{bottle.proof}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Size:</span>
                    <span className="text-gray-300">{bottle.size}</span>
                  </div>
                  {bottle.location && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Location:</span>
                      <span className="text-gray-300">{bottle.location.name}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Purchase Price:</span>
                    <span className="text-copper-light font-semibold">${bottle.purchasePrice}</span>
                  </div>
                  {bottle.rating && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Rating:</span>
                      <span className="text-yellow-500">{bottle.rating}/100</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-6">
                  <Link
                    href={`/bottles/${bottle._id}`}
                    className="flex-1 btn-secondary text-center text-sm py-2"
                  >
                    View Details
                  </Link>
                  <button
                    onClick={() => handleDelete(bottle._id)}
                    className="glass border-red-500/30 text-red-400 px-3 py-2 rounded-lg hover:bg-red-500/10 hover:border-red-500/50 transition-all duration-300"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Action Button for Quick Add */}
      <Link
        href="/bottles/quick-add"
        className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-r from-copper to-copper-light text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-300 flex items-center justify-center group"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        <span className="absolute right-full mr-3 bg-black/90 text-white text-sm px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          Quick Add
        </span>
      </Link>
    </div>
  );
}