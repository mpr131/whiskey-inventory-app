'use client';

import { useState, useEffect } from 'react';
import { 
  Package, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  TrendingUp, 
  Users, 
  Copy,
  Play,
  Pause,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ImportStats {
  totalFWGS: number;
  totalMaster: number;
  fwgsImported: number;
  customBottles: number;
  duplicates: number;
  percentImported: number;
}

interface RecentImport {
  _id: string;
  name: string;
  brand: string;
  externalData: {
    importDate: string;
  };
}

export default function FWGSImportDashboard() {
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [recentImports, setRecentImports] = useState<RecentImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [batchSize, setBatchSize] = useState(100);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/fwgs-import');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setRecentImports(data.recentImports);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      toast.error('Failed to load import statistics');
    } finally {
      setLoading(false);
    }
  };

  const runBatchImport = async () => {
    setImporting(true);
    try {
      const response = await fetch('/api/admin/fwgs-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch',
          batchSize
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        toast.success(
          `Imported ${data.results.created} new, merged ${data.results.merged}, ${data.results.errors} errors`
        );
        loadStats(); // Refresh stats
      } else {
        toast.error(data.error || 'Import failed');
      }
    } catch (error) {
      console.error('Error running import:', error);
      toast.error('Failed to run import');
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const remainingToImport = stats ? stats.totalFWGS - stats.fwgsImported : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">FWGS Data Import</h2>
            <p className="text-gray-600 mt-1">
              Import and sync product data from Fine Wine & Good Spirits
            </p>
          </div>
          <button
            onClick={loadStats}
            className="p-2 text-gray-600 hover:text-gray-900"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <Package className="h-8 w-8 text-gray-400" />
                <span className="text-xs text-gray-500">Total FWGS</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {stats.totalFWGS.toLocaleString()}
              </p>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <CheckCircle className="h-8 w-8 text-green-400" />
                <span className="text-xs text-gray-500">Imported</span>
              </div>
              <p className="text-2xl font-bold text-green-700 mt-2">
                {stats.fwgsImported.toLocaleString()}
              </p>
              <p className="text-sm text-green-600">{stats.percentImported}%</p>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <Users className="h-8 w-8 text-blue-400" />
                <span className="text-xs text-gray-500">Custom</span>
              </div>
              <p className="text-2xl font-bold text-blue-700 mt-2">
                {stats.customBottles.toLocaleString()}
              </p>
            </div>

            <div className="bg-amber-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <Copy className="h-8 w-8 text-amber-400" />
                <span className="text-xs text-gray-500">Duplicates</span>
              </div>
              <p className="text-2xl font-bold text-amber-700 mt-2">
                {stats.duplicates.toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Import Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Import Controls</h3>
        
        <div className="space-y-4">
          {/* Progress Bar */}
          {stats && (
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Import Progress</span>
                <span>{remainingToImport.toLocaleString()} remaining</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-green-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${stats.percentImported}%` }}
                />
              </div>
            </div>
          )}

          {/* Batch Import */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Batch Size
              </label>
              <input
                type="number"
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                min="10"
                max="1000"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <button
              onClick={runBatchImport}
              disabled={importing || remainingToImport === 0}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {importing ? (
                <>
                  <Pause className="h-4 w-4" />
                  Importing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Import Batch
                </>
              )}
            </button>
          </div>

          {remainingToImport === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">All FWGS products have been imported!</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Imports */}
      {recentImports.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Imports</h3>
          <div className="space-y-2">
            {recentImports.map((bottle) => (
              <div key={bottle._id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-medium text-gray-900">{bottle.name}</p>
                  <p className="text-sm text-gray-600">{bottle.brand}</p>
                </div>
                <p className="text-sm text-gray-500">
                  {new Date(bottle.externalData.importDate).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Command Line Instructions */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Command Line Tools</h3>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Full Import (Dry Run)</p>
            <code className="block bg-gray-800 text-gray-100 p-3 rounded text-sm">
              npm run script scripts/import-fwgs-data.ts --dry-run
            </code>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Full Import (Live)</p>
            <code className="block bg-gray-800 text-gray-100 p-3 rounded text-sm">
              npm run script scripts/import-fwgs-data.ts
            </code>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Migrate Existing Bottles</p>
            <code className="block bg-gray-800 text-gray-100 p-3 rounded text-sm">
              npm run script scripts/migrate-existing-bottles.ts
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}