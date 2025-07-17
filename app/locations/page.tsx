'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Package, DollarSign, ArrowRight } from 'lucide-react';

interface LocationBottle {
  _id: string;
  name: string;
  distillery: string;
  quantity: number;
  bin: string;
  value: number;
}

interface Location {
  name: string;
  totalBottles: number;
  totalValue: number;
  uniqueBins: number;
  bottles: LocationBottle[];
}

export default function LocationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    
    fetchLocations();
  }, [status, session, router]);

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

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString()}`;
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-400">Loading...</div>
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
            <div className="flex items-center space-x-4">
              <span className="text-gray-300">Welcome, {session?.user?.name}</span>
              <Link href="/api/auth/signout" className="btn-secondary text-sm px-4 py-2">
                Sign Out
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Storage Locations</h1>
          <div className="text-sm text-gray-400">
            {locations.length} location{locations.length !== 1 ? 's' : ''}
          </div>
        </div>

        {locations.length === 0 ? (
          <div className="card-premium text-center py-16">
            <MapPin className="w-24 h-24 text-copper/30 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No locations found</h3>
            <p className="text-gray-500 mb-6">
              Your bottles don't have location information yet. 
              You can add location data when importing bottles or editing existing ones.
            </p>
            <Link href="/bottles/import" className="btn-primary inline-flex items-center">
              <Package className="w-5 h-5 mr-2" />
              Import Bottles with Locations
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {locations.map((location) => (
              <div 
                key={location.name} 
                className="card-premium hover:border-copper/50 transition-all duration-300 cursor-pointer"
                onClick={() => setSelectedLocation(location)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <MapPin className="w-5 h-5 text-copper" />
                      <h3 className="text-xl font-bold text-white">{location.name}</h3>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-400">
                      <span>{location.uniqueBins} bin{location.uniqueBins !== 1 ? 's' : ''}</span>
                      <span>•</span>
                      <span>{formatCurrency(location.totalValue)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-copper">{location.totalBottles}</p>
                    <p className="text-sm text-gray-500">bottles</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                  <div className="flex items-center space-x-4 text-sm text-gray-400">
                    <div className="flex items-center space-x-1">
                      <Package className="w-4 h-4" />
                      <span>{location.totalBottles} bottles</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <DollarSign className="w-4 h-4" />
                      <span>{formatCurrency(location.totalValue)}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-500" />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Location Details Modal */}
      {selectedLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-12">
          <div className="absolute inset-0 bg-black/80" onClick={() => setSelectedLocation(null)} />
          
          <div className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="card-premium">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <MapPin className="w-6 h-6 text-copper" />
                  <h2 className="text-2xl font-bold text-white">{selectedLocation.name}</h2>
                </div>
                <button
                  onClick={() => setSelectedLocation(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="glass-dark rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Package className="w-5 h-5 text-copper" />
                    <span className="text-sm text-gray-400">Total Bottles</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{selectedLocation.totalBottles}</p>
                </div>
                <div className="glass-dark rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <DollarSign className="w-5 h-5 text-copper" />
                    <span className="text-sm text-gray-400">Total Value</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{formatCurrency(selectedLocation.totalValue)}</p>
                </div>
                <div className="glass-dark rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <MapPin className="w-5 h-5 text-copper" />
                    <span className="text-sm text-gray-400">Unique Bins</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{selectedLocation.uniqueBins}</p>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto">
                <h3 className="text-lg font-semibold text-white mb-4">Bottles in this Location</h3>
                <div className="space-y-2">
                  {selectedLocation.bottles.map((bottle) => (
                    <Link
                      key={bottle._id}
                      href={`/bottles/${bottle._id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-white">{bottle.name}</div>
                        <div className="text-sm text-gray-400">{bottle.distillery}</div>
                      </div>
                      <div className="flex items-center space-x-4 text-sm">
                        {bottle.bin && (
                          <div className="text-gray-400">
                            Bin: <span className="text-white">{bottle.bin}</span>
                          </div>
                        )}
                        <div className="text-gray-400">
                          Qty: <span className="text-white">{bottle.quantity}</span>
                        </div>
                        <div className="text-copper font-medium">
                          {formatCurrency(bottle.value)}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-gray-700">
                <button
                  onClick={() => setSelectedLocation(null)}
                  className="btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}