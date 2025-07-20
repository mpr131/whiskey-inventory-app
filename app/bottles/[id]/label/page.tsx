'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft, Printer, AlertTriangle, Settings, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import QRCode from 'react-qr-code';
import { generateDymoLabelXml, generateDymoLabelXmlWithQR, DYMO_LABEL_INFO, type DymoLabelSize } from '@/lib/dymo-label-templates';

// DYMO types
declare global {
  interface Window {
    dymo: any;
  }
}

interface MasterBottle {
  _id: string;
  name: string;
  brand: string;
  distillery: string;
  region?: string;
  category: string;
  type: string;
  age?: number;
  proof?: number;
  abv?: number;
}

interface UserBottle {
  _id: string;
  userId: string;
  masterBottleId: MasterBottle;
  purchaseDate?: string;
  location?: {
    area: string;
    bin: string;
  };
  barcode?: string;
  vaultBarcode?: string;
  status: 'unopened' | 'opened' | 'finished';
  fillLevel: number;
  lastLabelPrintedAt?: string;
  t8keRating?: number;
}

type LabelFormat = 'dymo' | 'avery5160' | 'avery5163' | 'custom';

interface LabelDimensions {
  width: string;
  height: string;
  name: string;
  perSheet?: number;
}

const LABEL_FORMATS: Record<LabelFormat, LabelDimensions> = {
  dymo: { width: '2.25in', height: '1.125in', name: 'Dymo LabelWriter' },
  avery5160: { width: '2.625in', height: '1in', name: 'Avery 5160', perSheet: 30 },
  avery5163: { width: '4in', height: '2in', name: 'Avery 5163', perSheet: 10 },
  custom: { width: '3in', height: '2in', name: 'Custom' },
};

