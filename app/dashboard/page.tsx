import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/signin');
  }

  return (
    <div className="min-h-screen">
      <nav className="glass-dark border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gradient">Whiskey Vault</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-300">Welcome, {session.user.name}</span>
              <Link href="/api/auth/signout" className="btn-secondary text-sm px-4 py-2">
                Sign Out
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="card-premium">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-300">Total Bottles</h3>
              <svg className="w-8 h-8 text-copper" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-white">0</p>
            <p className="text-sm text-gray-500 mt-2">In your collection</p>
          </div>

          <div className="card-premium">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-300">Total Value</h3>
              <svg className="w-8 h-8 text-copper" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-white">$0</p>
            <p className="text-sm text-gray-500 mt-2">Current estimate</p>
          </div>

          <div className="card-premium">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-300">Open Bottles</h3>
              <svg className="w-8 h-8 text-copper" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-white">0</p>
            <p className="text-sm text-gray-500 mt-2">Currently sampling</p>
          </div>

          <div className="card-premium">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-300">Locations</h3>
              <svg className="w-8 h-8 text-copper" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-white">0</p>
            <p className="text-sm text-gray-500 mt-2">Storage areas</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

          <Link href="/locations" className="card-premium hover:border-copper/50 transition-all duration-300 group">
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <svg className="w-12 h-12 text-copper mx-auto mb-3 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <p className="text-lg font-semibold text-white">Manage Locations</p>
              </div>
            </div>
          </Link>
        </div>

        {session.user.isAdmin && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-white mb-6">Admin Tools</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Link href="/admin/invite-codes" className="card-premium hover:border-copper/50 transition-all duration-300">
                <h3 className="text-lg font-semibold text-white mb-2">Manage Invite Codes</h3>
                <p className="text-gray-400">Create and manage invite codes for new users</p>
              </Link>

              <Link href="/admin/users" className="card-premium hover:border-copper/50 transition-all duration-300">
                <h3 className="text-lg font-semibold text-white mb-2">Manage Users</h3>
                <p className="text-gray-400">View and manage user accounts</p>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}