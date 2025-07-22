'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { X, Users } from 'lucide-react';

export default function ProfileSetupBanner() {
  const { data: session } = useSession();
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (session?.user?.email && !dismissed) {
      // Check if user has username
      fetch('/api/user/profile')
        .then(res => res.json())
        .then(data => {
          if (!data.username) {
            setShowBanner(true);
          }
        })
        .catch(() => {});
    }
  }, [session, dismissed]);

  const handleDismiss = () => {
    setDismissed(true);
    setShowBanner(false);
    // Store in session storage so it doesn't show again this session
    sessionStorage.setItem('profileSetupBannerDismissed', 'true');
  };

  useEffect(() => {
    // Check if banner was previously dismissed this session
    if (sessionStorage.getItem('profileSetupBannerDismissed') === 'true') {
      setDismissed(true);
    }
  }, []);

  if (!showBanner) return null;

  return (
    <div className="fixed top-16 left-0 right-0 z-40 bg-amber-600 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-white" />
            <p className="text-white font-medium">
              Set up your profile to connect with friends and share your whiskey journey!
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <Link
              href="/profile/setup"
              className="px-4 py-1.5 bg-white text-amber-700 rounded-lg font-medium hover:bg-amber-50 transition-colors"
            >
              Setup Profile
            </Link>
            <button
              onClick={handleDismiss}
              className="p-1 text-white/80 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}