export default function BottleLabelPage() {
  console.log('=== BOTTLE LABEL SYSTEM v3.2 - PRINTER PARSING FIXED ===');
  console.log('Fixed DYMO printer object parsing - direct printing enabled');
  
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const bottleId = params.id as string;
  
  const [bottle, setBottle] = useState<UserBottle | null>(null);
  const [loading, setLoading] = useState(true);
  const [format, setFormat] = useState<LabelFormat>('dymo');
  const [customSize, setCustomSize] = useState({ width: '3in', height: '2in' });
  const [showPurchaseDate, setShowPurchaseDate] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dymoReady, setDymoReady] = useState(false);
  const [dymoPrinters, setDymoPrinters] = useState<any[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [dymoLabelSize, setDymoLabelSize] = useState<DymoLabelSize>('30336'); // Default to most common size
  const [optionalFields, setOptionalFields] = useState({
    price: false,
    store: false,
    location: true  // Default on since it's useful for inventory
  });

  // Set mounted state for client-side rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load DYMO framework from local domain (like CellarTracker)
  useEffect(() => {
    // Prevent duplicate initialization
    if ((window as any)._dymoInitialized) {
      console.log('DYMO already initialized');
      setDymoReady(true);
      checkDymoPrinters();
      return;
    }

    // Check if already loading
    if ((window as any)._dymoLoading) {
      console.log('DYMO already loading');
      return;
    }

    (window as any)._dymoLoading = true;

    const script = document.createElement('script');
    script.src = '/libs/dymo/dymo.connect.framework.js';
    script.onload = () => {
      if (window.dymo && window.dymo.label && window.dymo.label.framework) {
        console.log('DYMO framework loaded from local');
        
        // Initialize with callback
        window.dymo.label.framework.init(() => {
          console.log('DYMO framework initialized');
          (window as any)._dymoInitialized = true;
          (window as any)._dymoLoading = false;
          
          // Check environment
          const env = window.dymo.label.framework.checkEnvironment();
          console.log('DYMO Web Service available:', env);
          
          if (env.isWebServicePresent) {
            setDymoReady(true);
            // Add a delay before checking printers
            console.log('Waiting 1 second for DYMO service to be ready...');
            setTimeout(() => {
              checkDymoPrinters();
            }, 1000);
          } else {
            console.error('DYMO Web Service not running');
          }
        });
      }
    };
    script.onerror = () => {
      console.error('Failed to load DYMO framework');
      (window as any)._dymoLoading = false;
    };
    document.head.appendChild(script);
  }, []);

  // Check for DYMO printers with retry
  const checkDymoPrinters = async (retryCount = 0) => {
    try {
      console.log(`Checking for DYMO printers... (attempt ${retryCount + 1})`);
      
      // First verify the service is really ready
      const env = window.dymo.label.framework.checkEnvironment();
      console.log('Environment check:', env);
      
      if (!env.isWebServicePresent) {
        console.error('DYMO Web Service not present!');
        return;
      }
      
      // Try different methods to get printers
      console.log('Available DYMO methods:', Object.keys(window.dymo.label.framework).filter(k => k.includes('print') || k.includes('Printer')));
      
      // Method 1: getPrinters (synchronous)
      let printers = window.dymo.label.framework.getPrinters();
      console.log('getPrinters() raw response:', printers);
      console.log('getPrinters() response type:', typeof printers);
      console.log('getPrinters() response length:', printers?.length);
      
      // Method 2: Try async version
      if (window.dymo.label.framework.getPrintersAsync) {
        console.log('Trying getPrintersAsync()...');
        try {
          const asyncPrinters = await window.dymo.label.framework.getPrintersAsync();
          console.log('getPrintersAsync() response:', asyncPrinters);
          if (asyncPrinters && asyncPrinters !== printers) {
            printers = asyncPrinters;
          }
        } catch (asyncError) {
          console.error('getPrintersAsync error:', asyncError);
        }
      }
      
      // Parse the response based on its type
      if (printers) {
        const printerList: any[] = [];
        
        // The framework returns an object where each printer name is a property
        if (typeof printers === 'object' && !Array.isArray(printers)) {
          console.log('Printers is an object, parsing properties...');
          
          // Iterate through all properties
          for (const printerName in printers) {
            // Skip the byIndex property and prototype properties
            if (printerName === 'byIndex' || !printers.hasOwnProperty(printerName)) {
              continue;
            }
            
            const printerInfo = printers[printerName];
            console.log(`Found printer: ${printerName}`, printerInfo);
            
            // Extract printer details
            printerList.push({
              name: printerName,
              modelName: printerInfo.modelName || printerInfo.printerType || '',
              printerType: printerInfo.printerType || 'LabelWriterPrinter',
              isConnected: true, // If it's in the list, it's connected
              printerInfo: printerInfo // Keep the full info object
            });
          }
        } 
        // Fallback: if it's a string (XML), try parsing as XML
        else if (typeof printers === 'string') {
          console.log('Printers is a string, parsing as XML...');
          const parser = new DOMParser();
          const doc = parser.parseFromString(printers, 'text/xml');
          const labelWriters = doc.getElementsByTagName('LabelWriterPrinter');
          
          for (let i = 0; i < labelWriters.length; i++) {
            const printer = labelWriters[i];
            const name = printer.getElementsByTagName('Name')[0]?.textContent || '';
            const modelName = printer.getElementsByTagName('ModelName')[0]?.textContent || '';
            const isConnected = printer.getElementsByTagName('IsConnected')[0]?.textContent === 'True';
            
            if (name && isConnected) {
              printerList.push({ 
                name, 
                modelName, 
                printerType: 'LabelWriterPrinter',
                isConnected 
              });
            }
          }
        }
        
        console.log('Parsed DYMO printers:', printerList);
        
        if (printerList.length > 0) {
          setDymoPrinters(printerList);
          setSelectedPrinter(printerList[0].name);
          console.log('Selected printer:', printerList[0].name);
        } else {
          console.warn('No connected DYMO printers found');
          
          // Retry up to 3 times with delay
          if (retryCount < 3) {
            console.log(`No printers found, retrying in 2 seconds...`);
            setTimeout(() => {
              checkDymoPrinters(retryCount + 1);
            }, 2000);
          } else {
            console.error('Failed to find DYMO printers after 3 attempts');
            // Try to make a direct API call
            testDirectApiCall();
          }
        }
      } else {
        console.error('No printer response received');
        if (retryCount < 3) {
          setTimeout(() => checkDymoPrinters(retryCount + 1), 2000);
        }
      }
    } catch (error) {
      console.error('Error checking DYMO printers:', error);
      console.error('Error details:', error.message, error.stack);
      
      // Retry on error
      if (retryCount < 3) {
        setTimeout(() => checkDymoPrinters(retryCount + 1), 2000);
      }
    }
  };
  
  // Test direct API call to DYMO service
  const testDirectApiCall = async () => {
    console.log('Testing direct API call to DYMO service...');
    try {
      const response = await fetch('https://127.0.0.1:41951/DYMO/DLS/Printing/StatusConnected', {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      console.log('Direct API response status:', response.status);
      const text = await response.text();
      console.log('Direct API response:', text);
    } catch (error) {
      console.error('Direct API call failed:', error);
    }
  };

  const fetchBottleDetails = useCallback(async () => {
    try {
      const response = await fetch(`/api/bottles/${bottleId}`);
      if (response.ok) {
        const data = await response.json();
        setBottle(data);
      } else if (response.status === 404) {
        toast.error('Bottle not found');
        router.push('/bottles');
      } else {
        toast.error('Failed to load bottle details');
      }
    } catch (error) {
      console.error('Failed to fetch bottle details:', error);
      toast.error('Failed to load bottle details');
    } finally {
      setLoading(false);
    }
  }, [bottleId, router]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    fetchBottleDetails();
  }, [session, status, router, fetchBottleDetails]);

  const handlePrint = async () => {
    setIsPrinting(true);
    
    // Use DYMO direct printing if available and selected
    if (format === 'dymo' && dymoReady && dymoPrinters.length > 0) {
      await printDymoLabel();
    } else {
      await printLabels();
    }
  };

  // DYMO direct printing (like CellarTracker)
  const printDymoLabel = () => {
    if (!bottle || !window.dymo) return;

    console.log('Starting DYMO print...');
    console.log('Selected printer:', selectedPrinter);
    console.log('DYMO ready:', dymoReady);
    console.log('Available printers:', dymoPrinters);

    try {
      // Prepare label data with optional fields
      const labelData = {
        name: bottle.masterBottleId.name,
        distillery: bottle.masterBottleId.distillery || (bottle.masterBottleId as any).brand,
        age: bottle.masterBottleId.age,
        proof: bottle.masterBottleId.proof,
        barcode: bottle.vaultBarcode || `WV${bottle._id}`,
        rating: bottle.t8keRating,
        // Optional fields
        price: optionalFields.price ? (bottle as any).purchasePrice : undefined,
        store: optionalFields.store ? (bottle as any).purchaseStore : undefined,
        location: optionalFields.location ? bottle.location : undefined
      };
      
      // Generate properly formatted label XML using template with QR code
      const labelXml = generateDymoLabelXmlWithQR(dymoLabelSize, labelData);
      
      console.log('Generated label XML for size:', dymoLabelSize);
      console.log('Creating label from XML...');
      const label = window.dymo.label.framework.openLabelXml(labelXml);
      
      console.log('Printing directly to DYMO...');
      // Print directly without browser dialog - synchronous version
      label.print(selectedPrinter);
      
      console.log('DYMO print command sent successfully');
      
      // Update timestamp
      fetch(`/api/bottles/${bottleId}/print-label`, {
        method: 'POST',
      }).then(() => {
        console.log('Print status updated');
      });
      
      toast.success('Label sent directly to DYMO printer!');
      setIsPrinting(false);
    } catch (error) {
      console.error('DYMO print error:', error);
      toast.error('Failed to print DYMO label - falling back to browser print');
      // Fall back to browser print
      printLabels();
    }
  };
  
  // Universal label printing function
  const printLabels = async () => {
    if (!bottle) return;
    
    try {
      const printWindow = window.open('', 'PRINT', 'width=600,height=400');
      if (!printWindow) {
        toast.error('Please allow pop-ups to print labels');
        setIsPrinting(false);
        return;
      }
      
      // Get dimensions for the format
      const dimensions = getDimensions();
      const barcodeValue = bottle.vaultBarcode || `WV${bottle._id}`;
      
      // Build optimized HTML for label printing
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Whiskey Label</title>
          <style>
            @media print {
              @page {
                margin: 0;
                size: ${dimensions.width} ${dimensions.height};
              }
            }
            body { 
              margin: 0; 
              padding: 0;
              font-family: Arial, sans-serif;
            }
            .label {
              width: ${dimensions.width};
              height: ${dimensions.height};
              padding: ${format === 'dymo' ? '0.05in' : '0.1in'};
              box-sizing: border-box;
              display: flex;
              align-items: center;
              gap: 0.1in;
              page-break-after: always;
            }
            .content {
              flex: 1;
            }
            .name {
              font-size: ${format === 'dymo' ? '10pt' : '12pt'};
              font-weight: bold;
              margin-bottom: 2px;
              line-height: 1.1;
            }
            .distillery {
              font-size: ${format === 'dymo' ? '8pt' : '10pt'};
              color: #333;
              margin-bottom: 2px;
            }
            .details {
              font-size: ${format === 'dymo' ? '8pt' : '9pt'};
              line-height: 1.2;
            }
            .qr {
              width: ${format === 'dymo' ? '0.9in' : '1in'};
              height: ${format === 'dymo' ? '0.9in' : '1in'};
            }
            .barcode {
              font-size: 7pt;
              font-family: monospace;
              text-align: center;
              margin-top: 2px;
            }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="content">
              <div class="name">${bottle.masterBottleId.name}</div>
              <div class="distillery">${bottle.masterBottleId.distillery}</div>
              <div class="details">
                ${bottle.masterBottleId.proof ? `${bottle.masterBottleId.proof}° proof<br>` : ''}
                ${bottle.location ? `${bottle.location.area}${bottle.location.bin ? `-${bottle.location.bin}` : ''}<br>` : ''}
                ${bottle.t8keRating ? `t8ke: ${bottle.t8keRating}/10<br>` : ''}
                ${showPurchaseDate && bottle.purchaseDate ? `${formatDate(bottle.purchaseDate)}` : ''}
              </div>
            </div>
            <div>
              <canvas class="qr" id="qr-code"></canvas>
              <div class="barcode">${barcodeValue}</div>
            </div>
          </div>
        </body>
        <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
        <script>
          QRCode.toCanvas(
            document.getElementById('qr-code'), 
            '${barcodeValue}',
            { width: ${format === 'dymo' ? 90 : 100}, margin: 0 },
            function (error) {
              if (error) console.error(error);
              // Print after QR code is generated
              setTimeout(() => {
                window.print();
                setTimeout(() => window.close(), 1000);
              }, 100);
            }
          );
        </script>
        </html>
      `);
      
      printWindow.document.close();
      
      // Update timestamp after print dialog
      setTimeout(async () => {
        try {
          await fetch(`/api/bottles/${bottleId}/print-label`, {
            method: 'POST',
          });
          toast.success(format === 'dymo' 
            ? 'Label sent to print - select your DYMO printer from the dialog' 
            : 'Label printed successfully');
        } catch (error) {
          console.error('Failed to update print status:', error);
        }
        setIsPrinting(false);
      }, 2000);
      
    } catch (error) {
      console.error('Print error:', error);
      toast.error('Failed to print label');
      setIsPrinting(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  };

  const getDimensions = () => {
    if (format === 'custom') {
      return customSize;
    }
    if (format === 'dymo' && dymoLabelSize) {
      const info = DYMO_LABEL_INFO[dymoLabelSize];
      return {
        width: `${info.width / 1440}in`,
        height: `${info.height / 1440}in`,
        name: info.name
      };
    }
    return LABEL_FORMATS[format];
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!session || !bottle) {
    return null;
  }

  const hasCellarTrackerLabel = !!bottle.barcode;
  const dimensions = getDimensions();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link 
              href={`/bottles/${bottleId}`}
              className="flex items-center space-x-2 text-gray-400 hover:text-copper transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Bottle</span>
            </Link>
          </div>
          
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex items-center space-x-2 px-4 py-2 bg-copper/20 hover:bg-copper/30 text-copper rounded-lg transition-colors disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>{isPrinting ? 'Printing...' : 'Print Label'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Settings Panel */}
          <div className="card-premium">
            <div className="flex items-center space-x-2 mb-4">
              <Settings className="w-5 h-5 text-copper" />
              <h2 className="text-xl font-semibold text-white">Label Settings</h2>
            </div>
            
            {hasCellarTrackerLabel && (
              <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  <p className="text-yellow-500">This bottle already has a CellarTracker label</p>
                </div>
              </div>
            )}

            {bottle.lastLabelPrintedAt && (
              <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-blue-400 text-sm">
                  Last printed: {formatDate(bottle.lastLabelPrintedAt)}
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Label Format
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as LabelFormat)}
                  className="w-full bg-white/5 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-copper focus:outline-none"
                >
                  {Object.entries(LABEL_FORMATS).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value.name}
                      {value.perSheet && ` (${value.perSheet} per sheet)`}
                    </option>
                  ))}
                </select>
              </div>

              {format === 'dymo' && (
                <div className="space-y-4">
                  {dymoReady && dymoPrinters.length > 0 ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          DYMO Printer
                        </label>
                        <select
                          value={selectedPrinter}
                          onChange={(e) => setSelectedPrinter(e.target.value)}
                          className="w-full bg-white/5 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-copper focus:outline-none"
                        >
                          {dymoPrinters.map((printer: any) => (
                            <option key={printer.name} value={printer.name}>
                              {printer.name} {printer.modelName && `(${printer.modelName})`}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-green-400 mt-1">✓ DYMO printer connected - direct printing enabled</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Label Size
                        </label>
                        <select
                          value={dymoLabelSize}
                          onChange={(e) => setDymoLabelSize(e.target.value as DymoLabelSize)}
                          className="w-full bg-white/5 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-copper focus:outline-none"
                        >
                          {Object.entries(DYMO_LABEL_INFO).map(([key, value]) => (
                            <option key={key} value={key}>
                              {value.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Optional Label Fields
                        </label>
                        <div className="space-y-2">
                          <label className="flex items-center space-x-2">
                            <input 
                              type="checkbox" 
                              checked={optionalFields.price} 
                              onChange={(e) => setOptionalFields({...optionalFields, price: e.target.checked})}
                              className="rounded border-gray-600 bg-white/5 text-copper focus:ring-copper"
                            />
                            <span className="text-sm text-gray-300">Purchase Price</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input 
                              type="checkbox" 
                              checked={optionalFields.store} 
                              onChange={(e) => setOptionalFields({...optionalFields, store: e.target.checked})}
                              className="rounded border-gray-600 bg-white/5 text-copper focus:ring-copper"
                            />
                            <span className="text-sm text-gray-300">Store Name</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input 
                              type="checkbox" 
                              checked={optionalFields.location} 
                              onChange={(e) => setOptionalFields({...optionalFields, location: e.target.checked})}
                              className="rounded border-gray-600 bg-white/5 text-copper focus:ring-copper"
                            />
                            <span className="text-sm text-gray-300">Storage Location</span>
                          </label>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Note: More fields = smaller text size</p>
                      </div>
                    </>
                  ) : (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <Info className="w-4 h-4 text-blue-400 mt-0.5" />
                        <div className="text-sm">
                          <p className="text-blue-400">DYMO Connect not detected</p>
                          <p className="text-blue-400/80 text-xs mt-1">
                            Install DYMO Connect for direct printing, or use browser print dialog
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {format === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Width
                    </label>
                    <input
                      type="text"
                      value={customSize.width}
                      onChange={(e) => setCustomSize({ ...customSize, width: e.target.value })}
                      className="w-full bg-white/5 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-copper focus:outline-none"
                      placeholder="3in"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Height
                    </label>
                    <input
                      type="text"
                      value={customSize.height}
                      onChange={(e) => setCustomSize({ ...customSize, height: e.target.value })}
                      className="w-full bg-white/5 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-copper focus:outline-none"
                      placeholder="2in"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPurchaseDate}
                    onChange={(e) => setShowPurchaseDate(e.target.checked)}
                    className="rounded border-gray-600 bg-white/5 text-copper focus:ring-copper"
                  />
                  <span className="text-gray-300">Include purchase date</span>
                </label>
              </div>
            </div>
          </div>

          {/* Label Preview */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Label Preview</h2>
            
            <div 
              className="bg-white text-black p-4 rounded-lg"
              style={{
                width: dimensions.width,
                height: dimensions.height,
                maxWidth: '100%',
              }}
            >
              <div className="h-full flex items-center justify-between p-2 border-2 border-gray-800">
                <div className="flex-1 pr-2">
                  <div className="font-bold text-sm leading-tight mb-1">
                    {bottle.masterBottleId.name}
                  </div>
                  <div className="text-xs text-gray-700 mb-1">
                    {bottle.masterBottleId.distillery}
                  </div>
                  <div className="text-xs space-y-0.5">
                    {bottle.masterBottleId.proof && (
                      <div>Proof: {bottle.masterBottleId.proof}°</div>
                    )}
                    {bottle.location && (
                      <div className="font-medium">
                        {bottle.location.area}
                        {bottle.location.bin && ` - ${bottle.location.bin}`}
                      </div>
                    )}
                    {bottle.t8keRating && (
                      <div>t8ke: {bottle.t8keRating}/10</div>
                    )}
                    {showPurchaseDate && bottle.purchaseDate && (
                      <div>{formatDate(bottle.purchaseDate)}</div>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col items-center justify-center">
                  <div className="bg-white p-1 qr-code-container">
                    {mounted && (
                      <QRCode
                        value={bottle.vaultBarcode || `WV${bottle._id}`}
                        size={60}
                        level="M"
                      />
                    )}
                  </div>
                  <div className="text-[10px] font-mono mt-1">
                    {bottle.vaultBarcode || `WV${bottle._id.slice(-8)}`}
                  </div>
                </div>
              </div>
            </div>

            {/* Additional info for sheet labels */}
            {format !== 'dymo' && format !== 'custom' && (
              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-blue-400 text-sm">
                  {LABEL_FORMATS[format].name} sheets have {LABEL_FORMATS[format].perSheet} labels per sheet.
                  Use the batch printing feature to optimize sheet usage.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      
    </div>
  );
}