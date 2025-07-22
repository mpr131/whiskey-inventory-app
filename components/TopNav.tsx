'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { 
  Home, 
  Wine, 
  Users, 
  Activity, 
  User, 
  Settings,
  LogOut,
  ChevronDown,
  Package
} from 'lucide-react';
import NotificationCenter from '@/components/NotificationCenter';

interface NavItem {
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

export default function TopNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [userProfile, setUserProfile] = useState<{ username?: string; displayName?: string } | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [pendingFriendRequests, setPendingFriendRequests] = useState(0);

  useEffect(() => {
    if (session?.user?.email) {
      fetch('/api/user/profile')
        .then(res => res.json())
        .then(data => setUserProfile(data))
        .catch(() => setUserProfile(null));
      
      // Fetch pending friend requests
      fetch('/api/friends/pending')
        .then(res => res.json())
        .then(data => setPendingFriendRequests(data.counts?.received || 0))
        .catch(() => setPendingFriendRequests(0));
    }
  }, [session]);

  const navItems: NavItem[] = [
    { path: '/dashboard', icon: Home, label: 'Dashboard' },
    { path: '/bottles', icon: Package, label: 'Collection' },
    { path: '/feed', icon: Activity, label: 'Feed' },
    { path: '/friends', icon: Users, label: 'Friends' },
    { path: '/pour/quick', icon: Wine, label: 'Add Pour' },
  ];

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/' || pathname === '/dashboard';
    }
    return pathname.startsWith(path);
  };

  if (!session) return null;

  return (
    <nav className="glass-dark border-b border-white/10 hidden md:block sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/dashboard" className="text-2xl font-bold text-gradient">
              Whiskey Vault
            </Link>
            
            <div className="flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg
                      transition-all duration-200 font-medium relative
                      ${active 
                        ? 'bg-copper/20 text-copper' 
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                    {item.path === '/friends' && pendingFriendRequests > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                        {pendingFriendRequests > 9 ? '9+' : pendingFriendRequests}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <NotificationCenter userId={session.user.id} />
            
            {/* User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"
              >
                <div className="w-8 h-8 bg-copper/20 rounded-full flex items-center justify-center">
                  {userProfile?.username ? (
                    <span className="text-copper font-bold">
                      {userProfile.username[0].toUpperCase()}
                    </span>
                  ) : (
                    <User className="w-4 h-4 text-copper" />
                  )}
                </div>
                <span className="font-medium">
                  {userProfile?.displayName || session.user.name}
                </span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
                  {userProfile?.username ? (
                    <Link
                      href={`/profile/${userProfile.username}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <User className="w-4 h-4 text-gray-400" />
                      <span>My Profile</span>
                    </Link>
                  ) : (
                    <Link
                      href="/profile/setup"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition-colors bg-amber-900/20"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <User className="w-4 h-4 text-amber-600" />
                      <span className="text-amber-600">Setup Profile</span>
                    </Link>
                  )}
                  
                  <Link
                    href="/settings/profile"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition-colors"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <Settings className="w-4 h-4 text-gray-400" />
                    <span>Settings</span>
                  </Link>
                  
                  <hr className="border-gray-700" />
                  
                  <Link
                    href="/api/auth/signout"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition-colors text-red-400"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}