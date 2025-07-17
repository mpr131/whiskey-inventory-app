'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Location {
  _id: string;
  name: string;
  type: string;
  bins?: { number: string; capacity: number; currentCount: number }[];
}

const COMMON_DISTILLERIES = [
  'Buffalo Trace', 'Wild Turkey', 'Four Roses', 'Makers Mark', 'Jim Beam',
  'Heaven Hill', 'Barton 1792', 'Woodford Reserve', 'Glenfiddich', 'Glenlivet',
  'Macallan', 'Lagavulin', 'Ardbeg', 'Laphroaig', 'Highland Park',
  'Jameson', 'Redbreast', 'Teeling', 'Nikka', 'Suntory', 'Yamazaki'
];

export default function AddBottlePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedBins, setSelectedBins] = useState<any[]>([]);
  const [showDistillerySuggestions, setShowDistillerySuggestions] = useState(false);
  const [distillerySuggestions, setDistillerySuggestions] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    distillery: '',
    type: 'Bourbon',
    age: '',
    proof: '',
    size: '750ml',
    vintage: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    purchasePrice: '',
    currentValue: '',
    location: '',
    binNumber: '',
    notes: '',
    rating: '',
    isOpen: false,
    barcode: '',
    isStorePick: false,
    storePickDetails: {
      store: '',
      barrel: '',
      rickhouse: '',
      floor: '',
      bottleNumber: '',
      totalBottles: '',
    },
    tags: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      fetchLocations();
    }
  }, [status, router]);

  useEffect(() => {
    if (formData.distillery) {
      const filtered = COMMON_DISTILLERIES.filter(d => 
        d.toLowerCase().includes(formData.distillery.toLowerCase())
      );
      setDistillerySuggestions(filtered);
    }
  }, [formData.distillery]);

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations');
      const data = await response.json();
      if (response.ok) {
        setLocations(data.locations);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const handleLocationChange = (locationId: string) => {
    setFormData({ ...formData, location: locationId, binNumber: '' });
    const location = locations.find(l => l._id === locationId);
    setSelectedBins(location?.bins || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const bottleData = {
        ...formData,
        age: formData.age ? parseInt(formData.age) : undefined,
        proof: parseInt(formData.proof),
        purchasePrice: parseFloat(formData.purchasePrice),
        currentValue: formData.currentValue ? parseFloat(formData.currentValue) : undefined,
        rating: formData.rating ? parseInt(formData.rating) : undefined,
        tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
        storePickDetails: formData.isStorePick ? formData.storePickDetails : undefined,
      };

      const response = await fetch('/api/bottles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bottleData),
      });

      if (response.ok) {
        router.push('/bottles');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create bottle');
      }
    } catch (error) {
      console.error('Error creating bottle:', error);
      alert('Failed to create bottle');
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
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gradient mb-8">Add New Bottle</h1>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <div className="card-premium">
            <h2 className="text-xl font-semibold text-white mb-6">Basic Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Bottle Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-premium w-full"
                  placeholder="e.g., Eagle Rare 10 Year"
                />
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Distillery <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.distillery}
                  onChange={(e) => setFormData({ ...formData, distillery: e.target.value })}
                  onFocus={() => setShowDistillerySuggestions(true)}
                  onBlur={() => setTimeout(() => setShowDistillerySuggestions(false), 200)}
                  className="input-premium w-full"
                  placeholder="e.g., Buffalo Trace"
                />
                {showDistillerySuggestions && distillerySuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 glass-dark rounded-lg max-h-48 overflow-y-auto">
                    {distillerySuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="block w-full text-left px-4 py-2 text-gray-300 hover:bg-white/10 transition-colors"
                        onClick={() => {
                          setFormData({ ...formData, distillery: suggestion });
                          setShowDistillerySuggestions(false);
                        }}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
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
                  <option value="Bourbon">Bourbon</option>
                  <option value="Scotch">Scotch</option>
                  <option value="Irish">Irish</option>
                  <option value="Rye">Rye</option>
                  <option value="Japanese">Japanese</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Age (Years)
                </label>
                <input
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className="input-premium w-full"
                  placeholder="e.g., 10"
                  min="0"
                  max="100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Proof <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  required
                  value={formData.proof}
                  onChange={(e) => setFormData({ ...formData, proof: e.target.value })}
                  className="input-premium w-full"
                  placeholder="e.g., 90"
                  min="0"
                  max="200"
                  step="0.1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Size <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  className="input-premium w-full"
                >
                  <option value="50ml">50ml</option>
                  <option value="200ml">200ml</option>
                  <option value="375ml">375ml</option>
                  <option value="500ml">500ml</option>
                  <option value="700ml">700ml</option>
                  <option value="750ml">750ml</option>
                  <option value="1L">1L</option>
                  <option value="1.75L">1.75L</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Purchase Information */}
          <div className="card-premium">
            <h2 className="text-xl font-semibold text-white mb-6">Purchase Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Purchase Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                  className="input-premium w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Purchase Price <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  required
                  value={formData.purchasePrice}
                  onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                  className="input-premium w-full"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Current Value
                </label>
                <input
                  type="number"
                  value={formData.currentValue}
                  onChange={(e) => setFormData({ ...formData, currentValue: e.target.value })}
                  className="input-premium w-full"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Barcode
                </label>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="input-premium w-full"
                  placeholder="UPC or custom code"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="card-premium">
            <h2 className="text-xl font-semibold text-white mb-6">Storage Location</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Location
                </label>
                <select
                  value={formData.location}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  className="input-premium w-full"
                >
                  <option value="">Select a location</option>
                  {locations.map((location) => (
                    <option key={location._id} value={location._id}>
                      {location.name} ({location.type})
                    </option>
                  ))}
                </select>
              </div>

              {selectedBins.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Bin
                  </label>
                  <select
                    value={formData.binNumber}
                    onChange={(e) => setFormData({ ...formData, binNumber: e.target.value })}
                    className="input-premium w-full"
                  >
                    <option value="">Select a bin</option>
                    {selectedBins.map((bin) => (
                      <option key={bin.number} value={bin.number}>
                        {bin.number} ({bin.currentCount}/{bin.capacity})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Store Pick Details */}
          <div className="card-premium">
            <h2 className="text-xl font-semibold text-white mb-6">Store Pick Details</h2>
            
            <div className="mb-6">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isStorePick}
                  onChange={(e) => setFormData({ ...formData, isStorePick: e.target.checked })}
                  className="w-5 h-5 rounded border-copper/50 bg-black/30 text-copper focus:ring-copper/30"
                />
                <span className="text-gray-300">This is a store pick</span>
              </label>
            </div>

            {formData.isStorePick && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Store Name
                  </label>
                  <input
                    type="text"
                    value={formData.storePickDetails.store}
                    onChange={(e) => setFormData({
                      ...formData,
                      storePickDetails: { ...formData.storePickDetails, store: e.target.value }
                    })}
                    className="input-premium w-full"
                    placeholder="e.g., Total Wine & More"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Barrel #
                  </label>
                  <input
                    type="text"
                    value={formData.storePickDetails.barrel}
                    onChange={(e) => setFormData({
                      ...formData,
                      storePickDetails: { ...formData.storePickDetails, barrel: e.target.value }
                    })}
                    className="input-premium w-full"
                    placeholder="e.g., #234"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Rickhouse
                  </label>
                  <input
                    type="text"
                    value={formData.storePickDetails.rickhouse}
                    onChange={(e) => setFormData({
                      ...formData,
                      storePickDetails: { ...formData.storePickDetails, rickhouse: e.target.value }
                    })}
                    className="input-premium w-full"
                    placeholder="e.g., H"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Floor
                  </label>
                  <input
                    type="text"
                    value={formData.storePickDetails.floor}
                    onChange={(e) => setFormData({
                      ...formData,
                      storePickDetails: { ...formData.storePickDetails, floor: e.target.value }
                    })}
                    className="input-premium w-full"
                    placeholder="e.g., 4"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Bottle #
                  </label>
                  <input
                    type="text"
                    value={formData.storePickDetails.bottleNumber}
                    onChange={(e) => setFormData({
                      ...formData,
                      storePickDetails: { ...formData.storePickDetails, bottleNumber: e.target.value }
                    })}
                    className="input-premium w-full"
                    placeholder="e.g., 147"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Total Bottles
                  </label>
                  <input
                    type="text"
                    value={formData.storePickDetails.totalBottles}
                    onChange={(e) => setFormData({
                      ...formData,
                      storePickDetails: { ...formData.storePickDetails, totalBottles: e.target.value }
                    })}
                    className="input-premium w-full"
                    placeholder="e.g., 240"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Additional Details */}
          <div className="card-premium">
            <h2 className="text-xl font-semibold text-white mb-6">Additional Details</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Rating (0-100)
                </label>
                <input
                  type="number"
                  value={formData.rating}
                  onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                  className="input-premium w-full"
                  placeholder="e.g., 85"
                  min="0"
                  max="100"
                />
              </div>

              <div>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isOpen}
                    onChange={(e) => setFormData({ ...formData, isOpen: e.target.checked })}
                    className="w-5 h-5 rounded border-copper/50 bg-black/30 text-copper focus:ring-copper/30"
                  />
                  <span className="text-gray-300">Bottle is currently open</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="input-premium w-full"
                  placeholder="e.g., favorite, rare, gift"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input-premium w-full resize-none"
                  rows={4}
                  placeholder="Tasting notes, purchase story, etc..."
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1"
            >
              {loading ? 'Creating...' : 'Add Bottle'}
            </button>
            <Link href="/bottles" className="btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}