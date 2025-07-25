'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Plus, Package, ExternalLink, Search } from 'lucide-react';
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

export default function ScanResultPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const barcode = searchParams.get('barcode');
  
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

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

      // If found in user's collection, show it (don't auto-redirect for better UX)
      // User can see what type of barcode was scanned
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
      toast.success('Bottle added to collection!');
      router.push(`/bottles/${userBottle._id}`);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Scanning barcode...</p>
        </div>
      </div>
    );
  }

  if (!scanResult) {
    return null;
  }

  // Found in user's collection
  if (scanResult.type === 'user_bottle') {
    const bottle = scanResult.userBottle;
    const masterBottle = bottle.masterBottleId;
    
    return (
      <div className="max-w-2xl mx-auto p-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Scanner
        </button>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="bg-green-50 border border-green-200 rounded p-4 mb-6">
            <div className="flex items-center gap-2 text-green-800">
              <Package className="h-5 w-5" />
              <p className="font-medium">Found in Your Collection!</p>
            </div>
            <p className="text-sm text-green-700 mt-1">
              {scanResult.barcodeType === 'vault' && `Vault Barcode: ${barcode}`}
              {scanResult.barcodeType === 'cellartracker' && `CellarTracker ID: ${barcode}`}
              {scanResult.barcodeType === 'upc' && scanResult.userBottleCount && scanResult.userBottleCount > 1 
                ? `You have ${scanResult.userBottleCount} bottles of this product`
                : 'Product barcode matched'}
            </p>
          </div>

          <div className="flex items-start gap-6">
            {masterBottle?.defaultImageUrl ? (
              <div className="relative w-32 h-40 flex-shrink-0">
                <Image
                  src={masterBottle.defaultImageUrl}
                  alt={bottle.name}
                  fill
                  className="object-contain rounded"
                />
              </div>
            ) : (
              <div className="w-32 h-40 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                <Package className="h-12 w-12 text-gray-400" />
              </div>
            )}

            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{bottle.name}</h1>
              <p className="text-lg text-gray-700 mb-1">{bottle.distillery}</p>
              <p className="text-gray-600 mb-4">
                {bottle.category} • {bottle.proof || bottle.statedProof}° • {bottle.size || '750 ml'}
              </p>
              
              <div className="bg-gray-50 rounded p-3 mb-4">
                <p className="text-sm text-gray-600">Status: <span className="font-medium">{bottle.status}</span></p>
                <p className="text-sm text-gray-600">Location: <span className="font-medium">{bottle.location}</span></p>
                {bottle.personalRating && (
                  <p className="text-sm text-gray-600">Your Rating: <span className="font-medium">{bottle.personalRating}/10</span></p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => router.push(`/bottles/${bottle._id}`)}
                  className="flex-1 bg-amber-600 text-white px-6 py-3 rounded-md hover:bg-amber-700"
                >
                  View Bottle Details
                </button>

                <button
                  onClick={() => router.push('/scan')}
                  className="px-6 py-3 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Scan Another
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Found in database (master bottle)
  if (scanResult.type === 'master_bottle') {
    const bottle = scanResult.masterBottle;
    return (
      <div className="max-w-2xl mx-auto p-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-start gap-6">
            {bottle.defaultImageUrl ? (
              <div className="relative w-32 h-40 flex-shrink-0">
                <Image
                  src={bottle.defaultImageUrl}
                  alt={bottle.name}
                  fill
                  className="object-contain rounded"
                />
              </div>
            ) : (
              <div className="w-32 h-40 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                <Package className="h-12 w-12 text-gray-400" />
              </div>
            )}

            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{bottle.name}</h1>
              <p className="text-lg text-gray-700 mb-1">{bottle.distillery}</p>
              <p className="text-gray-600 mb-4">
                {bottle.category} • {bottle.proof || bottle.statedProof}° • {bottle.size || '750 ml'}
              </p>

              {scanResult.userHasBottles && (
                <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-4">
                  <p className="text-sm text-amber-800">
                    You already have {scanResult.userBottleCount} bottle{scanResult.userBottleCount !== 1 ? 's' : ''} of this in your collection
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleAddToCollection}
                  disabled={adding}
                  className="flex-1 bg-amber-600 text-white px-6 py-3 rounded-md hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2"
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
                  onClick={() => router.push('/')}
                  className="px-6 py-3 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Found in external database
  if (scanResult.type === 'external_product') {
    const product = scanResult.externalProduct;
    return (
      <div className="max-w-2xl mx-auto p-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="bg-green-50 border border-green-200 rounded p-4 mb-6">
            <div className="flex items-center gap-2 text-green-800">
              <ExternalLink className="h-5 w-5" />
              <p className="font-medium">New bottle found in external database!</p>
            </div>
            <p className="text-sm text-green-700 mt-1">
              This will create a new master bottle and add it to your collection
            </p>
          </div>

          <div className="flex items-start gap-6">
            {product.defaultImageUrl ? (
              <div className="relative w-32 h-40 flex-shrink-0">
                <Image
                  src={product.defaultImageUrl}
                  alt={product.name}
                  fill
                  className="object-contain rounded"
                />
              </div>
            ) : (
              <div className="w-32 h-40 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                <Package className="h-12 w-12 text-gray-400" />
              </div>
            )}

            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h1>
              <p className="text-lg text-gray-700 mb-1">{product.distillery}</p>
              <p className="text-gray-600 mb-2">
                {product.category} • {product.proof}° • {product.size}
              </p>
              {product.msrp > 0 && (
                <p className="text-gray-600 mb-4">MSRP: ${product.msrp}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleAddToCollection}
                  disabled={adding}
                  className="flex-1 bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
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
                  onClick={() => router.push('/')}
                  className="px-6 py-3 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not found
  return (
    <div className="max-w-2xl mx-auto p-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-5 w-5" />
        Back
      </button>

      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <Search className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Barcode Not Found</h1>
        <p className="text-gray-600 mb-6">
          We couldn&apos;t find a bottle matching barcode: <span className="font-mono">{barcode}</span>
        </p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={handleManualEntry}
            className="bg-amber-600 text-white px-6 py-3 rounded-md hover:bg-amber-700 flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Add Manually
          </button>

          <button
            onClick={() => router.push('/scan')}
            className="px-6 py-3 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}