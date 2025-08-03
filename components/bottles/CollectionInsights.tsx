'use client';

import { useState } from 'react';
import { Wine, TrendingUp, Clock, AlertTriangle, DollarSign, BarChart3 } from 'lucide-react';

interface CollectionInsightsProps {
  insights: {
    fillLevels: {
      empty: number;
      low: number;
      medium: number;
      high: number;
      full: number;
    };
    categories: Record<string, number>;
    growth: {
      thisMonth: number;
      lastMonth: number;
    };
    recentActivity: {
      poursToday: number;
      bottlesOpened: number;
      lastPour?: string;
    };
    totalValue?: number;
    averagePrice?: number;
    mostExpensive?: {
      name: string;
      price: number;
    };
  };
  onFilterByInsight?: (type: string, value: string) => void;
}

export default function CollectionInsights({ insights, onFilterByInsight }: CollectionInsightsProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const fillLevelTotal = Object.values(insights.fillLevels).reduce((a, b) => a + b, 0);
  const lowCount = insights.fillLevels.empty + insights.fillLevels.low;
  const topCategory = Object.entries(insights.categories)
    .sort(([, a], [, b]) => b - a)[0];

  return (
    <div className="bg-white/[0.02] rounded-lg p-3 mb-6 border border-white/5">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Fill Levels */}
        <button
          onClick={() => {
            setActiveSection(activeSection === 'fill' ? null : 'fill');
            if (onFilterByInsight && lowCount > 0) {
              onFilterByInsight('status', 'low');
            }
          }}
          className={`group text-left p-3 rounded-md transition-all duration-200 ${
            activeSection === 'fill' ? 'bg-white/5' : 'hover:bg-white/[0.02]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Fill Levels</h3>
            <Wine className="w-3 h-3 text-gray-600" />
          </div>
          
          {/* Visual fill level bar - Refined */}
          <div className="flex items-center gap-0.5 mb-2 h-1 rounded-full overflow-hidden bg-white/5">
            <div 
              className="h-full bg-gray-600/50 transition-all duration-300"
              style={{ width: `${(insights.fillLevels.empty / fillLevelTotal) * 100}%` }}
              title={`Empty: ${insights.fillLevels.empty}`}
            />
            <div 
              className="h-full bg-red-500/50 transition-all duration-300"
              style={{ width: `${(insights.fillLevels.low / fillLevelTotal) * 100}%` }}
              title={`Low: ${insights.fillLevels.low}`}
            />
            <div 
              className="h-full bg-amber-500/50 transition-all duration-300"
              style={{ width: `${(insights.fillLevels.medium / fillLevelTotal) * 100}%` }}
              title={`Medium: ${insights.fillLevels.medium}`}
            />
            <div 
              className="h-full bg-yellow-500/50 transition-all duration-300"
              style={{ width: `${(insights.fillLevels.high / fillLevelTotal) * 100}%` }}
              title={`High: ${insights.fillLevels.high}`}
            />
            <div 
              className="h-full bg-green-500/50 transition-all duration-300"
              style={{ width: `${(insights.fillLevels.full / fillLevelTotal) * 100}%` }}
              title={`Full: ${insights.fillLevels.full}`}
            />
          </div>
          
          {lowCount > 0 && (
            <p className="text-sm text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {lowCount} running low
            </p>
          )}
        </button>

        {/* Categories */}
        <button
          onClick={() => {
            setActiveSection(activeSection === 'categories' ? null : 'categories');
            if (onFilterByInsight && topCategory) {
              onFilterByInsight('category', topCategory[0]);
            }
          }}
          className={`group text-left p-4 rounded-lg transition-all ${
            activeSection === 'categories' ? 'bg-gray-700/50' : 'hover:bg-gray-700/30'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Categories</h3>
            <BarChart3 className="w-4 h-4 text-gray-500" />
          </div>
          
          {topCategory && (
            <>
              <p className="text-2xl font-bold text-copper">{topCategory[1]}</p>
              <p className="text-sm text-gray-300">{topCategory[0]}</p>
            </>
          )}
          
          {activeSection === 'categories' && (
            <div className="mt-2 space-y-1">
              {Object.entries(insights.categories)
                .sort(([, a], [, b]) => b - a)
                .slice(1, 4)
                .map(([cat, count]) => (
                  <div key={cat} className="flex justify-between text-xs">
                    <span className="text-gray-400">{cat}</span>
                    <span className="text-gray-300">{count}</span>
                  </div>
                ))}
            </div>
          )}
        </button>

        {/* Growth */}
        <div className="p-4 rounded-lg hover:bg-gray-700/30 transition-all">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Growth</h3>
            <TrendingUp className="w-4 h-4 text-gray-500" />
          </div>
          
          <p className="text-2xl font-bold text-green-400">
            +{insights.growth.thisMonth}
          </p>
          <p className="text-sm text-gray-300">this month</p>
          
          {insights.growth.lastMonth > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {insights.growth.lastMonth} last month
            </p>
          )}
        </div>

        {/* Recent Activity */}
        <div className="p-4 rounded-lg hover:bg-gray-700/30 transition-all">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Recent Activity</h3>
            <Clock className="w-4 h-4 text-gray-500" />
          </div>
          
          <div className="space-y-1">
            {insights.recentActivity.poursToday > 0 && (
              <p className="text-sm text-gray-300">
                <span className="text-copper font-semibold">{insights.recentActivity.poursToday}</span> pours today
              </p>
            )}
            {insights.recentActivity.bottlesOpened > 0 && (
              <p className="text-sm text-gray-300">
                <span className="text-green-400 font-semibold">{insights.recentActivity.bottlesOpened}</span> bottles opened
              </p>
            )}
            {!insights.recentActivity.poursToday && !insights.recentActivity.bottlesOpened && (
              <p className="text-sm text-gray-500">No activity today</p>
            )}
          </div>
        </div>
      </div>
      
      {/* Additional insights row */}
      {(insights.totalValue || insights.averagePrice || insights.mostExpensive) && (
        <div className="mt-4 pt-4 border-t border-gray-700 flex items-center justify-between text-sm">
          {insights.totalValue && (
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-copper" />
              <span className="text-gray-400">Total Value:</span>
              <span className="text-copper font-semibold">${insights.totalValue.toLocaleString()}</span>
            </div>
          )}
          {insights.averagePrice && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Avg Price:</span>
              <span className="text-gray-300">${insights.averagePrice.toFixed(0)}</span>
            </div>
          )}
          {insights.mostExpensive && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Most Valuable:</span>
              <span className="text-gray-300">{insights.mostExpensive.name} (${insights.mostExpensive.price})</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}