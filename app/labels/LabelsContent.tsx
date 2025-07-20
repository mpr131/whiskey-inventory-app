'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { usePrintQueue } from '@/contexts/PrintQueueContext';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Printer, 
  CheckSquare, 
  Square, 
  Calendar,
  Filter,
  Settings,
  Package,
  AlertCircle,
  Info
} from 'lucide-react';
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
  proof?: number;
}

interface UserBottle {
  _id: string;
  masterBottleId: MasterBottle;
  location?: {
    area: string;
    bin: string;
  };
  barcode?: string;
  vaultBarcode?: string;
  lastLabelPrintedAt?: string;
  createdAt: string;
  t8keRating?: number;
}

type FilterType = 'new' | 'never' | 'missing' | 'dateRange' | 'all';
type LabelFormat = 'dymo' | 'avery5160' | 'avery5163' | 'custom';

interface LabelDimensions {
  width: string;
  height: string;
  name: string;
  perSheet?: number;
  columns?: number;
  rows?: number;
}

const LABEL_FORMATS: Record<LabelFormat, LabelDimensions> = {
  dymo: { width: '2.25in', height: '1.125in', name: 'Dymo LabelWriter' },
  avery5160: { 
    width: '2.625in', 
    height: '1in', 
    name: 'Avery 5160', 
    perSheet: 30,
    columns: 3,
    rows: 10
  },
  avery5163: { 
    width: '4in', 
    height: '2in', 
    name: 'Avery 5163', 
    perSheet: 10,
    columns: 2,
    rows: 5
  },
  custom: { width: '3in', height: '2in', name: 'Custom' },
};

