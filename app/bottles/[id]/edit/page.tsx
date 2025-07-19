'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import AutocompleteInput from '@/components/AutocompleteInput';

interface MasterBottle {
  _id: string;
  name: string;
  brand: string;
  distillery: string;
  region?: string;
  category: string;
  type: string;
  age?: number;
  proof?: number;
  msrp?: number;
  description?: string;
  isStorePick: boolean;
  storePickDetails?: {
    store: string;
    pickDate?: string;
    barrel?: string;
  };
}

interface UserBottle {
  _id: string;
  userId: string;
  masterBottleId: MasterBottle;
  purchaseDate?: string;
  purchasePrice?: number;
  marketValue?: number;
  myValue?: number;
  quantity: number;
  location?: {
    area: string;
    bin: string;
  };
  notes?: string;
  personalNotes?: string;
  purchaseNote?: string;
  deliveryDate?: string;
  barcode?: string;
  cellarTrackerId?: string;
  storeId?: {
    _id: string;
    masterStoreId?: {
      _id: string;
      name: string;
    };
  };
  status: 'unopened' | 'opened' | 'finished';
  photos: string[];
  pours: Array<{
    date: string;
    amount: number;
    rating?: number;
    notes?: string;
  }>;
  fillLevel: number;
  openDate?: string;
  createdAt: string;
  updatedAt: string;
}

