'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ScanLine } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const BarcodeScanner = dynamic(() => import('@/components/BarcodeScanner'), {
  ssr: false,
});

export default function ScanPage() {
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(false);

  const handleBarcodeScan = (barcode: string) => {
    setIsScanning(false);
    router.push(`/bottles?search=${encodeURIComponent(barcode)}`);
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center justify-between p-4">
          <Link href="/" className="p-2 -ml-2 text-gray-400 hover:text-white">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold text-white">Scan Barcode</h1>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>
      </header>

      <main className="p-4 pb-20">
        <div className="max-w-lg mx-auto">
          {!isScanning ? (
            <div className="text-center py-12">
              <div className="mb-8">
                <div className="w-32 h-32 bg-gray-800 rounded-full mx-auto flex items-center justify-center mb-6">
                  <ScanLine className="w-16 h-16 text-copper" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">
                  Scan a Bottle
                </h2>
                <p className="text-gray-400 mb-8">
                  Use your camera to scan a barcode on a bottle to quickly find it in your collection
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
                <p>Tips for best results:</p>
                <ul className="mt-2 space-y-1">
                  <li>• Ensure good lighting</li>
                  <li>• Hold camera steady</li>
                  <li>• Center barcode in frame</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="card-premium">
              <BarcodeScanner
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