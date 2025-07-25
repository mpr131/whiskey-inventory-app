'use client';

import { useState, useEffect, useCallback } from 'react';
import { Package, Check, CheckCircle, X, SkipForward, ExternalLink, AlertCircle, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import Image from 'next/image';

interface MasterBottle {
  _id: string;
  name: string;
  brand: string;
  distillery: string;
  category: string;
  proof?: number;
  age?: number;
  size?: string;
}

interface MatchResult {
  externalProduct: any;
  confidence: number;
  matchReasons: string[];
}

interface BackfillStats {
  totalMasterBottles: number;
  bottlesWithUPC: number;
  bottlesWithoutUPC: number;
  percentComplete: number;
}

export default function UPCBackfillTool() {
  const [stats, setStats] = useState<BackfillStats | null>(null);
  const [currentBottle, setCurrentBottle] = useState<MasterBottle | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processedCount, setProcessedCount] = useState(0);
  const [sessionStartTime] = useState(Date.now());
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [skipIds, setSkipIds] = useState<string[]>([]);
  const [totalRemaining, setTotalRemaining] = useState<number>(0);

  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/upc-backfill?action=stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadNextBottle = useCallback(async (additionalReviewedId?: string, additionalSkipId?: string) => {
    setLoading(true);
    try {
      // Use the additional IDs if provided (for immediate updates)
      const currentReviewedIds = additionalReviewedId 
        ? [...reviewedIds, additionalReviewedId]
        : reviewedIds;
      const currentSkipIds = additionalSkipId
        ? [...skipIds, additionalSkipId]
        : skipIds;
        
      console.log('Loading next bottle with:', {
        skipIds: currentSkipIds,
        reviewedIds: currentReviewedIds,
        total: currentSkipIds.length + currentReviewedIds.length
      });
      
      const params = new URLSearchParams({
        action: 'next',
        ...(currentSkipIds.length > 0 && { skipIds: currentSkipIds.join(',') }),
        ...(currentReviewedIds.length > 0 && { reviewedIds: currentReviewedIds.join(',') })
      });
        
      const response = await fetch(`/api/admin/upc-backfill?${params}`);
      const data = await response.json();
      
      if (data.completed) {
        setCurrentBottle(null);
        setMatches([]);
        toast.success('All bottles have been reviewed!');
      } else {
        setCurrentBottle(data.bottle);
        setMatches(data.matches || []);
        setTotalRemaining(data.totalRemaining || 0);
      }
    } catch (error) {
      console.error('Error loading next bottle:', error);
      toast.error('Failed to load next bottle');
    } finally {
      setLoading(false);
    }
  }, [reviewedIds, skipIds]);

  useEffect(() => {
    loadStats();
    loadNextBottle();
  }, [loadNextBottle]);

  const approveMatch = async (match: MatchResult) => {
    if (!currentBottle) return;
    
    console.log('Approving single match:', {
      bottleId: currentBottle._id,
      bottleName: currentBottle.name,
      externalProductName: match.externalProduct.displayName,
      upc: match.externalProduct.b2c_upc
    });
    
    setProcessing(true);
    try {
      const response = await fetch('/api/admin/upc-backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterBottleId: currentBottle._id,
          externalProduct: match.externalProduct
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        toast.success(data.message || 'UPC added successfully!');
        setProcessedCount(prev => prev + 1);
        console.log(`Adding ${currentBottle._id} to reviewed list`);
        setReviewedIds(prev => {
          const newIds = [...prev, currentBottle._id];
          console.log('Reviewed IDs:', newIds);
          return newIds;
        });
        loadStats();
        // Don't auto-advance - let user review other matches or click next
        toast('✓ UPC added! Review other matches or click "Next Bottle" to continue.', {
          duration: 4000,
          icon: '💡',
        });
      } else {
        toast.error(data.error || 'Failed to add UPC');
      }
    } catch (error) {
      console.error('Error approving match:', error);
      toast.error('Failed to approve match');
    } finally {
      setProcessing(false);
    }
  };

  const skipBottle = async () => {
    if (!currentBottle) return;
    
    setProcessing(true);
    try {
      await fetch('/api/admin/upc-backfill', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterBottleId: currentBottle._id,
          action: 'skip'
        })
      });
      
      setSkipIds(prev => [...prev, currentBottle._id]);
      // Pass the ID directly to avoid state delay
      loadNextBottle(undefined, currentBottle._id);
    } catch (error) {
      console.error('Error skipping bottle:', error);
    } finally {
      setProcessing(false);
    }
  };

  const markNoMatch = async () => {
    if (!currentBottle) return;
    
    setProcessing(true);
    try {
      await fetch('/api/admin/upc-backfill', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterBottleId: currentBottle._id,
          action: 'no_match'
        })
      });
      
      setProcessedCount(prev => prev + 1);
      setReviewedIds(prev => [...prev, currentBottle._id]);
      // Pass the ID directly to avoid state delay
      loadNextBottle(currentBottle._id);
    } catch (error) {
      console.error('Error marking no match:', error);
    } finally {
      setProcessing(false);
    }
  };

  const getConfidenceBadgeColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-100 text-green-800 border-green-200';
    if (confidence >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const sessionMinutes = Math.floor((Date.now() - sessionStartTime) / 60000);
  const bottlesPerMinute = sessionMinutes > 0 ? (processedCount / sessionMinutes).toFixed(1) : '0';

  if (loading && !currentBottle) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Header */}
      {stats && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">UPC Backfill Progress</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded p-4">
              <p className="text-sm text-gray-600">Total Master Bottles</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalMasterBottles.toLocaleString()}</p>
            </div>
            <div className="bg-green-50 rounded p-4">
              <p className="text-sm text-gray-600">Bottles with UPC</p>
              <p className="text-2xl font-bold text-green-700">{stats.bottlesWithUPC.toLocaleString()}</p>
            </div>
            <div className="bg-amber-50 rounded p-4">
              <p className="text-sm text-gray-600">Need UPC</p>
              <p className="text-2xl font-bold text-amber-700">{stats.bottlesWithoutUPC.toLocaleString()}</p>
            </div>
            <div className="bg-blue-50 rounded p-4">
              <p className="text-sm text-gray-600">Completion</p>
              <p className="text-2xl font-bold text-blue-700">{stats.percentComplete}%</p>
            </div>
          </div>
          
          {/* Session Stats */}
          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span>This session: {processedCount} bottles</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Rate: {bottlesPerMinute} bottles/min</span>
            </div>
            {totalRemaining > 0 && (
              <div className="flex items-center gap-2">
                <span>Remaining in queue: {totalRemaining}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Current Bottle */}
      {currentBottle && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Current Bottle</h3>
              <p className="text-sm text-gray-500 mt-1">Review potential UPC matches</p>
            </div>
            <div className="flex gap-2">
              {reviewedIds.includes(currentBottle._id) && (
                <button
                  onClick={() => loadNextBottle(currentBottle._id)}
                  disabled={processing}
                  className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  Next Bottle
                </button>
              )}
              <button
                onClick={skipBottle}
                disabled={processing}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                <SkipForward className="h-4 w-4" />
                Skip for Now
              </button>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">{currentBottle.name}</h4>
                <p className="text-gray-700 mt-1">
                  {currentBottle.brand} • {currentBottle.distillery}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {currentBottle.category} 
                  {currentBottle.proof && ` • ${currentBottle.proof}°`}
                  {currentBottle.age && ` • ${currentBottle.age} Year`}
                  {currentBottle.size && ` • ${currentBottle.size}`}
                </p>
              </div>
              {reviewedIds.includes(currentBottle._id) && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">UPC Added</span>
                </div>
              )}
            </div>
          </div>

          {/* Matches */}
          {matches.length > 0 ? (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Potential Matches ({matches.length})</h4>
              {matches.map((match, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                  <div className="flex items-start gap-4">
                    {/* Product Image */}
                    {match.externalProduct.primaryLargeImageURL && 
                     match.externalProduct.primaryLargeImageURL !== '/img/no-image.jpg' ? (
                      <div className="relative w-20 h-24 flex-shrink-0">
                        <Image
                          src={`https://www.finewineandgoodspirits.com${match.externalProduct.primaryLargeImageURL}`}
                          alt={match.externalProduct.displayName}
                          fill
                          className="object-contain rounded"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-24 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                        <Package className="h-8 w-8 text-gray-400" />
                      </div>
                    )}

                    {/* Match Details */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h5 className="font-medium text-gray-900">{match.externalProduct.displayName}</h5>
                          <p className="text-sm text-gray-700 mt-1">
                            {match.externalProduct.brand} 
                            {match.externalProduct.b2c_proof && ` • ${match.externalProduct.b2c_proof}°`}
                            {match.externalProduct.b2c_age && ` • ${match.externalProduct.b2c_age}`}
                          </p>
                        </div>
                        <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getConfidenceBadgeColor(match.confidence)}`}>
                          {match.confidence}% Match
                        </span>
                      </div>

                      <div className="mb-2">
                        <p className="text-xs text-gray-500">UPC{match.externalProduct.b2c_upc?.includes(' ') ? 's' : ''}:</p>
                        <p className="text-sm font-mono text-gray-700">
                          {match.externalProduct.b2c_upc}
                        </p>
                        {match.externalProduct.b2c_upc?.includes(' ') && (
                          <p className="text-xs text-amber-600 mt-1">
                            ⚠️ Multiple UPCs detected - only the first will be added
                          </p>
                        )}
                      </div>

                      {/* Match Reasons */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {match.matchReasons.map((reason, i) => (
                          <span key={i} className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded">
                            {reason}
                          </span>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => approveMatch(match)}
                          disabled={processing || reviewedIds.includes(currentBottle._id)}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Check className="h-4 w-4" />
                          {reviewedIds.includes(currentBottle._id) ? 'Already Added' : 'Approve Match'}
                        </button>
                        
                        {match.externalProduct.listPrice && (
                          <span className="text-sm text-gray-600">
                            MSRP: ${match.externalProduct.listPrice}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={markNoMatch}
                disabled={processing || reviewedIds.includes(currentBottle._id)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="h-4 w-4" />
                {reviewedIds.includes(currentBottle._id) ? 'Already Processed' : 'None of These Match'}
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-4">No potential matches found in external database</p>
              <button
                onClick={markNoMatch}
                disabled={processing}
                className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Continue
              </button>
            </div>
          )}
        </div>
      )}

      {/* Completion Message */}
      {!currentBottle && !loading && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <Check className="h-12 w-12 text-green-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-green-900 mb-2">All bottles have been reviewed!</h3>
          <p className="text-green-700">
            You processed {processedCount} bottles in this session.
          </p>
        </div>
      )}
    </div>
  );
}