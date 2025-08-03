'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Package, Upload, Search, Plus, Trash2, CheckCircle, Loader2, ScanLine, X, Database, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import MasterBottleSearch from '@/components/MasterBottleSearch';
import UPCBackfillTool from '@/components/admin/UPCBackfillTool';
import FWGSImportDashboard from '@/components/admin/FWGSImportDashboard';

const ZXingBarcodeScanner = dynamic(() => import('@/components/ZXingBarcodeScanner'), {
  ssr: false,
});

interface MasterBottle {
  _id: string;
  name: string;
  brand: string;
  distillery: string;
  category: string;
  type?: string;
  proof?: number;
  upcCodes?: Array<{
    code: string;
    submittedBy: string;
    verifiedCount: number;
    dateAdded: string;
    isAdminAdded: boolean;
  }>;
}

interface UpcSubmission {
  _id: string;
  code: string;
  masterBottle: MasterBottle;
  submittedBy: {
    _id: string;
    name: string;
    email: string;
  };
  dateAdded: string;
  verifiedCount: number;
  isAdminAdded: boolean;
}

export default function AdminUpcPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'add' | 'bulk' | 'review' | 'search' | 'backfill' | 'import'>('add');
  const [selectedBottle, setSelectedBottle] = useState<MasterBottle | null>(null);
  const [upcCode, setUpcCode] = useState('');
  const [searchUpc, setSearchUpc] = useState('');
  const [searchResult, setSearchResult] = useState<MasterBottle | null>(null);
  const [bulkData, setBulkData] = useState('');
  const [processing, setProcessing] = useState(false);
  const [pendingSubmissions, setPendingSubmissions] = useState<UpcSubmission[]>([]);
  const [recentUpcBottles, setRecentUpcBottles] = useState<MasterBottle[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [addedCount, setAddedCount] = useState(0);

  // Check if user is admin
  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user?.isAdmin) {
      router.push('/');
      toast.error('Admin access required');
    }
  }, [session, status, router]);

  // Fetch recent bottles with UPCs and pending submissions
  useEffect(() => {
    fetchRecentData();
  }, []);

  const fetchRecentData = async () => {
    try {
      const response = await fetch('/api/admin/upc-management');
      const data = await response.json();
      
      if (response.ok) {
        setRecentUpcBottles(data.recentBottles || []);
        setPendingSubmissions(data.pendingSubmissions || []);
      }
    } catch (error) {
      console.error('Error fetching UPC data:', error);
    }
  };

  const handleAddUpc = async () => {
    if (!selectedBottle || !upcCode) {
      toast.error('Please select a bottle and enter a UPC code');
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch('/api/upc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterBottleId: selectedBottle._id,
          upcCode: upcCode.trim(),
          isAdminAdded: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          toast.error(`UPC already exists on: ${data.existingBottle.name}`);
        } else {
          throw new Error(data.error || 'Failed to add UPC');
        }
        return;
      }

      toast.success('UPC added successfully!');
      setUpcCode('');
      // Keep the selected bottle for multiple UPC entries
      // setSelectedBottle(null);
      setAddedCount(prev => prev + 1);
      fetchRecentData();
      
      // Focus back on the UPC input for quick entry
      const upcInput = document.querySelector('input[placeholder="Enter UPC code..."]') as HTMLInputElement;
      if (upcInput) {
        upcInput.focus();
      }
    } catch (error) {
      console.error('Error adding UPC:', error);
      toast.error('Failed to add UPC');
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkImport = async () => {
    if (!bulkData.trim()) {
      toast.error('Please enter CSV data');
      return;
    }

    setProcessing(true);
    const lines = bulkData.trim().split('\n');
    let successCount = 0;
    let errorCount = 0;

    for (const line of lines) {
      const [bottleName, upcCode] = line.split(',').map(s => s.trim());
      
      if (!bottleName || !upcCode) {
        errorCount++;
        continue;
      }

      try {
        // Search for the bottle
        const searchResponse = await fetch(`/api/master-bottles?search=${encodeURIComponent(bottleName)}`);
        const bottles = await searchResponse.json();

        if (bottles.length === 0) {
          errorCount++;
          toast.error(`Bottle not found: ${bottleName}`);
          continue;
        }

        const bottle = bottles[0];

        // Add UPC
        const response = await fetch('/api/upc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            masterBottleId: bottle._id,
            upcCode: upcCode,
            isAdminAdded: true,
          }),
        });

        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
          const data = await response.json();
          if (response.status === 409) {
            toast.error(`UPC ${upcCode} already exists`);
          }
        }
      } catch (error) {
        errorCount++;
        console.error('Error processing line:', line, error);
      }
    }

    setProcessing(false);
    setBulkData('');
    toast.success(`Import complete: ${successCount} added, ${errorCount} errors`);
    fetchRecentData();
  };

  const handleSearchUpc = async () => {
    if (!searchUpc.trim()) return;

    setProcessing(true);
    try {
      const response = await fetch(`/api/master-bottles?upc=${encodeURIComponent(searchUpc)}`);
      const data = await response.json();

      if (response.ok && data.length > 0) {
        setSearchResult(data[0]);
        toast.success('Found bottle with UPC');
      } else {
        setSearchResult(null);
        toast.error('No bottle found with this UPC');
      }
    } catch (error) {
      console.error('Error searching UPC:', error);
      toast.error('Search failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteUpc = async (bottleId: string, upcCode: string) => {
    if (!confirm(`Remove UPC ${upcCode}?`)) return;

    setProcessing(true);
    try {
      const response = await fetch(`/api/admin/upc-management`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bottleId, upcCode }),
      });

      if (response.ok) {
        toast.success('UPC removed');
        fetchRecentData();
        if (searchResult?._id === bottleId) {
          setSearchResult(null);
        }
      } else {
        throw new Error('Failed to remove UPC');
      }
    } catch (error) {
      console.error('Error removing UPC:', error);
      toast.error('Failed to remove UPC');
    } finally {
      setProcessing(false);
    }
  };

  const handleBarcodeScan = (barcode: string) => {
    setShowScanner(false);
    setUpcCode(barcode);
    toast.success(`Scanned UPC: ${barcode}`);
    
    // Focus on the UPC input to show the value
    setTimeout(() => {
      const upcInput = document.querySelector('input[placeholder="Enter UPC code..."]') as HTMLInputElement;
      if (upcInput) {
        upcInput.focus();
        upcInput.select();
      }
    }, 100);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-copper" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">UPC Management</h1>
      
      <div className="max-w-4xl">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('add')}
            className={`px-4 py-2 rounded-lg whitespace-nowrap ${
              activeTab === 'add' ? 'bg-copper text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Add UPC
          </button>
          <button
            onClick={() => setActiveTab('bulk')}
            className={`px-4 py-2 rounded-lg whitespace-nowrap ${
              activeTab === 'bulk' ? 'bg-copper text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            <Upload className="w-4 h-4 inline mr-2" />
            Bulk Import
          </button>
          <button
            onClick={() => setActiveTab('review')}
            className={`px-4 py-2 rounded-lg whitespace-nowrap ${
              activeTab === 'review' ? 'bg-copper text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            <CheckCircle className="w-4 h-4 inline mr-2" />
            Review Queue
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2 rounded-lg whitespace-nowrap ${
              activeTab === 'search' ? 'bg-copper text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            <Search className="w-4 h-4 inline mr-2" />
            Search UPC
          </button>
          <button
            onClick={() => setActiveTab('backfill')}
            className={`px-4 py-2 rounded-lg whitespace-nowrap ${
              activeTab === 'backfill' ? 'bg-copper text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            <Database className="w-4 h-4 inline mr-2" />
            Backfill UPCs
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2 rounded-lg whitespace-nowrap ${
              activeTab === 'import' ? 'bg-copper text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            <Download className="w-4 h-4 inline mr-2" />
            FWGS Import
          </button>
        </div>

        {/* Add UPC Tab */}
        {activeTab === 'add' && (
          <div className="space-y-6">
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Add UPC to Bottle</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Select Master Bottle
                  </label>
                  <MasterBottleSearch
                    onSelect={(bottle) => setSelectedBottle(bottle)}
                    placeholder="Search for a bottle..."
                    redirectToBottle={false}
                  />
                  {selectedBottle && (
                    <div className="mt-2 p-3 bg-gray-800/50 rounded flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{selectedBottle.name}</p>
                        <p className="text-sm text-gray-400">
                          {selectedBottle.brand} • {selectedBottle.distillery}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedBottle(null)}
                        className="p-1 text-gray-400 hover:text-white transition-colors"
                        title="Clear selection"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    UPC Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={upcCode}
                      onChange={(e) => setUpcCode(e.target.value)}
                      placeholder="Enter UPC code..."
                      className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-copper/50 focus:border-copper transition-all"
                    />
                    <button
                      onClick={() => setShowScanner(true)}
                      type="button"
                      className="btn-secondary px-4"
                      title="Scan UPC"
                    >
                      <ScanLine className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleAddUpc}
                  disabled={processing || !selectedBottle || !upcCode}
                  className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    <>
                      Add UPC
                      {addedCount > 0 && (
                        <span className="ml-2 text-sm opacity-75">({addedCount} added this session)</span>
                      )}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Recent Bottles with UPCs */}
            {recentUpcBottles.length > 0 && (
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Recent UPC Additions</h3>
                <div className="space-y-3">
                  {recentUpcBottles.map((bottle) => (
                    <div key={bottle._id} className="border-b border-gray-800 pb-3 last:border-0">
                      <p className="text-white font-medium">{bottle.name}</p>
                      <p className="text-sm text-gray-400 mb-2">
                        {bottle.brand} • {bottle.distillery}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {bottle.upcCodes?.map((upc) => (
                          <span
                            key={upc.code}
                            className={`text-xs px-2 py-1 rounded ${
                              upc.isAdminAdded ? 'bg-copper/20 text-copper' : 'bg-gray-800 text-gray-400'
                            }`}
                          >
                            {upc.code}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bulk Import Tab */}
        {activeTab === 'bulk' && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Bulk Import UPCs</h2>
            <p className="text-gray-400 mb-4">
              Enter CSV data with format: BottleName, UPCCode
            </p>
            
            <textarea
              value={bulkData}
              onChange={(e) => setBulkData(e.target.value)}
              placeholder="Jack Daniel's Single Barrel, 084279007991
Buffalo Trace, 080244009167
..."
              className="w-full h-64 font-mono text-sm bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 p-4 focus:outline-none focus:ring-2 focus:ring-copper/50 focus:border-copper transition-all"
            />

            <button
              onClick={handleBulkImport}
              disabled={processing || !bulkData.trim()}
              className="btn-primary w-full mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                'Import UPCs'
              )}
            </button>
          </div>
        )}

        {/* Review Queue Tab */}
        {activeTab === 'review' && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-white mb-4">User Submissions</h2>
            {pendingSubmissions.length > 0 ? (
              <div className="space-y-3">
                {pendingSubmissions.map((submission) => (
                  <div key={submission._id} className="border border-gray-800 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-white font-medium">{submission.masterBottle.name}</p>
                        <p className="text-sm text-gray-400">
                          {submission.masterBottle.brand} • {submission.masterBottle.distillery}
                        </p>
                        <p className="text-sm text-copper mt-1">UPC: {submission.code}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Submitted by {submission.submittedBy.name} • Verified: {submission.verifiedCount}x
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteUpc(submission.masterBottle._id, submission.code)}
                        className="p-2 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400">No pending submissions</p>
            )}
          </div>
        )}

        {/* Search UPC Tab */}
        {activeTab === 'search' && (
          <div className="space-y-6">
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Search by UPC</h2>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchUpc}
                  onChange={(e) => setSearchUpc(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearchUpc()}
                  placeholder="Enter UPC to search..."
                  className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-copper/50 focus:border-copper transition-all"
                />
                <button
                  onClick={handleSearchUpc}
                  disabled={processing || !searchUpc.trim()}
                  className="btn-primary px-6"
                >
                  {processing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Search className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {searchResult && (
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-white mb-2">{searchResult.name}</h3>
                <p className="text-gray-400 mb-4">
                  {searchResult.brand} • {searchResult.distillery}
                </p>
                
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-400">Associated UPCs:</p>
                  {searchResult.upcCodes?.map((upc) => (
                    <div key={upc.code} className="flex items-center justify-between p-2 bg-gray-800/50 rounded">
                      <span className="text-white font-mono">{upc.code}</span>
                      <button
                        onClick={() => handleDeleteUpc(searchResult._id, upc.code)}
                        className="p-1 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Backfill Tab */}
        {activeTab === 'backfill' && (
          <div className="card p-6">
            <UPCBackfillTool />
          </div>
        )}

        {/* FWGS Import Tab */}
        {activeTab === 'import' && (
          <div className="w-full max-w-none">
            <FWGSImportDashboard />
          </div>
        )}

        {/* Barcode Scanner Modal */}
        {showScanner && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-lg p-6 max-w-lg w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Scan UPC Code</h3>
                <button
                  onClick={() => setShowScanner(false)}
                  className="p-2 text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ZXingBarcodeScanner
                onScan={handleBarcodeScan}
                onClose={() => setShowScanner(false)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}