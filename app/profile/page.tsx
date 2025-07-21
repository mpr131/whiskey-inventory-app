'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, LogOut, Settings, Shield, Bell } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut({ redirect: true, callbackUrl: '/auth/signin' });
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center justify-between p-4">
          <Link href="/" className="p-2 -ml-2 text-gray-400 hover:text-white">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold text-white">Profile</h1>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>
      </header>

      <main className="p-4 pb-20">
        <div className="max-w-lg mx-auto">
          {/* User Info */}
          <div className="card-premium mb-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center">
                <User className="w-10 h-10 text-copper" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{session.user.name}</h2>
                <p className="text-gray-400">{session.user.email}</p>
                {session.user.isAdmin && (
                  <span className="inline-flex items-center px-2 py-1 mt-2 rounded-full text-xs font-medium bg-copper/20 text-copper">
                    Admin
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="space-y-4">
            <Link href="/settings" className="card-premium flex items-center justify-between p-4 hover:border-copper/50 transition-colors">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-gray-400" />
                <span className="text-white">Settings</span>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            <Link href="/notifications" className="card-premium flex items-center justify-between p-4 hover:border-copper/50 transition-colors">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-gray-400" />
                <span className="text-white">Notifications</span>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            {session.user.isAdmin && (
              <Link href="/admin/invite-codes" className="card-premium flex items-center justify-between p-4 hover:border-copper/50 transition-colors">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-gray-400" />
                  <span className="text-white">Admin Panel</span>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}

            <button
              onClick={handleSignOut}
              className="card-premium flex items-center justify-between p-4 w-full text-left hover:border-red-500/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5 text-red-500" />
                <span className="text-red-500">Sign Out</span>
              </div>
            </button>
          </div>

          {/* App Info */}
          <div className="mt-12 text-center text-sm text-gray-500">
            <p>Whiskey Vault v1.0.0</p>
            <p className="mt-1">© 2024 Whiskey Vault</p>
          </div>
        </div>
      </main>
    </div>
  );
}