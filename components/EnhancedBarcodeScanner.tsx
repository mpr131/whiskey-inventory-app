'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { 
  X, 
  Camera, 
  AlertCircle, 
  Flashlight, 
  FlashlightOff,
  Upload,
  Info,
  Settings,
  RotateCcw,
  Check,
  Loader2
} from 'lucide-react';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';

// Types for camera permissions
type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'checking';

interface EnhancedBarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

// QuaggaJS2 will be imported dynamically to avoid SSR issues
let Quagga: any = null;

export default function EnhancedBarcodeScanner({ onScan, onClose }: EnhancedBarcodeScannerProps) {
  const videoRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasScanned = useRef(false);
  const scannerInitialized = useRef(false);
  
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('checking');
  const [isScanning, setIsScanning] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [scanConfidence, setScanConfidence] = useState(0);
  const [lastScannedCode, setLastScannedCode] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  // Request camera permission immediately on mount
  const requestCameraPermission = useCallback(async () => {
    try {
      setIsRequestingPermission(true);
      
      if (typeof navigator === 'undefined' || !('mediaDevices' in navigator)) {
        setPermissionStatus('denied');
        return;
      }

      const nav = navigator as any;
      const mediaDevices = nav.mediaDevices;
      
      if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
        setPermissionStatus('denied');
        return;
      }

      try {
        // Immediately request camera permission
        const stream = await mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          } 
        });
        
        // Permission granted - clean up stream and set status
        stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        setPermissionStatus('granted');
        
        // Scanner will be initialized automatically after state update
        
      } catch (err: any) {
        console.error('Camera permission error:', err);
        
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          // User denied permission
          setPermissionStatus('denied');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          // No camera available
          setPermissionStatus('denied');
          toast.error('No camera found on this device');
        } else {
          // Other error
          setPermissionStatus('denied');
        }
      }
    } catch (err) {
      console.error('Error requesting camera permission:', err);
      setPermissionStatus('denied');
    } finally {
      setIsRequestingPermission(false);
    }
  }, []);

  // Initialize Quagga scanner
  const initializeScanner = useCallback(async () => {
    if (!videoRef.current || scannerInitialized.current) return;

    try {
      // Dynamically import Quagga2
      const QuaggaModule = await import('@ericblade/quagga2');
      Quagga = QuaggaModule.default;

      Quagga.init({
        inputStream: {
          type: 'LiveStream',
          target: videoRef.current,
          constraints: {
            width: { min: 1280, ideal: 1920, max: 1920 },
            height: { min: 720, ideal: 1080, max: 1080 },
            facingMode: 'environment',
            aspectRatio: { ideal: 1.7778 }
          },
          area: { // Only scan the center area for better performance
            top: '25%',
            right: '15%',
            left: '15%',
            bottom: '25%'
          }
        },
        locator: {
          patchSize: 'medium',
          halfSample: true
        },
        decoder: {
          readers: [
            'upc_reader',
            'upc_e_reader',
            'ean_reader',
            'ean_8_reader',
            'code_128_reader',
            'code_39_reader',
            'code_39_vin_reader',
            'codabar_reader',
            'i2of5_reader',
            '2of5_reader',
            'code_93_reader'
          ],
          debug: {
            drawBoundingBox: true,
            drawScanline: true,
            showPattern: true
          }
        },
        locate: true,
        frequency: 10, // Scans per second
        debug: false
      }, (err: any) => {
        if (err) {
          console.error('Quagga init error:', err);
          setPermissionStatus('denied');
          return;
        }
        
        Quagga.start();
        scannerInitialized.current = true;
        setIsScanning(true);
      });

      // Set up detection handler
      Quagga.onDetected((result: any) => {
        if (!hasScanned.current && result.codeResult) {
          const code = result.codeResult.code;
          const confidence = Math.round(result.codeResult.decodedCodes
            .filter((x: any) => x.error !== undefined)
            .reduce((acc: number, x: any) => acc + (1 - x.error), 0) / result.codeResult.decodedCodes.length * 100);
          
          setScanConfidence(confidence);
          
          // Only accept high confidence scans
          if (confidence > 85) {
            hasScanned.current = true;
            setLastScannedCode(code);
            
            // Vibrate if available
            if ('vibrate' in navigator) {
              navigator.vibrate(200);
            }
            
            // Play sound if available
            const audio = new Audio('/sounds/beep.mp3');
            audio.play().catch(() => {});
            
            toast.success(`Scanned: ${code}`);
            
            setTimeout(() => {
              onScan(code);
            }, 500);
          }
        }
      });

      // Update scan confidence regularly
      Quagga.onProcessed((result: any) => {
        if (result && result.codeResult) {
          const confidence = Math.round(result.codeResult.decodedCodes
            .filter((x: any) => x.error !== undefined)
            .reduce((acc: number, x: any) => acc + (1 - x.error), 0) / result.codeResult.decodedCodes.length * 100);
          setScanConfidence(confidence);
        }
      });

    } catch (err) {
      console.error('Scanner initialization error:', err);
      setPermissionStatus('denied');
    }
  }, [onScan]);

  // Toggle torch/flashlight
  const toggleTorch = async () => {
    try {
      if (typeof navigator === 'undefined' || !('mediaDevices' in navigator)) {
        toast.error('Camera API not available');
        return;
      }
      
      const mediaDevices = navigator.mediaDevices;
      if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
        toast.error('Camera API not available');
        return;
      }
      
      const stream = await mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          // @ts-ignore
          torch: !torchEnabled 
        } 
      });
      
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as any;
      
      if ('torch' in capabilities) {
        await track.applyConstraints({
          // @ts-ignore
          advanced: [{ torch: !torchEnabled }]
        });
        setTorchEnabled(!torchEnabled);
      } else {
        toast.error('Torch not available on this device');
      }
      
      // Don't stop the stream if we're using it for scanning
      if (!isScanning) {
        stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
    } catch (err) {
      console.error('Torch error:', err);
      toast.error('Could not toggle torch');
    }
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      // Create an image element to process
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = async () => {
        // Create canvas to process image
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        
        // Use Quagga to decode from canvas
        if (Quagga) {
          Quagga.decodeSingle({
            src: url,
            numOfWorkers: 0,
            inputStream: {
              size: canvas.width > 1280 ? 1280 : canvas.width
            },
            decoder: {
              readers: [
                'upc_reader', 
                'upc_e_reader', 
                'ean_reader', 
                'ean_8_reader',
                'code_128_reader',
                'code_39_reader',
                'code_39_vin_reader',
                'codabar_reader'
              ]
            }
          }, (result: any) => {
            if (result && result.codeResult) {
              onScan(result.codeResult.code);
              toast.success(`Scanned from image: ${result.codeResult.code}`);
            } else {
              toast.error('No barcode found in image');
            }
          });
        }
        
        URL.revokeObjectURL(url);
      };
      
      img.src = url;
    } catch (err) {
      console.error('File upload error:', err);
      toast.error('Failed to process image');
    }
  };

  // Manual barcode entry
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      toast.success(`Entered: ${manualCode.trim()}`);
    }
  };

  // Request permission immediately on mount
  useEffect(() => {
    requestCameraPermission();
    
    return () => {
      if (Quagga && scannerInitialized.current) {
        Quagga.stop();
        scannerInitialized.current = false;
      }
    };
  }, [requestCameraPermission]);

  // Initialize scanner when permission is granted
  useEffect(() => {
    if (permissionStatus === 'granted' && !scannerInitialized.current && !isRequestingPermission) {
      initializeScanner();
    }
  }, [permissionStatus, initializeScanner, isRequestingPermission]);

  // Browser-specific help content
  const getBrowserHelp = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('chrome')) {
      return {
        browser: 'Chrome',
        steps: [
          'Click the camera icon in the address bar',
          'Select "Always allow" for this site',
          'Or go to Settings → Privacy → Site Settings → Camera'
        ]
      };
    } else if (userAgent.includes('safari')) {
      return {
        browser: 'Safari',
        steps: [
          'Go to Safari → Settings → Websites → Camera',
          'Find this website and select "Allow"',
          'Reload the page after changing permissions'
        ]
      };
    } else if (userAgent.includes('firefox')) {
      return {
        browser: 'Firefox',
        steps: [
          'Click the permissions icon in the address bar',
          'Set Camera to "Allow"',
          'Or go to Settings → Privacy → Permissions → Camera'
        ]
      };
    }
    
    return {
      browser: 'your browser',
      steps: [
        'Look for camera permissions in your browser settings',
        'Allow camera access for this website',
        'Reload the page after granting permission'
      ]
    };
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-gray-900/95 backdrop-blur">
        <h2 className="text-white text-lg font-semibold flex items-center">
          <Camera className="w-5 h-5 mr-2" />
          Enhanced Barcode Scanner
        </h2>
        <div className="flex items-center gap-2">
          {isScanning && (
            <button
              onClick={toggleTorch}
              className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
              title="Toggle flashlight"
            >
              {torchEnabled ? <Flashlight className="w-5 h-5" /> : <FlashlightOff className="w-5 h-5" />}
            </button>
          )}
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
            title="Help"
          >
            <Info className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Permission Status */}
      {(permissionStatus !== 'granted' || isRequestingPermission) && (
        <div className="bg-gray-800/90 backdrop-blur px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              isRequestingPermission ? 'bg-blue-500 animate-pulse' :
              permissionStatus === 'denied' ? 'bg-red-500' : 
              permissionStatus === 'prompt' ? 'bg-yellow-500' : 
              'bg-gray-500'
            }`} />
            <span className="text-sm text-gray-300">
              {isRequestingPermission ? 'Requesting camera permission...' :
               permissionStatus === 'denied' ? 'Camera Blocked' : 
               permissionStatus === 'prompt' ? 'Permission Needed' : 
               'Checking...'}
            </span>
          </div>
          {permissionStatus === 'denied' && !isRequestingPermission && (
            <button
              onClick={requestCameraPermission}
              className="text-xs px-3 py-1 bg-copper text-white rounded hover:bg-copper-light transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden">
        {isRequestingPermission ? (
          /* Loading state while requesting permission */
          <div className="flex flex-col items-center justify-center h-full p-4 bg-gray-900">
            <div className="relative">
              <Camera className="w-16 h-16 text-copper animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 border-4 border-copper/20 border-t-copper rounded-full animate-spin" />
              </div>
            </div>
            <h3 className="text-white text-xl mt-6 mb-2">Requesting Camera Access</h3>
            <p className="text-gray-400 text-center max-w-sm">
              Please allow camera access when prompted by your browser to scan barcodes
            </p>
          </div>
        ) : permissionStatus === 'granted' ? (
          <>
            {/* Scanner View */}
            <div ref={videoRef} className="w-full h-full relative bg-black" />
            
            {/* Scan Guide Overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  {/* Scan area */}
                  <div className="w-80 h-48 border-2 border-copper rounded-lg relative">
                    {/* Corner markers */}
                    <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-copper rounded-tl" />
                    <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-copper rounded-tr" />
                    <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-copper rounded-bl" />
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-copper rounded-br" />
                    
                    {/* Scan line animation */}
                    {isScanning && (
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-copper animate-scan" />
                    )}
                  </div>
                  
                  {/* Confidence indicator */}
                  {scanConfidence > 0 && (
                    <div className="absolute -bottom-8 left-0 right-0 flex items-center justify-center gap-2">
                      <div className="h-1 w-32 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 ${
                            scanConfidence > 85 ? 'bg-green-500' : 
                            scanConfidence > 60 ? 'bg-yellow-500' : 
                            'bg-red-500'
                          }`}
                          style={{ width: `${scanConfidence}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">{scanConfidence}%</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Instructions */}
              <div className="absolute bottom-24 left-0 right-0 text-center px-4">
                <p className="text-white text-lg font-medium">
                  {isScanning ? 'Align barcode within frame' : 'Initializing scanner...'}
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  Hold steady • Good lighting helps • UPC/EAN barcodes supported
                </p>
              </div>
            </div>
            
            {/* Last scanned code */}
            {lastScannedCode && (
              <div className="absolute top-20 left-4 right-4 bg-green-900/90 backdrop-blur rounded-lg p-3 flex items-center gap-2">
                <Check className="w-5 h-5 text-green-400" />
                <span className="text-green-400 font-mono">{lastScannedCode}</span>
              </div>
            )}
          </>
        ) : (
          /* Permission Denied / Manual Entry View */
          <div className="flex flex-col items-center justify-center h-full p-4 bg-gray-900">
            <AlertCircle className="w-16 h-16 text-copper mb-4" />
            <h3 className="text-white text-xl mb-2">
              {permissionStatus === 'denied' ? 'Camera Access Blocked' : 'Camera Not Available'}
            </h3>
            
            {permissionStatus === 'denied' && (
              <div className="max-w-md mb-6">
                <p className="text-gray-400 text-center mb-4">
                  To use the barcode scanner, you need to grant camera permission.
                </p>
                <div className="bg-gray-800 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-2">
                    How to enable camera in {getBrowserHelp().browser}:
                  </h4>
                  <ol className="text-sm text-gray-400 space-y-1">
                    {getBrowserHelp().steps.map((step, i) => (
                      <li key={i}>
                        {i + 1}. {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
            
            {/* Alternative Options */}
            <div className="w-full max-w-md space-y-4">
              {/* Manual Entry */}
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <label className="block text-sm text-gray-400">Enter barcode manually:</label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Enter barcode number..."
                    className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-copper"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="btn-primary px-6"
                    disabled={!manualCode.trim()}
                  >
                    Submit
                  </button>
                </div>
              </form>
              
              {/* Upload Image */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  Upload barcode image
                </button>
              </div>
            </div>
            
            {/* PWA Install Hint */}
            <div className="mt-8 p-4 bg-gray-800/50 rounded-lg max-w-md">
              <p className="text-sm text-gray-400 text-center">
                <span className="text-copper font-medium">Pro tip:</span> Install this app for better permission handling and offline access
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Help Panel */}
      {showHelp && (
        <div className="absolute inset-x-0 bottom-0 bg-gray-900/95 backdrop-blur p-6 rounded-t-2xl shadow-2xl">
          <h3 className="text-white font-semibold mb-3">Scanning Tips</h3>
          <ul className="text-sm text-gray-400 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-copper">•</span>
              Hold your device steady and ensure good lighting
            </li>
            <li className="flex items-start gap-2">
              <span className="text-copper">•</span>
              Position the barcode within the guide frame
            </li>
            <li className="flex items-start gap-2">
              <span className="text-copper">•</span>
              Try the flashlight button if lighting is poor
            </li>
            <li className="flex items-start gap-2">
              <span className="text-copper">•</span>
              Clean barcodes scan better - wipe if dusty
            </li>
            <li className="flex items-start gap-2">
              <span className="text-copper">•</span>
              For damaged barcodes, use manual entry or image upload
            </li>
          </ul>
          <button
            onClick={() => setShowHelp(false)}
            className="mt-4 w-full py-2 bg-gray-800 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

// Add scan line animation (only in browser)
if (typeof window !== 'undefined' && !document.getElementById('scanner-animations')) {
  const style = document.createElement('style');
  style.id = 'scanner-animations';
  style.textContent = `
    @keyframes scan {
      0% { transform: translateY(0); }
      100% { transform: translateY(12rem); }
    }
    .animate-scan {
      animation: scan 2s ease-in-out infinite;
    }
  `;
  document.head.appendChild(style);
}