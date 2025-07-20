'use client';

import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateOnlineStatus = () => {
      const offline = !navigator.onLine;
      setIsOffline(offline);
      
      if (offline) {
        setIsVisible(true);
      } else {
        setTimeout(() => setIsVisible(false), 2000);
      }
    };

    updateOnlineStatus();

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isOffline ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="bg-amber-600/90 backdrop-blur-sm">
        <div className="flex items-center justify-center gap-2 px-4 py-2">
          <WifiOff className="h-4 w-4 text-black" />
          <p className="text-sm font-medium text-black">
            {isOffline ? 'You are offline' : 'Back online'}
          </p>
        </div>
      </div>
    </div>
  );
}