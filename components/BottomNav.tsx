'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Wine, ScanLine, Grid3x3, User } from 'lucide-react';

interface NavItem {
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

const navItems: NavItem[] = [
  { path: '/dashboard', icon: Home, label: 'Home' },
  { path: '/pour/quick', icon: Wine, label: 'Add Pour' },
  { path: '/scan', icon: ScanLine, label: 'Scan' },
  { path: '/bottles', icon: Grid3x3, label: 'Collection' },
  { path: '/profile', icon: User, label: 'Profile' }
];

export default function BottomNav() {
  const pathname = usePathname();

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
                  <Icon 
                    className={`
                      w-6 h-6 transition-colors duration-200
                      ${active ? 'text-copper' : 'text-gray-400'}
                    `}
                  />
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