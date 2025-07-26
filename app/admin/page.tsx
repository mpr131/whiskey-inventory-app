'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { Ticket, Users, Package, Shield, GitMerge } from 'lucide-react';

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

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
            <h2 className="text-xl font-semibold text-white">Bottle Deduplication</h2>
          </div>
          <p className="text-gray-400">
            Match your bottles to FWGS products to add UPCs and images
          </p>
        </Link>
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