'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ScanLine } from 'lucide-react';
import dynamicImport from 'next/dynamic';
import MasterBottleSearch from '@/components/MasterBottleSearch';
import TopNav from '@/components/TopNav';
import TestNotifications from '@/components/TestNotifications';

const BarcodeScanner = dynamicImport(() => import('@/components/EnhancedBarcodeScanner'), {
  ssr: false,
});

interface DashboardStats {
  totalBottles: number;
  totalValue: number;
  openBottles: number;
  uniqueBottles: number;
  locations: number;
  lowStockBottles: number;
}

interface RecentBottle {
  _id: string;
  name: string;
  distillery: string;
  quantity: number;
  status: string;
  fillLevel: number;
  createdAt: string;
}

interface TopValuedBottle {
  _id: string;
  name: string;
  distillery: string;
  quantity: number;
  totalValue: number;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalBottles: 0,
    totalValue: 0,
    openBottles: 0,
    uniqueBottles: 0,
    locations: 0,
    lowStockBottles: 0,
  });
  const [recentBottles, setRecentBottles] = useState<RecentBottle[]>([]);
  const [topValuedBottles, setTopValuedBottles] = useState<TopValuedBottle[]>([]);
  const [lowStockBottles, setLowStockBottles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    fetchDashboardStats();
  }, [session, status, router]);

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch('/api/dashboard/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setRecentBottles(data.recentBottles || []);
        setTopValuedBottles(data.topValuedBottles || []);
        setLowStockBottles(data.lowStockBottles || []);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleBarcodeScan = (barcode: string) => {
    setShowScanner(false);
    router.push(`/bottles?barcode=${encodeURIComponent(barcode)}`);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <TopNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-24 md:pb-12">
        {/* Search Section */}
        <div className="mb-12">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <MasterBottleSearch 
                placeholder="Search your collection..."
                className="w-full"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="btn-secondary px-6 py-3 text-lg font-medium flex items-center space-x-2"
            >
              <ScanLine className="w-5 h-5" />
              <span>Scan</span>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Link href="/bottles" className="card-premium hover:border-copper/50 hover:bg-gray-800/50 transition-all duration-300 cursor-pointer group">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-300 group-hover:text-copper transition-colors">Total Bottles</h3>
              <svg className="w-8 h-8 text-copper group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-white group-hover:text-copper transition-colors">{stats.totalBottles.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-2 group-hover:text-gray-400 transition-colors">In your collection</p>
          </Link>

          <Link href="/bottles?sort=-value" className="card-premium hover:border-copper/50 hover:bg-gray-800/50 transition-all duration-300 cursor-pointer group">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-300 group-hover:text-copper transition-colors">Total Value</h3>
              <svg className="w-8 h-8 text-copper group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-white group-hover:text-copper transition-colors">${stats.totalValue.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-2 group-hover:text-gray-400 transition-colors">Current estimate</p>
          </Link>

          <Link href="/bottles?status=opened" className="card-premium hover:border-copper/50 hover:bg-gray-800/50 transition-all duration-300 cursor-pointer group">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-300 group-hover:text-copper transition-colors">Open Bottles</h3>
              <svg className="w-8 h-8 text-copper group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-white group-hover:text-copper transition-colors">{stats.openBottles.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-2 group-hover:text-gray-400 transition-colors">Currently sampling</p>
          </Link>

          <Link href="/locations" className="card-premium hover:border-copper/50 hover:bg-gray-800/50 transition-all duration-300 cursor-pointer group">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-300 group-hover:text-copper transition-colors">Locations</h3>
              <svg className="w-8 h-8 text-copper group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-white group-hover:text-copper transition-colors">{stats.locations.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-2 group-hover:text-gray-400 transition-colors">Storage areas</p>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          <Link href="/bottles/add" className="card-premium hover:border-copper/50 transition-all duration-300 group">
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <svg className="w-12 h-12 text-copper mx-auto mb-3 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <p className="text-lg font-semibold text-white">Add New Bottle</p>
              </div>
            </div>
          </Link>

          <Link href="/bottles" className="card-premium hover:border-copper/50 transition-all duration-300 group">
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <svg className="w-12 h-12 text-copper mx-auto mb-3 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <p className="text-lg font-semibold text-white">Browse Collection</p>
              </div>
            </div>
          </Link>

          <Link href="/bottles/import" className="card-premium hover:border-copper/50 transition-all duration-300 group">
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <svg className="w-12 h-12 text-copper mx-auto mb-3 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-lg font-semibold text-white">Import CSV</p>
              </div>
            </div>
          </Link>

          <Link href="/pour/quick" className="card-premium hover:border-copper/50 transition-all duration-300 group">
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <svg className="w-12 h-12 text-copper mx-auto mb-3 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-lg font-semibold text-white">Quick Pour</p>
              </div>
            </div>
          </Link>

          <Link href="/pour/sessions" className="card-premium hover:border-copper/50 transition-all duration-300 group">
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <svg className="w-12 h-12 text-copper mx-auto mb-3 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg font-semibold text-white">Pour Sessions</p>
              </div>
            </div>
          </Link>

          <Link href="/analytics" className="card-premium hover:border-copper/50 transition-all duration-300 group">
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <svg className="w-12 h-12 text-copper mx-auto mb-3 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-lg font-semibold text-white">Analytics</p>
              </div>
            </div>
          </Link>

          <Link href="/labels" className="card-premium hover:border-copper/50 transition-all duration-300 group">
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <svg className="w-12 h-12 text-copper mx-auto mb-3 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <p className="text-lg font-semibold text-white">Print Labels</p>
              </div>
            </div>
          </Link>

          {/* TEMPORARY: Social Profile Setup Button for Testing */}
          <Link href="/profile/setup" className="card-premium hover:border-amber-500 transition-all duration-300 group border-amber-500/50">
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <svg className="w-12 h-12 text-amber-500 mx-auto mb-3 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <p className="text-lg font-semibold text-amber-500">Setup Social Profile</p>
                <p className="text-xs text-amber-400 mt-1">(Testing)</p>
              </div>
            </div>
          </Link>

          {/* TEMPORARY: Test Notifications Component */}
          <div className="md:col-span-2">
            <TestNotifications />
          </div>
        </div>

        {/* Recent Activity */}
        {recentBottles.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-white mb-6">Recent Activity</h2>
            <div className="card-premium">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-gray-700">
                      <th className="pb-3 text-sm font-medium text-gray-400">Bottle</th>
                      <th className="pb-3 text-sm font-medium text-gray-400">Quantity</th>
                      <th className="pb-3 text-sm font-medium text-gray-400">Status</th>
                      <th className="pb-3 text-sm font-medium text-gray-400">Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBottles.map((bottle) => (
                      <tr key={bottle._id} className="border-b border-gray-800 hover:bg-gray-800/50">
                        <td className="py-3">
                          <Link href={`/bottles/${bottle._id}`} className="hover:text-copper transition-colors">
                            <div className="font-medium">{bottle.name}</div>
                            <div className="text-sm text-gray-500">{bottle.distillery}</div>
                          </Link>
                        </td>
                        <td className="py-3 text-sm">{bottle.quantity}</td>
                        <td className="py-3">
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              bottle.status === 'opened' ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-300'
                            }`}>
                              {bottle.status}
                            </span>
                            {bottle.status === 'opened' && bottle.fillLevel !== undefined && (
                              <div className="flex items-center space-x-1">
                                <div className="w-8 bg-gray-700 rounded-full h-1">
                                  <div
                                    className={`h-1 rounded-full ${
                                      bottle.fillLevel > 50 ? 'bg-green-500' : 
                                      bottle.fillLevel > 20 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${bottle.fillLevel}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-400">{bottle.fillLevel.toFixed(2)}%</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-sm text-gray-500">
                          {new Date(bottle.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Low Stock Bottles */}
        {lowStockBottles.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-white mb-6">Low Stock Alert</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {lowStockBottles.map((bottle) => (
                <Link 
                  key={bottle._id} 
                  href={`/bottles/${bottle._id}`}
                  className="card-premium hover:border-red-500/50 transition-all duration-300 border-red-500/20"
                >
                  <div className="text-center">
                    <div className="text-lg font-semibold text-white mb-1">{bottle.name}</div>
                    <div className="text-sm text-gray-400 mb-2">{bottle.distillery}</div>
                    <div className="mb-2">
                      <div className="w-full bg-gray-700 rounded-full h-2 mb-1">
                        <div
                          className="h-2 rounded-full bg-red-500"
                          style={{ width: `${bottle.fillLevel}%` }}
                        />
                      </div>
                      <div className="text-red-400 font-semibold">{bottle.fillLevel.toFixed(2)}% remaining</div>
                    </div>
                    {bottle.location && (
                      <div className="text-xs text-gray-500">{bottle.location.area} - {bottle.location.bin}</div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Top Valued Bottles */}
        {topValuedBottles.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-white mb-6">Most Valuable Bottles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {topValuedBottles.map((bottle) => (
                <Link 
                  key={bottle._id} 
                  href={`/bottles/${bottle._id}`}
                  className="card-premium hover:border-copper/50 transition-all duration-300"
                >
                  <div className="text-center">
                    <div className="text-lg font-semibold text-white mb-1">{bottle.name}</div>
                    <div className="text-sm text-gray-400 mb-2">{bottle.distillery}</div>
                    <div className="text-2xl font-bold text-copper">${bottle.totalValue.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 mt-1">Qty: {bottle.quantity}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {session.user.isAdmin && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-white mb-6">Admin Tools</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Link href="/admin/invite-codes" className="card-premium hover:border-copper/50 transition-all duration-300">
                <h3 className="text-lg font-semibold text-white mb-2">Manage Invite Codes</h3>
                <p className="text-gray-400">Create and manage invite codes for new users</p>
              </Link>

              <Link href="/admin/users" className="card-premium hover:border-copper/50 transition-all duration-300">
                <h3 className="text-lg font-semibold text-white mb-2">Manage Users</h3>
                <p className="text-gray-400">View and manage user accounts</p>
              </Link>

              <Link href="/admin/upc" className="card-premium hover:border-copper/50 transition-all duration-300">
                <h3 className="text-lg font-semibold text-white mb-2">Manage UPC Codes</h3>
                <p className="text-gray-400">Add, review, and manage UPC codes for bottles</p>
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="relative bg-gray-900 rounded-lg p-6 max-w-lg w-full mx-4">
            <button
              onClick={() => setShowScanner(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <h2 className="text-xl font-bold text-white mb-4">Scan Barcode</h2>
            
            <BarcodeScanner
              onScan={handleBarcodeScan}
              onClose={() => setShowScanner(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}