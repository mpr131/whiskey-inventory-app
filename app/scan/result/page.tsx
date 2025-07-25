'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Plus, Package, ExternalLink, Search, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Image from 'next/image';

interface ScanResult {
  type: 'user_bottle' | 'master_bottle' | 'external_product' | 'not_found';
  userBottle?: any;
  masterBottle?: any;
  externalProduct?: any;
  userHasBottles?: boolean;
  userBottleCount?: number;
  barcode?: string;
  message?: string;
  barcodeType?: 'vault' | 'cellartracker' | 'upc';
}

export const dynamic = 'force-dynamic';

function ScanResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const barcode = searchParams.get('barcode');
  
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [addedBottleId, setAddedBottleId] = useState<string | null>(null);

  useEffect(() => {
    if (barcode) {
      checkBarcode(barcode);
    }
  }, [barcode]);

  const checkBarcode = async (code: string) => {
    try {
      const response = await fetch('/api/smart-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: code })
      });

      if (!response.ok) throw new Error('Scan failed');
      
      const result = await response.json();
      setScanResult(result);
    } catch (error) {
      console.error('Scan error:', error);
      toast.error('Failed to scan barcode');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCollection = async () => {
    if (!scanResult) return;
    
    setAdding(true);
    try {
      const payload = scanResult.type === 'master_bottle' 
        ? { masterBottleId: scanResult.masterBottle._id }
        : { externalProduct: scanResult.externalProduct };

      const response = await fetch('/api/smart-scan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to add bottle');
      
      const { userBottle } = await response.json();
      setAddedBottleId(userBottle._id);
      toast.success('Bottle added to collection!');
      setShowSuccess(true);
    } catch (error) {
      console.error('Add error:', error);
      toast.error('Failed to add bottle');
    } finally {
      setAdding(false);
    }
  };

  const handleManualEntry = () => {
    router.push(`/bottles/add?barcode=${barcode}`);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-copper mx-auto mb-4"></div>
          <p className="text-gray-400">Scanning barcode...</p>
        </div>
      </div>
    );
  }

  // Success state
  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-gray-800 rounded-xl p-8 text-center">
            <div className="w-20 h-20 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Success!</h2>
            <p className="text-gray-400 mb-8">Bottle added to your collection</p>
            
            <div className="space-y-3">
              <button
                onClick={() => router.push('/scan')}
                className="w-full bg-copper hover:bg-copper-light text-white font-medium py-4 px-6 rounded-lg transition-all text-lg"
              >
                Scan Another Bottle
              </button>
              
              {addedBottleId && (
                <button
                  onClick={() => router.push(`/bottles/${addedBottleId}`)}
                  className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-4 px-6 rounded-lg transition-all"
                >
                  View Bottle
                </button>
              )}
              
              <button
                onClick={() => router.push('/bottles')}
                className="w-full bg-transparent border border-gray-600 hover:bg-gray-800 text-gray-300 font-medium py-4 px-6 rounded-lg transition-all"
              >
                View Collection
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!scanResult) {
    return null;
  }

  // Mobile-first layout wrapper
  const MobileLayout = ({ children, title = "Scan Result" }: { children: React.ReactNode, title?: string }) => (
    <div className="min-h-screen bg-gray-900">
      {/* Mobile Header */}
      <div className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-white">{title}</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="p-4 pb-24">
        <div className="max-w-lg mx-auto">
          {children}
        </div>
      </div>
    </div>
  );

  // Found in user's collection
  if (scanResult.type === 'user_bottle') {
    const bottle = scanResult.userBottle;
    const masterBottle = bottle.masterBottleId;
    
    return (
      <MobileLayout title="Already in Collection">
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <div className="bg-green-900/50 border-b border-green-800/50 p-4">
            <div className="flex items-center gap-2 text-green-400">
              <Package className="h-5 w-5" />
              <p className="font-medium">Found in Your Collection!</p>
            </div>
            <p className="text-sm text-green-300 mt-1">
              {scanResult.barcodeType === 'vault' && `Vault Barcode: ${barcode}`}
              {scanResult.barcodeType === 'cellartracker' && `CellarTracker ID: ${barcode}`}
              {scanResult.barcodeType === 'upc' && scanResult.userBottleCount && scanResult.userBottleCount > 1 
                ? `You have ${scanResult.userBottleCount} bottles of this product`
                : 'Product barcode matched'}
            </p>
          </div>

          <div className="p-4">
            {/* Mobile-optimized layout */}
            <div className="flex flex-col items-center text-center mb-6">
              {masterBottle?.defaultImageUrl ? (
                <div className="relative w-40 h-48 mb-4">
                  <Image
                    src={masterBottle.defaultImageUrl}
                    alt={bottle.name}
                    fill
                    className="object-contain rounded-lg"
                  />
                </div>
              ) : (
                <div className="w-40 h-48 bg-gray-700 rounded-lg flex items-center justify-center mb-4">
                  <Package className="h-16 w-16 text-gray-500" />
                </div>
              )}

              <h1 className="text-2xl font-bold text-white mb-2">{bottle.name}</h1>
              <p className="text-lg text-gray-300 mb-1">{bottle.distillery}</p>
              <p className="text-gray-400 mb-4">
                {bottle.category} • {bottle.proof || bottle.statedProof}° • {bottle.size || '750 ml'}
              </p>
            </div>
            
            <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Status</p>
                  <p className="font-medium text-white capitalize">{bottle.status}</p>
                </div>
                <div>
                  <p className="text-gray-400">Location</p>
                  <p className="font-medium text-white">{bottle.location}</p>
                </div>
                {bottle.personalRating && (
                  <div className="col-span-2">
                    <p className="text-gray-400">Your Rating</p>
                    <p className="font-medium text-copper">{bottle.personalRating}/10</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => router.push(`/bottles/${bottle._id}`)}
                className="w-full bg-copper hover:bg-copper-light text-white font-medium py-4 px-6 rounded-lg transition-all text-lg"
              >
                View Bottle Details
              </button>

              <button
                onClick={() => router.push('/scan')}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-4 px-6 rounded-lg transition-all"
              >
                Scan Another
              </button>
            </div>
          </div>
        </div>
      </MobileLayout>
    );
  }

  // Found in database (master bottle)
  if (scanResult.type === 'master_bottle') {
    const bottle = scanResult.masterBottle;
    return (
      <MobileLayout title="Bottle Found">
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          {scanResult.userHasBottles && (
            <div className="bg-amber-900/50 border-b border-amber-800/50 p-4">
              <p className="text-sm text-amber-300">
                You already have {scanResult.userBottleCount} bottle{scanResult.userBottleCount !== 1 ? 's' : ''} of this in your collection
              </p>
            </div>
          )}

          <div className="p-4">
            <div className="flex flex-col items-center text-center mb-6">
              {bottle.defaultImageUrl ? (
                <div className="relative w-40 h-48 mb-4">
                  <Image
                    src={bottle.defaultImageUrl}
                    alt={bottle.name}
                    fill
                    className="object-contain rounded-lg"
                  />
                </div>
              ) : (
                <div className="w-40 h-48 bg-gray-700 rounded-lg flex items-center justify-center mb-4">
                  <Package className="h-16 w-16 text-gray-500" />
                </div>
              )}

              <h1 className="text-2xl font-bold text-white mb-2">{bottle.name}</h1>
              <p className="text-lg text-gray-300 mb-1">{bottle.distillery}</p>
              <p className="text-gray-400 mb-4">
                {bottle.category} • {bottle.proof || bottle.statedProof}° • {bottle.size || '750 ml'}
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleAddToCollection}
                disabled={adding}
                className="w-full bg-copper hover:bg-copper-light text-white font-medium py-4 px-6 rounded-lg transition-all text-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {adding ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5" />
                    Add to My Collection
                  </>
                )}
              </button>

              <button
                onClick={() => router.push('/scan')}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-4 px-6 rounded-lg transition-all"
              >
                Scan Another
              </button>
            </div>
          </div>
        </div>
      </MobileLayout>
    );
  }

  // Found in external database
  if (scanResult.type === 'external_product') {
    const product = scanResult.externalProduct;
    return (
      <MobileLayout title="New Bottle Found">
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <div className="bg-green-900/50 border-b border-green-800/50 p-4">
            <div className="flex items-center gap-2 text-green-400">
              <ExternalLink className="h-5 w-5" />
              <p className="font-medium">New bottle found!</p>
            </div>
            <p className="text-sm text-green-300 mt-1">
              This will create a new master bottle and add it to your collection
            </p>
          </div>

          <div className="p-4">
            <div className="flex flex-col items-center text-center mb-6">
              {product.defaultImageUrl ? (
                <div className="relative w-40 h-48 mb-4">
                  <Image
                    src={product.defaultImageUrl}
                    alt={product.name}
                    fill
                    className="object-contain rounded-lg"
                  />
                </div>
              ) : (
                <div className="w-40 h-48 bg-gray-700 rounded-lg flex items-center justify-center mb-4">
                  <Package className="h-16 w-16 text-gray-500" />
                </div>
              )}

              <h1 className="text-2xl font-bold text-white mb-2">{product.name}</h1>
              <p className="text-lg text-gray-300 mb-1">{product.distillery}</p>
              <p className="text-gray-400 mb-2">
                {product.category} • {product.proof}° • {product.size}
              </p>
              {product.msrp > 0 && (
                <p className="text-gray-400 mb-4">MSRP: ${product.msrp}</p>
              )}
            </div>

            <div className="space-y-3">
              <button
                onClick={handleAddToCollection}
                disabled={adding}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-4 px-6 rounded-lg transition-all text-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {adding ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5" />
                    Create & Add to Collection
                  </>
                )}
              </button>

              <button
                onClick={() => router.push('/scan')}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-4 px-6 rounded-lg transition-all"
              >
                Scan Another
              </button>
            </div>
          </div>
        </div>
      </MobileLayout>
    );
  }

  // Not found
  return (
    <MobileLayout title="Not Found">
      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <div className="p-8 text-center">
          <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search className="w-10 h-10 text-gray-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Barcode Not Found</h2>
          <p className="text-gray-400 mb-2">
            We couldn&apos;t find a bottle matching barcode:
          </p>
          <p className="font-mono text-copper mb-8">{barcode}</p>

          <div className="space-y-3">
            <button
              onClick={handleManualEntry}
              className="w-full bg-copper hover:bg-copper-light text-white font-medium py-4 px-6 rounded-lg transition-all text-lg flex items-center justify-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Add Manually
            </button>

            <button
              onClick={() => router.push('/scan')}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-4 px-6 rounded-lg transition-all"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}

export default function ScanResultPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-copper mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    }>
      <ScanResultContent />
    </Suspense>
  );
}