'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Upload, Eye, Globe, Package, Trash2, ScanLine, Filter, Wine, Tag, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import Image from 'next/image';
import dynamicImport from 'next/dynamic';
import MasterBottleSearch from '@/components/MasterBottleSearch';
import { usePrintQueue } from '@/contexts/PrintQueueContext';
import SwipeableBottleCard from '@/components/SwipeableBottleCard';
import { haptic } from '@/utils/haptics';
import NotificationCenter from '@/components/NotificationCenter';
import BarrelRating from '@/components/BarrelRating';
import { getUserBottleRating } from '@/utils/ratingCalculations';

const BarcodeScanner = dynamicImport(() => import('@/components/EnhancedBarcodeScanner'), {
  ssr: false,
});

interface MasterBottle {
  _id: string;
  name: string;
  brand: string;
  distillery: string;
  category: string;
  type?: string;
  age?: number;
  proof?: number;
  abv?: number;
  statedProof?: string;
  msrp?: number;
  description?: string;
  isStorePick: boolean;
  communityRating?: number;
  communityRatingCount?: number;
}

interface UserBottle {
  _id: string;
  masterBottleId: MasterBottle;
  purchaseDate?: Date;
  purchasePrice?: number;
  purchaseLocation?: string;
  quantity: number;
  location?: {
    area: string;
    bin: string;
  };
  status: 'unopened' | 'opened' | 'finished';
  photos: string[];
  notes?: string;
  createdAt: string;
  fillLevel?: number;
  barcode?: string;
  vaultBarcode?: string;
  averageRating?: number;
}

interface GroupedBottle {
  _id: string;
  masterBottleId: MasterBottle;
  totalCount: number;
  openedCount: number;
  unopenedCount: number;
  finishedCount: number;
  locations: string[];
  stores: string[];
  totalValue: number;
  averagePrice: number;
  priceRange: { min: number | null; max: number | null };
  userBottles: UserBottle[];
  createdAt: string;
  updatedAt: string;
}

