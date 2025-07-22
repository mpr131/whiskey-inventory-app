'use client';

import { useState } from 'react';
import ActivityFeed from '@/components/social/ActivityFeed';
import LivePourBanner from '@/components/social/LivePourBanner';
import TopNav from '@/components/TopNav';
import { Wine, Star, Package } from 'lucide-react';

export default function FeedPage() {
  const [activeFilter, setActiveFilter] = useState<'all' | 'pours' | 'ratings' | 'new_bottles'>('all');

  const filters = [
    { id: 'all', label: 'All Activity', icon: null },
    { id: 'pours', label: 'Pours', icon: Wine },
    { id: 'ratings', label: 'Ratings', icon: Star },
    { id: 'new_bottles', label: 'New Bottles', icon: Package },
  ];

  return (
    <div className="min-h-screen bg-gray-900">
      <TopNav />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
            Activity Feed
          </h1>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          {filters.map((filter) => {
            const Icon = filter.icon;
            return (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeFilter === filter.id
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {Icon && <Icon className="w-4 h-4" />}
                {filter.label}
              </button>
            );
          })}
        </div>

          {/* Activity Feed */}
          <ActivityFeed filter={activeFilter} />
        </div>

        {/* Live Pour Banner */}
        <LivePourBanner />
      </div>
    </div>
  );
}