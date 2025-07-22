'use client';

import { useState, useEffect } from 'react';
import { Wine, X, Users, MapPin } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface LivePour {
  _id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  bottleId: string;
  bottleName: string;
  bottleImage?: string;
  startedAt: string;
  location?: string;
  cheersCount: number;
}

export default function LivePourBanner() {
  const [livePours, setLivePours] = useState<LivePour[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connectToLiveFeed = () => {
      eventSource = new EventSource('/api/feed/live');

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'initial' || data.type === 'update') {
          setLivePours(data.pours);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        eventSource?.close();
        
        // Reconnect after 5 seconds
        setTimeout(connectToLiveFeed, 5000);
      };
    };

    connectToLiveFeed();

    return () => {
      eventSource?.close();
    };
  }, []);

  if (!isOpen || livePours.length === 0) {
    return null;
  }

  return (
    <div
      className={`fixed bottom-0 right-0 m-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 transition-all duration-300 z-50 ${
        isMinimized ? 'w-64' : 'w-96 max-w-[calc(100vw-2rem)]'
      }`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-2">
          <Wine className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Live Pours
          </h3>
          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs rounded-full">
            {livePours.length} active
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
          }}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="max-h-96 overflow-y-auto">
          {livePours.map((pour) => (
            <div
              key={pour._id}
              className="p-4 border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex gap-3">
                {/* User Avatar */}
                <Link href={`/profile/${pour.userId}`}>
                  {pour.userAvatar ? (
                    <Image
                      src={pour.userAvatar}
                      alt={pour.userName}
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900 rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                        {pour.userName[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                </Link>

                {/* Pour Details */}
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    <Link
                      href={`/profile/${pour.userId}`}
                      className="hover:underline"
                    >
                      {pour.userName}
                    </Link>
                    {' is pouring'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {pour.bottleName}
                  </p>
                  
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span>
                      {formatDistanceToNow(new Date(pour.startedAt), { addSuffix: true })}
                    </span>
                    
                    {pour.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {pour.location}
                      </span>
                    )}
                    
                    {pour.cheersCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {pour.cheersCount} cheers
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottle Image */}
                {pour.bottleImage && (
                  <Image
                    src={pour.bottleImage}
                    alt={pour.bottleName}
                    width={40}
                    height={60}
                    className="rounded object-contain"
                  />
                )}
              </div>

              {/* Cheers Button */}
              <button
                className="mt-3 w-full px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors text-sm font-medium"
              >
                🥃 Cheers!
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}