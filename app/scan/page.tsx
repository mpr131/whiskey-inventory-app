'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ScanLine, Package, Wine, Check, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import Image from 'next/image';

const BarcodeScanner = dynamic(() => import('@/components/BarcodeScanner'), {
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
  msrp?: number;
  description?: string;
  isStorePick: boolean;
  communityRating?: number;
  communityRatingCount?: number;
}

interface PotentialMatch {
  masterBottle: MasterBottle;
  similarity: number;
  matchDetails: {
    name: number;
    distillery: number;
  };
}

interface UpcScanResult {
  type: 'vault' | 'user' | 'upc' | 'new_upc' | 'not_found';
  bottle?: any;
  masterBottle?: MasterBottle;
  userBottles?: any[];
  upcInfo?: {
    title: string;
    brand: string;
    description: string;
    category?: string;
    size?: string;
  };
  barcode?: string;
  potentialMatches?: PotentialMatch[];
  message?: string;
}

export default function ScanPage() {
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<UpcScanResult | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);

  const handleBarcodeScan = async (barcode: string) => {
    setIsScanning(false);
    setIsProcessing(true);
    
    try {
      const response = await fetch(`/api/upc?barcode=${encodeURIComponent(barcode)}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to process barcode');
      }
      
      setScanResult(data);
      
      // Handle different result types
      switch (data.type) {
        case 'vault':
        case 'user':
          // Found existing user bottle - redirect to it
          router.push(`/bottles/${data.bottle._id}`);
          toast.success('Found your bottle!');
          break;
          
        case 'upc':
          // Found master bottle with UPC - show user bottles
          if (data.userBottles.length === 1) {
            router.push(`/bottles/${data.userBottles[0]._id}`);
            toast.success('Found your bottle!');
          } else if (data.userBottles.length > 1) {
            // Show bottle selection
            toast.success(`Found ${data.userBottles.length} bottles with this UPC`);
          } else {
            // No user bottles but UPC exists - redirect to add bottle
            router.push(`/bottles/add?masterBottleId=${data.masterBottle._id}`);
            toast.success('Found this product! Add it to your collection.');
          }
          break;
          
        case 'new_upc':
          // New UPC - show matching interface
          if (data.potentialMatches.length === 0) {
            toast('No matches found. Create a new bottle entry.');
          } else {
            toast.success(`Found ${data.potentialMatches.length} potential matches`);
          }
          break;
          
        case 'not_found':
          toast.error(data.message || 'Product not found');
          break;
      }
    } catch (error) {
      console.error('Error processing barcode:', error);
      toast.error('Failed to process barcode');
      setScanResult(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMatchSelection = async (masterBottleId: string) => {
    if (!scanResult?.barcode) return;
    
    setIsProcessing(true);
    try {
      // Add UPC to the selected master bottle
      const response = await fetch('/api/upc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterBottleId,
          upcCode: scanResult.barcode,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 409) {
          toast.error('This UPC is already linked to another bottle');
          router.push(`/bottles?search=${scanResult.barcode}`);
        } else {
          throw new Error(data.error || 'Failed to link UPC');
        }
        return;
      }
      
      toast.success('UPC linked successfully!');
      router.push(`/bottles/add?masterBottleId=${masterBottleId}`);
    } catch (error) {
      console.error('Error linking UPC:', error);
      toast.error('Failed to link UPC to bottle');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateNew = () => {
    if (!scanResult?.upcInfo) return;
    
    // Navigate to add bottle page with pre-filled info
    const params = new URLSearchParams({
      name: scanResult.upcInfo.title || '',
      brand: scanResult.upcInfo.brand || '',
      upc: scanResult.barcode || '',
    });
    
    router.push(`/bottles/add?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center justify-between p-4">
          <Link href="/" className="p-2 -ml-2 text-gray-400 hover:text-white">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold text-white">Smart Scanner</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="p-4 pb-20">
        <div className="max-w-lg mx-auto">
          {!isScanning && !scanResult && !isProcessing && (
            <div className="text-center py-12">
              <div className="mb-8">
                <div className="w-32 h-32 bg-gray-800 rounded-full mx-auto flex items-center justify-center mb-6">
                  <ScanLine className="w-16 h-16 text-copper" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">
                  Smart Barcode Scanner
                </h2>
                <p className="text-gray-400 mb-8">
                  Scan any barcode - vault labels, CellarTracker codes, or product UPCs
                </p>
              </div>

              <button
                onClick={() => setIsScanning(true)}
                className="btn-primary px-8 py-4 text-lg font-semibold flex items-center gap-3 mx-auto"
              >
                <ScanLine className="w-6 h-6" />
                Start Scanning
              </button>

              <div className="mt-8 text-sm text-gray-500">
                <p className="font-medium mb-2">Supported barcode types:</p>
                <ul className="space-y-1 text-left max-w-xs mx-auto">
                  <li className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    <span>WV vault labels (WV001-000001)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Wine className="w-4 h-4" />
                    <span>CellarTracker barcodes</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-copper" />
                    <span className="text-copper">Product UPC codes (NEW!)</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {isScanning && (
            <div className="card-premium">
              <BarcodeScanner
                onScan={handleBarcodeScan}
                onClose={() => setIsScanning(false)}
              />
            </div>
          )}

          {isProcessing && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-copper animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Processing barcode...</p>
            </div>
          )}

          {scanResult?.type === 'new_upc' && scanResult.potentialMatches && (
            <div className="space-y-4">
              <div className="card p-4">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Scanned Product
                </h3>
                <p className="text-gray-300">{scanResult.upcInfo?.title}</p>
                {scanResult.upcInfo?.brand && (
                  <p className="text-sm text-gray-500">by {scanResult.upcInfo.brand}</p>
                )}
                <p className="text-xs text-gray-600 mt-2">UPC: {scanResult.barcode}</p>
              </div>

              {scanResult.potentialMatches.length > 0 ? (
                <>
                  <h3 className="text-lg font-semibold text-white">
                    Is this one of these bottles?
                  </h3>
                  
                  <div className="space-y-3">
                    {scanResult.potentialMatches.map((match) => (
                      <button
                        key={match.masterBottle._id}
                        onClick={() => setSelectedMatch(match.masterBottle._id)}
                        disabled={isProcessing}
                        className={`w-full text-left card p-4 transition-all ${
                          selectedMatch === match.masterBottle._id
                            ? 'ring-2 ring-copper bg-gray-800/50'
                            : 'hover:bg-gray-800/30'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-white">
                              {match.masterBottle.name}
                            </h4>
                            <p className="text-sm text-gray-400">
                              {match.masterBottle.brand} • {match.masterBottle.distillery}
                            </p>
                            <div className="flex gap-4 mt-2 text-xs">
                              <span className="text-copper">
                                {match.similarity}% match
                              </span>
                              {match.masterBottle.proof && (
                                <span className="text-gray-500">
                                  {match.masterBottle.proof} proof
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="ml-4">
                            {selectedMatch === match.masterBottle._id ? (
                              <Check className="w-5 h-5 text-copper" />
                            ) : (
                              <div className="w-5 h-5 border-2 border-gray-600 rounded" />
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => selectedMatch && handleMatchSelection(selectedMatch)}
                      disabled={!selectedMatch || isProcessing}
                      className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                      ) : (
                        'Yes, Use Selected'
                      )}
                    </button>
                    <button
                      onClick={handleCreateNew}
                      disabled={isProcessing}
                      className="btn-secondary flex-1"
                    >
                      No, Create New
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-4">
                    No matching bottles found in our database
                  </p>
                  <button
                    onClick={handleCreateNew}
                    disabled={isProcessing}
                    className="btn-primary"
                  >
                    Create New Bottle Entry
                  </button>
                </div>
              )}
            </div>
          )}

          {scanResult?.type === 'upc' && scanResult.userBottles && scanResult.userBottles.length > 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">
                Select Your Bottle
              </h3>
              <p className="text-gray-400">
                You have {scanResult.userBottles.length} bottles of {scanResult.masterBottle?.name}
              </p>
              
              <div className="space-y-3">
                {scanResult.userBottles.map((bottle) => (
                  <Link
                    key={bottle._id}
                    href={`/bottles/${bottle._id}`}
                    className="block card p-4 hover:bg-gray-800/30 transition-all"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-white font-medium">
                          {bottle.location ? `${bottle.location.area} - ${bottle.location.bin}` : 'No location'}
                        </p>
                        <p className="text-sm text-gray-400">
                          Status: {bottle.status} • Qty: {bottle.quantity}
                        </p>
                      </div>
                      <ArrowLeft className="w-5 h-5 text-gray-500 rotate-180" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}