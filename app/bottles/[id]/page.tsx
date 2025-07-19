'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft, Edit, Trash2, MapPin, Calendar, DollarSign, FileText, Package, Star, Eye, Camera, Skull, Wine, Copy, CheckCircle, Users, Tag, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import PhotoUpload from '@/components/PhotoUpload';
import BarrelRating from '@/components/BarrelRating';

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
  abv?: number;
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
  vaultBarcode?: string;
  cellarTrackerId?: string;
  storeId?: {
    _id: string;
    masterStoreId: {
      _id: string;
      name: string;
      type: string;
      state?: string;
      country: string;
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

interface MasterBottleView {
  masterBottle: MasterBottle;
  userBottles: UserBottle[];
  groupedBottles: Array<{
    location: string;
    bottles: UserBottle[];
  }>;
  totalCount: number;
  openedCount: number;
  unopenedCount: number;
  finishedCount: number;
}

interface Pour {
  _id: string;
  date: string;
  amount: number;
  rating?: number;
  notes?: string;
  location?: string;
  companions?: string[];
  tags?: string[];
  costPerPour?: number;
  sessionId?: {
    _id: string;
    sessionName: string;
  };
}

export default function BottleDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const bottleId = params.id as string;
  
  const [bottle, setBottle] = useState<UserBottle | null>(null);
  const [masterBottleView, setMasterBottleView] = useState<MasterBottleView | null>(null);
  const [pours, setPours] = useState<Pour[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showPourModal, setShowPourModal] = useState(false);
  const [fillLevel, setFillLevel] = useState(100);
  const [pourAmount, setPourAmount] = useState(1);
  const [pourNotes, setPourNotes] = useState('');
  const [pourRating, setPourRating] = useState(0);
  const [pourLocation, setPourLocation] = useState('Home');
  const [pourCompanions, setPourCompanions] = useState<string[]>([]);
  const [pourTags, setPourTags] = useState<string[]>([]);
  const [companionInput, setCompanionInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [showPourDetails, setShowPourDetails] = useState(false);
  const [isMasterView, setIsMasterView] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    fetchBottleDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, router, bottleId]);

  const fetchBottleDetails = async () => {
    try {
      // First try to get as individual bottle
      let response = await fetch(`/api/bottles/${bottleId}`);
      if (response.ok) {
        const data = await response.json();
        setBottle(data);
        setIsMasterView(false);
        
        // Fetch pours for this bottle
        const poursResponse = await fetch(`/api/pours?userBottleId=${bottleId}`);
        if (poursResponse.ok) {
          const poursData = await poursResponse.json();
          setPours(poursData.pours || []);
        }
      } else if (response.status === 404) {
        // If not found as individual bottle, try as master bottle
        response = await fetch(`/api/bottles/${bottleId}?view=master`);
        if (response.ok) {
          const data = await response.json();
          setMasterBottleView(data);
          setIsMasterView(true);
        } else {
          toast.error('Bottle not found');
          router.push('/bottles');
        }
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

  const handleBottleKill = async () => {
    if (!bottle) return;

    const confirmed = window.confirm(
      `Finished this bottle? This will mark it as empty and set quantity to 0.`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/bottles/${bottleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'finished',
          fillLevel: 0,
          quantity: 0,
          notes: bottle.notes ? `${bottle.notes}\n\nBottle finished on ${new Date().toLocaleDateString()}` : `Bottle finished on ${new Date().toLocaleDateString()}`,
        }),
      });

      if (response.ok) {
        const updatedBottle = await response.json();
        setBottle(updatedBottle);
        toast.success('💀 Bottle killed! RIP to a good dram.');
      } else {
        toast.error('Failed to update bottle status');
      }
    } catch (error) {
      toast.error('Failed to update bottle');
    }
  };

  const handleDelete = async () => {
    if (!bottle) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${bottle.masterBottleId.name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/bottles/${bottleId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Bottle deleted successfully');
        router.push('/bottles');
      } else {
        toast.error('Failed to delete bottle');
      }
    } catch (error) {
      console.error('Failed to delete bottle:', error);
      toast.error('Failed to delete bottle');
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenBottle = async () => {
    if (!bottle) return;

    try {
      const response = await fetch(`/api/bottles/${bottleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'opened',
          openDate: new Date().toISOString(),
          fillLevel: fillLevel,
        }),
      });

      if (response.ok) {
        const updatedBottle = await response.json();
        setBottle(updatedBottle);
        setShowOpenModal(false);
        toast.success('Bottle opened successfully!');
      } else {
        toast.error('Failed to open bottle');
      }
    } catch (error) {
      console.error('Failed to open bottle:', error);
      toast.error('Failed to open bottle');
    }
  };

  const handlePour = async () => {
    if (!bottle) return;

    try {
      const response = await fetch(`/api/bottles/${bottleId}/pour`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: pourAmount,
          notes: pourNotes,
          rating: pourRating,
        }),
      });

      if (response.ok) {
        // Use the new Pour API
        const pourResponse = await fetch('/api/pours', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userBottleId: bottle._id,
            amount: pourAmount,
            rating: pourRating > 0 ? pourRating : undefined,
            notes: pourNotes || undefined,
            location: pourLocation,
            companions: pourCompanions.length > 0 ? pourCompanions : undefined,
            tags: pourTags.length > 0 ? pourTags : undefined,
          }),
        });
        
        if (pourResponse.ok) {
          // Refresh bottle data
          const bottleResponse = await fetch(`/api/bottles/${bottleId}`);
          if (bottleResponse.ok) {
            const refreshedBottle = await bottleResponse.json();
            setBottle(refreshedBottle);
          }
          
          // Refresh pours list
          const poursResponse = await fetch(`/api/pours?userBottleId=${bottleId}`);
          if (poursResponse.ok) {
            const poursData = await poursResponse.json();
            setPours(poursData.pours || []);
          }
        }
        
        setShowPourModal(false);
        // Reset all fields
        setPourAmount(1);
        setPourNotes('');
        setPourRating(0);
        setPourLocation('Home');
        setPourCompanions([]);
        setPourTags([]);
        setCompanionInput('');
        setTagInput('');
        setShowPourDetails(false);
        
        toast.success(`Poured ${pourAmount}oz successfully!`);
      } else {
        toast.error('Failed to record pour');
      }
    } catch (error) {
      console.error('Failed to record pour:', error);
      toast.error('Failed to record pour');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (value?: number) => {
    if (!value) return 'Not specified';
    return `$${value.toLocaleString()}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'opened':
        return 'bg-green-900/50 text-green-400';
      case 'finished':
        return 'bg-red-900/50 text-red-400';
      default:
        return 'bg-gray-700 text-gray-300';
    }
  };

  const getFillLevelColor = (fillLevel: number) => {
    if (fillLevel > 50) return 'bg-green-500';
    if (fillLevel > 20) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const calculateRemainingOz = (fillLevel: number) => {
    // Assuming 750ml bottle = ~25.4 oz
    const totalOz = 25.4;
    return Math.round((fillLevel / 100) * totalOz * 10) / 10;
  };

  const calculatePourCost = (bottle: UserBottle) => {
    const totalOz = 25.4;
    const price = bottle.purchasePrice || bottle.marketValue || bottle.myValue || 0;
    return Math.round((price / totalOz) * 100) / 100;
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

  if (!bottle && !masterBottleView) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-400">Bottle not found</div>
      </div>
    );
  }
  
  // Master bottle view
  if (isMasterView && masterBottleView) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link 
              href="/bottles"
              className="flex items-center space-x-2 text-gray-400 hover:text-copper transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Collection</span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Master Bottle Header */}
            <div className="card-premium">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-white mb-2">
                    {masterBottleView.masterBottle.name}
                  </h1>
                  <div className="flex items-center space-x-4 text-gray-400 mb-4">
                    <span className="text-lg">{masterBottleView.masterBottle.distillery}</span>
                    {masterBottleView.masterBottle.region && (
                      <span className="text-sm">• {masterBottleView.masterBottle.region}</span>
                    )}
                    <span className="text-sm">• {masterBottleView.masterBottle.category}</span>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="px-3 py-1 bg-copper/20 text-copper rounded-full">
                      {masterBottleView.totalCount} bottles
                    </span>
                    <span className="text-gray-400">{masterBottleView.unopenedCount} unopened</span>
                    <span className="text-gray-400">{masterBottleView.openedCount} opened</span>
                    {masterBottleView.finishedCount > 0 && (
                      <span className="text-gray-400">{masterBottleView.finishedCount} finished</span>
                    )}
                    {masterBottleView.masterBottle.age && (
                      <span className="text-gray-400">{masterBottleView.masterBottle.age} Years</span>
                    )}
                    {masterBottleView.masterBottle.proof && (
                      <span className="text-gray-400">{masterBottleView.masterBottle.proof}° Proof</span>
                    )}
                    {masterBottleView.masterBottle.abv && (
                      <span className="text-gray-400">{masterBottleView.masterBottle.abv}% ABV</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Master Bottle Details */}
            <div className="card-premium">
              <h2 className="text-xl font-semibold text-white mb-4">Bottle Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Brand</label>
                  <p className="text-white">{masterBottleView.masterBottle.brand}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Distillery</label>
                  <p className="text-white">{masterBottleView.masterBottle.distillery}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Category</label>
                  <p className="text-white">{masterBottleView.masterBottle.category}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Type</label>
                  <p className="text-white">{masterBottleView.masterBottle.type || 'Not specified'}</p>
                </div>
                {masterBottleView.masterBottle.region && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Region</label>
                    <p className="text-white">{masterBottleView.masterBottle.region}</p>
                  </div>
                )}
                {masterBottleView.masterBottle.msrp && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">MSRP</label>
                    <p className="text-white">{formatCurrency(masterBottleView.masterBottle.msrp)}</p>
                  </div>
                )}
              </div>
              
              {masterBottleView.masterBottle.description && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                  <p className="text-white">{masterBottleView.masterBottle.description}</p>
                </div>
              )}
              
              {masterBottleView.masterBottle.isStorePick && masterBottleView.masterBottle.storePickDetails && (
                <div className="mt-4 p-4 bg-copper/10 rounded-lg border border-copper/20">
                  <h3 className="text-copper font-semibold mb-2">Store Pick Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-400">Store:</span>
                      <span className="text-white ml-2">{masterBottleView.masterBottle.storePickDetails.store}</span>
                    </div>
                    {masterBottleView.masterBottle.storePickDetails.barrel && (
                      <div>
                        <span className="text-gray-400">Barrel:</span>
                        <span className="text-white ml-2">{masterBottleView.masterBottle.storePickDetails.barrel}</span>
                      </div>
                    )}
                    {masterBottleView.masterBottle.storePickDetails.pickDate && (
                      <div>
                        <span className="text-gray-400">Pick Date:</span>
                        <span className="text-white ml-2">{formatDate(masterBottleView.masterBottle.storePickDetails.pickDate)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Your Bottles Section */}
            <div className="card-premium">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Your Bottles ({masterBottleView.totalCount})
              </h2>
              
              {masterBottleView.groupedBottles.map((group, groupIndex) => (
                <div key={groupIndex} className="mb-6 last:mb-0">
                  <h3 className="text-lg font-medium text-copper mb-3 flex items-center">
                    <MapPin className="w-4 h-4 mr-2" />
                    {group.location} ({group.bottles.length} bottles)
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {group.bottles.map((userBottle) => (
                      <div key={userBottle._id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              userBottle.status === 'opened' ? 'bg-green-900/50 text-green-400' :
                              userBottle.status === 'finished' ? 'bg-red-900/50 text-red-400' :
                              'bg-gray-700 text-gray-300'
                            }`}>
                              {userBottle.status}
                            </span>
                            {userBottle.status === 'opened' && userBottle.fillLevel < 20 && (
                              <span className="px-2 py-1 bg-red-900/50 text-red-400 rounded-full text-xs">
                                Low Stock
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Link
                              href={`/bottles/${userBottle._id}`}
                              className="text-copper hover:text-copper-light transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            <Link
                              href={`/bottles/${userBottle._id}/edit`}
                              className="text-gray-400 hover:text-white transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                            <Link
                              href={`/bottles/${userBottle._id}/print`}
                              className="text-gray-400 hover:text-white transition-colors"
                              title="Print Label"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                              </svg>
                            </Link>
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Location:</span>
                            <span className="text-white">
                              {userBottle.location?.area || 'N/A'}
                              {userBottle.location?.bin && ` - ${userBottle.location.bin}`}
                            </span>
                          </div>
                          
                          {userBottle.purchaseDate && (
                            <div className="flex justify-between">
                              <span className="text-gray-400">Purchase Date:</span>
                              <span className="text-white">{formatDate(userBottle.purchaseDate)}</span>
                            </div>
                          )}
                          
                          {userBottle.purchasePrice && (
                            <div className="flex justify-between">
                              <span className="text-gray-400">Purchase Price:</span>
                              <span className="text-copper">{formatCurrency(userBottle.purchasePrice)}</span>
                            </div>
                          )}
                          
                          {userBottle.storeId?.masterStoreId?.name && (
                            <div className="flex justify-between">
                              <span className="text-gray-400">Store:</span>
                              <span className="text-white">
                                {userBottle.storeId.masterStoreId.name}
                              </span>
                            </div>
                          )}
                          
                          {userBottle.status === 'opened' && (
                            <div className="mt-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-gray-400 text-xs">Fill Level</span>
                                <span className="text-white text-xs">{Math.round(userBottle.fillLevel)}%</span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-1">
                                <div
                                  className={`h-1 rounded-full transition-all duration-300 ${
                                    userBottle.fillLevel > 50 ? 'bg-green-500' : 
                                    userBottle.fillLevel > 20 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${userBottle.fillLevel}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar - Summary Stats */}
          <div className="space-y-6">
            <div className="card-premium">
              <h2 className="text-xl font-semibold text-white mb-4">Collection Summary</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Bottles:</span>
                  <span className="text-white font-medium">{masterBottleView.totalCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Unopened:</span>
                  <span className="text-white">{masterBottleView.unopenedCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Opened:</span>
                  <span className="text-white">{masterBottleView.openedCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Finished:</span>
                  <span className="text-white">{masterBottleView.finishedCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Locations:</span>
                  <span className="text-white">{masterBottleView.groupedBottles.length}</span>
                </div>
              </div>
            </div>
            
            <div className="card-premium">
              <h2 className="text-xl font-semibold text-white mb-4">Value Summary</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Value:</span>
                  <span className="text-copper font-medium">
                    {formatCurrency(
                      masterBottleView.userBottles.reduce((sum, b) => 
                        sum + (b.purchasePrice || b.marketValue || b.myValue || 0), 0
                      )
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Average Price:</span>
                  <span className="text-copper">
                    {formatCurrency(
                      masterBottleView.userBottles.reduce((sum, b) => 
                        sum + (b.purchasePrice || b.marketValue || b.myValue || 0), 0
                      ) / masterBottleView.totalCount
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Individual bottle view (existing code continues below)
  if (!bottle) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-400">Bottle not found</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <Link 
            href="/bottles"
            className="flex items-center space-x-2 text-gray-400 hover:text-copper transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Collection</span>
          </Link>
        </div>
        
        <div className="flex items-center space-x-2">
          <Link
            href={`/bottles/${bottleId}/edit`}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all"
            title="Edit bottle"
          >
            <Edit className="w-5 h-5" />
          </Link>
          
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-all disabled:opacity-50"
            title="Delete bottle"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bottle Header */}
          <div className="card-premium">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-2">
                  <h1 className="text-3xl font-bold text-white">
                    {bottle.masterBottleId.name}
                  </h1>
                  {bottle.vaultBarcode && (
                    <div className="flex items-center gap-2 bg-copper/10 px-3 py-1 rounded-lg">
                      <span className="text-copper font-mono text-sm font-semibold">{bottle.vaultBarcode}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(bottle.vaultBarcode!);
                          toast.success('Vault ID copied');
                        }}
                        className="text-copper/60 hover:text-copper transition-colors"
                        title="Copy Vault ID"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-4 text-gray-400 mb-4">
                  <span className="text-lg">{bottle.masterBottleId.distillery}</span>
                  {bottle.masterBottleId.region && (
                    <span className="text-sm">• {bottle.masterBottleId.region}</span>
                  )}
                  <span className="text-sm">• {bottle.masterBottleId.category}</span>
                </div>
                
                <div className="flex items-center space-x-4 text-sm">
                  <span className={`px-3 py-1 rounded-full ${getStatusColor(bottle.status)}`}>
                    {bottle.status}
                  </span>
                  <span className="text-gray-400">Quantity: {bottle.quantity}</span>
                  {bottle.masterBottleId.age && (
                    <span className="text-gray-400">{bottle.masterBottleId.age} Years</span>
                  )}
                  {bottle.masterBottleId.proof && (
                    <span className="text-gray-400">{bottle.masterBottleId.proof}° Proof</span>
                  )}
                  {bottle.fillLevel < 20 && (
                    <span className="px-2 py-1 bg-red-900/50 text-red-400 rounded-full text-xs">
                      Low Stock
                    </span>
                  )}
                </div>
                
                {/* Fill Level Indicator */}
                {bottle.status === 'opened' && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">Fill Level</span>
                      <span className="text-sm text-white">
                        {Math.round(bottle.fillLevel)}% ({calculateRemainingOz(bottle.fillLevel)}oz remaining)
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${getFillLevelColor(bottle.fillLevel)}`}
                        style={{ width: `${bottle.fillLevel}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="mt-6 flex flex-wrap gap-3">
              {bottle.status === 'unopened' && (
                <button
                  onClick={() => setShowOpenModal(true)}
                  className="btn-primary bg-green-600 hover:bg-green-700 flex items-center space-x-2"
                >
                  <Wine className="w-4 h-4" />
                  <span>Open Bottle</span>
                </button>
              )}
              
              {bottle.status === 'opened' && (
                <>
                  <button
                    onClick={() => setShowPourModal(true)}
                    className="btn-primary bg-copper hover:bg-copper-dark flex items-center space-x-2"
                  >
                    <Wine className="w-4 h-4" />
                    <span>Log Pour</span>
                  </button>
                  
                  <button
                    onClick={handleBottleKill}
                    className="btn-primary bg-red-600 hover:bg-red-700 flex items-center space-x-2"
                  >
                    <Skull className="w-4 h-4" />
                    <span>Bottle Kill</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Master Bottle Details */}
          <div className="card-premium">
            <h2 className="text-xl font-semibold text-white mb-4">Bottle Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Brand</label>
                <p className="text-white">{bottle.masterBottleId.brand}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Distillery</label>
                <p className="text-white">{bottle.masterBottleId.distillery}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Category</label>
                <p className="text-white">{bottle.masterBottleId.category}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Type</label>
                <p className="text-white">{bottle.masterBottleId.type || 'Not specified'}</p>
              </div>
              {bottle.masterBottleId.region && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Region</label>
                  <p className="text-white">{bottle.masterBottleId.region}</p>
                </div>
              )}
              {bottle.masterBottleId.msrp && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">MSRP</label>
                  <p className="text-white">{formatCurrency(bottle.masterBottleId.msrp)}</p>
                </div>
              )}
            </div>
            
            {bottle.masterBottleId.description && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                <p className="text-white">{bottle.masterBottleId.description}</p>
              </div>
            )}
            
            {bottle.masterBottleId.isStorePick && bottle.masterBottleId.storePickDetails && (
              <div className="mt-4 p-4 bg-copper/10 rounded-lg border border-copper/20">
                <h3 className="text-copper font-semibold mb-2">Store Pick Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-400">Store:</span>
                    <span className="text-white ml-2">{bottle.masterBottleId.storePickDetails.store}</span>
                  </div>
                  {bottle.masterBottleId.storePickDetails.barrel && (
                    <div>
                      <span className="text-gray-400">Barrel:</span>
                      <span className="text-white ml-2">{bottle.masterBottleId.storePickDetails.barrel}</span>
                    </div>
                  )}
                  {bottle.masterBottleId.storePickDetails.pickDate && (
                    <div>
                      <span className="text-gray-400">Pick Date:</span>
                      <span className="text-white ml-2">{formatDate(bottle.masterBottleId.storePickDetails.pickDate)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          {(bottle.notes || bottle.personalNotes) && (
            <div className="card-premium">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Notes
              </h2>
              <div className="space-y-4">
                {bottle.notes && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Tasting Notes</label>
                    <p className="text-white whitespace-pre-wrap">{bottle.notes}</p>
                  </div>
                )}
                {bottle.personalNotes && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Personal Notes</label>
                    <p className="text-white whitespace-pre-wrap">{bottle.personalNotes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pour History */}
          {pours.length > 0 && (
            <div className="card-premium">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Pour History
              </h2>
              <div className="space-y-3">
                {pours.slice(0, 10).map((pour) => (
                  <div key={pour._id} className="p-4 bg-gray-800/50 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-white font-medium">{pour.amount}oz</span>
                        <span className="text-gray-400 text-sm">
                          {new Date(pour.date).toLocaleDateString()} at {new Date(pour.date).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-right">
                        {pour.costPerPour ? (
                          <span className="text-copper font-medium">${pour.costPerPour.toFixed(2)}</span>
                        ) : (
                          <span className="text-copper text-sm font-medium">
                            ${(calculatePourCost(bottle) * pour.amount).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {pour.rating && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm text-gray-400">Rating:</span>
                        <span className="text-copper font-medium">{pour.rating}/10</span>
                        <BarrelRating value={pour.rating} onChange={() => {}} readonly size="sm" />
                      </div>
                    )}
                    
                    <div className="flex flex-wrap gap-2 mb-2">
                      {pour.location && pour.location !== 'Home' && (
                        <span className="text-xs px-2 py-1 bg-gray-700 rounded-full flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {pour.location}
                        </span>
                      )}
                      
                      {pour.companions && pour.companions.length > 0 && (
                        <span className="text-xs px-2 py-1 bg-gray-700 rounded-full flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {pour.companions.join(', ')}
                        </span>
                      )}
                      
                      {pour.tags && pour.tags.map((tag) => (
                        <span key={tag} className="text-xs px-2 py-1 bg-copper/20 text-copper rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                    
                    {pour.notes && (
                      <p className="text-gray-400 text-sm">{pour.notes}</p>
                    )}
                    
                    {pour.sessionId && (
                      <Link 
                        href={`/pour/session/${pour.sessionId._id}`}
                        className="text-xs text-copper hover:text-copper-light mt-2 inline-flex items-center gap-1"
                      >
                        View Session: {pour.sessionId.sessionName}
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                ))}
                
                {pours.length > 10 && (
                  <div className="text-center text-gray-400 text-sm">
                    Showing last 10 pours ({pours.length} total)
                  </div>
                )}
                
                <div className="border-t border-gray-700 pt-3 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total poured:</span>
                    <span className="text-white">
                      {pours.reduce((total, pour) => total + pour.amount, 0).toFixed(1)}oz
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total cost:</span>
                    <span className="text-copper font-medium">
                      ${pours.reduce((total, pour) => total + (pour.costPerPour || (calculatePourCost(bottle) * pour.amount)), 0).toFixed(2)}
                    </span>
                  </div>
                  {bottle?.averageRating && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-400">Average rating:</span>
                      <span className="text-copper font-medium">{bottle.averageRating}/10</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Purchase & Value Info */}
          <div className="card-premium">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <DollarSign className="w-5 h-5 mr-2" />
              Purchase & Value
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Purchase Price</label>
                <p className="text-white">{formatCurrency(bottle.purchasePrice)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Market Value</label>
                <p className="text-white">{formatCurrency(bottle.marketValue)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">My Value</label>
                <p className="text-white">{formatCurrency(bottle.myValue)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Purchase Date</label>
                <p className="text-white">{formatDate(bottle.purchaseDate)}</p>
              </div>
              {bottle.storeId?.masterStoreId?.name && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Store</label>
                  <p className="text-white">{bottle.storeId.masterStoreId.name}</p>
                </div>
              )}
              {bottle.deliveryDate && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Delivery Date</label>
                  <p className="text-white">{formatDate(bottle.deliveryDate)}</p>
                </div>
              )}
              {bottle.openDate && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Opened Date</label>
                  <p className="text-white">{formatDate(bottle.openDate)}</p>
                </div>
              )}
              {bottle.status === 'opened' && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Cost per Pour</label>
                  <p className="text-copper font-medium">${calculatePourCost(bottle)}/oz</p>
                </div>
              )}
            </div>
          </div>

          {/* Location */}
          {bottle.location && (
            <div className="card-premium">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <MapPin className="w-5 h-5 mr-2" />
                Location
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Area</label>
                  <p className="text-white">{bottle.location.area || 'Not specified'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Bin</label>
                  <p className="text-white">{bottle.location.bin || 'Not specified'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Additional Details */}
          <div className="card-premium">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Package className="w-5 h-5 mr-2" />
              Additional Details
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
                <p className="text-white capitalize">{bottle.status}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Quantity</label>
                <p className="text-white">{bottle.quantity}</p>
              </div>
              {bottle.vaultBarcode && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Vault ID</label>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-mono text-sm font-semibold">{bottle.vaultBarcode}</p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(bottle.vaultBarcode!);
                        toast.success('Vault ID copied to clipboard');
                      }}
                      className="text-gray-400 hover:text-white transition-colors"
                      title="Copy Vault ID"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
              {bottle.barcode && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Original Barcode</label>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-mono text-sm">{bottle.barcode}</p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(bottle.barcode!);
                        toast.success('Barcode copied to clipboard');
                      }}
                      className="text-gray-400 hover:text-white transition-colors"
                      title="Copy Barcode"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
              {bottle.cellarTrackerId && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">CellarTracker ID</label>
                  <p className="text-white font-mono text-sm">{bottle.cellarTrackerId}</p>
                </div>
              )}
              {bottle.purchaseNote && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Purchase Note</label>
                  <p className="text-white text-sm">{bottle.purchaseNote}</p>
                </div>
              )}
            </div>
          </div>

          {/* Photos */}
          <div className="card-premium">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Camera className="w-5 h-5 mr-2" />
              Photos
            </h2>
            <PhotoUpload
              bottleId={bottle._id}
              photos={bottle.photos}
              onPhotosUpdate={(newPhotos) => {
                setBottle({ ...bottle, photos: newPhotos });
              }}
            />
          </div>

          {/* Timestamps */}
          <div className="card-premium">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Record Info
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Added</label>
                <p className="text-white">{formatDate(bottle.createdAt)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Last Updated</label>
                <p className="text-white">{formatDate(bottle.updatedAt)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Open Bottle Modal */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-12">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowOpenModal(false)} />
          
          <div className="relative z-10 w-full max-w-md">
            <div className="card-premium">
              <h2 className="text-2xl font-bold text-white mb-6">Open Bottle</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Current Fill Level
                  </label>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={fillLevel}
                      onChange={(e) => setFillLevel(Number(e.target.value))}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>0%</span>
                      <span className="text-white font-medium">{Math.round(fillLevel)}%</span>
                      <span>100%</span>
                    </div>
                    <div className="text-center text-sm text-gray-400">
                      {calculateRemainingOz(fillLevel)}oz remaining
                    </div>
                  </div>
                </div>
                
                <div className="text-sm text-gray-400 bg-gray-800/50 p-3 rounded-lg">
                  <p>Setting the fill level helps track your consumption and calculate pour costs.</p>
                  <p className="mt-1">Cost per oz: ${calculatePourCost(bottle)}</p>
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button
                  onClick={() => setShowOpenModal(false)}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleOpenBottle}
                  className="flex-1 btn-primary"
                >
                  Open Bottle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pour Modal */}
      {showPourModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-12">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowPourModal(false)} />
          
          <div className="relative z-10 w-full max-w-md">
            <div className="card-premium">
              <h2 className="text-2xl font-bold text-white mb-6">Take a Pour</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Pour Amount
                  </label>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[1, 1.5, 2, 3].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setPourAmount(amount)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          pourAmount === amount
                            ? 'bg-copper text-white'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {amount}oz
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={pourAmount}
                      onChange={(e) => setPourAmount(Number(e.target.value))}
                      step="0.1"
                      min="0.1"
                      max="25"
                      className="flex-1 input-premium"
                      placeholder="Custom amount"
                    />
                    <span className="text-gray-400">oz</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Rating (T8ke Scale) - {pourRating.toFixed(1)}/10
                  </label>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.1"
                      value={pourRating}
                      onChange={(e) => setPourRating(parseFloat(e.target.value))}
                      className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>0</span>
                      <span>2.5</span>
                      <span>5</span>
                      <span>7.5</span>
                      <span>10</span>
                    </div>
                    <BarrelRating 
                      value={pourRating} 
                      onChange={setPourRating}
                      max={10}
                      readonly={false}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={pourNotes}
                    onChange={(e) => setPourNotes(e.target.value)}
                    className="w-full input-premium resize-none"
                    rows={3}
                    placeholder="Tasting notes, occasion, etc."
                  />
                </div>
                
                {/* Additional Details Toggle */}
                <button
                  type="button"
                  onClick={() => setShowPourDetails(!showPourDetails)}
                  className="w-full text-left p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors flex items-center justify-between"
                >
                  <span className="text-sm font-medium text-gray-300">Additional Details</span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${showPourDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* Additional Details Section */}
                {showPourDetails && (
                  <div className="space-y-4 pt-2">
                    {/* Location */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        <MapPin className="w-4 h-4 inline mr-1" />
                        Location
                      </label>
                      <select
                        value={pourLocation}
                        onChange={(e) => setPourLocation(e.target.value)}
                        className="w-full input-premium"
                      >
                        <option value="Home">Home</option>
                        <option value="Bar">Bar</option>
                        <option value="Restaurant">Restaurant</option>
                        <option value="Tasting">Tasting</option>
                        <option value="Friend's Place">Friend&apos;s Place</option>
                        <option value="Event">Event</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    
                    {/* Companions */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        <Users className="w-4 h-4 inline mr-1" />
                        Drinking With
                      </label>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={companionInput}
                          onChange={(e) => setCompanionInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (companionInput.trim() && !pourCompanions.includes(companionInput.trim())) {
                                setPourCompanions([...pourCompanions, companionInput.trim()]);
                                setCompanionInput('');
                              }
                            }
                          }}
                          placeholder="Add companion..."
                          className="flex-1 input-premium"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (companionInput.trim() && !pourCompanions.includes(companionInput.trim())) {
                              setPourCompanions([...pourCompanions, companionInput.trim()]);
                              setCompanionInput('');
                            }
                          }}
                          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                        >
                          Add
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {pourCompanions.map((companion) => (
                          <span
                            key={companion}
                            className="px-3 py-1 bg-gray-700 rounded-full text-sm flex items-center gap-1"
                          >
                            {companion}
                            <button
                              type="button"
                              onClick={() => setPourCompanions(pourCompanions.filter(c => c !== companion))}
                              className="text-gray-400 hover:text-white"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    {/* Tags */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        <Tag className="w-4 h-4 inline mr-1" />
                        Tags
                      </label>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const tag = tagInput.trim().toLowerCase();
                              if (tag && !tag.startsWith('#')) {
                                const formattedTag = `#${tag}`;
                                if (!pourTags.includes(formattedTag)) {
                                  setPourTags([...pourTags, formattedTag]);
                                }
                              } else if (tag && !pourTags.includes(tag)) {
                                setPourTags([...pourTags, tag]);
                              }
                              setTagInput('');
                            }
                          }}
                          placeholder="Add tag..."
                          className="flex-1 input-premium"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const tag = tagInput.trim().toLowerCase();
                            if (tag && !tag.startsWith('#')) {
                              const formattedTag = `#${tag}`;
                              if (!pourTags.includes(formattedTag)) {
                                setPourTags([...pourTags, formattedTag]);
                              }
                            } else if (tag && !pourTags.includes(tag)) {
                              setPourTags([...pourTags, tag]);
                            }
                            setTagInput('');
                          }}
                          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                        >
                          Add
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {pourTags.map((tag) => (
                          <span
                            key={tag}
                            className="px-3 py-1 bg-copper/20 text-copper rounded-full text-sm flex items-center gap-1"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => setPourTags(pourTags.filter(t => t !== tag))}
                              className="text-copper-light hover:text-copper"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="text-sm text-gray-400 bg-gray-800/50 p-3 rounded-lg">
                  <div className="flex justify-between">
                    <span>Pour cost:</span>
                    <span className="text-copper font-medium">
                      ${(calculatePourCost(bottle) * pourAmount).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span>New fill level:</span>
                    <span className="text-white">
                      {Math.max(0, Math.round((bottle.fillLevel - (pourAmount / 25.4 * 100)) * 10) / 10)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button
                  onClick={() => setShowPourModal(false)}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePour}
                  className="flex-1 btn-primary"
                >
                  Record Pour
                </button>
              </div>
            </div>
          </div>
        </div>
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