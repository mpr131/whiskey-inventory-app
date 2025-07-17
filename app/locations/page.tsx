'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Location {
  _id: string;
  name: string;
  type: string;
  description?: string;
  capacity?: number;
  currentCount: number;
  bins?: {
    number: string;
    capacity: number;
    currentCount: number;
    description?: string;
  }[];
  isTemperatureControlled: boolean;
  temperature?: number;
  humidity?: number;
}

export default function LocationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'Cabinet',
    description: '',
    capacity: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      fetchLocations();
    }
  }, [status, router]);

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations');
      const data = await response.json();

      if (response.ok) {
        setLocations(data.locations);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const locationData = {
        ...formData,
        capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
      };

      const response = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locationData),
      });

      if (response.ok) {
        const data = await response.json();
        setLocations([...locations, data.location]);
        setShowAddForm(false);
        setFormData({
          name: '',
          type: 'Cabinet',
          description: '',
          capacity: '',
        });
      }
    } catch (error) {
      console.error('Error creating location:', error);
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
                <Link href="/bottles" className="text-gray-300 hover:text-white transition-colors">
                  Bottles
                </Link>
                <Link href="/locations" className="text-copper-light">
                  Locations
                </Link>
              </div>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="btn-primary text-sm px-4 py-2"
            >
              Add Location
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">Storage Locations</h1>

        {locations.length === 0 ? (
          <div className="card-premium text-center py-16">
            <svg className="w-24 h-24 text-copper/30 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No locations yet</h3>
            <p className="text-gray-500 mb-6">Create your first storage location to organize your collection</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="btn-primary inline-flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create First Location
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {locations.map((location) => (
              <div key={location._id} className="card-premium hover:border-copper/30 transition-all duration-300">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">{location.name}</h3>
                    <p className="text-gray-400">{location.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-copper-light">{location.currentCount}</p>
                    {location.capacity && (
                      <p className="text-sm text-gray-500">of {location.capacity}</p>
                    )}
                  </div>
                </div>

                {location.description && (
                  <p className="text-gray-300 text-sm mb-4">{location.description}</p>
                )}

                <div className="space-y-2">
                  {location.isTemperatureControlled && (
                    <div className="flex items-center text-sm text-gray-400">
                      <svg className="w-4 h-4 mr-2 text-copper" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Temperature Controlled
                    </div>
                  )}

                  {location.capacity && (
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-500">Capacity</span>
                        <span className="text-gray-400">
                          {Math.round((location.currentCount / location.capacity) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-black/50 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-copper to-copper-light h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min((location.currentCount / location.capacity) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add Location Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-12">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowAddForm(false)} />
          
          <div className="relative z-10 w-full max-w-md">
            <div className="card-premium">
              <h2 className="text-2xl font-bold text-white mb-6">Add Storage Location</h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-premium w-full"
                    placeholder="e.g., Main Cabinet"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Type <span className="text-red-400">*</span>
                  </label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="input-premium w-full"
                  >
                    <option value="Cabinet">Cabinet</option>
                    <option value="Shelf">Shelf</option>
                    <option value="Box">Box</option>
                    <option value="Cellar">Cellar</option>
                    <option value="Display">Display</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Capacity
                  </label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    className="input-premium w-full"
                    placeholder="e.g., 50"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input-premium w-full resize-none"
                    rows={3}
                    placeholder="Optional description..."
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    className="btn-primary flex-1"
                  >
                    Create Location
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}