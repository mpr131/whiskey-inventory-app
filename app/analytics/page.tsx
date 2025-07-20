'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ChevronLeft, Wine, TrendingUp, Award, Target, Brain,
  Clock, Calendar, MapPin, Star, Users, Tag, AlertTriangle
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, AreaChart, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import toast from 'react-hot-toast';

interface AnalyticsData {
  tonightsPours: {
    pours: Array<{
      time: string;
      bottleName: string;
      amount: number;
      rating?: number;
      companions?: string[];
    }>;
    totalAmount: number;
    averageRating?: number;
  };
  collectionInsights: {
    categoryBreakdown: Array<{ name: string; value: number; percentage: number }>;
    ageDistribution: Array<{ age: string; count: number }>;
    proofDistribution: Array<{ range: string; count: number }>;
    mostValuable: Array<{ name: string; value: number }>;
    totalValue: number;
    averageValue: number;
  };
  pourAnalytics: {
    mostPoured: Array<{ name: string; pours: number; amount: number }>;
    pourSizeDistribution: Array<{ size: string; count: number }>;
    ratingsByCategory: Array<{ category: string; avgRating: number }>;
    weeklyHeatMap: Array<{ day: string; hour: number; pours: number }>;
    costPerPour: { total: number; average: number };
  };
  pourCalendar: {
    dailyData: Array<{
      date: string;
      pours: number;
      totalAmount: number;
      avgRating?: number;
    }>;
    weeklyPatterns: Array<{
      day: string;
      avgPours: number;
      avgRating: number;
    }>;
    monthlyTrends: Array<{
      month: string;
      pours: number;
    }>;
    insights: {
      heaviestDay: string;
      heaviestDayAvg: number;
      longestStreak: number;
      streakDates: string;
      seasonalPattern?: string;
      bestRatingDay: string;
      bestRatingAvg: number;
    };
  };
  killRate: {
    depletionPredictions: Array<{
      bottleId: string;
      bottleName: string;
      fillLevel: number;
      daysUntilEmpty: number;
      depletionRate: number; // oz per week
      remainingOz: number;
    }>;
    burnRateData: Array<{
      bottleName: string;
      history: Array<{ date: string; fillLevel: number }>;
      projection: Array<{ date: string; fillLevel: number }>;
    }>;
    insights: {
      consumptionChanges: Array<{ bottle: string; change: string; isUp: boolean }>;
      warnings: string[];
      projections: string[];
    };
    stats: {
      avgBottleLifespan: number;
      fastestKilled: { name: string; days: number };
      slowestSipped: { name: string; days: number };
      finishedThisYear: number;
    };
  };
  smartInsights: {
    patterns: string[];
    recommendations: string[];
    achievements: string[];
  };
}