export default function EditBottlePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const bottleId = params.id as string;
  
  const [bottle, setBottle] = useState<UserBottle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stores, setStores] = useState<any[]>([]);
  
  // Autocomplete suggestions
  const [storeSuggestions, setStoreSuggestions] = useState<string[]>([]);
  const [storePickStoreSuggestions, setStorePickStoreSuggestions] = useState<string[]>([]);
  const [areaSuggestions, setAreaSuggestions] = useState<string[]>([]);
  const [binSuggestions, setBinSuggestions] = useState<string[]>([]);
  const [purchaseLocation, setPurchaseLocation] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    purchaseDate: '',
    purchasePrice: '',
    marketValue: '',
    myValue: '',
    locationArea: '',
    locationBin: '',
    notes: '',
    personalNotes: '',
    purchaseNote: '',
    deliveryDate: '',
    barcode: '',
    cellarTrackerId: '',
    storeId: '',
  });
  
  // Store pick state
  const [isStorePick, setIsStorePick] = useState(false);
  const [storePickDetails, setStorePickDetails] = useState({
    store: '',
    pickDate: '',
    barrel: '',
  });

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    fetchBottleDetails();
    fetchStores();
  }, [session, status, router, bottleId]);

  const fetchStores = async () => {
    try {
      const response = await fetch('/api/stores');
      if (response.ok) {
        const data = await response.json();
        setStores(data.userStores);
      }
    } catch (error) {
      console.error('Failed to fetch stores:', error);
    }
  };

  const fetchBottleDetails = async () => {
    try {
      const response = await fetch(`/api/bottles/${bottleId}`);
      if (response.ok) {
        const data = await response.json();
        setBottle(data);
        
        // Populate form with existing data
        setFormData({
          purchaseDate: data.purchaseDate ? new Date(data.purchaseDate).toISOString().split('T')[0] : '',
          purchasePrice: data.purchasePrice?.toString() || '',
          marketValue: data.marketValue?.toString() || '',
          myValue: data.myValue?.toString() || '',
          locationArea: data.location?.area || '',
          locationBin: data.location?.bin || '',
          notes: data.notes || '',
          personalNotes: data.personalNotes || '',
          purchaseNote: data.purchaseNote || '',
          deliveryDate: data.deliveryDate ? new Date(data.deliveryDate).toISOString().split('T')[0] : '',
          barcode: data.barcode || '',
          cellarTrackerId: data.cellarTrackerId || '',
          storeId: data.storeId?._id || '',
        });
        
        // Set purchase location from store name
        if (data.storeId?.masterStoreId?.name) {
          setPurchaseLocation(data.storeId.masterStoreId.name);
        }
        
        // Set store pick details from master bottle
        if (data.masterBottleId?.isStorePick) {
          setIsStorePick(true);
          if (data.masterBottleId.storePickDetails) {
            setStorePickDetails({
              store: data.masterBottleId.storePickDetails.store || '',
              pickDate: data.masterBottleId.storePickDetails.pickDate ? new Date(data.masterBottleId.storePickDetails.pickDate).toISOString().split('T')[0] : '',
              barrel: data.masterBottleId.storePickDetails.barrel || '',
            });
          }
        }
      } else if (response.status === 404) {
        toast.error('Bottle not found');
        router.push('/bottles');
      } else {
        toast.error('Failed to load bottle details');
      }
    } catch (error) {
      console.error('Failed to fetch bottle details:', error);
      toast.error('Failed to load bottle details');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updateData: any = {
        purchaseDate: formData.purchaseDate ? new Date(formData.purchaseDate).toISOString() : undefined,
        purchasePrice: formData.purchasePrice ? parseFloat(formData.purchasePrice) : undefined,
        marketValue: formData.marketValue ? parseFloat(formData.marketValue) : undefined,
        myValue: formData.myValue ? parseFloat(formData.myValue) : undefined,
        location: (formData.locationArea || formData.locationBin) ? {
          area: formData.locationArea,
          bin: formData.locationBin,
        } : undefined,
        notes: formData.notes,
        personalNotes: formData.personalNotes,
        purchaseNote: formData.purchaseNote,
        deliveryDate: formData.deliveryDate ? new Date(formData.deliveryDate).toISOString() : undefined,
        barcode: formData.barcode,
        cellarTrackerId: formData.cellarTrackerId,
        purchaseLocation: purchaseLocation || undefined,
      };
      
      // Include master bottle update data for store pick
      if (isStorePick || storePickDetails.store || storePickDetails.barrel || storePickDetails.pickDate) {
        updateData.masterBottleUpdate = {
          isStorePick: isStorePick,
          storePickDetails: isStorePick ? {
            store: storePickDetails.store,
            pickDate: storePickDetails.pickDate ? new Date(storePickDetails.pickDate).toISOString() : undefined,
            barrel: storePickDetails.barrel || undefined,
          } : undefined,
        };
      }

      const response = await fetch(`/api/bottles/${bottleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        toast.success('Bottle updated successfully');
        router.push(`/bottles/${bottleId}`);
      } else {
        toast.error('Failed to update bottle');
      }
    } catch (error) {
      console.error('Failed to update bottle:', error);
      toast.error('Failed to update bottle');
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (!bottle) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-400">Bottle not found</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <Link 
            href={`/bottles/${bottleId}`}
            className="flex items-center space-x-2 text-gray-400 hover:text-copper transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Bottle</span>
          </Link>
        </div>
        
        <div className="flex items-center space-x-3">
          <Link
            href={`/bottles/${bottleId}`}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600/20 hover:bg-gray-600/30 text-gray-300 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Cancel</span>
          </Link>
          
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center space-x-2 px-4 py-2 bg-copper/20 hover:bg-copper/30 text-copper rounded-lg transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* Master Bottle Info (Read-only) */}
      <div className="card-premium mb-8">
        <h1 className="text-2xl font-bold text-white mb-4">
          Editing: {bottle.masterBottleId.name}
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Distillery:</span>
            <span className="text-white ml-2">{bottle.masterBottleId.distillery}</span>
          </div>
          <div>
            <span className="text-gray-400">Category:</span>
            <span className="text-white ml-2">{bottle.masterBottleId.category}</span>
          </div>
          <div>
            <span className="text-gray-400">Status:</span>
            <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
              bottle.status === 'opened' ? 'bg-green-900/50 text-green-400' :
              bottle.status === 'finished' ? 'bg-red-900/50 text-red-400' :
              'bg-gray-700 text-gray-300'
            }`}>
              {bottle.status}
            </span>
          </div>
        </div>
      </div>

      {/* Store Pick Information */}
      <div className="card-premium mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Store Pick Information</h2>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="isStorePick"
              checked={isStorePick}
              onChange={(e) => setIsStorePick(e.target.checked)}
              className="w-4 h-4 text-copper bg-gray-800 border-gray-600 rounded focus:ring-copper focus:ring-2"
            />
            <label htmlFor="isStorePick" className="text-gray-300 font-medium">
              This is a store pick
            </label>
          </div>
          
          {isStorePick && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <AutocompleteInput
                label="Store Name"
                value={storePickDetails.store}
                onChange={(value) => setStorePickDetails({...storePickDetails, store: value})}
                onSearch={async (query) => {
                  const res = await fetch(`/api/stores/search?q=${encodeURIComponent(query)}`);
                  const data = await res.json();
                  setStorePickStoreSuggestions(data.stores || []);
                }}
                suggestions={storePickStoreSuggestions}
                placeholder="Store name"
                allowNew={true}
              />
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Pick Date
                </label>
                <input
                  type="date"
                  value={storePickDetails.pickDate}
                  onChange={(e) => setStorePickDetails({...storePickDetails, pickDate: e.target.value})}
                  className="input-premium w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Barrel Number
                </label>
                <input
                  type="text"
                  value={storePickDetails.barrel}
                  onChange={(e) => setStorePickDetails({...storePickDetails, barrel: e.target.value})}
                  className="input-premium w-full"
                  placeholder="Barrel #"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Purchase & Value */}
          <div className="space-y-6">
            <div className="card-premium">
              <h2 className="text-xl font-semibold text-white mb-4">Purchase & Value Information</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    name="purchaseDate"
                    value={formData.purchaseDate}
                    onChange={handleInputChange}
                    className="input-premium w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Purchase Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="purchasePrice"
                    value={formData.purchasePrice}
                    onChange={handleInputChange}
                    className="input-premium w-full"
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Market Value ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="marketValue"
                    value={formData.marketValue}
                    onChange={handleInputChange}
                    className="input-premium w-full"
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    My Value ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="myValue"
                    value={formData.myValue}
                    onChange={handleInputChange}
                    className="input-premium w-full"
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Delivery Date
                  </label>
                  <input
                    type="date"
                    name="deliveryDate"
                    value={formData.deliveryDate}
                    onChange={handleInputChange}
                    className="input-premium w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Location & Details */}
          <div className="space-y-6">
            <div className="card-premium">
              <h2 className="text-xl font-semibold text-white mb-4">Location & Details</h2>
              
              <div className="space-y-4">
                <AutocompleteInput
                  label="Location Area"
                  value={formData.locationArea}
                  onChange={(value) => {
                    setFormData({...formData, locationArea: value});
                    // Clear bin when area changes
                    if (value !== formData.locationArea) {
                      setFormData(prev => ({...prev, locationBin: ''}));
                      setBinSuggestions([]);
                    }
                  }}
                  onSearch={async (query) => {
                    const res = await fetch(`/api/locations/areas?q=${encodeURIComponent(query)}`);
                    const data = await res.json();
                    setAreaSuggestions(data.areas || []);
                  }}
                  suggestions={areaSuggestions}
                  placeholder="e.g., Living Room, Wine Cellar"
                  allowNew={true}
                />
                
                <AutocompleteInput
                  label="Bin/Position"
                  value={formData.locationBin}
                  onChange={(value) => setFormData({...formData, locationBin: value})}
                  onSearch={async (query) => {
                    if (formData.locationArea) {
                      const res = await fetch(`/api/locations/bins?area=${encodeURIComponent(formData.locationArea)}&q=${encodeURIComponent(query)}`);
                      const data = await res.json();
                      setBinSuggestions(data.bins || []);
                    }
                  }}
                  suggestions={binSuggestions}
                  placeholder="e.g., A1, Shelf 2"
                  allowNew={true}
                />
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Barcode
                  </label>
                  <input
                    type="text"
                    name="barcode"
                    value={formData.barcode}
                    onChange={handleInputChange}
                    className="input-premium w-full"
                    placeholder="Barcode or ID"
                  />
                </div>
                
                <AutocompleteInput
                  label="Purchase Location"
                  value={purchaseLocation}
                  onChange={(value) => setPurchaseLocation(value)}
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
                    CellarTracker ID
                  </label>
                  <input
                    type="text"
                    name="cellarTrackerId"
                    value={formData.cellarTrackerId}
                    onChange={handleInputChange}
                    className="input-premium w-full"
                    placeholder="CellarTracker iWine ID"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes Section */}
        <div className="card-premium mt-8">
          <h2 className="text-xl font-semibold text-white mb-4">Notes</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Purchase Notes
              </label>
              <textarea
                name="purchaseNote"
                value={formData.purchaseNote}
                onChange={handleInputChange}
                rows={3}
                className="input-premium w-full resize-none"
                placeholder="Store information, purchase details, etc."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tasting Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={4}
                className="input-premium w-full resize-none"
                placeholder="Flavor profile, aroma, finish, etc."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Personal Notes
              </label>
              <textarea
                name="personalNotes"
                value={formData.personalNotes}
                onChange={handleInputChange}
                rows={4}
                className="input-premium w-full resize-none"
                placeholder="Personal thoughts, memories, occasions, etc."
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4 mt-8">
          <Link
            href={`/bottles/${bottleId}`}
            className="px-6 py-2 bg-gray-600/20 hover:bg-gray-600/30 text-gray-300 rounded-lg transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-copper/20 hover:bg-copper/30 text-copper rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}