export default function LabelsContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { queue, clearQueue } = usePrintQueue();
  
  const [bottles, setBottles] = useState<UserBottle[]>([]);
  const [selectedBottles, setSelectedBottles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('new');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [lastPrintSessionDate, setLastPrintSessionDate] = useState<string | null>(null);
  const [format, setFormat] = useState<LabelFormat>('dymo');
  const [customSize, setCustomSize] = useState({ width: '3in', height: '2in' });
  const [showSettings, setShowSettings] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isQueueMode, setIsQueueMode] = useState(false);
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

  const fetchBottles = useCallback(async () => {
    try {
      const params = new URLSearchParams({ filter });
      if (filter === 'dateRange' && dateRange.start && dateRange.end) {
        params.append('startDate', dateRange.start);
        params.append('endDate', dateRange.end);
      }

      const response = await fetch(`/api/labels/bottles?${params}`);
      if (response.ok) {
        const data = await response.json();
        setBottles(data.bottles);
        setLastPrintSessionDate(data.lastPrintSessionDate);
        
        // Auto-select all bottles for 'new' filter
        if (filter === 'new') {
          setSelectedBottles(new Set(data.bottles.map((b: UserBottle) => b._id)));
        }
      } else {
        toast.error('Failed to load bottles');
      }
    } catch (error) {
      console.error('Failed to fetch bottles:', error);
      toast.error('Failed to load bottles');
    } finally {
      setLoading(false);
    }
  }, [filter, dateRange]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    // Check if we're in queue mode
    const queueParam = searchParams.get('queue');
    if (queueParam === 'true' && queue.length > 0) {
      setIsQueueMode(true);
      // Convert queue items to UserBottle format
      const queueBottles = queue.map(item => ({
        _id: item._id,
        masterBottleId: {
          _id: '',
          name: item.name,
          brand: '',
          distillery: item.distillery,
          proof: undefined
        },
        vaultBarcode: item.vaultBarcode,
        createdAt: new Date().toISOString()
      } as UserBottle));
      setBottles(queueBottles);
      setSelectedBottles(new Set(queue.map(item => item._id)));
      setLoading(false);
    } else {
      setIsQueueMode(false);
      fetchBottles();
    }
  }, [session, status, router, filter, dateRange, searchParams, queue, fetchBottles]);

  const handleSelectAll = () => {
    if (selectedBottles.size === bottles.length) {
      setSelectedBottles(new Set());
    } else {
      setSelectedBottles(new Set(bottles.map(b => b._id)));
    }
  };

  const handleSelectBottle = (bottleId: string) => {
    const newSelected = new Set(selectedBottles);
    if (newSelected.has(bottleId)) {
      newSelected.delete(bottleId);
    } else {
      newSelected.add(bottleId);
    }
    setSelectedBottles(newSelected);
  };

  const handlePrint = async () => {
    if (selectedBottles.size === 0) {
      toast.error('Please select bottles to print');
      return;
    }

    setIsPrinting(true);
    
    // Use DYMO direct printing if available and selected
    if (format === 'dymo' && dymoReady && dymoPrinters.length > 0) {
      await printDymoLabels();
    } else {
      await printLabels();
    }
  };

  // DYMO direct batch printing (like CellarTracker)
  const printDymoLabels = async () => {
    if (!window.dymo) return;

    console.log('Starting DYMO batch print...');
    console.log('Selected printer:', selectedPrinter);
    console.log('DYMO ready:', dymoReady);
    console.log('Available printers:', dymoPrinters);

    try {
      let successCount = 0;
      const selectedBottleArray = Array.from(selectedBottles);
      
      for (const bottleId of selectedBottleArray) {
        const bottle = bottles.find(b => b._id === bottleId);
        if (!bottle) continue;
        
        // Create label XML for each bottle
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

        // Print each label
        await window.dymo.label.framework.printLabel(
          selectedPrinter,
          null,
          labelXml,
          ''
        );
        
        successCount++;
      }
      
      // Update print status
      await updatePrintStatus();
      
      toast.success(`${successCount} labels printed to DYMO printer!`);
      setIsPrinting(false);
    } catch (error) {
      console.error('DYMO print error:', error);
      toast.error('Failed to print DYMO labels');
      setIsPrinting(false);
    }
  };
  
  // Universal batch label printing
  const printLabels = async () => {
    try {
      const printWindow = window.open('', 'PRINT', 'width=800,height=600');
      if (!printWindow) {
        toast.error('Please allow pop-ups to print labels');
        setIsPrinting(false);
        return;
      }
      
      // Get dimensions for the format
      const dimensions = getDimensions();
      
      // Generate labels data
      const selectedBottleArray = Array.from(selectedBottles);
      const labelsData = selectedBottleArray.map(bottleId => {
        const bottle = bottles.find(b => b._id === bottleId);
        if (!bottle) return null;
        return {
          id: bottle._id,
          name: bottle.masterBottleId.name,
          distillery: bottle.masterBottleId.distillery,
          proof: bottle.masterBottleId.proof,
          location: bottle.location,
          rating: bottle.t8keRating,
          barcode: bottle.vaultBarcode || `WV${bottle._id}`
        };
      }).filter(Boolean) as Array<{
        id: string;
        name: string;
        distillery: string;
        proof?: number;
        location?: { area: string; bin: string };
        rating?: number;
        barcode: string;
      }>;
      
      // Create print document with optimized layout
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Whiskey Labels</title>
          <style>
            @media print {
              @page {
                margin: 0;
                size: ${format === 'dymo' ? '2.25in 1.125in' : 
                        format.startsWith('avery') ? '8.5in 11in' : 
                        dimensions.width + ' ' + dimensions.height};
              }
            }
            body { 
              margin: 0; 
              padding: ${format.startsWith('avery') ? '0.5in 0.1875in' : '0'};
              font-family: Arial, sans-serif;
            }
            .labels-container {
              ${format.startsWith('avery') ? `
                display: grid;
                grid-template-columns: repeat(${dimensions.columns}, ${dimensions.width});
                grid-template-rows: repeat(${dimensions.rows}, ${dimensions.height});
                gap: 0;
              ` : ''}
            }
            .label {
              width: ${dimensions.width};
              height: ${dimensions.height};
              padding: ${format === 'dymo' ? '0.05in' : '0.1in'};
              box-sizing: border-box;
              display: flex;
              align-items: center;
              gap: 0.1in;
              page-break-after: ${format === 'dymo' ? 'always' : 'auto'};
              page-break-inside: avoid;
              ${format !== 'dymo' ? 'border: 1px solid #ddd;' : ''}
            }
            .label:last-child {
              page-break-after: auto;
            }
            .content {
              flex: 1;
            }
            .name {
              font-size: ${format === 'dymo' ? '10pt' : '11pt'};
              font-weight: bold;
              margin-bottom: 2px;
              line-height: 1.1;
            }
            .distillery {
              font-size: ${format === 'dymo' ? '8pt' : '9pt'};
              color: #333;
              margin-bottom: 2px;
            }
            .details {
              font-size: ${format === 'dymo' ? '8pt' : '9pt'};
              line-height: 1.2;
            }
            .qr-container {
              display: flex;
              flex-direction: column;
              align-items: center;
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
          <div class="labels-container">
            ${labelsData.map((bottle, index) => `
              <div class="label">
                <div class="content">
                  <div class="name">${bottle.name}</div>
                  <div class="distillery">${bottle.distillery}</div>
                  <div class="details">
                    ${bottle.proof ? `${bottle.proof}° proof<br>` : ''}
                    ${bottle.location ? `${bottle.location.area}${bottle.location.bin ? `-${bottle.location.bin}` : ''}<br>` : ''}
                    ${bottle.rating ? `t8ke: ${bottle.rating}/10` : ''}
                  </div>
                </div>
                <div class="qr-container">
                  <canvas class="qr" id="qr-${index}"></canvas>
                  <div class="barcode">${bottle.barcode}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </body>
        <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
        <script>
          const bottles = ${JSON.stringify(labelsData)};
          let completed = 0;
          
          bottles.forEach((bottle, index) => {
            QRCode.toCanvas(
              document.getElementById('qr-' + index), 
              bottle.barcode,
              { width: ${format === 'dymo' ? 90 : 100}, margin: 0 },
              function (error) {
                if (error) console.error(error);
                completed++;
                if (completed === bottles.length) {
                  // All QR codes generated, now print
                  setTimeout(() => {
                    window.print();
                    setTimeout(() => window.close(), 1000);
                  }, 100);
                }
              }
            );
          });
        </script>
        </html>
      `);
      
      printWindow.document.close();
      
      // Update print status after print dialog
      setTimeout(async () => {
        await updatePrintStatus();
        toast.success(format === 'dymo' 
          ? 'Labels sent to print - select your DYMO printer from the dialog' 
          : `${labelsData.length} labels printed successfully`);
        setIsPrinting(false);
      }, 2000);
      
    } catch (error) {
      console.error('Print error:', error);
      toast.error('Failed to print labels');
      setIsPrinting(false);
    }
  };
  
  const updatePrintStatus = async () => {
    try {
      await fetch('/api/labels/bottles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bottleIds: Array.from(selectedBottles) }),
      });
      
      // Refresh bottles list if not in queue mode
      if (!isQueueMode) {
        fetchBottles();
      }
    } catch (error) {
      console.error('Failed to update print status:', error);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  };

  const getDimensions = () => {
    if (format === 'custom') {
      return { ...customSize, name: 'Custom' };
    }
    return LABEL_FORMATS[format];
  };

  const getFilterDescription = () => {
    switch (filter) {
      case 'new':
        return lastPrintSessionDate 
          ? `Bottles added since ${formatDate(lastPrintSessionDate)}`
          : 'All bottles (no previous print session)';
      case 'never':
        return 'Bottles that have never been printed';
      case 'missing':
        return 'Bottles without any labels';
      case 'dateRange':
        return dateRange.start && dateRange.end
          ? `Bottles from ${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}`
          : 'Select date range';
      case 'all':
        return 'All bottles';
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const dimensions = getDimensions();
  const selectedCount = selectedBottles.size;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link 
              href="/bottles"
              className="flex items-center space-x-2 text-gray-400 hover:text-copper transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Bottles</span>
            </Link>
            <h1 className="text-2xl font-bold text-white">Batch Label Printing</h1>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center space-x-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
            
            <button
              onClick={handlePrint}
              disabled={isPrinting || selectedCount === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-copper/20 hover:bg-copper/30 text-copper rounded-lg transition-colors disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>
                {isPrinting ? 'Printing...' : `Print ${selectedCount} Label${selectedCount !== 1 ? 's' : ''}`}
              </span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="card-premium mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-copper" />
              <h2 className="text-lg font-semibold text-white">Filter Bottles</h2>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <Package className="w-4 h-4" />
              <span>{bottles.length} bottles need labels</span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {(['new', 'never', 'missing', 'dateRange', 'all'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  filter === f 
                    ? 'bg-copper/20 text-copper border border-copper/40' 
                    : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                {f === 'new' && 'New Since Last Print'}
                {f === 'never' && 'Never Printed'}
                {f === 'missing' && 'Missing Labels'}
                {f === 'dateRange' && 'Date Range'}
                {f === 'all' && 'All Bottles'}
              </button>
            ))}
          </div>
          
          {filter === 'dateRange' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Start Date</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="w-full bg-white/5 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-copper focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">End Date</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="w-full bg-white/5 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-copper focus:outline-none"
                />
              </div>
            </div>
          )}
          
          <p className="text-sm text-gray-400 mt-2">{getFilterDescription()}</p>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="card-premium mb-6">
            <div className="flex items-center space-x-2 mb-4">
              <Settings className="w-5 h-5 text-copper" />
              <h2 className="text-lg font-semibold text-white">Label Settings</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <>
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
                </>
              )}
            </div>

            {dimensions.perSheet && (
              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="text-blue-400 text-sm">
                      {dimensions.name} sheets have {dimensions.perSheet} labels per sheet.
                    </p>
                    <p className="text-blue-400/80 text-sm">
                      Selected: {selectedCount} labels = {Math.ceil(selectedCount / dimensions.perSheet)} sheet{Math.ceil(selectedCount / dimensions.perSheet) !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottle Selection */}
        <div className="card-premium mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Select Bottles</h2>
            <button
              onClick={handleSelectAll}
              className="flex items-center space-x-2 text-sm text-copper hover:text-copper/80 transition-colors"
            >
              {selectedBottles.size === bottles.length ? (
                <>
                  <CheckSquare className="w-4 h-4" />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4" />
                  <span>Select All</span>
                </>
              )}
            </button>
          </div>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {bottles.map((bottle) => (
              <div
                key={bottle._id}
                onClick={() => handleSelectBottle(bottle._id)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedBottles.has(bottle._id)
                    ? 'bg-copper/10 border-copper/40'
                    : 'bg-white/5 border-gray-700 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-copper">
                      {selectedBottles.has(bottle._id) ? (
                        <CheckSquare className="w-5 h-5" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-white">{bottle.masterBottleId.name}</div>
                      <div className="text-sm text-gray-400">
                        {bottle.masterBottleId.distillery}
                        {bottle.location && ` • ${bottle.location.area}${bottle.location.bin ? `-${bottle.location.bin}` : ''}`}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {bottle.vaultBarcode || `WV${bottle._id.slice(-8)}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}