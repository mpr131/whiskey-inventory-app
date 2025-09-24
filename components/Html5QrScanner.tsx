'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface Html5QrScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export default function Html5QrScanner({ onScan, onClose }: Html5QrScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<string[]>(['Loading html5-qrcode scanner...']);
  const [manualCode, setManualCode] = useState('');
  const scannerInstanceRef = useRef<any>(null);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${msg}`]);
    console.log(msg);
  };

  useEffect(() => {
    let Html5QrcodeScanner: any;
    
    const initScanner = async () => {
      try {
        // Prevent multiple initializations
        if (scannerInstanceRef.current) {
          addLog('⚠️ Scanner already initialized, skipping...');
          return;
        }

        // Dynamically import html5-qrcode
        const html5QrcodeModule = await import('html5-qrcode');
        Html5QrcodeScanner = html5QrcodeModule.Html5QrcodeScanner;

        addLog('✅ html5-qrcode library loaded');

        if (scannerRef.current) {
          // Clear any existing scanner DOM elements first to prevent duplicates
          scannerRef.current.innerHTML = '';

          // Small delay to ensure DOM is ready
          await new Promise(resolve => setTimeout(resolve, 100));

          // Use a unique ID to prevent conflicts
          const uniqueId = `qr-reader-${Date.now()}`;
          scannerRef.current.id = uniqueId;

          // Create scanner with optimized config for speed and accuracy
          const scanner = new Html5QrcodeScanner(
            uniqueId,
            {
              fps: 30, // High FPS for responsiveness
              qrbox: { width: 300, height: 150 }, // Focus area for barcodes
              aspectRatio: 2.0, // Wide rectangle for barcodes
              supportedScanTypes: [
                html5QrcodeModule.Html5QrcodeScanType.SCAN_TYPE_CAMERA
              ],
              experimentalFeatures: {
                useBarCodeDetectorIfSupported: true // Use native detector if available!
              },
              rememberLastUsedCamera: true, // Let it remember the working camera
              showTorchButtonIfSupported: true,
              showZoomSliderIfSupported: true,
              defaultZoomValueIfSupported: 2, // 2x zoom for better barcode reading
            },
            false // Verbose logging off
          );
          
          scannerInstanceRef.current = scanner;
          
          // Success callback - when barcode is detected
          const onScanSuccess = (decodedText: string, decodedResult: any) => {
            try {
              const formatName = decodedResult?.result?.format?.formatName || 
                                decodedResult?.format?.formatName || 
                                'Unknown';
              addLog(`🎯 SCANNED: ${decodedText} (${formatName})`);
              
              // Stop scanner and clean up DOM
              scanner.clear().then(() => {
                if (scannerRef.current) {
                  scannerRef.current.innerHTML = '';
                }
              }).catch(console.error);
              
              // Call the success callback
              onScan(decodedText);
            } catch (err) {
              addLog(`🎯 SCANNED: ${decodedText}`);
              scanner.clear().catch(console.error);
              onScan(decodedText);
            }
          };
          
          // Error callback - when scan fails
          const onScanFailure = (error: string) => {
            // Don't log every failure, just occasional status updates
            if (Math.random() < 0.005) { // 0.5% of failures for less noise
              addLog('🔍 Scanning...');
            }
          };
          
          // Start scanner
          scanner.render(onScanSuccess, onScanFailure)
            .then(() => {
              addLog('🚀 Scanner started successfully!');
            })
            .catch((err: any) => {
              addLog(`❌ Scanner failed: ${err}`);
            });
        }
        
      } catch (err: any) {
        addLog(`❌ Failed to load scanner: ${err.message}`);
      }
    };
    
    initScanner();
    
    return () => {
      // Cleanup scanner and DOM
      if (scannerInstanceRef.current) {
        // Clear DOM immediately (don't wait for async clear to complete)
        if (scannerRef.current) {
          scannerRef.current.innerHTML = '';
        }

        // Then try to properly clear the scanner instance
        try {
          scannerInstanceRef.current.clear().catch(console.error);
        } catch (err) {
          console.error('Scanner cleanup error:', err);
        }

        // Null out the reference
        scannerInstanceRef.current = null;
      }
    };
  }, [onScan]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      addLog(`📱 Manual entry: ${manualCode.trim()}`);
      onScan(manualCode.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 text-white">
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-gray-800">
        <h1 className="text-lg font-bold">🔥 HTML5 QR Scanner</h1>
        <button onClick={onClose} className="p-2 bg-red-600 rounded">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Scanner Area */}
      <div className="p-4">
        <div
          ref={scannerRef}
          className="w-full"
        />
        
        {/* Debug Logs */}
        <div className="bg-black p-3 rounded text-xs font-mono h-24 overflow-y-auto mt-4">
          <div className="text-green-400 mb-1">Status:</div>
          {logs.map((log, i) => (
            <div key={i} className="text-gray-300">{log}</div>
          ))}
        </div>

        {/* Manual Entry Fallback */}
        <form onSubmit={handleManualSubmit} className="space-y-3 mt-4">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Enter barcode manually..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:border-orange-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!manualCode.trim()}
            className="w-full py-2 bg-orange-600 text-white font-semibold rounded hover:bg-orange-700 disabled:opacity-50"
          >
            📱 Manual Scan
          </button>
        </form>
      </div>
    </div>
  );
}