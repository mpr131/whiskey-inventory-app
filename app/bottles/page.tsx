'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Upload, Eye, Globe, Package, Trash2, ScanLine, Filter, Wine, Tag, Star, MoreVertical, Share2, Edit, Copy, MapPin } from 'lucide-react';
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
import BottleFillIndicator from '@/components/BottleFillIndicator';
import FilterSidebar from '@/components/bottles/FilterSidebar';
import MoreActionsDropdown from '@/components/bottles/MoreActionsDropdown';
import ViewSwitcherMinimal from '@/components/bottles/ViewSwitcherMinimal';
import ListView from '@/components/bottles/ListView';
import GalleryView from '@/components/bottles/GalleryView';
import ShelfView from '@/components/bottles/ShelfView';
import CollectionInsights from '@/components/bottles/CollectionInsights';

const BarcodeScanner = dynamicImport(() => import('@/components/AutoStartScanner'), {
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
  const [filters, setFilters] = useState({
    category: searchParams.get('category') || '',
    status: searchParams.get('status') || '',
    proof: searchParams.get('proof') || '',
    priceRange: '',
    age: '',
    location: '',
    attributes: [] as string[]
  });
  const [viewMode, setViewMode] = useState<'my' | 'community' | 'all'>('my');
  const [viewLayout, setViewLayout] = useState<'grid' | 'list' | 'gallery' | 'shelf'>('grid');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || '-createdAt');
  const [isMasterBottles, setIsMasterBottles] = useState(false);
  const [isGrouped, setIsGrouped] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  // Show filter sidebar if any filters are pre-applied from URL
  const hasPreAppliedFilters = !!(searchParams.get('status') || searchParams.get('category') || searchParams.get('proof'));
  const [showFilterSidebar, setShowFilterSidebar] = useState(hasPreAppliedFilters);
  // Show old filters if any are pre-applied from URL
  const [showFilters, setShowFilters] = useState(hasPreAppliedFilters);
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
    const proofParam = searchParams.get('proof');
    
    setFilters(prev => ({
      ...prev,
      status: statusParam || '',
      category: categoryParam || '',
      proof: proofParam || ''
    }));
    setSortBy(sortParam || '-createdAt');
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
  }, [filters, sortBy, viewMode, status, filtersInitialized]);

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
      if (filters.category) params.append('category', filters.category);
      if (filters.status) params.append('status', filters.status);
      if (filters.proof) params.append('proof', filters.proof);
      if (filters.priceRange) params.append('priceRange', filters.priceRange);
      if (filters.age) params.append('age', filters.age);
      if (filters.location) params.append('location', filters.location);
      if (filters.attributes.length > 0) params.append('attributes', filters.attributes.join(','));
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

  // Calculate insights from bottles data
  const calculateInsights = () => {
    const userBottles = bottles.filter(isUserBottle);
    
    const fillLevels = {
      empty: 0,
      low: 0,
      medium: 0,
      high: 0,
      full: 0
    };
    
    const categories: Record<string, number> = {};
    let totalValue = 0;
    let priceCount = 0;
    let mostExpensive = { name: '', price: 0 };
    
    userBottles.forEach((bottle) => {
      // Fill levels
      const fillLevel = bottle.fillLevel ?? 100;
      if (bottle.status === 'unopened') {
        fillLevels.full++;
      } else if (fillLevel === 0) {
        fillLevels.empty++;
      } else if (fillLevel < 25) {
        fillLevels.low++;
      } else if (fillLevel < 50) {
        fillLevels.medium++;
      } else if (fillLevel < 75) {
        fillLevels.high++;
      } else {
        fillLevels.full++;
      }
      
      // Categories
      const category = bottle.masterBottleId.category;
      categories[category] = (categories[category] || 0) + 1;
      
      // Value calculations
      if (bottle.purchasePrice) {
        totalValue += bottle.purchasePrice;
        priceCount++;
        if (bottle.purchasePrice > mostExpensive.price) {
          mostExpensive = {
            name: bottle.masterBottleId.name,
            price: bottle.purchasePrice
          };
        }
      }
    });
    
    return {
      fillLevels,
      categories,
      growth: {
        thisMonth: userBottles.filter(b => {
          const createdDate = new Date(b.createdAt);
          const now = new Date();
          return createdDate.getMonth() === now.getMonth() && 
                 createdDate.getFullYear() === now.getFullYear();
        }).length,
        lastMonth: 0 // Would need to fetch this separately
      },
      recentActivity: {
        poursToday: 0, // Would need to fetch from pour data
        bottlesOpened: 0, // Would need openDate field to track this
      },
      totalValue,
      averagePrice: priceCount > 0 ? totalValue / priceCount : 0,
      mostExpensive: mostExpensive.price > 0 ? mostExpensive : undefined
    };
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

      <div className="flex">
        {/* Filter Sidebar */}
        <FilterSidebar 
          isOpen={showFilterSidebar}
          onClose={() => setShowFilterSidebar(false)}
          filters={filters}
          onFilterChange={setFilters}
          sortBy={sortBy}
          onSortChange={setSortBy}
          locations={['Main Bar', 'Home Office', 'Basement']} // TODO: Get from actual data
        />
        
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 overflow-x-hidden">
        
        {/* Refined Header Section */}
        <div className="mb-8 space-y-6">
          {/* Top Row - Title and Search */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            {/* Title */}
            <h1 className="text-2xl font-light text-white">
              {viewMode === 'my' ? 'My Collection' : 'Community Bottles'}
            </h1>
            
            {/* Centered Search Bar */}
            <div className="flex-1 md:max-w-2xl md:mx-auto flex items-center gap-2">
              <div className="flex-1 relative">
                <MasterBottleSearch 
                  placeholder="Search bottles..."
                  redirectToBottle={true}
                  className="w-full"
                />
              </div>
              <button
                onClick={() => setShowScanner(true)}
                className="p-2 text-white/40 hover:text-white/70 transition-colors"
                title="Scan barcode"
              >
                <ScanLine className="w-4 h-4" />
              </button>
            </div>
            
            {/* Settings/More - hidden on mobile */}
            <button className="hidden md:block p-2 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
          
          {/* Bottom Row - Ultra Minimal */}
          <div className="flex items-center justify-between pb-6">
            {/* Left side - Minimal Controls */}
            <div className="flex items-center gap-8">
              {/* View Toggle - Minimal Tabs with Underline */}
              <div className="flex items-center gap-6">
                <button
                  onClick={() => setViewMode('my')}
                  className={`relative pb-1 text-sm font-medium transition-colors ${
                    viewMode === 'my'
                      ? 'text-amber-500'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  My Bottles
                  {viewMode === 'my' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />
                  )}
                </button>
                <button
                  onClick={() => setViewMode('community')}
                  className={`relative pb-1 text-sm font-medium transition-colors ${
                    viewMode === 'community'
                      ? 'text-amber-500'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Community
                  {viewMode === 'community' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />
                  )}
                </button>
              </div>
              
              {/* View Layout Switcher - Minimal */}
              <ViewSwitcherMinimal 
                currentView={viewLayout}
                onViewChange={setViewLayout}
              />
            </div>
            
            {/* Filter Toggle - True Ghost Button */}
            <button
              onClick={() => setShowFilterSidebar(!showFilterSidebar)}
              className={`
                flex items-center gap-1.5 text-xs transition-all duration-200
                ${showFilterSidebar 
                  ? 'text-copper' 
                  : 'text-white/40 hover:text-white/70'
                }
              `}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
              {(filters.category || filters.status || filters.proof || filters.priceRange || filters.age || filters.location || filters.attributes.length > 0) && (
                <span className="text-copper">
                  ({[filters.category, filters.status, filters.proof, filters.priceRange, filters.age, filters.location, filters.attributes.length > 0].filter(Boolean).length})
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Results Summary - Refined */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs text-gray-600">
            {pagination.total > 0 ? (
              <>
                Showing {(pagination.page - 1) * pagination.limit + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} bottles
              </>
            ) : (
              'No bottles found'
            )}
          </p>
        </div>

        {/* Collection Insights */}
        {viewMode === 'my' && bottles.length > 0 && (
          <CollectionInsights 
            insights={calculateInsights()}
            onFilterByInsight={(type, value) => {
              if (type === 'status') {
                setFilters(prev => ({ ...prev, status: value }));
              } else if (type === 'category') {
                setFilters(prev => ({ ...prev, category: value }));
              }
            }}
          />
        )}

        {/* Render different views based on viewLayout */}
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
        ) : viewLayout === 'list' ? (
          <ListView
            bottles={bottles}
            isUserBottle={isUserBottle}
            isGroupedBottle={isGroupedBottle}
            onQuickPour={(bottle) => {
              haptic.medium();
              setQuickPourBottle(bottle);
            }}
            onQuickRate={(bottle) => {
              haptic.medium();
              setQuickRateBottle(bottle);
            }}
            onDelete={handleDelete}
            addToQueue={addToQueue}
            isInQueue={isInQueue}
          />
        ) : viewLayout === 'gallery' ? (
          <GalleryView
            bottles={bottles}
            isUserBottle={isUserBottle}
            isGroupedBottle={isGroupedBottle}
            onQuickPour={(bottle) => {
              haptic.medium();
              setQuickPourBottle(bottle);
            }}
            onQuickRate={(bottle) => {
              haptic.medium();
              setQuickRateBottle(bottle);
            }}
          />
        ) : viewLayout === 'shelf' ? (
          <ShelfView
            bottles={bottles}
            isUserBottle={isUserBottle}
            isGroupedBottle={isGroupedBottle}
          />
        ) : (
          // Default Grid View
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {bottles.map((bottle) => {
              const isUser = isUserBottle(bottle);
              const isGrouped = isGroupedBottle(bottle);
              const masterData = isUser ? bottle.masterBottleId : (isGrouped ? bottle.masterBottleId : bottle as MasterBottle);
              
              if (isGrouped) {
                // Grouped bottle view
                return (
                  <Link key={bottle._id} href={`/bottles/${bottle._id}`} className="block">
                    <div className="card-refined group cursor-pointer">
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
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-bold text-white group-hover:text-copper-light transition-colors truncate">
                          {masterData.name}
                        </h3>
                        <p className="text-gray-400 truncate">{masterData.distillery}</p>
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
                      <div className="flex flex-col items-end space-y-2">
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
                        {/* Show fill level if any bottles are opened */}
                        {bottle.openedCount > 0 && bottle.userBottles && bottle.userBottles.length > 0 && (
                          <div className="flex items-center space-x-1">
                            {bottle.userBottles
                              .filter(b => b.status === 'opened' && b.fillLevel !== undefined)
                              .slice(0, 3)
                              .map((b, index) => (
                                <BottleFillIndicator 
                                  key={index}
                                  fillLevel={b.fillLevel || 100} 
                                  size="sm" 
                                  showLabel={false}
                                />
                              ))}
                            {bottle.userBottles.filter(b => b.status === 'opened').length > 3 && (
                              <span className="text-xs text-gray-500 ml-1">
                                +{bottle.userBottles.filter(b => b.status === 'opened').length - 3}
                              </span>
                            )}
                          </div>
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
                      <div className="card-refined cursor-pointer">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-bold text-white group-hover:text-copper-light transition-colors truncate">
                          {masterData.name}
                        </h3>
                        <p className="text-gray-400 truncate">{masterData.distillery}</p>
                        {isUser && bottle.vaultBarcode && (
                          <div className="mt-2">
                            <span className="inline-flex items-center px-2 py-0.5 bg-copper/10 text-copper text-xs font-mono rounded">
                              {bottle.vaultBarcode}
                            </span>
                          </div>
                        )}
                      </div>
                      {isUser && (
                        <div className="flex items-center space-x-2">
                          <BottleFillIndicator 
                            fillLevel={bottle.fillLevel || 100} 
                            size="sm" 
                            showLabel={false}
                            status={bottle.status}
                          />
                          {bottle.status === 'opened' && bottle.fillLevel && bottle.fillLevel < 25 && (
                            <span className="glass bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded-full animate-pulse">
                              ⚠️ Running Low
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
                    {isUser && (
                      <div className="mt-4 flex justify-center">
                        <BottleFillIndicator 
                          fillLevel={bottle.fillLevel || 100} 
                          size="md" 
                          showLabel={true}
                          status={bottle.status}
                        />
                      </div>
                    )}
                    
                    {/* Add padding at the bottom when action buttons are present */}
                    {isUser && <div className="h-12" />}
                      </div>
                    </Link>
                    
                    {/* Action buttons positioned absolutely */}
                      {isUser && (
                        <div className="absolute bottom-4 right-4 flex gap-2 z-20" onClick={(e) => e.stopPropagation()}>
                          {/* Quick Pour */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              haptic.medium();
                              setQuickPourBottle(bottle as UserBottle);
                            }}
                            className="p-2 text-green-500/70 hover:text-green-400 hover:bg-green-500/10 rounded-md transition-all duration-200"
                            title="Quick Pour"
                          >
                            <Wine className="w-4 h-4" />
                          </button>
                          
                          {/* Quick Rate */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              haptic.medium();
                              setQuickRateBottle(bottle as UserBottle);
                            }}
                            className="p-2 text-amber-500/70 hover:text-amber-400 hover:bg-amber-500/10 rounded-md transition-all duration-200"
                            title="Quick Rate"
                          >
                            <Star className="w-4 h-4" />
                          </button>
                          
                          {/* Add to Print Queue */}
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
                            className={`p-2 rounded-md transition-all duration-200 ${
                              isInQueue(bottle._id)
                                ? 'text-gray-600 cursor-not-allowed'
                                : 'text-copper/70 hover:text-copper hover:bg-copper/10'
                            }`}
                            title={isInQueue(bottle._id) ? 'Already in queue' : 'Add to print queue'}
                          >
                            <Tag className="w-4 h-4" />
                          </button>
                          
                          {/* More Actions */}
                          <MoreActionsDropdown
                            bottleId={bottle._id}
                            bottleName={masterData.name}
                            onShare={() => {
                              toast.success('Share feature coming soon!');
                            }}
                            onDuplicate={() => {
                              toast.success('Duplicate feature coming soon!');
                            }}
                            onMoveLocation={() => {
                              toast.success('Move location feature coming soon!');
                            }}
                          />
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
        {/* Minimal Floating Action Buttons */}
        <div className="fixed bottom-20 md:bottom-8 right-4 md:right-8 flex flex-col gap-2 pb-safe">
          {/* Quick Pour Button */}
          <Link
            href="/pour/quick"
            className="w-10 h-10 bg-black/40 backdrop-blur-sm text-copper/80 hover:text-copper rounded-full transition-all duration-200 flex items-center justify-center group"
          >
            <Wine className="w-4 h-4" />
            <span className="absolute right-full mr-2 bg-black/80 backdrop-blur-sm text-white text-[11px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Pour
            </span>
          </Link>
          
          {/* Quick Add Button */}
          <Link
            href="/bottles/quick-add"
            className="w-10 h-10 bg-black/40 backdrop-blur-sm text-white/40 hover:text-white/70 rounded-full transition-all duration-200 flex items-center justify-center group"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="absolute right-full mr-2 bg-black/80 backdrop-blur-sm text-white text-[11px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Add
            </span>
          </Link>
        </div>
      </main>
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