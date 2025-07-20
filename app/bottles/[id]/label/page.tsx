'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft, Printer, AlertTriangle, Settings, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import QRCode from 'react-qr-code';

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

  // Set mounted state for client-side rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load DYMO framework from local domain (like CellarTracker)
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '/libs/dymo/dymo.connect.framework.js';
    script.onload = async () => {
      if (window.dymo && window.dymo.label && window.dymo.label.framework) {
        console.log('DYMO framework loaded from local');
        try {
          // Initialize the framework
          await window.dymo.label.framework.init();
          console.log('DYMO framework initialized');
          
          // Check if DYMO Web Service is running
          const isServiceAvailable = await window.dymo.label.framework.checkEnvironment();
          console.log('DYMO Web Service available:', isServiceAvailable);
          
          if (isServiceAvailable.isWebServicePresent) {
            setDymoReady(true);
            checkDymoPrinters();
          } else {
            console.error('DYMO Web Service not running');
          }
        } catch (error) {
          console.error('Failed to initialize DYMO:', error);
        }
      }
    };
    script.onerror = () => {
      console.error('Failed to load DYMO framework');
    };
    document.head.appendChild(script);
  }, []);

  // Check for DYMO printers
  const checkDymoPrinters = async () => {
    try {
      console.log('Checking for DYMO printers...');
      const printers = await window.dymo.label.framework.getPrinters();
      console.log('DYMO printers found:', printers);
      
      // Parse the XML response if it's a string
      let printerList = [];
      if (typeof printers === 'string') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(printers, 'text/xml');
        const printerNodes = doc.getElementsByTagName('LabelWriterPrinter');
        
        for (let i = 0; i < printerNodes.length; i++) {
          const name = printerNodes[i].getElementsByTagName('Name')[0]?.textContent || '';
          const modelName = printerNodes[i].getElementsByTagName('ModelName')[0]?.textContent || '';
          printerList.push({ name, modelName, printerType: 'LabelWriterPrinter' });
        }
      } else if (Array.isArray(printers)) {
        printerList = printers.filter((p: any) => 
          p.printerType === 'LabelWriterPrinter'
        );
      }
      
      console.log('Parsed DYMO printers:', printerList);
      setDymoPrinters(printerList);
      if (printerList.length > 0) {
        setSelectedPrinter(printerList[0].name);
        console.log('Selected printer:', printerList[0].name);
      }
    } catch (error) {
      console.error('Error checking DYMO printers:', error);
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
  const printDymoLabel = async () => {
    if (!bottle || !window.dymo) return;

    console.log('Starting DYMO print...');
    console.log('Selected printer:', selectedPrinter);
    console.log('DYMO ready:', dymoReady);
    console.log('Available printers:', dymoPrinters);

    try {
      // Create label XML
      const labelXml = `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips">
  <PaperOrientation>Landscape</PaperOrientation>
  <Id>30252 Address</Id>
  <IsOutlined>false</IsOutlined>
  <ObjectInfo>
    <TextObject>
      <Name>Text</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0"></ForeColor>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"></BackColor>
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <GroupID>-1</GroupID>
      <IsOutlined>False</IsOutlined>
      <HorizontalAlignment>Left</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String xml:space="preserve">${bottle.masterBottleId.name}
${bottle.masterBottleId.distillery}
${bottle.masterBottleId.proof ? bottle.masterBottleId.proof + '° proof' : ''}
${bottle.location ? bottle.location.area + (bottle.location.bin ? '-' + bottle.location.bin : '') : ''}
${bottle.vaultBarcode || 'WV' + bottle._id}</String>
          <Attributes>
            <Font Family="Arial" Size="12" Bold="False" Italic="False" Underline="False" Strikeout="False"></Font>
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0"></ForeColor>
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
  </ObjectInfo>
  <Bounds X="330" Y="150" Width="4455" Height="1260"></Bounds>
</DieCutLabel>`;

      console.log('Printing with DYMO framework...');
      // Print directly without browser dialog
      await window.dymo.label.framework.printLabel(
        selectedPrinter,
        null,
        labelXml,
        ''
      );
      console.log('DYMO print command sent successfully');
      
      // Update timestamp
      await fetch(`/api/bottles/${bottleId}/print-label`, {
        method: 'POST',
      });
      
      toast.success('Label printed to DYMO printer!');
      setIsPrinting(false);
    } catch (error) {
      console.error('DYMO print error:', error);
      toast.error('Failed to print DYMO label');
      setIsPrinting(false);
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
                <div>
                  {dymoReady && dymoPrinters.length > 0 ? (
                    <>
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
                            {printer.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-green-400 mt-1">✓ DYMO printer connected - direct printing enabled</p>
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