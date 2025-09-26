'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';

interface AutoStartScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export default function AutoStartScanner({ onScan, onClose }: AutoStartScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<string>('Initializing camera...');
  const [manualCode, setManualCode] = useState('');
  const scannerInstanceRef = useRef<any>(null);
  const html5QrcodeRef = useRef<any>(null);

  useEffect(() => {
    const initScanner = async () => {
      try {
        // Import html5-qrcode library
        const html5QrcodeModule = await import('html5-qrcode');
        const { Html5Qrcode } = html5QrcodeModule;

        setStatus('Requesting camera permission...');

        // Get available cameras
        const cameras = await Html5Qrcode.getCameras();

        if (!cameras || cameras.length === 0) {
          setStatus('No cameras found. Please check permissions.');
          return;
        }

        setStatus(`Found ${cameras.length} camera(s). Selecting best one...`);

        // Find the best camera (prefer back camera, especially ultra-wide)
        let selectedCamera = cameras[0]; // Default to first camera

        // Priority order for camera selection
        const cameraPreferences = [
          'back ultra wide',
          'ultra wide',
          'back',
          'rear',
          'environment'
        ];

        for (const pref of cameraPreferences) {
          const found = cameras.find(camera =>
            camera.label.toLowerCase().includes(pref)
          );
          if (found) {
            selectedCamera = found;
            break;
          }
        }

        // If we still have the default and there are multiple cameras,
        // prefer the last one (usually back camera on mobile)
        if (selectedCamera === cameras[0] && cameras.length > 1) {
          selectedCamera = cameras[cameras.length - 1];
        }

        setStatus(`Using: ${selectedCamera.label || 'Camera'}`);

        if (!scannerRef.current) return;

        // Clear any existing content
        scannerRef.current.innerHTML = '';

        // Create a unique container for the scanner
        const scannerContainer = document.createElement('div');
        scannerContainer.id = `scanner-${Date.now()}`;
        scannerContainer.style.width = '100%';
        scannerRef.current.appendChild(scannerContainer);

        // Initialize Html5Qrcode with the container ID
        const html5Qrcode = new Html5Qrcode(scannerContainer.id);
        html5QrcodeRef.current = html5Qrcode;

        // Configuration optimized for barcode scanning
        const config = {
          fps: 30,
          qrbox: { width: 300, height: 150 },
          aspectRatio: 2.0,
          // Advanced config for better barcode detection
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          },
          // Zoom configuration
          defaultZoomValueIfSupported: 2,
          // Focus mode for better scanning
          focusMode: 'continuous',
          // Advanced detection
          disableFlip: false,
          // Support all barcode formats
          formatsToSupport: [
            html5QrcodeModule.Html5QrcodeSupportedFormats.QR_CODE,
            html5QrcodeModule.Html5QrcodeSupportedFormats.UPC_A,
            html5QrcodeModule.Html5QrcodeSupportedFormats.UPC_E,
            html5QrcodeModule.Html5QrcodeSupportedFormats.EAN_13,
            html5QrcodeModule.Html5QrcodeSupportedFormats.EAN_8,
            html5QrcodeModule.Html5QrcodeSupportedFormats.CODE_128,
            html5QrcodeModule.Html5QrcodeSupportedFormats.CODE_39,
            html5QrcodeModule.Html5QrcodeSupportedFormats.CODE_93,
            html5QrcodeModule.Html5QrcodeSupportedFormats.CODABAR,
            html5QrcodeModule.Html5QrcodeSupportedFormats.ITF,
          ]
        };

        // Success callback
        const onScanSuccess = (decodedText: string, decodedResult: any) => {
          setStatus('Barcode detected!');

          // Trigger callback first (before cleanup)
          onScan(decodedText);

          // Stop scanning after a small delay to allow navigation to start
          setTimeout(() => {
            html5Qrcode.stop().then(() => {
              if (scannerRef.current) {
                scannerRef.current.innerHTML = '';
              }
            }).catch(console.error);
          }, 100);
        };

        // Error callback
        const onScanError = (error: string) => {
          // Silently continue scanning
          // Only update status occasionally to avoid UI spam
          if (Math.random() < 0.01) { // 1% chance
            setStatus('Scanning for barcodes...');
          }
        };

        // Start scanning with the selected camera
        await html5Qrcode.start(
          selectedCamera.id,
          config,
          onScanSuccess,
          onScanError
        );

        setStatus('Camera ready! Point at a barcode...');

      } catch (err: any) {
        console.error('Scanner initialization error:', err);
        setStatus(`Error: ${err.message || 'Failed to initialize camera'}`);

        // Common error messages with user-friendly explanations
        if (err.message?.includes('Permission')) {
          setStatus('Camera permission denied. Please allow camera access and reload.');
        } else if (err.message?.includes('Secure context')) {
          setStatus('Camera requires HTTPS or localhost. Please use a secure connection.');
        } else if (err.message?.includes('NotFound')) {
          setStatus('No camera found. Please check your device.');
        }
      }
    };

    // Start initialization immediately
    initScanner();

    // Cleanup
    return () => {
      if (html5QrcodeRef.current) {
        html5QrcodeRef.current.stop().catch(console.error);
        html5QrcodeRef.current = null;
      }
      if (scannerRef.current) {
        scannerRef.current.innerHTML = '';
      }
    };
  }, [onScan]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 text-white">
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-gray-800 border-b border-gray-700">
        <h1 className="text-lg font-bold">Smart Barcode Scanner</h1>
        <button
          onClick={onClose}
          className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Scanner Area */}
      <div className="flex flex-col h-full">
        <div className="flex-1 relative">
          <div
            ref={scannerRef}
            className="w-full h-full"
          />

          {/* Status Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900 via-gray-900/80 to-transparent p-6">
            <div className="bg-gray-800/90 backdrop-blur rounded-lg p-3 flex items-center gap-3">
              {status.includes('...') && (
                <Loader2 className="w-5 h-5 animate-spin text-copper" />
              )}
              <span className="text-sm font-medium">{status}</span>
            </div>
          </div>
        </div>

        {/* Manual Entry */}
        <div className="p-4 bg-gray-800 border-t border-gray-700">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Or enter barcode manually..."
              className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-copper focus:outline-none"
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-4 py-2 bg-copper text-white font-semibold rounded-lg hover:bg-copper/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Submit
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}