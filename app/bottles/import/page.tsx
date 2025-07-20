'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, CheckCircle, Info, Download } from 'lucide-react';
import toast from 'react-hot-toast';

interface CSVPreview {
  headers: string[];
  preview: any[];
  totalRows: number;
  analysis?: {
    suggestedMappings: Record<string, string>;
    uniqueWineCount: number;
    hasMultipleLocations: boolean;
  };
}

interface ColumnMapping {
  wine: string;
  producer: string;
  vintage: string;
  size: string;
  price: string;
  quantity: string;
  location: string;
  bin: string;
  notes: string;
  personalNotes: string;
  purchaseNote: string;
  purchaseDate: string;
  storeName: string;
  deliveryDate: string;
  barcode: string;
  wineBarcode: string;
  iWine: string;
  value: string;
  varietal: string;
  region: string;
  proof: string;
  abv: string;
  isStorePick: string;
  store: string;
  barrelNumber: string;
  warehouse: string;
  floor: string;
  pickDate: string;
}

const defaultMapping: ColumnMapping = {
  wine: '',
  producer: '',
  vintage: '',
  size: '',
  price: '',
  quantity: '',
  location: '',
  bin: '',
  notes: '',
  personalNotes: '',
  purchaseNote: '',
  purchaseDate: '',
  storeName: '',
  deliveryDate: '',
  barcode: '',
  wineBarcode: '',
  iWine: '',
  value: '',
  varietal: '',
  region: '',
  proof: '',
  abv: '',
  isStorePick: '',
  store: '',
  barrelNumber: '',
  warehouse: '',
  floor: '',
  pickDate: '',
};

const fieldLabels: Record<keyof ColumnMapping, string> = {
  wine: 'Wine Name',
  producer: 'Producer/Distillery',
  vintage: 'Vintage/Year',
  size: 'Bottle Size',
  price: 'Purchase Price',
  quantity: 'Quantity',
  location: 'Location/Area',
  bin: 'Bin/Position',
  notes: 'Tasting Notes',
  personalNotes: 'Personal Notes',
  purchaseNote: 'Purchase Notes',
  purchaseDate: 'Purchase Date',
  storeName: 'Store Name',
  deliveryDate: 'Delivery Date',
  barcode: 'Barcode',
  wineBarcode: 'Wine Barcode',
  iWine: 'CellarTracker ID',
  value: 'Market Value',
  varietal: 'Varietal/Category',
  region: 'Region',
  proof: 'Proof',
  abv: 'ABV %',
  isStorePick: 'Store Pick (Yes/No)',
  store: 'Store Pick - Store Name',
  barrelNumber: 'Barrel Number',
  warehouse: 'Warehouse/Rickhouse',
  floor: 'Floor',
  pickDate: 'Pick Date',
};

