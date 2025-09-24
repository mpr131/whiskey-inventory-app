'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import dynamicImport from 'next/dynamic';
import toast from 'react-hot-toast';
import { ScanLine, Search, X, ChevronLeft, Wine, Users, MapPin, Tag, Camera, Star } from 'lucide-react';
import FriendSelector, { Companion } from '@/components/FriendSelector';

const BarcodeScanner = dynamicImport(() => import('@/components/Html5QrScanner'), {
  ssr: false,
});

interface UserBottle {
  _id: string;
  masterBottleId: {
    _id: string;
    name: string;
    brand: string;
    distillery: string;
    proof?: number;
    communityRating?: number;
    communityRatingCount?: number;
  };
  purchasePrice?: number;
  barcode?: string;
  vaultBarcode?: string;
  fillLevel?: number;
  status: string;
  averageRating?: number;
}

interface PourSession {
  _id?: string;
  sessionName: string;
}

export default function QuickPourPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // State
  const [showScanner, setShowScanner] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBottle, setSelectedBottle] = useState<UserBottle | null>(null);
  const [pourAmount, setPourAmount] = useState(1); // Default 1 oz
  const [rating, setRating] = useState<number | null>(null);
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [location, setLocation] = useState('Home');
  const [notes, setNotes] = useState('');
  const [currentSession, setCurrentSession] = useState<PourSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<UserBottle[]>([]);
  const [searching, setSearching] = useState(false);
  const [tagInput, setTagInput] = useState('');

  // Common pour sizes
  const pourSizes = [
    { label: '½ oz', value: 0.5 },
    { label: '1 oz', value: 1 },
    { label: '1½ oz', value: 1.5 },
    { label: '2 oz', value: 2 },
  ];

  // Location options
  const locationOptions = ['Home', 'Bar', 'Restaurant', 'Tasting', 'Friend\'s Place', 'Event', 'Other'];

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // Create or get current session
  useEffect(() => {
    const initSession = async () => {
      try {
        // Check for existing session today
        const response = await fetch('/api/pour-sessions/current');
        if (response.ok) {
          const data = await response.json();
          setCurrentSession(data.session);
        }
      } catch (error) {
        console.error('Error initializing session:', error);
      }
    };
    
    if (session?.user) {
      initSession();
    }
  }, [session]);

  const handleBarcodeScanned = async (barcode: string) => {
    setShowScanner(false);
    setSearchQuery(barcode);
    await searchBottles(barcode);
  };

  const searchBottles = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setSearching(true);
    try {
      // First check if this looks like a barcode - if so, use smart-scan logic
      const isBarcode = /^[0-9]{6,}$/.test(query.trim());
      
      if (isBarcode) {
        // Use smart-scan API for barcode searches (checks everything!)
        const smartScanResponse = await fetch('/api/smart-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ barcode: query })
        });
        
        if (smartScanResponse.ok) {
          const smartResult = await smartScanResponse.json();
          
          if (smartResult.type === 'user_bottle') {
            // Found exact bottle - show it as exact match
            setSearchResults([{ ...smartResult.userBottle, isExactMatch: true }]);
            return;
          } else if (smartResult.type === 'master_bottle' && smartResult.userBottleCount > 0) {
            // Found product with user bottles - get all user bottles of this product
            const userBottlesResponse = await fetch(`/api/user-bottles?masterBottleId=${smartResult.masterBottle._id}`);
            if (userBottlesResponse.ok) {
              const { bottles } = await userBottlesResponse.json();
              setSearchResults(bottles.map((b: any) => ({ ...b, isExactMatch: true })));
              return;
            }
          }
        }
      }
      
      // Fallback to regular text search
      const response = await fetch(`/api/user-bottles?search=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        // If grouped results, extract individual bottles
        let bottles = [];
        if (data.isGrouped && data.bottles) {
          // Extract all userBottles from grouped results
          bottles = data.bottles.flatMap((group: any) => 
            group.userBottles || []
          );
        } else if (data.bottles) {
          bottles = data.bottles;
        }
        
        // Sort to show opened bottles first
        bottles.sort((a: any, b: any) => {
          if (a.status === 'opened' && b.status !== 'opened') return -1;
          if (a.status !== 'opened' && b.status === 'opened') return 1;
          return 0;
        });
        
        // Check for exact barcode matches (check ALL barcode fields like smart-scan)
        const cleanedQuery = query.replace(/^0+/, ''); // Remove leading zeros
        const paddedQuery = query.padStart(12, '0'); // Pad with zeros
        
        const exactMatches = bottles.filter((b: any) => 
          b.vaultBarcode === query ||
          b.barcode === query || b.barcode === cleanedQuery || b.barcode === paddedQuery ||
          b.wineBarcode === query || b.wineBarcode === cleanedQuery || b.wineBarcode === paddedQuery ||
          b.cellarTrackerId === query
        );
        
        const otherBottles = bottles.filter((b: any) => !exactMatches.includes(b));
        
        // Sort: exact matches first, then others
        const sortedBottles = [
          ...exactMatches.map((b: any) => ({ ...b, isExactMatch: true })),
          ...otherBottles.map((b: any) => ({ ...b, isExactMatch: false }))
        ];
        
        setSearchResults(sortedBottles);
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search bottles');
    } finally {
      setSearching(false);
    }
  };

  // Debounced search for real-time results
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      searchBottles(value);
    }, 300);
  };

  const selectBottle = (bottle: UserBottle) => {
    setSelectedBottle(bottle);
    setSearchResults([]);
    setSearchQuery('');
  };

  const calculateCostPerPour = () => {
    if (!selectedBottle?.purchasePrice) return null;
    const bottleOunces = 25.36; // 750ml
    return (selectedBottle.purchasePrice / bottleOunces) * pourAmount;
  };


  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tag.startsWith('#')) {
      const formattedTag = `#${tag}`;
      if (!tags.includes(formattedTag)) {
        setTags([...tags, formattedTag]);
      }
    } else if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput('');
  };

  const handleSubmitPour = async () => {
    if (!selectedBottle) {
      toast.error('Please select a bottle');
      return;
    }

    setLoading(true);
    try {
      // Create session if needed
      let sessionId = currentSession?._id;
      if (!sessionId) {
        const sessionResponse = await fetch('/api/pour-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionName: `Session ${new Date().toLocaleString()}`,
            location,
            tags,
          }),
        });
        
        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          sessionId = sessionData.session._id;
          setCurrentSession(sessionData.session);
        }
      }

      // Submit pour
      const response = await fetch('/api/pours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userBottleId: selectedBottle._id,
          sessionId,
          amount: pourAmount,
          rating: rating || undefined,
          companionTags: companions,
          tags,
          location,
          notes,
        }),
      });

      if (response.ok) {
        toast.success('Pour logged successfully!');
        
        // Reset form
        setSelectedBottle(null);
        setPourAmount(1);
        setRating(null);
        setCompanions([]);
        setTags([]);
        setNotes('');
        
        // Navigate to session summary
        router.push(`/pour/session/${sessionId}`);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to log pour');
      }
    } catch (error) {
      console.error('Pour error:', error);
      toast.error('Failed to log pour');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-copper animate-pulse">Loading...</div>
      </div>
    );
  }

  const costPerPour = calculateCostPerPour();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Mobile-optimized header */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 text-gray-400 hover:text-white"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-copper">Quick Pour</h1>
          <div className="w-10" /> {/* Balance spacer */}
        </div>
      </header>

      <main className="p-4 pb-24 md:pb-20 max-w-lg mx-auto">
        {/* Bottle Selection */}
        {!selectedBottle ? (
          <div className="space-y-4">
            <div className="text-center py-8">
              <Wine className="w-16 h-16 text-copper mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Select Your Bottle</h2>
              <p className="text-gray-400">Scan a barcode or search</p>
            </div>

            {/* Scan Button - Big and thumb-friendly */}
            <button
              onClick={() => setShowScanner(true)}
              className="w-full bg-copper hover:bg-copper-light text-white font-bold py-6 px-8 rounded-xl text-lg flex items-center justify-center gap-3 transition-all transform active:scale-95"
            >
              <ScanLine className="w-8 h-8" />
              Scan Bottle
            </button>

            {/* Manual Search */}
            <div className="relative">
              <Search className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or barcode..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchBottles(searchQuery)}
                className="w-full pl-12 pr-4 py-4 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-copper text-lg"
              />
            </div>

            {/* Search Results */}
            {searching && (
              <div className="text-center py-4 text-gray-400">Searching...</div>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((bottle) => (
                  <button
                    key={bottle._id}
                    onClick={() => selectBottle(bottle)}
                    className={`w-full p-4 rounded-lg text-left transition-all ${
                      bottle.isExactMatch 
                        ? 'bg-copper/20 border-2 border-copper hover:bg-copper/30' 
                        : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    {bottle.isExactMatch && (
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs bg-copper/30 text-copper px-2 py-1 rounded-full font-semibold">
                          🎯 Exact Barcode Match
                        </span>
                      </div>
                    )}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold">{bottle.masterBottleId?.name || 'Unknown Bottle'}</div>
                        <div className="text-sm text-gray-400">{bottle.masterBottleId?.distillery || ''}</div>
                        {bottle.vaultBarcode && (
                          <div className="text-xs text-copper mt-1">{bottle.vaultBarcode}</div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          bottle.status === 'opened' ? 'bg-green-900/50 text-green-400' :
                          bottle.status === 'finished' ? 'bg-red-900/50 text-red-400' :
                          'bg-gray-700 text-gray-300'
                        }`}>
                          {bottle.status}
                        </span>
                        {bottle.fillLevel !== undefined && bottle.status === 'opened' && (
                          <div className="text-xs text-gray-500 mt-1">{bottle.fillLevel.toFixed(2)}% full</div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Selected Bottle */}
            <div className="bg-gray-800 p-4 rounded-xl">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{selectedBottle.masterBottleId.name}</h3>
                  <p className="text-gray-400">{selectedBottle.masterBottleId.distillery}</p>
                  {selectedBottle.masterBottleId.proof && (
                    <p className="text-sm text-gray-500">{selectedBottle.masterBottleId.proof}°</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedBottle(null)}
                  className="text-gray-400 hover:text-white p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Fill Level Indicator */}
              {selectedBottle.fillLevel !== undefined && (
                <div className="mt-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">Fill Level</span>
                    <span className="text-gray-300">{selectedBottle.fillLevel.toFixed(2)}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        selectedBottle.fillLevel > 50 ? 'bg-green-500' : 
                        selectedBottle.fillLevel > 20 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${selectedBottle.fillLevel}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Pour Size Selection */}
            <div>
              <label className="block text-sm font-medium mb-3">Pour Size</label>
              <div className="grid grid-cols-4 gap-2">
                {pourSizes.map((size) => (
                  <button
                    key={size.value}
                    onClick={() => setPourAmount(size.value)}
                    className={`py-3 px-4 rounded-lg font-medium transition-all ${
                      pourAmount === size.value
                        ? 'bg-copper text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
              
              {/* Custom Size */}
              <div className="mt-2">
                <input
                  type="number"
                  value={pourAmount}
                  onChange={(e) => setPourAmount(parseFloat(e.target.value) || 0)}
                  step="0.25"
                  min="0.25"
                  max="10"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-center"
                  placeholder="Custom (oz)"
                />
              </div>
              
              {/* Cost Per Pour - Show immediately after size selection */}
              {costPerPour !== null && (
                <div className="mt-3 bg-copper/10 border border-copper/30 rounded-lg p-3 text-center">
                  <div className="text-sm text-copper">
                    {pourAmount}oz pour = <span className="text-xl font-bold text-copper-light">${costPerPour.toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Based on ${selectedBottle?.purchasePrice || 0} bottle price
                  </div>
                </div>
              )}
            </div>

            {/* T8ke Scale Rating */}
            <div>
              <label className="block text-sm font-medium mb-3">
                Rating (T8ke Scale)
                {rating !== null && <span className="ml-2 text-copper">{rating}/10</span>}
              </label>
              
              {/* Display current ratings for reference */}
              {selectedBottle && (selectedBottle.averageRating || selectedBottle.masterBottleId.communityRating) && (
                <div className="mb-3 p-3 bg-gray-800/50 rounded-lg text-sm">
                  {selectedBottle.averageRating && (
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-400">Your average:</span>
                      <div className="flex items-center gap-1">
                        <span className="text-copper font-medium">{selectedBottle.averageRating.toFixed(1)}</span>
                        <Star className="w-3 h-3 text-copper fill-copper" />
                      </div>
                    </div>
                  )}
                  {selectedBottle.masterBottleId.communityRating && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Community:</span>
                      <div className="flex items-center gap-1">
                        <span className="text-copper font-medium">{selectedBottle.masterBottleId.communityRating.toFixed(1)}</span>
                        <Star className="w-3 h-3 text-copper fill-copper" />
                        <span className="text-xs text-gray-500">({selectedBottle.masterBottleId.communityRatingCount})</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={rating || 0}
                onChange={(e) => setRating(parseFloat(e.target.value))}
                className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0</span>
                <span>5</span>
                <span>10</span>
              </div>
            </div>

            {/* Optional Details (Collapsible) */}
            <details className="bg-gray-800 rounded-lg">
              <summary className="p-4 cursor-pointer font-medium">Add Details (Optional)</summary>
              <div className="p-4 pt-0 space-y-4">
                {/* Location */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Location
                  </label>
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                  >
                    {locationOptions.map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>

                {/* Companions */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <Users className="w-4 h-4 inline mr-1" />
                    Drinking With
                  </label>
                  <FriendSelector
                    value={companions}
                    onChange={setCompanions}
                    placeholder="Add friends or names..."
                    className="w-full"
                    onAddFriend={(name) => {
                      // TODO: Implement friend request functionality
                      console.log('Send friend request to:', name);
                      toast.success(`Friend request feature coming soon for "${name}"`);
                    }}
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <Tag className="w-4 h-4 inline mr-1" />
                    Tags
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                      placeholder="Add tag..."
                      className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                    />
                    <button
                      onClick={handleAddTag}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-copper/20 text-copper rounded-full text-sm flex items-center gap-1"
                      >
                        {tag}
                        <button
                          onClick={() => setTags(tags.filter(t => t !== tag))}
                          className="text-copper-light hover:text-copper"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium mb-2">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Tasting notes, occasion, etc..."
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                  />
                </div>
              </div>
            </details>

            {/* Submit Button */}
            <button
              onClick={handleSubmitPour}
              disabled={loading || !selectedBottle}
              className="w-full bg-copper hover:bg-copper-light disabled:bg-gray-700 text-white font-bold py-4 px-8 rounded-xl text-lg transition-all transform active:scale-95 disabled:transform-none"
            >
              {loading ? 'Logging Pour...' : 'Log Pour'}
            </button>
          </div>
        )}
      </main>

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScanned}
          onClose={() => setShowScanner(false)}
        />
      )}

      <style jsx>{`
        .slider-thumb::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: #B87333;
          cursor: pointer;
          border-radius: 50%;
        }
        
        .slider-thumb::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: #B87333;
          cursor: pointer;
          border-radius: 50%;
          border: none;
        }
      `}</style>
    </div>
  );
}