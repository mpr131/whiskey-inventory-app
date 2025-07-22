'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Users, Activity, Wine, User } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

interface NavItem {
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  requiresUsername?: boolean;
}

export default function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [userProfile, setUserProfile] = useState<{ username?: string } | null>(null);
  const [pendingFriendRequests, setPendingFriendRequests] = useState(0);

  useEffect(() => {
    if (session?.user?.email) {
      // Fetch user profile to check for username
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
    { path: '/dashboard', icon: Home, label: 'Home' },
    { path: '/feed', icon: Activity, label: 'Feed' },
    { path: '/pour/quick', icon: Wine, label: 'Pour' },
    { path: '/friends', icon: Users, label: 'Friends' },
    { 
      path: userProfile?.username ? `/profile/${userProfile.username}` : '/profile/setup',
      icon: User, 
      label: 'Profile',
      requiresUsername: true
    }
  ];

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/' || pathname === '/dashboard';
    }
    return pathname.startsWith(path);
  };

  const handleNavClick = () => {
    // Trigger haptic feedback if supported
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };

  return (
    <>
      {/* Spacer to prevent content from being hidden behind nav */}
      <div className="h-16 md:hidden" />
      
      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
        <div className="bg-[#1a1a1a]/80 backdrop-blur-lg border-t border-copper/20 shadow-[0_-2px_10px_rgba(0,0,0,0.3)]">
          <div className="flex justify-around items-center h-16 px-2 pb-safe">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={handleNavClick}
                  className={`
                    flex flex-col items-center justify-center
                    min-w-[44px] min-h-[44px] px-2 py-1
                    transition-all duration-200
                    ${active ? 'scale-105' : 'active:scale-95'}
                  `}
                >
                  <div className="relative">
                    <Icon 
                      className={`
                        w-6 h-6 transition-colors duration-200
                        ${active ? 'text-copper' : 'text-gray-400'}
                      `}
                    />
                    {item.path === '/friends' && pendingFriendRequests > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                        {pendingFriendRequests > 9 ? '9+' : pendingFriendRequests}
                      </span>
                    )}
                  </div>
                  <span 
                    className={`
                      text-[10px] mt-1 transition-colors duration-200
                      ${active ? 'text-copper font-medium' : 'text-gray-400'}
                    `}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}