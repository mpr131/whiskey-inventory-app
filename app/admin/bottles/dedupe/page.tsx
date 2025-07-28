'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Package, Search, CheckCircle, XCircle, SkipForward, ArrowRight, Image as ImageIcon, Users } from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';

interface MasterBottle {
  _id: string;
  name: string;
  brand?: string;
  producer?: string;
  category?: string;
  subcategory?: string;
  proof?: number;
  statedProof?: number;
  size?: string;
  externalData?: {
    source: string;
    mergedTo?: string;
    noFwgsMatch?: boolean;
  };
  userBottleCount?: number;
  isMasterBottle?: boolean;
}

interface FWGSMatch {
  _id: string;
  name: string;
  brand?: string;
  producer?: string;
  category?: string;
  subcategory?: string;
  proof?: number;
  statedProof?: number;
  size?: string;
  defaultImageUrl?: string;
  upcCodes?: Array<{
    code: string;
    verifiedCount: number;
  }>;
  externalData?: {
    source: string;
    fwgsId?: string;
    sku?: string;
    description?: string;
  };
  matchScore?: number;
}

export default function BottleDeduplicationPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentBottle, setCurrentBottle] = useState<MasterBottle | null>(null);
  const [matches, setMatches] = useState<FWGSMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [merging, setMerging] = useState(false);
  const [storePickStates, setStorePickStates] = useState<Record<string, boolean>>({});
  const [stats, setStats] = useState({
    total: 0,
    processed: 0,
    remaining: 0,
  });

  // Check admin access
  useEffect(() => {
    if (session && !session.user?.isAdmin) {
      router.push('/dashboard');
    }
  }, [session, router]);

  // Load the next unmatched bottle
  const loadNextBottle = useCallback(async () => {
    setLoading(true);
    setMatches([]);
    setStorePickStates({}); // Reset store pick states
    
    try {
      // Get skipped master bottles from session storage
      const skippedBottles = JSON.parse(sessionStorage.getItem('skippedMasterBottles') || '[]');
      console.log('Loading next master bottle, skipping:', skippedBottles);
      
      const response = await fetch('/api/admin/bottles/dedupe/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skippedBottles }),
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          toast.success('All bottles have been processed!');
          setCurrentBottle(null);
          return;
        }
        throw new Error('Failed to load bottle');
      }

      const data = await response.json();
      console.log('Loaded master bottle:', data.bottle?._id, data.bottle?.name);
      console.log('This bottle affects', data.bottle?.userBottleCount, 'user bottles');
      
      setCurrentBottle(data.bottle);
      setStats({
        total: data.stats.total,
        processed: data.stats.processed,
        remaining: data.stats.remaining,
      });

      // Automatically search for matches
      if (data.bottle) {
        searchForMatches(data.bottle.name);
      }
    } catch (error) {
      console.error('Error loading bottle:', error);
      toast.error('Failed to load next bottle');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadNextBottle();
  }, [loadNextBottle]);

  // Search for FWGS matches based on bottle name
  const searchForMatches = async (bottleName: string) => {
    setSearching(true);
    
    try {
      const response = await fetch('/api/admin/bottles/dedupe/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: bottleName }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Search API error:', data);
        throw new Error(data.error || 'Search failed');
      }

      setMatches(data.matches || []);
      
      // Log search info for debugging
      if (data.searchInfo) {
        console.log('Search info:', data.searchInfo);
      }
      
      // Log matches found
      console.log(`Matches returned: ${data.matches?.length || 0}`);
      if (data.matches && data.matches.length > 0) {
        console.log('Top 3 matches:');
        data.matches.slice(0, 3).forEach((m: any) => {
          console.log(`  - ${m.name} (Score: ${m.matchScore}, FWGS ID: ${m.externalData?.fwgsId})`);
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search for matches');
    } finally {
      setSearching(false);
    }
  };

  // Merge master bottles
  const handleMerge = async (targetMasterBottleId: string) => {
    if (!currentBottle) return;
    
    setMerging(true);
    
    try {
      const response = await fetch('/api/admin/bottles/dedupe/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceMasterBottleId: currentBottle._id,
          targetMasterBottleId: targetMasterBottleId,
          isStorePick: storePickStates[targetMasterBottleId] || false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Merge API error:', errorData);
        throw new Error(errorData.error || 'Merge failed');
      }

      const data = await response.json();
      console.log('Merge response:', data);
      
      if (!data.success) {
        throw new Error('Merge did not complete successfully');
      }
      
      toast.success(`Successfully merged! Updated ${data.result?.userBottlesUpdated || 0} user bottles.`);
      
      // Add a small delay before loading next bottle to ensure the merge is processed
      setTimeout(() => {
        loadNextBottle();
      }, 500);
    } catch (error: any) {
      console.error('Merge error:', error);
      toast.error(error.message || 'Failed to merge bottles');
    } finally {
      setMerging(false);
    }
  };

  // Skip current bottle
  const handleSkip = async () => {
    console.log('Skip button clicked for bottle:', currentBottle?._id);
    
    // Store skipped master bottle IDs in session storage
    if (currentBottle) {
      const skippedBottles = JSON.parse(sessionStorage.getItem('skippedMasterBottles') || '[]');
      skippedBottles.push(currentBottle._id);
      sessionStorage.setItem('skippedMasterBottles', JSON.stringify(skippedBottles));
      console.log('Added to skipped master bottles:', currentBottle._id);
    }
    
    loadNextBottle();
  };

  // Mark as no match found
  const handleNoMatch = async () => {
    if (!currentBottle) return;
    
    console.log('No Match button clicked for bottle:', currentBottle._id);
    setMerging(true); // Use same loading state
    
    try {
      const response = await fetch('/api/admin/bottles/dedupe/no-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterBottleId: currentBottle._id }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('No match API error:', error);
        throw new Error(error.error || 'Failed to mark as no match');
      }

      const data = await response.json();
      toast.success(`Marked as no match - Updated ${data.masterBottle.userBottlesUpdated} user bottles`);
      loadNextBottle();
    } catch (error) {
      console.error('No match error:', error);
      toast.error('Failed to mark as no match');
    } finally {
      setMerging(false);
    }
  };

  if (!session?.user?.isAdmin) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Master Bottle Deduplication Tool
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Match your original 276 master bottles to the FWGS product database
        </p>
      </div>

      {/* Progress Stats */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Master Bottles</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{stats.processed}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Processed</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-600">{stats.remaining}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Remaining</p>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-green-600 h-full transition-all duration-300"
              style={{ width: `${stats.total > 0 ? (stats.processed / stats.total * 100) : 0}%` }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
        </div>
      ) : currentBottle ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Side - Master Bottle */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Master Bottle
            </h2>
            
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Name</p>
                <p className="font-semibold text-gray-900 dark:text-white">{currentBottle.name}</p>
              </div>
              
              {currentBottle.brand && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Brand</p>
                  <p className="font-medium text-gray-800 dark:text-gray-200">{currentBottle.brand}</p>
                </div>
              )}
              
              {currentBottle.producer && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Producer</p>
                  <p className="font-medium text-gray-800 dark:text-gray-200">{currentBottle.producer}</p>
                </div>
              )}
              
              {currentBottle.category && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Category</p>
                  <p className="font-medium text-gray-800 dark:text-gray-200">{currentBottle.category}</p>
                </div>
              )}
              
              {currentBottle.proof && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Proof</p>
                  <p className="font-medium text-gray-800 dark:text-gray-200">{currentBottle.proof}°</p>
                </div>
              )}
              
              {currentBottle.size && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Size</p>
                  <p className="font-medium text-gray-800 dark:text-gray-200">{currentBottle.size}</p>
                </div>
              )}
              
              {currentBottle.userBottleCount !== undefined && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    This master bottle is linked to {currentBottle.userBottleCount} user bottle{currentBottle.userBottleCount !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
              
              {currentBottle.externalData?.source && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Source</p>
                  <p className="font-medium text-gray-800 dark:text-gray-200">{currentBottle.externalData.source}</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleSkip}
                disabled={loading || merging}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SkipForward className="w-4 h-4" />
                Skip
              </button>
              
              <button
                onClick={handleNoMatch}
                disabled={loading || merging}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {merging ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    No Match
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Side - FWGS Matches */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Search className="w-5 h-5" />
              FWGS Matches
            </h2>

            {searching ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
              </div>
            ) : matches.length > 0 ? (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {matches.map((match) => (
                  <div 
                    key={match._id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex gap-4">
                      {/* Product Image */}
                      <div className="flex-shrink-0">
                        {match.defaultImageUrl ? (
                          <div className="relative w-16 h-20">
                            <Image
                              src={match.defaultImageUrl}
                              alt={match.name}
                              fill
                              className="object-contain rounded"
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-20 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Product Details */}
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                          {match.name}
                        </h3>
                        
                        {match.matchScore && (
                          <div className="mb-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                              {match.matchScore}% Match
                            </span>
                          </div>
                        )}
                        
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          {match.brand && <p>Brand: {match.brand}</p>}
                          {match.proof && <p>Proof: {match.proof}°</p>}
                          {match.size && <p>Size: {match.size}</p>}
                          {match.upcCodes && match.upcCodes.length > 0 && (
                            <p>UPC: {match.upcCodes[0].code}</p>
                          )}
                        </div>

                        <div className="mt-3 space-y-2">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={storePickStates[match._id] || false}
                              onChange={(e) => setStorePickStates(prev => ({
                                ...prev,
                                [match._id]: e.target.checked
                              }))}
                              className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 dark:focus:ring-green-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                            />
                            <span className="text-gray-700 dark:text-gray-300">This is a store pick</span>
                          </label>

                          <button
                            onClick={() => handleMerge(match._id)}
                            disabled={merging}
                            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                          >
                          {merging ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Merging...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              Merge
                            </>
                          )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No matches found</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                  Try clicking &quot;No Match&quot; to mark this bottle and move on
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            All Done!
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            All bottles have been processed.
          </p>
        </div>
      )}
    </div>
  );
}