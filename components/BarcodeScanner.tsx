'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Camera, AlertCircle } from 'lucide-react';
import { useZxing } from 'react-zxing';

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const hasScanned = useRef(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string>('');
  
  const { ref } = useZxing({
    onDecodeResult(result) {
      if (!hasScanned.current) {
        hasScanned.current = true;
        const code = result.getText();
        console.log('Scanned barcode:', code);
        onScan(code);
      }
    },
    onError(error) {
      console.error('Scanner error:', error);
      setError('Camera error. Please check permissions.');
    },
    constraints: {
      video: {
        facingMode: 'environment'
      },
      audio: false
    }
  });

  // Request camera permissions
  useEffect(() => {
    hasScanned.current = false;
    
    const requestPermissions = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        setHasPermission(true);
        // Stop the test stream
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error('Permission error:', err);
        setHasPermission(false);
        setError('Camera permission denied. Please enable camera access.');
      }
    };
    
    requestPermissions();
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-gray-900/80">
        <h2 className="text-white text-lg font-semibold flex items-center">
          <Camera className="w-5 h-5 mr-2" />
          Scan Barcode
        </h2>
        <button
          onClick={onClose}
          className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Scanner */}
      <div className="flex-1 relative">
        {hasPermission === false || error ? (
          <div className="flex flex-col items-center justify-center h-full p-4">
            <AlertCircle className="w-16 h-16 text-copper mb-4" />
            <h3 className="text-white text-xl mb-2">Camera Not Available</h3>
            <p className="text-gray-400 text-center max-w-md mb-6">
              Camera access requires HTTPS. Enter barcode manually instead:
            </p>
            
            {/* Manual Entry Form */}
            <div className="w-full max-w-md">
              <form onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.elements.namedItem('barcode') as HTMLInputElement;
                if (input.value.trim()) {
                  onScan(input.value.trim());
                }
              }} className="flex gap-3">
                <input
                  type="text"
                  name="barcode"
                  placeholder="Enter barcode number..."
                  className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-copper"
                  autoFocus
                />
                <button
                  type="submit"
                  className="btn-primary px-6"
                >
                  Search
                </button>
              </form>
              
              <p className="text-gray-500 text-sm mt-4 text-center">
                Tip: Camera scanning works with HTTPS connection
              </p>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={ref}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            
            {/* Scan guide overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-32 border-2 border-copper rounded-lg relative">
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-copper rounded-tl" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-copper rounded-tr" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-copper rounded-bl" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-copper rounded-br" />
                </div>
              </div>
              
              <div className="absolute bottom-8 left-0 right-0 text-center">
                <p className="text-white text-lg">Align barcode within frame</p>
                <p className="text-gray-400 text-sm mt-1">Scanning automatically...</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}