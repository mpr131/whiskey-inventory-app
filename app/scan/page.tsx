'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ScanLine, Package, Wine } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const ZXingBarcodeScanner = dynamic(() => import('@/components/ZXingBarcodeScanner'), {
  ssr: false,
});

export default function ScanPage() {
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(false);

  const handleBarcodeScan = async (barcode: string) => {
    setIsScanning(false);
    // Redirect to scan result page with the barcode
    router.push(`/scan/result?barcode=${encodeURIComponent(barcode)}`);
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
          {!isScanning && (
            <div className="text-center py-12">
              <div className="mb-8">
                <div className="w-32 h-32 bg-gray-800 rounded-full mx-auto flex items-center justify-center mb-6">
                  <ScanLine className="w-16 h-16 text-copper" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">
                  Smart Barcode Scanner
                </h2>
                <p className="text-gray-400 mb-8">
                  Scan any barcode to find or add bottles to your collection
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
                <p className="font-medium mb-2">Supports multiple barcode types:</p>
                <ul className="space-y-1 text-left max-w-xs mx-auto">
                  <li className="flex items-center gap-2">
                    <Wine className="w-4 h-4 text-copper" />
                    <span>Vault Barcodes (WV_xxxxx)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-500" />
                    <span>CellarTracker IDs</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-green-500" />
                    <span>Product UPCs (71,000+ products)</span>
                  </li>
                </ul>
                <p className="mt-4 text-xs">
                  Instantly searches your collection and our complete database
                </p>
              </div>
            </div>
          )}

          {isScanning && (
            <div className="card-premium">
              <ZXingBarcodeScanner
                onScan={handleBarcodeScan}
                onClose={() => setIsScanning(false)}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}