export default function ImportBottlesPage() {
  const router = useRouter();
  const [csvData, setCsvData] = useState<string>('');
  const [preview, setPreview] = useState<CSVPreview | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>(defaultMapping);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<any>(null);
  const [isCellarTracker, setIsCellarTracker] = useState(true);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.type === 'text/csv') {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        setCsvData(text);
        
        // Get preview
        try {
          const response = await fetch('/api/bottles/import', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csvData: text, isCellarTracker }),
          });
          
          if (response.ok) {
            const data = await response.json();
            setPreview(data);
            
            // Apply suggested mappings if available
            if (data.analysis?.suggestedMappings) {
              setMapping(prev => ({
                ...prev,
                ...data.analysis.suggestedMappings,
              }));
            }
          } else {
            toast.error('Failed to parse CSV file');
          }
        } catch (error) {
          toast.error('Error reading CSV file');
        }
      };
      reader.readAsText(file);
    } else {
      toast.error('Please upload a CSV file');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  });

  const handleImport = async () => {
    if (!preview || !csvData) return;

    // Validate required mappings
    if (isCellarTracker && !mapping.iWine) {
      toast.error('Please map the CellarTracker ID (iWine) field for CellarTracker imports');
      return;
    } else if (!isCellarTracker && (!mapping.wine || !mapping.producer)) {
      toast.error('Please map at least Wine Name and Producer fields');
      return;
    }

    setImporting(true);
    setImportProgress(0);

    try {
      // Parse CSV using the improved parsing function
      const lines = csvData.split('\n').filter(line => line.trim());
      const headers = parseCSVLine(lines[0]);
      
      const bottles = [];
      const batchSize = 50; // Larger batches for better performance
      
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        bottles.push(row);
        
        // Update progress
        setImportProgress(Math.round((i / lines.length) * 100));
      }
      
      // Send all bottles in one request with column mapping
      const response = await fetch('/api/bottles/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bottles,
          columnMapping: mapping,
          isCellarTracker,
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        const totalProcessed = result.results.imported + result.results.updated;
        const skipped = result.summary.totalBottles - totalProcessed;
        
        const message = `Import completed! Created ${result.results.imported} bottles, Updated ${result.results.updated}, Skipped ${skipped}`;
        toast.success(message, {
          duration: 8000, // Keep visible for 8 seconds
          style: {
            maxWidth: '600px',
          },
        });
        setImportResults({
          ...result.results,
          summary: result.summary,
          skipped: skipped,
        });
        
        // Redirect after 8 seconds to give time to see results
        setTimeout(() => {
          router.push('/bottles');
        }, 8000);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Import failed');
      }
      
    } catch (error) {
      toast.error('Import failed');
      console.error('Import error:', error);
    } finally {
      setImporting(false);
    }
  };

  const updateMapping = (field: keyof ColumnMapping, value: string) => {
    setMapping(prev => ({ ...prev, [field]: value }));
  };

  // Helper function to parse CSV line
  const parseCSVLine = (line: string): string[] => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  };

  // Function to download CSV template
  const downloadTemplate = () => {
    const headers = [
      'Wine Name',
      'Producer/Distillery',
      'Vintage/Year',
      'Bottle Size',
      'Purchase Price',
      'Quantity',
      'Location/Area',
      'Bin/Position',
      'Tasting Notes',
      'Personal Notes',
      'Purchase Notes',
      'Purchase Date',
      'Store Name',
      'Delivery Date',
      'Barcode',
      'Wine Barcode',
      'CellarTracker ID',
      'Market Value',
      'Varietal/Category',
      'Region',
      'Proof',
      'ABV %',
      'Store Pick (Yes/No)',
      'Store Pick - Store Name',
      'Barrel Number',
      'Warehouse/Rickhouse',
      'Floor',
      'Pick Date'
    ];

    const sampleData = [
      [
        'Blanton\'s Single Barrel',
        'Buffalo Trace',
        '2023',
        '750ml',
        '89.99',
        '1',
        'Cabinet A',
        'Shelf 3',
        'Rich caramel and vanilla notes with a hint of orange peel',
        'Birthday gift from John',
        'Found at local store',
        '2023-12-15',
        'ABC Fine Wine & Spirits',
        '2023-12-16',
        '123456789012',
        '987654321098',
        '',
        '125.00',
        'Bourbon',
        'Kentucky',
        '93',
        '46.5',
        'No',
        '',
        '',
        '',
        '',
        ''
      ],
      [
        'Eagle Rare 10 Year Store Pick',
        'Buffalo Trace',
        '2023',
        '750ml',
        '45.99',
        '2',
        'Cabinet B',
        'Shelf 1',
        'Oak, toffee, and hints of orange',
        'Store pick from Total Wine',
        'Limited release',
        '2023-11-20',
        'Total Wine & More',
        '2023-11-21',
        '234567890123',
        '',
        '',
        '89.99',
        'Bourbon',
        'Kentucky',
        '90',
        '45',
        'Yes',
        'Total Wine & More',
        '23-4567',
        'Warehouse H',
        '5',
        '2023-10-15'
      ],
      [
        'Weller Special Reserve',
        'Buffalo Trace',
        '2024',
        '750ml',
        '29.99',
        '1',
        'Cabinet A',
        'Shelf 2',
        'Smooth wheat notes with honey and butterscotch',
        'Daily sipper',
        'MSRP find!',
        '2024-01-05',
        'Kroger',
        '2024-01-05',
        '',
        '',
        '',
        '75.00',
        'Wheated Bourbon',
        'Kentucky',
        '90',
        '',
        'No',
        '',
        '',
        '',
        '',
        ''
      ]
    ];

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => 
        row.map(cell => 
          cell.includes(',') || cell.includes('"') || cell.includes('\n') 
            ? `"${cell.replace(/"/g, '""')}"` 
            : cell
        ).join(',')
      )
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'whiskey_vault_import_template.csv');
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Template downloaded! Check your downloads folder.');
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Import Bottles from CSV</h1>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Import Type:</label>
          <button
            type="button"
            onClick={() => setIsCellarTracker(!isCellarTracker)}
            className={`px-4 py-2 rounded-lg transition-all ${
              isCellarTracker
                ? 'bg-amber-600 text-white'
                : 'bg-gray-700 text-gray-300'
            }`}
          >
            CellarTracker Import
          </button>
        </div>
      </div>

      {!preview && (
        <div className="space-y-4">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-amber-500 bg-amber-500/10' : 'border-gray-700 hover:border-amber-500'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-16 h-16 mx-auto mb-4 text-gray-500" />
            <p className="text-lg mb-2">
              {isDragActive ? 'Drop the CSV file here' : 'Drag & drop a CSV file here'}
            </p>
            <p className="text-sm text-gray-500">or click to select a file</p>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-gray-400 mb-2">Need a template?</p>
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Download CSV Template
            </button>
          </div>
        </div>
      )}

      {preview && !importing && !importResults && (
        <div className="space-y-6">
          {/* Import Summary */}
          {preview.analysis && (
            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
              <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-400" />
                Import Analysis
              </h3>
              <div className="text-sm space-y-1">
                <p>Total rows: {preview.totalRows}</p>
                <p>Unique wines detected: {preview.analysis.uniqueWineCount}</p>
                {isCellarTracker && (
                  <p className="text-green-400">
                    ✓ Using CellarTracker ID (iWine) for grouping
                  </p>
                )}
                {preview.analysis.hasMultipleLocations && (
                  <p className="text-amber-400">
                    ⚠️ Some wines have multiple locations - separate bottles will be created for each location
                  </p>
                )}
                {isCellarTracker && (
                  <p className="text-gray-400 text-xs mt-2">
                    Quantities will be calculated by counting bottles with the same iWine + location/bin
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Column Mapping
            </h2>
            
            <p className="text-sm text-gray-400 mb-4">
              Map your CSV columns to the appropriate fields. Required fields are marked with *.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* CellarTracker ID - Required for CT imports */}
              {isCellarTracker && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    CellarTracker ID (iWine) *
                  </label>
                  <select
                    value={mapping.iWine}
                    onChange={(e) => updateMapping('iWine', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
                    required
                  >
                    <option value="">-- Select column --</option>
                    {preview.headers.map(header => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Standard required fields */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Wine Name {!isCellarTracker && '*'}
                </label>
                <select
                  value={mapping.wine}
                  onChange={(e) => updateMapping('wine', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
                  required={!isCellarTracker}
                >
                  <option value="">-- Select column --</option>
                  {preview.headers.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Producer/Distillery {!isCellarTracker && '*'}
                </label>
                <select
                  value={mapping.producer}
                  onChange={(e) => updateMapping('producer', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
                  required={!isCellarTracker}
                >
                  <option value="">-- Select column --</option>
                  {preview.headers.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>

              {/* Optional fields */}
              {Object.entries(fieldLabels).map(([field, label]) => {
                if (field === 'wine' || field === 'producer' || (field === 'iWine' && isCellarTracker)) return null;
                
                return (
                  <div key={field}>
                    <label className="block text-sm font-medium mb-1">
                      {label}
                    </label>
                    <select
                      value={mapping[field as keyof ColumnMapping]}
                      onChange={(e) => updateMapping(field as keyof ColumnMapping, e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
                    >
                      <option value="">-- Not mapped --</option>
                      {preview.headers.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preview Table */}
          <div className="bg-gray-900 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-3">Preview (First 10 rows)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    {preview.headers.map(header => {
                      const mappedField = Object.entries(mapping).find(([_, value]) => value === header)?.[0];
                      return (
                        <th key={header} className="px-2 py-2 text-left">
                          <div>{header}</div>
                          {mappedField && (
                            <div className="text-xs text-amber-400 font-normal">
                              → {fieldLabels[mappedField as keyof ColumnMapping]}
                            </div>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-800">
                      {preview.headers.map(header => (
                        <td key={header} className="px-2 py-2">
                          {row[header] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => {
                setPreview(null);
                setCsvData('');
                setMapping(defaultMapping);
              }}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!mapping.wine || !mapping.producer}
              className="px-6 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              Import {preview.totalRows} Rows
            </button>
          </div>
        </div>
      )}

      {importing && (
        <div className="bg-gray-900 rounded-lg p-8">
          <h2 className="text-xl font-semibold mb-4">Importing Bottles...</h2>
          <div className="mb-4">
            <div className="bg-gray-800 rounded-full h-4 overflow-hidden">
              <div
                className="bg-amber-600 h-full transition-all duration-300"
                style={{ width: `${importProgress}%` }}
              />
            </div>
          </div>
          <p className="text-center text-gray-400">{importProgress}% complete</p>
        </div>
      )}

      {importResults && (
        <div className="bg-gray-900 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <h2 className="text-2xl font-semibold">Import Complete!</h2>
          </div>
          
          <div className="space-y-2 text-lg">
            <p>
              <span className="text-gray-400">Unique whiskeys created:</span>{' '}
              <span className="text-amber-400 font-semibold">{importResults.masterBottlesCreated}</span>
            </p>
            <p>
              <span className="text-gray-400">Existing whiskeys found:</span>{' '}
              <span className="text-blue-400 font-semibold">{importResults.masterBottlesFound}</span>
            </p>
            <p>
              <span className="text-gray-400">New bottles imported:</span>{' '}
              <span className="text-green-400 font-semibold">{importResults.imported}</span>
            </p>
            <p>
              <span className="text-gray-400">Existing bottles updated:</span>{' '}
              <span className="text-blue-400 font-semibold">{importResults.updated}</span>
            </p>
            {importResults.skipped > 0 && (
              <p>
                <span className="text-gray-400">Bottles skipped:</span>{' '}
                <span className="text-yellow-400 font-semibold">{importResults.skipped}</span>
              </p>
            )}
            {importResults.summary && (
              <div className="text-sm text-gray-500 mt-3 pt-3 border-t border-gray-700">
                <p>{importResults.summary.uniqueWines} unique wines processed from {importResults.summary.totalBottles} total rows</p>
                {importResults.skipped > 0 && (
                  <p className="text-yellow-400 mt-1">
                    Bottles may be skipped due to: duplicate location/bin combinations, missing required fields, or import errors
                  </p>
                )}
              </div>
            )}
            {importResults.failed > 0 && (
              <p className="text-red-400 mt-2">
                {importResults.failed} bottles failed to import
              </p>
            )}
          </div>
          
          {importResults.errors?.length > 0 && (
            <div className="mt-4 p-4 bg-red-900/20 rounded">
              <h3 className="font-semibold text-red-400 mb-2">Import Errors:</h3>
              <ul className="text-sm space-y-1">
                {importResults.errors.slice(0, 5).map((error: any, idx: number) => (
                  <li key={idx}>
                    {error.bottle}: {error.error}
                  </li>
                ))}
                {importResults.errors.length > 5 && (
                  <li>... and {importResults.errors.length - 5} more errors</li>
                )}
              </ul>
            </div>
          )}
          
          <p className="text-gray-400 mt-4">Redirecting to bottles page...</p>
        </div>
      )}
    </div>
  );
}