const COLORS = ['#B87333', '#CD7F32', '#A0522D', '#8B4513', '#D2691E', '#F4A460'];

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState('30d');
  const [error, setError] = useState<string | null>(null);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetchAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    setLoadingTimeout(false);
    
    // Set timeout for slow loading
    const timeoutId = setTimeout(() => {
      setLoadingTimeout(true);
    }, 10000); // 10 seconds

    try {
      console.log('Fetching analytics data...');
      const response = await fetch(`/api/analytics?range=${timeRange}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Analytics data received:', data);
      console.log('Data structure:', {
        hasTonightsPours: !!data.tonightsPours,
        hasCollectionInsights: !!data.collectionInsights,
        hasPourAnalytics: !!data.pourAnalytics,
        hasPourCalendar: !!data.pourCalendar,
        hasKillRate: !!data.killRate,
        hasSmartInsights: !!data.smartInsights
      });
      
      // Ensure data has expected structure
      const analyticsData: AnalyticsData = {
        tonightsPours: data.tonightsPours || { pours: [], totalAmount: 0 },
        collectionInsights: data.collectionInsights || {
          categoryBreakdown: [],
          ageDistribution: [],
          proofDistribution: [],
          mostValuable: [],
          totalValue: 0,
          averageValue: 0
        },
        pourAnalytics: data.pourAnalytics || {
          mostPoured: [],
          pourSizeDistribution: [],
          ratingsByCategory: [],
          weeklyHeatMap: [],
          costPerPour: { total: 0, average: 0 }
        },
        pourCalendar: data.pourCalendar || {
          dailyData: [],
          weeklyPatterns: [],
          monthlyTrends: [],
          insights: {
            heaviestDay: 'None',
            heaviestDayAvg: 0,
            longestStreak: 0,
            streakDates: 'No streaks yet',
            bestRatingDay: 'None',
            bestRatingAvg: 0
          }
        },
        killRate: data.killRate || {
          depletionPredictions: [],
          burnRateData: [],
          insights: {
            consumptionChanges: [],
            warnings: [],
            projections: []
          },
          stats: {
            avgBottleLifespan: 0,
            fastestKilled: { name: 'None yet', days: 0 },
            slowestSipped: { name: 'None yet', days: 0 },
            finishedThisYear: 0
          }
        },
        smartInsights: data.smartInsights || {
          patterns: [],
          recommendations: [],
          achievements: []
        }
      };
      
      setAnalytics(analyticsData);
      clearTimeout(timeoutId);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load analytics';
      setError(errorMessage);
      toast.error(errorMessage);
      clearTimeout(timeoutId);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="text-copper animate-pulse mb-4">Loading analytics...</div>
          {loadingTimeout && (
            <div className="text-yellow-500 text-sm">
              <p>Analytics taking longer than expected.</p>
              <p>Check the browser console for errors.</p>
              <button 
                onClick={() => window.location.reload()} 
                className="mt-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                Refresh Page
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-red-500 mb-4">Analytics Error</h2>
            <p className="text-white mb-2">Failed to load analytics data:</p>
            <pre className="bg-gray-800 p-4 rounded overflow-x-auto text-sm text-gray-300">
              {error}
            </pre>
            <div className="mt-6 space-x-4">
              <button 
                onClick={fetchAnalytics} 
                className="px-4 py-2 bg-copper hover:bg-copper-light rounded-lg transition-colors"
              >
                Try Again
              </button>
              <button 
                onClick={() => router.push('/dashboard')} 
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
            <div className="mt-6 text-sm text-gray-400">
              <p>Debug tips:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Check browser console for detailed errors</li>
                <li>Try accessing <a href="/api/analytics" className="text-copper hover:underline" target="_blank">/api/analytics</a> directly</li>
                <li>Verify database connection is working</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="text-gray-500 mb-4">No analytics data available</div>
          <button 
            onClick={fetchAnalytics} 
            className="px-4 py-2 bg-copper hover:bg-copper-light rounded-lg transition-colors"
          >
            Reload Analytics
          </button>
        </div>
      </div>
    );
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 text-gray-400 hover:text-white"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-copper">Analytics Dashboard</h1>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-1 bg-gray-800 border border-gray-700 rounded-lg text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
        </div>
      </header>

      <main className="p-4 max-w-7xl mx-auto space-y-8">
        {/* Tonight's Pour Timeline */}
        <section className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Clock className="w-6 h-6 text-copper" />
            <h2 className="text-2xl font-bold">
              {new Date().getHours() < 18 ? "Today's" : "Tonight's"} Pour Timeline
            </h2>
          </div>

          {analytics.tonightsPours?.pours?.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-copper">{analytics.tonightsPours.pours.length}</div>
                  <div className="text-gray-400">Pours Tonight</div>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-white">{analytics.tonightsPours.totalAmount.toFixed(1)}oz</div>
                  <div className="text-gray-400">Total Volume</div>
                </div>
                {analytics.tonightsPours.averageRating && (
                  <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-copper flex items-center justify-center gap-1">
                      <Star className="w-6 h-6" />
                      {analytics.tonightsPours.averageRating.toFixed(1)}
                    </div>
                    <div className="text-gray-400">Average Rating</div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {analytics.tonightsPours.pours.map((pour, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 bg-gray-700/30 rounded-lg">
                    <div className="text-copper font-medium">{formatTime(pour.time)}</div>
                    <Wine className="w-5 h-5 text-gray-500" />
                    <div className="flex-1">
                      <div className="font-semibold">{pour.bottleName}</div>
                      <div className="text-sm text-gray-400">{pour.amount}oz pour</div>
                    </div>
                    {pour.rating && (
                      <div className="flex items-center gap-1 text-copper">
                        <Star className="w-4 h-4" />
                        <span>{pour.rating}</span>
                      </div>
                    )}
                    {pour.companions && pour.companions.length > 0 && (
                      <div className="flex items-center gap-1 text-gray-400">
                        <Users className="w-4 h-4" />
                        <span className="text-sm">{pour.companions.length}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Wine className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No pours recorded tonight yet</p>
            </div>
          )}
        </section>

        {/* Collection Insights */}
        <section className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-6 h-6 text-copper" />
            <h2 className="text-2xl font-bold">Collection Insights</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Breakdown */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Category Breakdown</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.collectionInsights.categoryBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name} ${percentage}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analytics.collectionInsights.categoryBreakdown.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Age Distribution */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Age Distribution</h3>
              {analytics.collectionInsights.ageDistribution && analytics.collectionInsights.ageDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.collectionInsights.ageDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="age" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                      labelStyle={{ color: '#9CA3AF' }}
                    />
                    <Bar dataKey="count" fill="#B87333" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  <p>No age distribution data available</p>
                </div>
              )}
            </div>

            {/* Proof Distribution */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Proof Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={analytics.collectionInsights.proofDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="range" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#9CA3AF' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#CD7F32" fill="#B87333" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Most Valuable Bottles */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Most Valuable Bottles</h3>
              <div className="space-y-3">
                {analytics.collectionInsights.mostValuable.slice(0, 5).map((bottle, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-copper/20 rounded-full flex items-center justify-center text-copper font-bold">
                        {index + 1}
                      </div>
                      <span className="font-medium">{bottle.name}</span>
                    </div>
                    <span className="text-copper font-bold">${bottle.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Total Collection Value</span>
                  <span className="text-2xl font-bold text-copper">${analytics.collectionInsights.totalValue.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pour Analytics */}
        <section className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Award className="w-6 h-6 text-copper" />
            <h2 className="text-2xl font-bold">Pour Analytics</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Most Poured Bottles */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Most Poured Bottles</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.pourAnalytics.mostPoured} margin={{ left: 20, right: 20, top: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#9CA3AF" 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#9CA3AF' }}
                  />
                  <Bar dataKey="pours" fill="#B87333" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pour Size Distribution */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Pour Size Preferences</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.pourAnalytics.pourSizeDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="count"
                    label={({ size, count }) => `${size}: ${count}`}
                  >
                    {analytics.pourAnalytics.pourSizeDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                    formatter={(value, _, props) => [
                      `${value} pours`,
                      props.payload.size
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Ratings by Category */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Average Ratings by Category</h3>
              {analytics.pourAnalytics.ratingsByCategory && analytics.pourAnalytics.ratingsByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={analytics.pourAnalytics.ratingsByCategory}>
                    <PolarGrid stroke="#374151" />
                    <PolarAngleAxis dataKey="category" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                    <PolarRadiusAxis 
                      angle={90} 
                      domain={[0, 10]} 
                      stroke="#9CA3AF" 
                      tickCount={6}
                    />
                    <Radar 
                      name="Average Rating" 
                      dataKey="avgRating" 
                      stroke="#B87333" 
                      fill="#B87333" 
                      fillOpacity={0.6} 
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                      labelStyle={{ color: '#9CA3AF' }}
                      formatter={(value: number) => value.toFixed(1)}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  <p>No ratings data available by category</p>
                </div>
              )}
            </div>

            {/* Cost Analysis */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Pour Cost Analysis</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-6 text-center">
                  <div className="text-3xl font-bold text-copper">${analytics.pourAnalytics.costPerPour.total.toFixed(2)}</div>
                  <div className="text-gray-400 mt-1">Total Pour Cost</div>
                  <div className="text-sm text-gray-500 mt-2">This {timeRange === '7d' ? 'week' : timeRange === '30d' ? 'month' : 'period'}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-6 text-center">
                  <div className="text-3xl font-bold text-white">${analytics.pourAnalytics.costPerPour.average.toFixed(2)}</div>
                  <div className="text-gray-400 mt-1">Average per Pour</div>
                  <div className="text-sm text-gray-500 mt-2">All sizes included</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pour Calendar Heat Map */}
        <section className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Calendar className="w-6 h-6 text-copper" />
            <h2 className="text-2xl font-bold">Pour Calendar</h2>
          </div>

          {/* Calendar Heat Map */}
          <div className="mb-8">
            <CalendarHeatMap data={analytics.pourCalendar.dailyData} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Weekly Patterns */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Weekly Patterns</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={analytics.pourCalendar.weeklyPatterns}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="day" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#9CA3AF' }}
                    formatter={(value: any, name: string) => {
                      if (name === 'avgRating') return [value.toFixed(1), 'Avg Rating'];
                      return [value.toFixed(1), 'Avg Pours'];
                    }}
                  />
                  <Bar dataKey="avgPours" fill="#B87333" />
                  <Bar dataKey="avgRating" fill="#CD7F32" yAxisId="right" />
                  <YAxis yAxisId="right" orientation="right" stroke="#CD7F32" domain={[0, 10]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly Trends */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Monthly Trends</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={analytics.pourCalendar.monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#9CA3AF' }}
                  />
                  <Line type="monotone" dataKey="pours" stroke="#B87333" strokeWidth={2} dot={{ fill: '#CD7F32' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Calendar Insights */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Calendar Insights</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Wine className="w-5 h-5 text-copper mt-0.5" />
                  <div>
                    <p className="font-medium">Heaviest Pour Day</p>
                    <p className="text-sm text-gray-400">{analytics.pourCalendar.insights.heaviestDay}s (avg {analytics.pourCalendar.insights.heaviestDayAvg.toFixed(1)} pours)</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-copper mt-0.5" />
                  <div>
                    <p className="font-medium">Longest Streak</p>
                    <p className="text-sm text-gray-400">{analytics.pourCalendar.insights.longestStreak} days ({analytics.pourCalendar.insights.streakDates})</p>
                  </div>
                </div>
                
                {analytics.pourCalendar.insights.seasonalPattern && (
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-copper mt-0.5" />
                    <div>
                      <p className="font-medium">Seasonal Pattern</p>
                      <p className="text-sm text-gray-400">{analytics.pourCalendar.insights.seasonalPattern}</p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-start gap-3">
                  <Star className="w-5 h-5 text-copper mt-0.5" />
                  <div>
                    <p className="font-medium">Best Rating Day</p>
                    <p className="text-sm text-gray-400">{analytics.pourCalendar.insights.bestRatingDay}s average {analytics.pourCalendar.insights.bestRatingAvg.toFixed(1)}/10</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Kill Rate Analytics */}
        <section className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-6 h-6 text-copper" />
            <h2 className="text-2xl font-bold">Kill Rate Analytics</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Depletion Predictions */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Depletion Predictions</h3>
              <div className="space-y-3">
                {analytics.killRate.depletionPredictions.slice(0, 5).map((bottle) => (
                  <Link 
                    key={bottle.bottleId}
                    href={`/bottles/${bottle.bottleId}`}
                    className="block p-3 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-medium text-white">{bottle.bottleName}</div>
                        <div className="text-sm text-gray-400">
                          {bottle.daysUntilEmpty > 0 
                            ? `${bottle.daysUntilEmpty} days left`
                            : 'Empty soon'
                          } • {bottle.depletionRate.toFixed(1)} oz/week
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">{bottle.remainingOz.toFixed(1)} oz</div>
                      </div>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          bottle.fillLevel > 50 ? 'bg-green-500' : 
                          bottle.fillLevel > 20 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${bottle.fillLevel}%` }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Burn Rate Chart */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Burn Rate Projection</h3>
              {analytics.killRate.burnRateData.length > 0 ? (
                <div className="h-[300px] overflow-y-auto">
                  <div className="space-y-4 px-4">
                    {analytics.killRate.burnRateData.slice(0, 5).map((bottle, index) => {
                      const currentFill = bottle.history[bottle.history.length - 1]?.fillLevel || 0;
                      const projectedFill = bottle.projection.length > 0 
                        ? bottle.projection[bottle.projection.length - 1]?.fillLevel || 0
                        : currentFill;
                      
                      return (
                        <div key={bottle.bottleName} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-300 truncate mr-2" style={{ color: COLORS[index % COLORS.length] }}>
                              {bottle.bottleName}
                            </span>
                            <span className="text-gray-500 whitespace-nowrap">
                              {currentFill.toFixed(0)}% → {
                                bottle.projection.length > 0 
                                  ? `${projectedFill.toFixed(0)}%`
                                  : 'N/A'
                              }
                            </span>
                          </div>
                          <div className="relative h-8 bg-gray-700 rounded-full overflow-hidden">
                            {/* Current fill level */}
                            <div 
                              className="absolute left-0 top-0 h-full transition-all duration-500"
                              style={{ 
                                width: `${Math.min(100, Math.max(0, currentFill))}%`,
                                backgroundColor: COLORS[index % COLORS.length]
                              }}
                            />
                            {/* Projected depletion overlay */}
                            {bottle.projection.length > 0 && projectedFill < currentFill && (
                              <div 
                                className="absolute top-0 h-full opacity-30"
                                style={{ 
                                  left: `${Math.min(100, Math.max(0, projectedFill))}%`,
                                  width: `${Math.min(100, Math.max(0, currentFill - projectedFill))}%`,
                                  backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 5px, ${COLORS[index % COLORS.length]} 5px, ${COLORS[index % COLORS.length]} 10px)`
                                }}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  <p>No burn rate data available</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            {/* Depletion Insights */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Depletion Insights</h3>
              <div className="space-y-3">
                {analytics.killRate.insights.consumptionChanges.map((change, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-lg">{change.isUp ? '🔥' : '📉'}</span>
                    <span className="text-sm text-gray-300">
                      {change.bottle} consumption {change.change}
                    </span>
                  </div>
                ))}
                {analytics.killRate.insights.warnings.map((warning, index) => (
                  <div key={`w-${index}`} className="flex items-start gap-2">
                    <span className="text-lg">⚠️</span>
                    <span className="text-sm text-gray-300">{warning}</span>
                  </div>
                ))}
                {analytics.killRate.insights.projections.map((projection, index) => (
                  <div key={`p-${index}`} className="flex items-start gap-2">
                    <span className="text-lg">💡</span>
                    <span className="text-sm text-gray-300">{projection}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-gray-700/30 rounded-lg p-4 lg:col-span-2">
              <h3 className="text-lg font-semibold mb-4">Kill Rate Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-copper">{analytics.killRate.stats.avgBottleLifespan}</div>
                  <div className="text-sm text-gray-400 mt-1">Avg Days per Bottle</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-white">{analytics.killRate.stats.finishedThisYear}</div>
                  <div className="text-sm text-gray-400 mt-1">Finished This Year</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="font-medium text-copper">{analytics.killRate.stats.fastestKilled.name}</div>
                  <div className="text-sm text-gray-400">{analytics.killRate.stats.fastestKilled.days} days • Fastest</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="font-medium text-white">{analytics.killRate.stats.slowestSipped.name}</div>
                  <div className="text-sm text-gray-400">{analytics.killRate.stats.slowestSipped.days} days • Slowest</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Smart Insights */}
        <section className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Brain className="w-6 h-6 text-copper" />
            <h2 className="text-2xl font-bold">Smart Insights</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Patterns */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-copper" />
                Drinking Patterns
              </h3>
              <ul className="space-y-3">
                {analytics.smartInsights.patterns.map((pattern, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-copper rounded-full mt-1.5 flex-shrink-0" />
                    <span className="text-gray-300">{pattern}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommendations */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                Recommendations
              </h3>
              <ul className="space-y-3">
                {analytics.smartInsights.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mt-1.5 flex-shrink-0" />
                    <span className="text-gray-300">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Achievements */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-green-500" />
                Achievements
              </h3>
              <ul className="space-y-3">
                {analytics.smartInsights.achievements.map((achievement, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5 flex-shrink-0" />
                    <span className="text-gray-300">{achievement}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

// Calendar Heat Map Component
function CalendarHeatMap({ data }: { data: Array<{ date: string; pours: number; totalAmount: number; avgRating?: number }> }) {
  const router = useRouter();
  const [hoveredDay, setHoveredDay] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Create a map for quick lookup
  const dataMap = new Map(data.map(d => [d.date, d]));

  // Calculate date range (365 days on desktop, 90 on mobile)
  const daysToShow = isMobile ? 90 : 365;
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999); // End of today
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - daysToShow + 1);
  startDate.setHours(0, 0, 0, 0); // Start of day

  // Generate all dates in range
  const dates = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Group by week
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];
  
  // Add empty cells for the first week if needed
  const firstDayOfWeek = dates[0].getDay();
  for (let i = 0; i < firstDayOfWeek; i++) {
    currentWeek.push(null as any);
  }

  dates.forEach(date => {
    currentWeek.push(date);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });
  
  // Only add the last week if it has actual dates
  if (currentWeek.length > 0) {
    // Fill the rest of the week with nulls
    while (currentWeek.length < 7) {
      currentWeek.push(null as any);
    }
    weeks.push(currentWeek);
  }

  // Get color based on pour count
  const getColor = (pours: number) => {
    if (pours === 0) return 'bg-gray-800';
    if (pours === 1) return 'bg-amber-900/30';
    if (pours === 2) return 'bg-amber-800/50';
    if (pours <= 4) return 'bg-amber-700/70';
    return 'bg-amber-600';
  };

  // Month labels - only add when month changes
  const monthLabels: { month: string; year: number; col: number }[] = [];
  let lastMonthYear = '';
  
  weeks.forEach((week, weekIndex) => {
    // Check the first valid date in the week
    const firstDateInWeek = week.find(date => date !== null);
    if (firstDateInWeek) {
      const monthYear = `${firstDateInWeek.getFullYear()}-${firstDateInWeek.getMonth()}`;
      if (monthYear !== lastMonthYear) {
        lastMonthYear = monthYear;
        monthLabels.push({
          month: firstDateInWeek.toLocaleDateString('en-US', { month: 'short' }),
          year: firstDateInWeek.getFullYear(),
          col: weekIndex
        });
      }
    }
  });

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handleDayClick = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    router.push(`/pour/sessions?date=${dateStr}`);
  };

  return (
    <div className="relative">
      {/* Month labels */}
      <div className="relative h-5 mb-2 ml-10">
        {monthLabels.map((label, i) => {
          // Show year for January or when year changes
          const showYear = label.month === 'Jan' || (i > 0 && monthLabels[i-1].year !== label.year);
          return (
            <div
              key={`${label.month}-${label.year}-${i}`}
              className="text-xs text-gray-400 absolute whitespace-nowrap"
              style={{ 
                left: `${label.col * 14}px`,
                top: 0
              }}
            >
              {label.month}{showYear && ` ${label.year}`}
            </div>
          );
        })}
      </div>

      <div className="flex gap-4 mt-6">
        {/* Day labels */}
        <div className="flex flex-col gap-1 text-xs text-gray-400">
          {dayLabels.map((day, i) => (
            <div key={i} className="h-3 leading-3">
              {i % 2 === 1 ? day.substring(0, 1) : ''}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="flex gap-1 overflow-x-auto">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-1">
              {week.map((date, dayIndex) => {
                if (!date) {
                  return <div key={`empty-${weekIndex}-${dayIndex}`} className="w-3 h-3" />;
                }

                const dateStr = date.toISOString().split('T')[0];
                const dayData = dataMap.get(dateStr);
                const pours = dayData?.pours || 0;

                return (
                  <div
                    key={`day-${dateStr}`}
                    className={`w-3 h-3 rounded-sm cursor-pointer transition-all ${getColor(pours)} hover:ring-2 hover:ring-copper`}
                    onClick={() => handleDayClick(date)}
                    onMouseEnter={() => setHoveredDay({ ...dayData, date })}
                    onMouseLeave={() => setHoveredDay(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {hoveredDay && (
        <div className="absolute z-10 bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm pointer-events-none"
          style={{
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%) translateY(-8px)',
          }}
        >
          <div className="font-medium text-white">
            {hoveredDay.date.toLocaleDateString('en-US', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric',
              year: 'numeric'
            })}
          </div>
          {hoveredDay.pours > 0 ? (
            <>
              <div className="text-copper">{hoveredDay.pours} pour{hoveredDay.pours !== 1 ? 's' : ''}</div>
              <div className="text-gray-400">{hoveredDay.totalAmount?.toFixed(1)}oz total</div>
              {hoveredDay.avgRating && (
                <div className="text-gray-400">Avg: {hoveredDay.avgRating.toFixed(1)}/10</div>
              )}
            </>
          ) : (
            <div className="text-gray-500">No pours</div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4">
        <span className="text-xs text-gray-400">Less</span>
        <div className="flex gap-1">
          <div className="w-3 h-3 bg-gray-800 rounded-sm" />
          <div className="w-3 h-3 bg-amber-900/30 rounded-sm" />
          <div className="w-3 h-3 bg-amber-800/50 rounded-sm" />
          <div className="w-3 h-3 bg-amber-700/70 rounded-sm" />
          <div className="w-3 h-3 bg-amber-600 rounded-sm" />
        </div>
        <span className="text-xs text-gray-400">More</span>
      </div>
    </div>
  );
}