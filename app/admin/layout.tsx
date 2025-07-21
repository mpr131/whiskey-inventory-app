'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { Shield, Users, Ticket, ArrowLeft, Package } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
    <div className="min-h-screen bg-gray-900">
      {/* Admin Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-copper mr-3" />
              <h1 className="text-xl font-semibold text-white">Admin Panel</h1>
            </div>
            <Link
              href="/"
              className="text-gray-400 hover:text-white flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to App
            </Link>
          </div>
        </div>
      </div>

      {/* Admin Navigation */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            <Link
              href="/admin/invite-codes"
              className="text-gray-300 hover:text-white px-3 py-4 text-sm font-medium border-b-2 border-transparent hover:border-copper flex items-center gap-2"
            >
              <Ticket className="h-4 w-4" />
              Invite Codes
            </Link>
            <Link
              href="/admin/users"
              className="text-gray-300 hover:text-white px-3 py-4 text-sm font-medium border-b-2 border-transparent hover:border-copper flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              Users
            </Link>
            <Link
              href="/admin/upc"
              className="text-gray-300 hover:text-white px-3 py-4 text-sm font-medium border-b-2 border-transparent hover:border-copper flex items-center gap-2"
            >
              <Package className="h-4 w-4" />
              UPC Management
            </Link>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}