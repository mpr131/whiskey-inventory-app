'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Ticket, Users, Package, Shield, GitMerge, Database, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [cleaningProof, setCleaningProof] = useState(false);
  const [cleanResults, setCleanResults] = useState<{
    total: number;
    fixed: number;
    failed: number;
    errors?: string[];
  } | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    
    // Check if user is admin
    if (!session || !session.user?.isAdmin) {
      router.push('/');
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-copper">Loading...</div>
      </div>
    );
  }

  if (!session || !session.user?.isAdmin) {
    return null;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
        <p className="text-gray-400">Manage your whiskey vault system</p>
      </div>
      
      {/* Admin Tools Grid - 5 cards total */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link 
          href="/admin/invite-codes"
          className="card-premium hover:border-copper/50 transition-all duration-300 p-6"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-copper/20 rounded-lg">
              <Ticket className="h-6 w-6 text-copper" />
            </div>
            <h2 className="text-xl font-semibold text-white">Invite Codes</h2>
          </div>
          <p className="text-gray-400">
            Create and manage invite codes for new users to join your vault
          </p>
        </Link>

        <Link 
          href="/admin/users"
          className="card-premium hover:border-copper/50 transition-all duration-300 p-6"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-copper/20 rounded-lg">
              <Users className="h-6 w-6 text-copper" />
            </div>
            <h2 className="text-xl font-semibold text-white">Users</h2>
          </div>
          <p className="text-gray-400">
            View and manage user accounts, permissions, and access
          </p>
        </Link>

        <Link 
          href="/admin/upc"
          className="card-premium hover:border-copper/50 transition-all duration-300 p-6"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-copper/20 rounded-lg">
              <Package className="h-6 w-6 text-copper" />
            </div>
            <h2 className="text-xl font-semibold text-white">UPC Management</h2>
          </div>
          <p className="text-gray-400">
            Add, review, and manage UPC codes for bottles in the database
          </p>
        </Link>

        <Link 
          href="/admin/bottles/dedupe"
          className="card-premium hover:border-copper/50 transition-all duration-300 p-6"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-copper/20 rounded-lg">
              <GitMerge className="h-6 w-6 text-copper" />
            </div>
            <h2 className="text-xl font-semibold text-white">Dedupe Master Bottles</h2>
          </div>
          <p className="text-gray-400">
            Match user-created bottles to FWGS products
          </p>
        </Link>

        <div className="card-premium hover:border-copper/50 transition-all duration-300 p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-copper/20 rounded-lg">
              <Database className="h-6 w-6 text-copper" />
            </div>
            <h2 className="text-xl font-semibold text-white">Clean Proof Data</h2>
          </div>
          <p className="text-gray-400 mb-4">
            Fix proof values with % symbols and convert them to numbers
          </p>
          
          {cleanResults && (
            <div className="mb-4 p-3 bg-gray-800 rounded-lg text-sm">
              <div className="flex items-center gap-2 mb-2">
                {cleanResults.failed === 0 ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                )}
                <span className="text-white font-medium">Cleaning Complete</span>
              </div>
              <div className="text-gray-400 space-y-1">
                <p>Total processed: {cleanResults.total}</p>
                <p className="text-green-400">Fixed: {cleanResults.fixed}</p>
                {cleanResults.failed > 0 && (
                  <p className="text-red-400">Failed: {cleanResults.failed}</p>
                )}
              </div>
            </div>
          )}
          
          <button
            onClick={async () => {
              setCleaningProof(true);
              setCleanResults(null);
              
              try {
                const response = await fetch('/api/admin/clean-proof-data', {
                  method: 'POST',
                });
                
                if (!response.ok) {
                  throw new Error('Failed to clean proof data');
                }
                
                const data = await response.json();
                setCleanResults(data.results);
                
                if (data.results.failed === 0) {
                  toast.success(`Successfully cleaned ${data.results.fixed} bottles!`);
                } else {
                  toast.error(`Cleaned ${data.results.fixed} bottles, but ${data.results.failed} failed`);
                }
              } catch (error) {
                console.error('Error cleaning proof data:', error);
                toast.error('Failed to clean proof data');
              } finally {
                setCleaningProof(false);
              }
            }}
            disabled={cleaningProof}
            className="w-full px-4 py-2 bg-copper text-white rounded-lg hover:bg-copper/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {cleaningProof ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Cleaning...
              </>
            ) : (
              'Run Cleanup'
            )}
          </button>
        </div>
      </div>

      <div className="mt-12 p-6 bg-gray-800/50 rounded-lg border border-gray-700">
        <div className="flex items-center gap-3 mb-3">
          <Shield className="h-5 w-5 text-copper" />
          <h3 className="text-lg font-semibold text-white">Admin Access</h3>
        </div>
        <p className="text-gray-400 text-sm">
          You have administrative privileges. Use these tools responsibly to maintain 
          the integrity of your whiskey vault system.
        </p>
      </div>
    </div>
  );
}