export default function BottlesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToQueue, isInQueue } = usePrintQueue();
  const [bottles, setBottles] = useState<(UserBottle | MasterBottle | GroupedBottle)[]>([]);
  const [loading, setLoading] = useState(true);
  // Initialize filters from URL parameters immediately
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [proofFilter, setProofFilter] = useState('');
  const [viewMode, setViewMode] = useState<'my' | 'community' | 'all'>('my');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || '-createdAt');
  const [isMasterBottles, setIsMasterBottles] = useState(false);
  const [isGrouped, setIsGrouped] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  // Show filters if any are pre-applied from URL
  const [showFilters, setShowFilters] = useState(
    !!(searchParams.get('status') || searchParams.get('category') || searchParams.get('proof'))
  );
  const [quickPourBottle, setQuickPourBottle] = useState<UserBottle | null>(null);
  const [quickRateBottle, setQuickRateBottle] = useState<UserBottle | null>(null);
  const [filtersInitialized, setFiltersInitialized] = useState(true); // True since we initialize from URL
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 24,
    total: 0,
    pages: 0,
  });


  // Update filters when URL parameters change (only after initial mount)
  useEffect(() => {
    // Skip the first render since we initialize from URL
    if (!filtersInitialized) return;
    
    const statusParam = searchParams.get('status');
    const sortParam = searchParams.get('sort');
    const categoryParam = searchParams.get('category');
    
    setStatusFilter(statusParam || '');
    setSortBy(sortParam || '-createdAt');
    setCategoryFilter(categoryParam || '');
  }, [searchParams, filtersInitialized]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    // Only fetch if filters are initialized and session is ready
    if (status === 'authenticated' && filtersInitialized) {
      setPagination(prev => ({ ...prev, page: 1 })); // Reset to page 1 when filters change
      fetchBottles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, statusFilter, proofFilter, sortBy, viewMode, status, filtersInitialized]);

  useEffect(() => {
    // Only fetch if filters are initialized and session is ready
    if (status === 'authenticated' && filtersInitialized && pagination.page > 1) {
      fetchBottles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, status, filtersInitialized]);

  const fetchBottles = async () => {
    try {
      const params = new URLSearchParams();
      const searchParam = searchParams.get('search');
      if (searchParam) params.append('search', searchParam);
      if (categoryFilter) params.append('category', categoryFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (proofFilter) params.append('proof', proofFilter);
      params.append('sort', sortBy);
      params.append('view', viewMode);
      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());

      const response = await fetch(`/api/user-bottles?${params}`);
      const data = await response.json();

      if (response.ok) {
        setBottles(data.bottles);
        setIsMasterBottles(data.isMasterBottles);
        setIsGrouped(data.isGrouped || false);
        setPagination(prev => ({
          ...prev,
          total: data.pagination.total,
          pages: data.pagination.pages,
        }));
      }
    } catch (error) {
      console.error('Error fetching bottles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeScanned = (barcode: string) => {
    setShowScanner(false);
    // Use new smart scan flow
    router.push(`/scan/result?barcode=${encodeURIComponent(barcode)}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bottle?')) return;

    try {
      const response = await fetch(`/api/user-bottles/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setBottles(bottles.filter(b => b._id !== id));
      }
    } catch (error) {
      console.error('Error deleting bottle:', error);
    }
  };

  const handleClearCollection = async () => {
    const confirmed = window.confirm(
      'This will delete all your bottles. Are you sure? This action cannot be undone.'
    );
    
    if (!confirmed) return;

    // Double confirmation for safety
    const doubleConfirmed = window.confirm(
      'Are you absolutely sure? This will permanently delete your entire collection.'
    );
    
    if (!doubleConfirmed) return;

    setClearing(true);
    try {
      const response = await fetch('/api/user-bottles/clear', {
        method: 'DELETE',
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Successfully deleted ${data.deletedCount} bottles`);
        setBottles([]);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to clear collection');
      }
    } catch (error) {
      console.error('Error clearing collection:', error);
      toast.error('Failed to clear collection');
    } finally {
      setClearing(false);
    }
  };

  const isUserBottle = (bottle: UserBottle | MasterBottle | GroupedBottle): bottle is UserBottle => {
    return 'masterBottleId' in bottle && 'quantity' in bottle && !('totalCount' in bottle);
  };
  
  const isGroupedBottle = (bottle: UserBottle | MasterBottle | GroupedBottle): bottle is GroupedBottle => {
    return 'totalCount' in bottle;
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
      <nav className="bg-black/20 border border-white/10 shadow-2xl border-b">
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
                <Link href="/pour/sessions" className="text-gray-300 hover:text-white transition-colors">
                  Pour Sessions
                </Link>
                <Link href="/locations" className="text-gray-300 hover:text-white transition-colors">
                  Locations
                </Link>
                <Link href="/labels" className="text-gray-300 hover:text-white transition-colors">
                  Print Labels
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <NotificationCenter userId={session?.user?.id || ''} />
              <Link href="/bottles/import" className="text-gray-400 hover:text-white transition-colors text-sm">
                <Upload className="w-4 h-4 inline mr-1" />
                Import
              </Link>
              {viewMode === 'my' && bottles.length > 0 && (
                <button
                  onClick={handleClearCollection}
                  disabled={clearing}
                  className="text-gray-400 hover:text-red-400 transition-colors text-sm disabled:opacity-50"
                  title="Clear entire collection"
                >
                  <Trash2 className="w-4 h-4 inline mr-1" />
                  Clear
                </button>
              )}
              <Link href="/bottles/add" className="btn-primary text-sm px-4 py-2">
                Add Bottle
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        
        {/* Clean Header Section */}
        <div className="mb-8">
          {/* Top Row - Title and Search */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 mb-6">
            {/* Title */}
            <h1 className="text-2xl md:text-3xl font-bold text-white">
              {viewMode === 'my' ? 'My Collection' : 'Community Bottles'}
            </h1>
            
            {/* Centered Search Bar */}
            <div className="flex-1 md:max-w-xl md:mx-8 flex items-center gap-2">
              <div className="flex-1 relative">
                <MasterBottleSearch 
                  placeholder="Search bottles..."
                  redirectToBottle={true}
                  className="w-full"
                />
              </div>
              <button
                onClick={() => setShowScanner(true)}
                className="p-3 md:p-2 hover:bg-gray-700 rounded-lg transition-all bg-gray-800/50 border border-gray-700"
                title="Scan barcode"
              >
                <ScanLine className="w-5 h-5 text-gray-400 hover:text-copper" />
              </button>
            </div>
            
            {/* Placeholder for balance - hidden on mobile */}
            <div className="hidden md:block w-32"></div>
          </div>
          
          {/* Bottom Row - View Toggle and Filters */}
          <div className="flex items-center justify-between">
            {/* View Toggle */}
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('my')}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    viewMode === 'my'
                      ? 'bg-copper text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  My Bottles
                </button>
                <button
                  onClick={() => setViewMode('community')}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    viewMode === 'community'
                      ? 'bg-copper text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  Community
                </button>
              </div>
            </div>
            
            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-400 hover:text-white rounded-lg transition-all"
            >
              <Filter className="w-4 h-4" />
              Filters
              {(categoryFilter || statusFilter || proofFilter || sortBy !== '-createdAt') && (
                <span className="ml-1 px-2 py-0.5 bg-copper text-white text-xs rounded-full">
                  {[categoryFilter, statusFilter, proofFilter, sortBy !== '-createdAt' && 'sorted'].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>
          
          {/* Collapsible Filters */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-800/30 rounded-lg border border-gray-700">
              <div className="flex flex-wrap gap-3">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white appearance-none cursor-pointer focus:outline-none focus:border-copper"
                >
                  <option value="">All Categories</option>
                  <option value="Bourbon">Bourbon</option>
                  <option value="Scotch">Scotch</option>
                  <option value="Irish">Irish</option>
                  <option value="Rye">Rye</option>
                  <option value="Japanese">Japanese</option>
                  <option value="Other">Other</option>
                </select>

                {viewMode !== 'community' && (
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white appearance-none cursor-pointer focus:outline-none focus:border-copper"
                  >
                    <option value="">All Status</option>
                    <option value="unopened">Unopened</option>
                    <option value="opened">Opened</option>
                    <option value="finished">Finished</option>
                  </select>
                )}

                <select
                  value={proofFilter}
                  onChange={(e) => setProofFilter(e.target.value)}
                  className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white appearance-none cursor-pointer focus:outline-none focus:border-copper"
                >
                  <option value="">All Proofs</option>
                  <option value="80-90">80-90 Proof</option>
                  <option value="90-100">90-100 Proof</option>
                  <option value="100-110">100-110 Proof</option>
                  <option value="110-120">110-120 Proof</option>
                  <option value="120+">120+ Proof</option>
                  <option value="cask">Cask Strength (110+)</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white appearance-none cursor-pointer focus:outline-none focus:border-copper"
                >
                  <option value="-createdAt">Newest First</option>
                  <option value="createdAt">Oldest First</option>
                  <option value="name">Name (A-Z)</option>
                  <option value="-name">Name (Z-A)</option>
                  <option value="-purchasePrice">Price (High to Low)</option>
                  <option value="purchasePrice">Price (Low to High)</option>
                  <option value="-proof">Proof (High to Low)</option>
                  <option value="proof">Proof (Low to High)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Results Summary */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {pagination.total > 0 ? (
              <>
                Showing <span className="text-white">{(pagination.page - 1) * pagination.limit + 1}</span> - <span className="text-white">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="text-white">{pagination.total}</span> bottles
              </>
            ) : (
              'No bottles found'
            )}
          </p>
        </div>

        {bottles.length === 0 ? (
          <div className="card-premium text-center py-16">
            <svg className="w-24 h-24 text-copper/30 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No bottles found</h3>
            <p className="text-gray-500 mb-6">Start building your collection by adding your first bottle</p>
            <div className="flex gap-4 justify-center">
              <Link href="/bottles/import" className="btn-secondary inline-flex items-center">
                <Upload className="w-5 h-5 mr-2" />
                Import from CSV
              </Link>
              <Link href="/bottles/add" className="btn-primary inline-flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Your First Bottle
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bottles.map((bottle) => {
              const isUser = isUserBottle(bottle);
              const isGrouped = isGroupedBottle(bottle);
              const masterData = isUser ? bottle.masterBottleId : (isGrouped ? bottle.masterBottleId : bottle as MasterBottle);
              
              if (isGrouped) {
                // Grouped bottle view
                return (
                  <Link key={bottle._id} href={`/bottles/${bottle._id}`} className="block">
                    <div className="card-premium group hover:border-copper/30 hover:shadow-lg cursor-pointer transition-all duration-300">
                      {/* Show thumbnail if any bottle has photos */}
                      {bottle.userBottles.some(b => b.photos && b.photos.length > 0) && (
                        <div className="relative h-48 -mx-6 -mt-6 mb-4 overflow-hidden rounded-t-lg" style={{ width: 'calc(100% + 3rem)' }}>
                          <Image
                            src={bottle.userBottles.find(b => b.photos && b.photos.length > 0)?.photos[0] || ''}
                            alt={masterData.name}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          />
                        </div>
                      )}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white group-hover:text-copper-light transition-colors">
                          {masterData.name}
                        </h3>
                        <p className="text-gray-400">{masterData.distillery}</p>
                        {bottle.userBottles && bottle.userBottles.length > 0 && bottle.userBottles[0].vaultBarcode && (
                          <div className="mt-2">
                            <span className="inline-flex items-center px-2 py-0.5 bg-copper/10 text-copper text-xs font-mono rounded">
                              {bottle.userBottles.length === 1 
                                ? bottle.userBottles[0].vaultBarcode 
                                : `${bottle.userBottles[0].vaultBarcode} +${bottle.userBottles.length - 1}`}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="glass bg-copper/20 text-copper text-xs px-2 py-1 rounded-full">
                          {bottle.totalCount} bottles
                        </span>
                        {bottle.openedCount > 0 && (
                          <span className="glass bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full">
                            {bottle.openedCount} open
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Category:</span>
                        <span className="text-gray-300">{masterData.category}</span>
                      </div>
                      {masterData.age && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Age:</span>
                          <span className="text-gray-300">{masterData.age} Years</span>
                        </div>
                      )}
                      {masterData.proof && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Proof:</span>
                          <span className="text-gray-300">{masterData.proof}°</span>
                        </div>
                      )}
                      {masterData.abv && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">ABV:</span>
                          <span className="text-gray-300">{masterData.abv}%</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-500">Status:</span>
                        <span className="text-gray-300">
                          {bottle.unopenedCount > 0 && `${bottle.unopenedCount} unopened`}
                          {bottle.unopenedCount > 0 && bottle.openedCount > 0 && ', '}
                          {bottle.openedCount > 0 && `${bottle.openedCount} opened`}
                          {bottle.finishedCount > 0 && `, ${bottle.finishedCount} finished`}
                        </span>
                      </div>
                      {bottle.locations.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Locations:</span>
                          <span className="text-gray-300 text-xs">
                            📍 {bottle.locations.length} location{bottle.locations.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                      {bottle.stores.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Stores:</span>
                          <span 
                            className="text-gray-300 text-xs cursor-help"
                            title={bottle.stores.join(', ')}
                          >
                            🏪 {bottle.stores.length === 1 ? bottle.stores[0] : `${bottle.stores.length} stores`}
                          </span>
                        </div>
                      )}
                      {bottle.totalValue > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Total Value:</span>
                          <span className="text-copper-light font-semibold">${bottle.totalValue.toFixed(0)}</span>
                        </div>
                      )}
                      {bottle.averagePrice > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Avg Price:</span>
                          <span className="text-copper-light font-semibold">${bottle.averagePrice.toFixed(0)}</span>
                        </div>
                      )}
                    </div>

                    {/* Rating Display for Grouped Bottles */}
                    {masterData.communityRating !== undefined && masterData.communityRating !== null && (
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">Community Rating:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-copper">{masterData.communityRating.toFixed(1)}</span>
                            <Star className="w-4 h-4 text-copper fill-copper" />
                            <span className="text-xs text-gray-500">({masterData.communityRatingCount} pour{masterData.communityRatingCount !== 1 ? 's' : ''})</span>
                          </div>
                        </div>
                        <div className="text-right mt-1">
                          <span className="text-xs text-gray-600">Updated daily</span>
                        </div>
                      </div>
                    )}
                    </div>
                  </Link>
                );
              } else {
                // Individual bottle view (for community view)
                return (
                  <SwipeableBottleCard
                    key={bottle._id}
                    bottleId={bottle._id}
                    onQuickPour={isUser ? () => {
                      haptic.medium();
                      setQuickPourBottle(bottle as UserBottle);
                    } : undefined}
                    onQuickRate={isUser ? () => {
                      haptic.medium();
                      setQuickRateBottle(bottle as UserBottle);
                    } : undefined}
                    className="relative group"
                  >
                    <Link href={`/bottles/${bottle._id}`} className="block">
                      <div className="card-premium hover:border-copper/30 hover:shadow-lg cursor-pointer transition-all duration-300">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white group-hover:text-copper-light transition-colors">
                          {masterData.name}
                        </h3>
                        <p className="text-gray-400">{masterData.distillery}</p>
                        {isUser && bottle.vaultBarcode && (
                          <div className="mt-2">
                            <span className="inline-flex items-center px-2 py-0.5 bg-copper/10 text-copper text-xs font-mono rounded">
                              {bottle.vaultBarcode}
                            </span>
                          </div>
                        )}
                      </div>
                      {isUser && bottle.status === 'opened' && (
                        <div className="flex items-center space-x-2">
                          <span className="glass bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full">
                            Open
                          </span>
                          {bottle.fillLevel && bottle.fillLevel < 20 && (
                            <span className="glass bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded-full">
                              Low Stock
                            </span>
                          )}
                        </div>
                      )}
                      {!isUser && (
                        <span className="glass bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded-full">
                          Community
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Category:</span>
                        <span className="text-gray-300">{masterData.category}</span>
                      </div>
                      {masterData.age && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Age:</span>
                          <span className="text-gray-300">{masterData.age} Years</span>
                        </div>
                      )}
                      {masterData.proof && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Proof:</span>
                          <span className="text-gray-300">{masterData.proof}°</span>
                        </div>
                      )}
                      {masterData.abv && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">ABV:</span>
                          <span className="text-gray-300">{masterData.abv}%</span>
                        </div>
                      )}
                      {isUser && (
                        <>
                          {bottle.quantity > 1 && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Quantity:</span>
                              <span className="text-gray-300">{bottle.quantity}</span>
                            </div>
                          )}
                          {bottle.location && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Location:</span>
                              <span className="text-gray-300">{bottle.location.area} - {bottle.location.bin}</span>
                            </div>
                          )}
                          {bottle.purchasePrice && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Purchase Price:</span>
                              <span className="text-copper-light font-semibold">${bottle.purchasePrice}</span>
                            </div>
                          )}
                        </>
                      )}
                      {!isUser && masterData.msrp && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">MSRP:</span>
                          <span className="text-copper-light font-semibold">${masterData.msrp}</span>
                        </div>
                      )}
                    </div>

                    {/* Rating Display */}
                    {(isUser && bottle.averageRating !== undefined && bottle.averageRating !== null) || 
                     (masterData.communityRating !== undefined && masterData.communityRating !== null) ? (
                      <div className="mt-4 space-y-2">
                        {isUser && bottle.averageRating !== undefined && bottle.averageRating !== null && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-400">My Rating:</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-copper">{bottle.averageRating.toFixed(1)}</span>
                              <Star className="w-4 h-4 text-copper fill-copper" />
                            </div>
                          </div>
                        )}
                        {masterData.communityRating !== undefined && masterData.communityRating !== null && (
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-400">Community:</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-copper">{masterData.communityRating.toFixed(1)}</span>
                                <Star className="w-4 h-4 text-copper fill-copper" />
                                <span className="text-xs text-gray-500">({masterData.communityRatingCount} pour{masterData.communityRatingCount !== 1 ? 's' : ''})</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-gray-600">Updated daily</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      isUser && <div className="mt-4 text-center text-sm text-gray-500">No ratings yet</div>
                    )}

                    {/* Fill Level Indicator */}
                    {isUser && bottle.status === 'opened' && bottle.fillLevel !== undefined && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-gray-500">Fill Level</span>
                          <span className="text-xs text-gray-300">{bottle.fillLevel.toFixed(2)}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              bottle.fillLevel > 50 ? 'bg-green-500' : 
                              bottle.fillLevel > 20 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${bottle.fillLevel}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {/* Add padding at the bottom when action buttons are present */}
                    {isUser && <div className="h-12" />}
                      </div>
                    </Link>
                    
                    {/* Action buttons positioned absolutely */}
                      {isUser && (
                        <div className="absolute bottom-4 right-4 flex gap-2 z-20" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              addToQueue({
                                _id: bottle._id,
                                name: masterData.name,
                                distillery: masterData.distillery,
                                vaultBarcode: bottle.vaultBarcode
                              });
                            }}
                            disabled={isInQueue(bottle._id)}
                            className={`glass px-3 py-2 rounded-lg transition-all duration-300 ${
                              isInQueue(bottle._id)
                                ? 'border-gray-600 text-gray-500 cursor-not-allowed'
                                : 'border-copper/30 text-copper hover:bg-copper/10 hover:border-copper/50'
                            }`}
                            title={isInQueue(bottle._id) ? 'Already in queue' : 'Add to print queue'}
                          >
                            <Tag className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDelete(bottle._id);
                            }}
                            className="glass border-red-500/30 text-red-400 px-3 py-2 rounded-lg hover:bg-red-500/10 hover:border-red-500/50 transition-all duration-300"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                  </SwipeableBottleCard>
                );
              }
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {pagination.total > 0 && (
          <div className="mt-8 flex flex-col items-center space-y-4">
            {/* Results Info */}
            <div className="text-sm text-gray-400">
              Showing {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} {isGrouped ? 'whiskey types' : 'bottles'}
            </div>
            
            {/* Pagination Buttons */}
            {pagination.pages > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                
                {/* Page Numbers */}
                {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                  const startPage = Math.max(1, pagination.page - 2);
                  const pageNum = startPage + i;
                  if (pageNum > pagination.pages) return null;
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                      className={`px-3 py-1 rounded-lg transition-colors ${
                        pageNum === pagination.page
                          ? 'bg-copper text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                {pagination.pages > 5 && pagination.page < pagination.pages - 2 && (
                  <>
                    <span className="text-gray-500">...</span>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: pagination.pages }))}
                      className="px-3 py-1 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
                    >
                      {pagination.pages}
                    </button>
                  </>
                )}
                
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.min(pagination.pages, prev.page + 1) }))}
                  disabled={pagination.page === pagination.pages}
                  className="px-3 py-1 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-20 md:bottom-8 right-4 md:right-8 flex flex-col gap-4 pb-safe">
        {/* Quick Pour Button */}
        <Link
          href="/pour/quick"
          className="w-14 h-14 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-300 flex items-center justify-center group"
        >
          <Wine className="w-6 h-6" />
          <span className="absolute right-full mr-3 bg-black/90 text-white text-sm px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Quick Pour
          </span>
        </Link>
        
        {/* Quick Add Button */}
        <Link
          href="/bottles/quick-add"
          className="w-14 h-14 bg-gradient-to-r from-copper to-copper-light text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-300 flex items-center justify-center group"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span className="absolute right-full mr-3 bg-black/90 text-white text-sm px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Quick Add
          </span>
        </Link>
      </div>

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScanned}
          onClose={() => setShowScanner(false)}
        />
      )}
      
      {/* Quick Pour Modal */}
      {quickPourBottle && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-premium max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">Quick Pour</h2>
            <p className="text-gray-300 mb-2">{quickPourBottle.masterBottleId.name}</p>
            <p className="text-gray-400 text-sm mb-6">{quickPourBottle.masterBottleId.distillery}</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Pour Size</label>
                <div className="grid grid-cols-4 gap-2">
                  {[0.5, 1, 1.5, 2].map((size) => (
                    <button
                      key={size}
                      onClick={async () => {
                        haptic.light();
                        try {
                          const response = await fetch(`/api/bottles/${quickPourBottle._id}/pour`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ amount: size })
                          });
                          
                          if (response.ok) {
                            haptic.success();
                            toast.success(`${size}oz pour recorded!`);
                            setQuickPourBottle(null);
                            fetchBottles(); // Refresh the list
                          } else {
                            haptic.error();
                            toast.error('Failed to record pour');
                          }
                        } catch (error) {
                          toast.error('Error recording pour');
                        }
                      }}
                      className="btn-secondary py-3 text-lg font-semibold"
                    >
                      {size}oz
                    </button>
                  ))}
                </div>
              </div>
              
              <button
                onClick={() => {
                  haptic.light();
                  setQuickPourBottle(null);
                }}
                className="w-full btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Quick Rate Modal */}
      {quickRateBottle && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-premium max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">Quick Rate</h2>
            <p className="text-gray-300 mb-2">{quickRateBottle.masterBottleId.name}</p>
            <p className="text-gray-400 text-sm mb-6">{quickRateBottle.masterBottleId.distillery}</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Rating</label>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                    <button
                      key={rating}
                      onClick={async () => {
                        try {
                          // For now, just show a toast since we need a pour to rate
                          toast.success(`Would rate ${rating}/10! (Requires a pour session)`);
                          setQuickRateBottle(null);
                        } catch (error) {
                          toast.error('Error recording rating');
                        }
                      }}
                      className="w-10 h-10 rounded-full bg-gray-800 hover:bg-amber-600 text-white hover:text-black transition-all flex items-center justify-center font-semibold"
                    >
                      {rating}
                    </button>
                  ))}
                </div>
              </div>
              
              <button
                onClick={() => {
                  haptic.light();
                  setQuickRateBottle(null);
                }}
                className="w-full btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}