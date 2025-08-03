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
import toast from 'react-hot-toast';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType, NotFoundException } from '@zxing/library';

// Types for camera permissions
type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'checking';

interface ZXingBarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export default function ZXingBarcodeScanner({ onScan, onClose }: ZXingBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const scanningRef = useRef(false);
  const scanAttemptsRef = useRef(0);
  
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('checking');
  const [isScanning, setIsScanning] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [currentCamera, setCurrentCamera] = useState<string>('');
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  
  // Debug state for UI display
  const [debugInfo, setDebugInfo] = useState({
    scanAttempts: 0,
    lastResult: 'None',
    scannerStatus: 'Initializing',
    lastError: '',
    fps: 0,
    lastScanTime: ''
  });
  const fpsCounterRef = useRef({ count: 0, lastTime: Date.now() });

  // Initialize ZXing reader with all barcode formats
  useEffect(() => {
    console.log('=== SCANNER INITIALIZATION DEBUG ===');
    console.log('ZXing library loaded:', !!BrowserMultiFormatReader);
    console.log('BarcodeFormat available:', !!BarcodeFormat);
    
    setDebugInfo(prev => ({ ...prev, scannerStatus: 'Loading ZXing library...' }));
    
    // Check for native BarcodeDetector API
    if ('BarcodeDetector' in window) {
      (window as any).BarcodeDetector.getSupportedFormats().then((formats: string[]) => {
        console.log('Native BarcodeDetector available! Supported formats:', formats);
        setDebugInfo(prev => ({ ...prev, scannerStatus: 'Native scanner available' }));
      }).catch((err: any) => {
        console.log('Native BarcodeDetector error:', err);
      });
    } else {
      console.log('Native BarcodeDetector NOT available');
    }
    
    const hints = new Map();
    // Enable specific barcode formats we need
    // Temporarily limiting to most common formats to debug
    const formats = [
      BarcodeFormat.CODE_128,     // DYMO/CellarTracker barcodes (PRIORITY)
      BarcodeFormat.EAN_13,       // Standard barcodes
      BarcodeFormat.UPC_A,        // US product barcodes
      BarcodeFormat.QR_CODE,      // QR codes
      // Commenting out less common formats that might cause misreading
      // BarcodeFormat.CODE_39,      // This might be causing the issue!
      // BarcodeFormat.EAN_8,
      // BarcodeFormat.UPC_E,
      // BarcodeFormat.CODABAR,
      // BarcodeFormat.ITF,
      // BarcodeFormat.CODE_93
    ];
    
    console.log('=== BARCODE FORMAT DEBUG ===');
    console.log('CODE_128 enum value:', BarcodeFormat.CODE_128);
    console.log('CODE_39 enum value:', BarcodeFormat.CODE_39);
    console.log('EAN_13 enum value:', BarcodeFormat.EAN_13);
    console.log('Enabled formats:', formats);
    
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
    // Try harder mode for difficult scans
    hints.set(DecodeHintType.TRY_HARDER, true);
    // Character set for better decoding
    hints.set(DecodeHintType.CHARACTER_SET, 'UTF-8');
    // Also try ISO-8859-1 for some barcodes
    // hints.set(DecodeHintType.CHARACTER_SET, 'ISO-8859-1');
    
    console.log('Initializing ZXing with formats:', formats.map(f => BarcodeFormat[f]));
    
    try {
      readerRef.current = new BrowserMultiFormatReader(hints);
      console.log('✅ Scanner instance created:', readerRef.current);
      console.log('Scanner methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(readerRef.current)));
      setDebugInfo(prev => ({ ...prev, scannerStatus: 'Scanner initialized' }));
    } catch (err) {
      console.error('❌ Failed to create scanner:', err);
      setDebugInfo(prev => ({ 
        ...prev, 
        scannerStatus: 'Failed to initialize', 
        lastError: (err as Error).message 
      }));
    }
    
    return () => {
      if (readerRef.current) {
        readerRef.current.reset();
      }
    };
  }, []);

  // Request camera permission
  const requestCameraPermission = useCallback(async () => {
    try {
      setIsRequestingPermission(true);
      
      if (typeof navigator === 'undefined' || !('mediaDevices' in navigator)) {
        setPermissionStatus('denied');
        return;
      }

      // Get available cameras
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(videoDevices);
      
      if (videoDevices.length === 0) {
        setPermissionStatus('denied');
        toast.error('No camera found on this device');
        return;
      }

      // Try to get camera access with better constraints
      try {
        const constraints = {
          video: {
            facingMode: { ideal: 'environment' },
            focusMode: { ideal: 'continuous' },
            width: { min: 1280, ideal: 1920, max: 1920 },
            height: { min: 720, ideal: 1080, max: 1080 },
            aspectRatio: { ideal: 16/9 }
          }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Permission granted - clean up stream
        stream.getTracks().forEach(track => track.stop());
        setPermissionStatus('granted');
        setDebugInfo(prev => ({ ...prev, scannerStatus: 'Camera permission granted' }));
        
        // Set default camera (prefer back camera)
        const backCamera = videoDevices.find(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('rear')
        );
        setCurrentCamera(backCamera?.deviceId || videoDevices[0].deviceId);
        
      } catch (err: any) {
        console.error('Camera permission error:', err);
        
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPermissionStatus('denied');
          setDebugInfo(prev => ({ 
            ...prev, 
            scannerStatus: 'Permission denied',
            lastError: 'Camera access denied' 
          }));
        } else {
          setPermissionStatus('denied');
          toast.error('Camera access failed');
          setDebugInfo(prev => ({ 
            ...prev, 
            scannerStatus: 'Camera failed',
            lastError: err.message 
          }));
        }
      }
    } catch (err) {
      console.error('Error requesting camera permission:', err);
      setPermissionStatus('denied');
    } finally {
      setIsRequestingPermission(false);
    }
  }, []);

  // Stop scanning
  const stopScanning = useCallback(() => {
    console.log('=== STOP SCANNING CALLED ===');
    console.log('readerRef.current exists:', !!readerRef.current);
    console.log('scanningRef.current:', scanningRef.current);
    
    try {
      if (readerRef.current) {
        console.log('Calling reader.reset()...');
        readerRef.current.reset();
        console.log('Reader reset complete');
      }
    } catch (err) {
      console.error('Error stopping scanner:', err);
    }
    
    scanningRef.current = false;
    setIsScanning(false);
    console.log('Scanner stopped');
    setDebugInfo(prev => ({ ...prev, scannerStatus: 'Stopped', fps: 0 }));
  }, []);

  // Start scanning
  const startScanning = useCallback(async () => {
    console.log('=== START SCANNING CALLED ===');
    console.log('readerRef.current:', !!readerRef.current);
    console.log('videoRef.current:', !!videoRef.current);
    console.log('scanningRef.current:', scanningRef.current);
    
    if (!readerRef.current || !videoRef.current || scanningRef.current) {
      console.log('Early return - missing dependencies or already scanning');
      return;
    }
    
    try {
      scanningRef.current = true;
      setIsScanning(true);
      
      console.log('Starting scan with camera:', currentCamera || 'default');
      console.log('Video element state:');
      console.log('- readyState:', videoRef.current.readyState);
      console.log('- videoWidth:', videoRef.current.videoWidth);
      console.log('- videoHeight:', videoRef.current.videoHeight);
      console.log('- srcObject:', !!videoRef.current.srcObject);
      
      setDebugInfo(prev => ({ 
        ...prev, 
        scannerStatus: 'Starting camera...',
        scanAttempts: 0
      }));
      scanAttemptsRef.current = 0;
      
      // Configure video constraints for better scanning
      const videoConstraints = {
        facingMode: { ideal: 'environment' },
        focusMode: { ideal: 'continuous' },
        width: { min: 1280, ideal: 1920 },
        height: { min: 720, ideal: 1080 }
      };
      
      console.log('About to call decodeFromVideoDevice...');
      console.log('Reader:', readerRef.current);
      console.log('Reader prototype:', Object.getPrototypeOf(readerRef.current));
      
      let callbackCount = 0;
      
      // Start continuous scanning with better error handling
      const controls = await readerRef.current.decodeFromVideoDevice(
        currentCamera || null,
        videoRef.current,
        (result, error) => {
          callbackCount++;
          scanAttemptsRef.current++;
          
          // Update FPS counter
          fpsCounterRef.current.count++;
          const now = Date.now();
          if (now - fpsCounterRef.current.lastTime > 1000) {
            const fps = Math.round(fpsCounterRef.current.count * 1000 / (now - fpsCounterRef.current.lastTime));
            setDebugInfo(prev => ({ ...prev, fps, scanAttempts: scanAttemptsRef.current }));
            fpsCounterRef.current = { count: 0, lastTime: now };
          }
          
          if (callbackCount % 30 === 1) { // Log every 30th callback to reduce noise
            console.log(`=== DECODE CALLBACK #${callbackCount} ===`);
            console.log('Result:', result);
            console.log('Error:', error);
          }
          
          if (result) {
            try {
              console.log('=== DETAILED SCAN RESULT ===');
              console.log('Result object:', result);
              console.log('Result methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(result)));
              
              // Get all possible data from the result
              const code = result.getText();
              const format = result.getBarcodeFormat();
              const formatName = BarcodeFormat[format];
              
              console.log('Format enum value:', format);
              console.log('Format name:', formatName);
              console.log('getText():', code);
              
              // Try to get raw data
              try {
                const rawBytes = result.getRawBytes();
                console.log('Raw bytes:', rawBytes);
                console.log('Raw bytes as array:', Array.from(rawBytes || []));
                console.log('Raw bytes as hex:', Array.from(rawBytes || []).map(b => b.toString(16).padStart(2, '0')).join(' '));
                console.log('Raw bytes as string:', new TextDecoder().decode(new Uint8Array(rawBytes || [])));
              } catch (e) {
                console.log('Could not get raw bytes:', e);
              }
              
              // Try other possible properties
              console.log('All result properties:', Object.keys(result));
              console.log('Result toString():', result.toString());
              
              console.log('✅ SCANNED:', code, 'Format:', formatName);
              console.log('Code length:', code?.length);
              console.log('Code as char codes:', Array.from(code || '').map(c => c.charCodeAt(0)));
              console.log('Last scanned code:', lastScannedCode);
              console.log('Codes match?', code === lastScannedCode);
              
              // Prevent duplicate scans and ensure valid code
              if (code && code.trim().length > 0) {
                // Update debug info with scan result
                setDebugInfo(prev => ({ 
                  ...prev, 
                  lastResult: `${formatName}: ${code}`,
                  lastScanTime: new Date().toLocaleTimeString(),
                  scannerStatus: 'Processing scan...'
                }));
                
                // Check if this is a new scan
                if (code !== lastScannedCode) {
                  console.log('✅ Valid new scan detected - processing...');
                  setLastScannedCode(code);
                  
                  // Play success sound/vibration
                  if ('vibrate' in navigator) {
                    console.log('Vibrating device...');
                    navigator.vibrate(200);
                  }
                  
                  console.log('Showing toast notification...');
                  toast.success(`Scanned ${format}: ${code}`);
                  
                  // Update status
                  setDebugInfo(prev => ({ ...prev, scannerStatus: 'Scan complete!' }));
                  
                  // Stop scanning immediately
                  console.log('Stopping scanner...');
                  stopScanning();
                  
                  // Call the callback with a slight delay to ensure cleanup
                  console.log('Scheduling onScan callback...');
                  setTimeout(() => {
                    console.log('Calling onScan with code:', code);
                    onScan(code);
                  }, 100);
                } else {
                  console.log('Duplicate scan ignored:', code);
                  setDebugInfo(prev => ({ 
                    ...prev, 
                    scannerStatus: 'Duplicate ignored',
                    lastResult: `${formatName}: ${code} (duplicate)`
                  }));
                }
              } else {
                console.log('Invalid code - empty or no length');
              }
            } catch (callbackError) {
              console.error('Error in decode callback:', callbackError);
            }
          }
          
          if (error) {
            if (error instanceof NotFoundException) {
              // This is normal - no barcode in view
              // Only log every 100th occurrence to reduce noise
              if (Math.random() < 0.01) {
                console.log('No barcode in view (sampled)');
              }
            } else {
              console.warn('Scan error:', error.message);
              setDebugInfo(prev => ({ 
                ...prev, 
                lastError: error.message,
                scannerStatus: 'Scan error'
              }));
            }
          }
        }
      );
      
      console.log('decodeFromVideoDevice returned:', controls);
      
      // Apply enhanced video settings if possible
      const stream = videoRef.current.srcObject as MediaStream;
      console.log('Video stream:', !!stream);
      
      if (stream) {
        const videoTrack = stream.getVideoTracks()[0];
        console.log('Video track:', !!videoTrack);
        
        if (videoTrack) {
          const capabilities = videoTrack.getCapabilities() as any;
          console.log('Camera capabilities:', capabilities);
          
          // Apply focus mode if supported
          if (capabilities.focusMode) {
            console.log('Applying continuous focus mode...');
            await videoTrack.applyConstraints({
              // @ts-ignore
              advanced: [{ focusMode: 'continuous' }]
            });
          }
        }
      }
      
      console.log('✅ Scanner started successfully');
      setDebugInfo(prev => ({ ...prev, scannerStatus: 'Scanning active' }));
      
    } catch (err) {
      console.error('❌ Failed to start scanning:', err);
      console.error('Error stack:', (err as Error).stack);
      toast.error('Failed to start camera');
      setIsScanning(false);
      scanningRef.current = false;
      setDebugInfo(prev => ({ 
        ...prev, 
        scannerStatus: 'Failed to start',
        lastError: (err as Error).message
      }));
    }
  }, [currentCamera, lastScannedCode, onScan, stopScanning]);

  // Toggle torch/flashlight
  const toggleTorch = useCallback(async () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    
    const stream = videoRef.current.srcObject as MediaStream;
    const videoTrack = stream.getVideoTracks()[0];
    
    if (!videoTrack) return;
    
    try {
      const capabilities = videoTrack.getCapabilities() as any;
      
      if (!capabilities.torch) {
        toast.error('Torch not supported on this device');
        return;
      }
      
      await videoTrack.applyConstraints({
        // @ts-ignore - torch is not in TypeScript types yet
        advanced: [{ torch: !torchEnabled }]
      });
      
      setTorchEnabled(!torchEnabled);
    } catch (err) {
      console.error('Torch toggle error:', err);
      toast.error('Failed to toggle torch');
    }
  }, [torchEnabled]);

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !readerRef.current) return;
    
    try {
      const result = await readerRef.current.decodeFromImageElement(
        await createImageElement(file)
      );
      
      if (result) {
        const code = result.getText();
        toast.success(`Scanned from image: ${code}`);
        onScan(code);
      }
    } catch (err) {
      console.error('Image scan error:', err);
      toast.error('No barcode found in image');
    }
  };

  // Helper to create image element from file
  const createImageElement = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Manual barcode entry
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      toast.success(`Entered: ${manualCode.trim()}`);
    }
  };

  // Request permission on mount
  useEffect(() => {
    requestCameraPermission();
    
    return () => {
      stopScanning();
    };
  }, [requestCameraPermission, stopScanning]);

  // Start scanning when permission granted
  useEffect(() => {
    console.log('=== PERMISSION/SCANNING EFFECT ===');
    console.log('permissionStatus:', permissionStatus);
    console.log('isScanning:', isScanning);
    console.log('videoRef.current:', !!videoRef.current);
    
    if (permissionStatus === 'granted' && !isScanning && videoRef.current) {
      console.log('Setting up timer to start scanning...');
      const timer = setTimeout(() => {
        console.log('Timer fired - calling startScanning');
        startScanning();
      }, 100);
      return () => {
        console.log('Cleaning up timer');
        clearTimeout(timer);
      };
    }
  }, [permissionStatus, startScanning, isScanning]);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30"
          >
            <X className="w-6 h-6" />
          </button>
          
          <h2 className="text-white font-semibold">Scan Barcode</h2>
          
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="p-2 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30"
          >
            <Info className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Video/Camera View */}
      <div className="relative h-full flex items-center justify-center">
        {permissionStatus === 'granted' ? (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              autoPlay
              muted
            />
            
            {/* Debug overlay */}
            <div className="absolute top-20 left-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white text-sm font-mono">
              <div className="grid grid-cols-2 gap-2">
                <div>Attempts: <span className="text-copper">{debugInfo.scanAttempts}</span></div>
                <div>FPS: <span className="text-copper">{debugInfo.fps}</span></div>
                <div className="col-span-2">Status: <span className="text-green-400">{debugInfo.scannerStatus}</span></div>
                <div className="col-span-2">Last: <span className="text-blue-400">{debugInfo.lastResult}</span></div>
                {debugInfo.lastScanTime && (
                  <div className="col-span-2">Time: <span className="text-gray-400">{debugInfo.lastScanTime}</span></div>
                )}
                {debugInfo.lastError && (
                  <div className="col-span-2 text-red-400">Error: {debugInfo.lastError}</div>
                )}
              </div>
            </div>
            
            {/* Scan overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="h-full w-full flex flex-col items-center justify-center">
                {/* Scanning tips */}
                <div className="mb-4 text-center px-4">
                  <p className="text-white text-sm bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2">
                    Hold steady • Good lighting • 6-12 inches away
                  </p>
                </div>
                
                <div className="w-64 h-64 relative">
                  {/* Corner markers */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500"></div>
                  
                  {/* Scanning line animation */}
                  <div className="absolute inset-x-0 h-0.5 bg-green-500 animate-scan"></div>
                  
                  {/* Center dot for focus */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                </div>
                
                {/* Format indicator */}
                <div className="mt-4 text-center">
                  <p className="text-green-400 text-xs bg-black/50 backdrop-blur-sm rounded px-3 py-1">
                    Scanning for QR & Barcodes...
                  </p>
                </div>
              </div>
            </div>
            
            {/* Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex justify-center gap-4">
                {/* Torch toggle */}
                <button
                  onClick={toggleTorch}
                  className="p-3 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30"
                  disabled={!isScanning}
                >
                  {torchEnabled ? <FlashlightOff className="w-6 h-6" /> : <Flashlight className="w-6 h-6" />}
                </button>
                
                {/* Camera switch (if multiple cameras) */}
                {availableCameras.length > 1 && (
                  <button
                    onClick={() => {
                      const currentIndex = availableCameras.findIndex(cam => cam.deviceId === currentCamera);
                      const nextIndex = (currentIndex + 1) % availableCameras.length;
                      setCurrentCamera(availableCameras[nextIndex].deviceId);
                      stopScanning();
                      setTimeout(() => startScanning(), 100);
                    }}
                    className="p-3 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30"
                  >
                    <RotateCcw className="w-6 h-6" />
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            {isRequestingPermission ? (
              <Loader2 className="w-12 h-12 text-white animate-spin mb-4" />
            ) : permissionStatus === 'denied' ? (
              <>
                <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Camera Access Denied</h3>
                <p className="text-gray-300 mb-4">
                  Please enable camera access in your device settings to scan barcodes.
                </p>
              </>
            ) : null}
            
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
                    disabled={!manualCode.trim()}
                    className="px-6 py-3 bg-copper text-white rounded-lg hover:bg-copper/90 disabled:opacity-50"
                  >
                    Submit
                  </button>
                </div>
              </form>
              
              {/* File Upload */}
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
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white hover:bg-gray-700"
                >
                  <Upload className="w-5 h-5" />
                  Upload Image
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Help Overlay */}
      {showHelp && (
        <div className="absolute inset-0 z-30 bg-black/90 flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Supported Barcode Types</h3>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>UPC-A/UPC-E (Product barcodes)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>EAN-13/EAN-8 (European barcodes)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Code 128 (DYMO/CellarTracker labels)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>QR Code (Modern 2D barcodes)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Code 39 (Older barcode format)</span>
              </li>
            </ul>
            <button
              onClick={() => setShowHelp(false)}
              className="mt-6 w-full px-4 py-2 bg-copper text-white rounded-lg hover:bg-copper/90"
            >
              Close
            </button>
          </div>
        </div>
      )}
      
      <style jsx>{`
        @keyframes scan {
          0% { transform: translateY(-100px); }
          50% { transform: translateY(100px); }
          100% { transform: translateY(-100px); }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}