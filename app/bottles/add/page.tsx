'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Search, Plus } from 'lucide-react';
import AutocompleteInput from '@/components/AutocompleteInput';
import { haptic } from '@/utils/haptics';

interface MasterBottle {
  _id: string;
  name: string;
  brand: string;
  distillery: string;
  category: string;
  type?: string;
  age?: number;
  proof?: number;
  msrp?: number;
}

export default function AddBottlePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MasterBottle[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMaster, setSelectedMaster] = useState<MasterBottle | null>(null);
  const [createNew, setCreateNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMasterBottle, setLoadingMasterBottle] = useState(false);
  
  // Autocomplete suggestions
  const [storeSuggestions, setStoreSuggestions] = useState<string[]>([]);
  const [areaSuggestions, setAreaSuggestions] = useState<string[]>([]);
  const [binSuggestions, setBinSuggestions] = useState<string[]>([]);
  const [distillerySuggestions, setDistillerySuggestions] = useState<string[]>([]);
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([]);

  // Master bottle fields (for creating new)
  const [masterData, setMasterData] = useState({
    name: '',
    brand: '',
    distillery: '',
    category: 'Bourbon',
    type: '',
    age: '',
    proof: '',
    msrp: '',
    description: '',
    isStorePick: false,
    storePickDetails: {
      store: '',
      pickDate: '',
      barrel: '',
    },
  });

  // User bottle fields
  const [userData, setUserData] = useState({
    purchaseDate: new Date().toISOString().split('T')[0],
    purchasePrice: '',
    purchaseLocation: '',
    quantity: '1',
    location: {
      area: '',
      bin: '',
    },
    bottleNumber: '',
    barrelNumber: '',
    actualProof: '',
    notes: '',
  });

  const searchMasterBottles = useCallback(async () => {
    setSearching(true);
    try {
      const response = await fetch(`/api/master-bottles/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      if (response.ok) {
        setSearchResults(data.bottles);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const fetchMasterBottle = useCallback(async (masterBottleId: string) => {
    setLoadingMasterBottle(true);
    try {
      const response = await fetch(`/api/master-bottles/search?id=${masterBottleId}`);
      const data = await response.json();
      
      if (response.ok && data.bottles && data.bottles.length > 0) {
        const masterBottle = data.bottles[0];
        setSelectedMaster(masterBottle);
        setSearchQuery(masterBottle.name);
        toast.success(`Pre-selected: ${masterBottle.name}`);
      } else {
        toast.error('Master bottle not found');
      }
    } catch (error) {
      console.error('Error fetching master bottle:', error);
      toast.error('Failed to load master bottle');
    } finally {
      setLoadingMasterBottle(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery && searchQuery.length >= 2) {
        searchMasterBottles();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, searchMasterBottles]);

  useEffect(() => {
    const masterBottleId = searchParams.get('masterBottleId');
    const name = searchParams.get('name');
    const brand = searchParams.get('brand');
    const upc = searchParams.get('upc');
    
    if (masterBottleId) {
      fetchMasterBottle(masterBottleId);
    } else if (name || brand) {
      // Pre-fill for new bottle creation from UPC scan
      setCreateNew(true);
      setMasterData(prev => ({
        ...prev,
        name: name || '',
        brand: brand || '',
      }));
      setSearchQuery(name || '');
      
      if (upc) {
        toast.success(`Creating new bottle for UPC: ${upc}`);
      }
    }
  }, [searchParams, fetchMasterBottle]);

  const handleSelectMaster = (master: MasterBottle) => {
    haptic.selection();
    setSelectedMaster(master);
    setSearchQuery(master.name);
    setSearchResults([]);
    setCreateNew(false);
    
    // Pre-fill actual proof if available
    if (master.proof) {
      setUserData(prev => ({ ...prev, actualProof: master.proof!.toString() }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    haptic.medium();
    setLoading(true);

    try {
      const body: any = {
        ...userData,
        masterBottleId: selectedMaster?._id,
      };

      // If creating new master bottle
      if (createNew || !selectedMaster) {
        body.masterBottle = {
          ...masterData,
          age: masterData.age ? parseInt(masterData.age) : undefined,
          proof: masterData.proof ? parseFloat(masterData.proof) : undefined,
          msrp: masterData.msrp ? parseFloat(masterData.msrp) : undefined,
          isStorePick: masterData.isStorePick,
          storePickDetails: masterData.isStorePick ? {
            store: masterData.storePickDetails.store || undefined,
            pickDate: masterData.storePickDetails.pickDate || undefined,
            barrel: masterData.storePickDetails.barrel || undefined,
          } : undefined,
        };
        delete body.masterBottleId;
      }

      // Convert user data
      body.purchasePrice = userData.purchasePrice ? parseFloat(userData.purchasePrice) : undefined;
      body.quantity = parseInt(userData.quantity) || 1;
      body.actualProof = userData.actualProof ? parseFloat(userData.actualProof) : undefined;

      const response = await fetch('/api/user-bottles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        haptic.success();
        toast.success('Bottle added successfully!');
        router.push('/bottles');
      } else {
        const error = await response.json();
        haptic.error();
        toast.error(error.error || 'Failed to add bottle');
      }
    } catch (error) {
      toast.error('An error occurred');
      console.error('Submit error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
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
            <Link href="/bottles" className="text-gray-300 hover:text-white transition-colors">
              ← Back to Collection
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">Add New Bottle</h1>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Master Bottle Search/Select */}
          <div className="card-premium">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-copper" />
              Select Whiskey
            </h2>
            
            <div className="relative mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={loadingMasterBottle ? "Loading..." : "Search for a whiskey..."}
                className="input-premium w-full"
                disabled={loadingMasterBottle}
              />
              
              {searchResults.length > 0 && (
                <div className="absolute top-full mt-2 w-full glass-dark rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                  {searchResults.map((bottle) => (
                    <button
                      key={bottle._id}
                      type="button"
                      onClick={() => handleSelectMaster(bottle)}
                      className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors border-b border-white/5 last:border-0"
                    >
                      <div className="font-semibold">{bottle.name}</div>
                      <div className="text-sm text-gray-400">
                        {bottle.distillery} • {bottle.category}
                        {bottle.age && ` • ${bottle.age} Year`}
                        {bottle.proof && ` • ${bottle.proof} Proof`}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedMaster && !createNew && (
              <div className="glass bg-amber-600/20 p-4 rounded-lg">
                <div className="font-semibold text-amber-400">{selectedMaster.name}</div>
                <div className="text-sm text-gray-300">
                  {selectedMaster.distillery} • {selectedMaster.category}
                  {selectedMaster.age && ` • ${selectedMaster.age} Year`}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setCreateNew(true);
                setSelectedMaster(null);
              }}
              className="mt-4 text-sm text-copper hover:text-copper-light transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Can&apos;t find your whiskey? Create new entry
            </button>
          </div>

          {/* Create New Master Bottle Fields */}
          {createNew && (
            <div className="card-premium">
              <h2 className="text-xl font-semibold mb-4">Whiskey Details</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label-premium">Name *</label>
                  <input
                    type="text"
                    required
                    value={masterData.name}
                    onChange={(e) => setMasterData({...masterData, name: e.target.value})}
                    className="input-premium w-full"
                  />
                </div>

                <AutocompleteInput
                  label="Brand"
                  value={masterData.brand}
                  onChange={(value) => setMasterData({...masterData, brand: value})}
                  onSearch={async (query) => {
                    const res = await fetch(`/api/master-bottles/producers?q=${encodeURIComponent(query)}&field=brand`);
                    const data = await res.json();
                    setBrandSuggestions(data.producers || []);
                  }}
                  suggestions={brandSuggestions}
                  placeholder="e.g., Russell's Reserve"
                  allowNew={true}
                  required
                />

                <AutocompleteInput
                  label="Distillery"
                  value={masterData.distillery}
                  onChange={(value) => setMasterData({...masterData, distillery: value})}
                  onSearch={async (query) => {
                    const res = await fetch(`/api/master-bottles/producers?q=${encodeURIComponent(query)}&field=distillery`);
                    const data = await res.json();
                    setDistillerySuggestions(data.producers || []);
                  }}
                  suggestions={distillerySuggestions}
                  placeholder="e.g., Wild Turkey"
                  allowNew={true}
                  required
                />

                <div>
                  <label className="label-premium">Category *</label>
                  <select
                    required
                    value={masterData.category}
                    onChange={(e) => setMasterData({...masterData, category: e.target.value})}
                    className="input-premium w-full"
                  >
                    <option value="Bourbon">Bourbon</option>
                    <option value="Rye">Rye</option>
                    <option value="Scotch">Scotch</option>
                    <option value="Irish">Irish</option>
                    <option value="Japanese">Japanese</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="label-premium">Type</label>
                  <input
                    type="text"
                    value={masterData.type}
                    onChange={(e) => setMasterData({...masterData, type: e.target.value})}
                    placeholder="e.g., Kentucky Straight Bourbon"
                    className="input-premium w-full"
                  />
                </div>

                <div>
                  <label className="label-premium">Age (Years)</label>
                  <input
                    type="number"
                    value={masterData.age}
                    onChange={(e) => setMasterData({...masterData, age: e.target.value})}
                    className="input-premium w-full"
                  />
                </div>

                <div>
                  <label className="label-premium">Proof</label>
                  <input
                    type="number"
                    step="0.1"
                    value={masterData.proof}
                    onChange={(e) => setMasterData({...masterData, proof: e.target.value})}
                    className="input-premium w-full"
                  />
                </div>

                <div>
                  <label className="label-premium">MSRP</label>
                  <input
                    type="number"
                    step="0.01"
                    value={masterData.msrp}
                    onChange={(e) => setMasterData({...masterData, msrp: e.target.value})}
                    className="input-premium w-full"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="label-premium">Description</label>
                <textarea
                  value={masterData.description}
                  onChange={(e) => setMasterData({...masterData, description: e.target.value})}
                  rows={3}
                  className="input-premium w-full"
                />
              </div>

              {/* Store Pick Information */}
              <div className="mt-6 space-y-4">
                <h3 className="text-lg font-medium text-white">Store Pick Information</h3>
                
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="isStorePick"
                    checked={masterData.isStorePick}
                    onChange={(e) => setMasterData({...masterData, isStorePick: e.target.checked})}
                    className="w-4 h-4 text-copper bg-gray-800 border-gray-600 rounded focus:ring-copper focus:ring-2"
                  />
                  <label htmlFor="isStorePick" className="text-gray-300 font-medium">
                    This is a store pick
                  </label>
                </div>
                
                {masterData.isStorePick && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <AutocompleteInput
                      label="Store Name"
                      value={masterData.storePickDetails.store}
                      onChange={(value) => setMasterData({...masterData, storePickDetails: {...masterData.storePickDetails, store: value}})}
                      onSearch={async (query) => {
                        const res = await fetch(`/api/stores/search?q=${encodeURIComponent(query)}`);
                        const data = await res.json();
                        setStoreSuggestions(data.stores || []);
                      }}
                      suggestions={storeSuggestions}
                      placeholder="Store name"
                      allowNew={true}
                    />
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Pick Date
                      </label>
                      <input
                        type="date"
                        value={masterData.storePickDetails.pickDate}
                        onChange={(e) => setMasterData({...masterData, storePickDetails: {...masterData.storePickDetails, pickDate: e.target.value}})}
                        className="input-premium w-full"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Barrel/Pick Details
                      </label>
                      <input
                        type="text"
                        value={masterData.storePickDetails.barrel}
                        onChange={(e) => setMasterData({...masterData, storePickDetails: {...masterData.storePickDetails, barrel: e.target.value}})}
                        placeholder="e.g., Barrel #123"
                        className="input-premium w-full"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* User Bottle Details */}
          <div className="card-premium">
            <h2 className="text-xl font-semibold mb-4">Your Bottle Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label-premium">Purchase Date</label>
                <input
                  type="date"
                  value={userData.purchaseDate}
                  onChange={(e) => setUserData({...userData, purchaseDate: e.target.value})}
                  className="input-premium w-full"
                />
              </div>

              <div>
                <label className="label-premium">Purchase Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={userData.purchasePrice}
                  onChange={(e) => setUserData({...userData, purchasePrice: e.target.value})}
                  placeholder="0.00"
                  className="input-premium w-full"
                />
              </div>

              <AutocompleteInput
                label="Purchase Location"
                value={userData.purchaseLocation}
                onChange={(value) => setUserData({...userData, purchaseLocation: value})}
                onSearch={async (query) => {
                  const res = await fetch(`/api/stores/search?q=${encodeURIComponent(query)}`);
                  const data = await res.json();
                  setStoreSuggestions(data.stores || []);
                }}
                suggestions={storeSuggestions}
                placeholder="Store name"
                allowNew={true}
              />

              <div>
                <label className="label-premium">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={userData.quantity}
                  onChange={(e) => setUserData({...userData, quantity: e.target.value})}
                  className="input-premium w-full"
                />
              </div>

              <AutocompleteInput
                label="Storage Area"
                value={userData.location.area}
                onChange={(value) => {
                  setUserData({...userData, location: {...userData.location, area: value}});
                  // Clear bin when area changes
                  if (value !== userData.location.area) {
                    setUserData(prev => ({...prev, location: {...prev.location, bin: ''}}));
                    setBinSuggestions([]);
                  }
                }}
                onSearch={async (query) => {
                  const res = await fetch(`/api/locations/areas?q=${encodeURIComponent(query)}`);
                  const data = await res.json();
                  setAreaSuggestions(data.areas || []);
                }}
                suggestions={areaSuggestions}
                placeholder="e.g., Bar, Cellar"
                allowNew={true}
              />

              <AutocompleteInput
                label="Bin/Shelf"
                value={userData.location.bin}
                onChange={(value) => setUserData({...userData, location: {...userData.location, bin: value}})}
                onSearch={async (query) => {
                  if (userData.location.area) {
                    const res = await fetch(`/api/locations/bins?area=${encodeURIComponent(userData.location.area)}&q=${encodeURIComponent(query)}`);
                    const data = await res.json();
                    setBinSuggestions(data.bins || []);
                  }
                }}
                suggestions={binSuggestions}
                placeholder="e.g., A1, Top Shelf"
                allowNew={true}
              />

              <div>
                <label className="label-premium">Bottle Number</label>
                <input
                  type="text"
                  value={userData.bottleNumber}
                  onChange={(e) => setUserData({...userData, bottleNumber: e.target.value})}
                  placeholder="e.g., Bottle 127 of 250"
                  className="input-premium w-full"
                />
              </div>

              <div>
                <label className="label-premium">Barrel Number</label>
                <input
                  type="text"
                  value={userData.barrelNumber}
                  onChange={(e) => setUserData({...userData, barrelNumber: e.target.value})}
                  placeholder="For single barrel releases"
                  className="input-premium w-full"
                />
              </div>

              <div>
                <label className="label-premium">Actual Proof</label>
                <input
                  type="number"
                  step="0.1"
                  value={userData.actualProof}
                  onChange={(e) => setUserData({...userData, actualProof: e.target.value})}
                  placeholder="If different from standard"
                  className="input-premium w-full"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="label-premium">Notes</label>
              <textarea
                value={userData.notes}
                onChange={(e) => setUserData({...userData, notes: e.target.value})}
                rows={3}
                placeholder="Tasting notes, special occasions, etc."
                className="input-premium w-full"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.push('/bottles')}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (!selectedMaster && !createNew)}
              className="btn-primary flex-1"
            >
              {loading ? 'Adding...' : 'Add Bottle'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}