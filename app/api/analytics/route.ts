import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import UserBottle from '@/models/UserBottle';
import Pour from '@/models/Pour';

export async function GET(request: Request) {
  console.log('Analytics API route called at:', new Date().toISOString());
  
  // Wrap EVERYTHING in try-catch to ensure no uncaught errors
  try {
    // TEST 1: Basic API reachability - UNCOMMENT TO TEST
    /*
    return NextResponse.json({ 
      test: 'API is reachable', 
      timestamp: new Date().toISOString(),
      message: 'If you see this, the API route is working. Comment this out to test real functionality.'
    });
    */
    
    // TEST 2: Real analytics code starts here
    
    // TEST 2: Test imports and basic setup
    console.time('Analytics API Total');
    console.log('Starting analytics API...');
    
    // TEST 3: Test authentication
    console.log('Testing authentication...');
    const session = await getServerSession(authOptions);
    if (!session) {
      console.log('No session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('Session found for user:', session.user?.id);
    
    // TEST 4: Test database connection
    console.log('Connecting to database...');
    await dbConnect();
    console.log('Database connected successfully');

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30d';
    const section = searchParams.get('section'); // For testing specific sections

    // Calculate date range
    const now = new Date();
    const startDate = new Date();
    switch (range) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    // Tonight's/Today's Pours based on session boundaries
    console.time('Tonight Pours Query');
    // now is already declared above
    const currentHour = now.getHours();
    
    // Determine session start time based on current time
    let sessionStart = new Date();
    
    if (currentHour >= 4 && currentHour < 18) {
      // Daytime session: 4 AM today onwards
      sessionStart.setHours(4, 0, 0, 0);
    } else if (currentHour >= 18) {
      // Evening session: 6 PM today onwards
      sessionStart.setHours(18, 0, 0, 0);
    } else {
      // Late night (midnight-4am): Still part of previous evening's session
      // Go back to 6 PM yesterday
      sessionStart.setDate(sessionStart.getDate() - 1);
      sessionStart.setHours(18, 0, 0, 0);
    }
    
    const tonightsPours = await Pour.find({
      userId: session.user.id,
      createdAt: { $gte: sessionStart }
    })
    .populate({
      path: 'userBottleId',
      populate: {
        path: 'masterBottleId',
        model: 'MasterBottle'
      }
    })
    .sort({ createdAt: 1 })
    .lean();
    console.timeEnd('Tonight Pours Query');

    const tonightsData = {
      pours: tonightsPours.map(pour => ({
        time: pour.createdAt,
        bottleName: pour.userBottleId?.masterBottleId?.name || 'Unknown',
        amount: pour.amount,
        rating: pour.rating,
        companions: pour.companions
      })),
      totalAmount: tonightsPours.reduce((sum, pour) => sum + pour.amount, 0),
      averageRating: tonightsPours.filter(p => p.rating).length > 0
        ? tonightsPours.filter(p => p.rating).reduce((sum, p) => sum + (p.rating || 0), 0) / tonightsPours.filter(p => p.rating).length
        : undefined
    };

    // Collection Insights
    console.time('Collection Query');
    const userBottles = await UserBottle.find({ 
      userId: session.user.id,
      status: { $ne: 'finished' }
    })
    .populate('masterBottleId')
    .lean();
    console.timeEnd('Collection Query');

    // Category breakdown
    const categoryCount: Record<string, number> = {};
    const ageCount: Record<string, number> = {};
    const proofRanges: Record<string, number> = {
      '80-90': 0,
      '90-100': 0,
      '100-110': 0,
      '110-120': 0,
      '120+': 0
    };

    let totalValue = 0;
    const valuableBottles: Array<{ name: string; value: number; rating?: number; valuePerPoint?: number }> = [];
    const valueAnalysisBottles: Array<{
      name: string;
      category: string;
      price: number;
      rating: number;
      valuePerPoint: number;
    }> = [];
    const categoryValueData: Record<string, { totalValuePerPoint: number; count: number }> = {};

    userBottles.forEach(bottle => {
      const master = bottle.masterBottleId as any;
      if (!master || typeof master === 'string') return;

      // Category
      const category = master.category || 'Other';
      categoryCount[category] = (categoryCount[category] || 0) + 1;

      // Age
      if (master.age) {
        const ageGroup = `${master.age} Year`;
        ageCount[ageGroup] = (ageCount[ageGroup] || 0) + 1;
      }

      // Proof
      if (master.proof) {
        if (master.proof < 90) proofRanges['80-90']++;
        else if (master.proof < 100) proofRanges['90-100']++;
        else if (master.proof < 110) proofRanges['100-110']++;
        else if (master.proof < 120) proofRanges['110-120']++;
        else proofRanges['120+']++;
      }

      // Value
      const value = bottle.marketValue || bottle.purchasePrice || 0;
      totalValue += value;
      
      // Get rating from bottle's average rating
      const rating = bottle.averageRating || 0;
      
      if (value > 0) {
        valuableBottles.push({ 
          name: master.name, 
          value,
          rating: rating > 0 ? rating : undefined,
          valuePerPoint: rating > 0 ? value / rating : undefined
        });
      }

      // Value per point analysis
      if (value > 0 && rating > 0) {
        const valuePerPoint = value / rating;
        valueAnalysisBottles.push({
          name: master.name,
          category,
          price: value,
          rating,
          valuePerPoint
        });

        // Track category averages
        if (!categoryValueData[category]) {
          categoryValueData[category] = { totalValuePerPoint: 0, count: 0 };
        }
        categoryValueData[category].totalValuePerPoint += valuePerPoint;
        categoryValueData[category].count++;
      }
    });

    const totalBottles = userBottles.length;
    const categoryBreakdown = Object.entries(categoryCount).map(([name, value]) => ({
      name,
      value,
      percentage: Math.round((value / totalBottles) * 100)
    }));

    const ageDistribution = Object.entries(ageCount)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .map(([age, count]) => ({ age, count }));

    const proofDistribution = Object.entries(proofRanges)
      .map(([range, count]) => ({ range, count }));

    const mostValuable = valuableBottles
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Process value analytics
    const bestValues = valueAnalysisBottles
      .sort((a, b) => a.valuePerPoint - b.valuePerPoint)
      .slice(0, 10);

    const overpriced = valueAnalysisBottles
      .sort((a, b) => b.valuePerPoint - a.valuePerPoint)
      .slice(0, 10);

    const categoryValueBreakdown = Object.entries(categoryValueData)
      .map(([category, data]) => ({
        category,
        avgValuePerPoint: data.totalValuePerPoint / data.count,
        bottleCount: data.count
      }))
      .sort((a, b) => a.avgValuePerPoint - b.avgValuePerPoint);

    // Pour Analytics - Limit to reasonable amount
    console.time('Pour Analytics Query');
    const allPours = await Pour.find({
      userId: session.user.id,
      createdAt: { $gte: startDate }
    })
    .populate({
      path: 'userBottleId',
      populate: {
        path: 'masterBottleId',
        model: 'MasterBottle'
      }
    })
    .sort({ createdAt: -1 })
    .limit(1000) // Limit to prevent memory issues
    .lean();
    console.timeEnd('Pour Analytics Query');

    // Most poured bottles
    const pourCounts: Record<string, { name: string; pours: number; amount: number }> = {};
    const sizeCounts: Record<string, number> = {
      '0.5oz': 0,
      '1oz': 0,
      '1.5oz': 0,
      '2oz': 0,
      '2oz+': 0
    };
    const categoryRatings: Record<string, number[]> = {};
    let totalCost = 0;

    allPours.forEach(pour => {
      const bottleId = pour.userBottleId?._id?.toString();
      const bottleName = pour.userBottleId?.masterBottleId?.name || 'Unknown';
      const category = pour.userBottleId?.masterBottleId?.category || 'Other';

      if (bottleId) {
        if (!pourCounts[bottleId]) {
          pourCounts[bottleId] = { name: bottleName, pours: 0, amount: 0 };
        }
        pourCounts[bottleId].pours++;
        pourCounts[bottleId].amount += pour.amount;
      }

      // Size distribution
      if (pour.amount <= 0.5) sizeCounts['0.5oz']++;
      else if (pour.amount <= 1) sizeCounts['1oz']++;
      else if (pour.amount <= 1.5) sizeCounts['1.5oz']++;
      else if (pour.amount <= 2) sizeCounts['2oz']++;
      else sizeCounts['2oz+']++;

      // Ratings by category
      if (pour.rating) {
        if (!categoryRatings[category]) {
          categoryRatings[category] = [];
        }
        categoryRatings[category].push(pour.rating);
      }

      // Cost calculation
      if (pour.costPerPour) {
        totalCost += pour.costPerPour;
      }
    });

    const mostPoured = Object.values(pourCounts)
      .sort((a, b) => b.pours - a.pours)
      .slice(0, 5);

    const pourSizeDistribution = Object.entries(sizeCounts)
      .filter(([_, count]) => count > 0)
      .map(([size, count]) => ({ size, count }));

    const ratingsByCategory = Object.entries(categoryRatings)
      .map(([category, ratings]) => ({
        category,
        avgRating: ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      }))
      .sort((a, b) => b.avgRating - a.avgRating);

    const averageCostPerPour = allPours.length > 0 ? totalCost / allPours.length : 0;

    // Smart Insights
    const patterns: string[] = [];
    const recommendations: string[] = [];
    const achievements: string[] = [];

    // Analyze patterns
    if (tonightsPours.length > 3) {
      patterns.push(`You tend to have ${tonightsPours.length} pours in a session`);
    }
    
    const avgPourSize = allPours.reduce((sum, p) => sum + p.amount, 0) / allPours.length;
    patterns.push(`Your typical pour is ${avgPourSize.toFixed(1)}oz`);

    const favoriteCategory = categoryBreakdown.sort((a, b) => b.value - a.value)[0]?.name;
    if (favoriteCategory) {
      patterns.push(`${favoriteCategory} makes up ${categoryBreakdown[0].percentage}% of your collection`);
    }

    // Recommendations
    if (avgPourSize > 1.5) {
      recommendations.push('Consider smaller pours to savor your whiskey longer');
    }

    const lowRatedCategories = ratingsByCategory.filter(c => c.avgRating < 6);
    if (lowRatedCategories.length > 0) {
      recommendations.push(`Try exploring beyond ${lowRatedCategories[0].category} for higher satisfaction`);
    }

    if (mostPoured.length > 0 && mostPoured[0].pours > allPours.length * 0.3) {
      recommendations.push(`Branch out from ${mostPoured[0].name} - variety is the spice of life!`);
    }

    // Achievements
    if (allPours.length >= 100) {
      achievements.push('Century Club: 100+ pours tracked!');
    }
    if (userBottles.length >= 50) {
      achievements.push('Serious Collector: 50+ bottles in collection');
    }
    if (totalValue >= 10000) {
      achievements.push('Premium Vault: Collection worth over $10,000');
    }
    const perfectPours = allPours.filter(p => p.rating === 10);
    if (perfectPours.length > 0) {
      achievements.push(`Found ${perfectPours.length} perfect 10/10 pour${perfectPours.length > 1 ? 's' : ''}!`);
    }

    // Pour Calendar Data
    console.time('Calendar Query');
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const calendarPours = await Pour.find({
      userId: session.user.id,
      createdAt: { $gte: oneYearAgo }
    })
    .select('createdAt amount rating') // Only select needed fields
    .sort({ createdAt: 1 })
    .lean();
    console.timeEnd('Calendar Query');

    // Group pours by date
    const dailyPours: Record<string, { pours: number; totalAmount: number; ratings: number[] }> = {};
    const weekdayStats: Record<number, { pours: string[]; ratings: number[] }> = {
      0: { pours: [], ratings: [] }, // Sunday
      1: { pours: [], ratings: [] },
      2: { pours: [], ratings: [] },
      3: { pours: [], ratings: [] },
      4: { pours: [], ratings: [] },
      5: { pours: [], ratings: [] },
      6: { pours: [], ratings: [] }, // Saturday
    };
    const monthlyPours: Record<string, number> = {};

    calendarPours.forEach(pour => {
      const date = new Date(pour.createdAt);
      const dateStr = date.toISOString().split('T')[0];
      const weekday = date.getDay();
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      // Daily data
      if (!dailyPours[dateStr]) {
        dailyPours[dateStr] = { pours: 0, totalAmount: 0, ratings: [] };
      }
      dailyPours[dateStr].pours++;
      dailyPours[dateStr].totalAmount += pour.amount;
      if (pour.rating) {
        dailyPours[dateStr].ratings.push(pour.rating);
      }

      // Weekly patterns
      if (!weekdayStats[weekday].pours.includes(dateStr)) {
        weekdayStats[weekday].pours.push(dateStr);
      }
      if (pour.rating) {
        weekdayStats[weekday].ratings.push(pour.rating);
      }

      // Monthly trends
      monthlyPours[monthKey] = (monthlyPours[monthKey] || 0) + 1;
    });

    // Process daily data
    const dailyData = Object.entries(dailyPours).map(([date, data]) => ({
      date,
      pours: data.pours,
      totalAmount: data.totalAmount,
      avgRating: data.ratings.length > 0 
        ? data.ratings.reduce((sum, r) => sum + r, 0) / data.ratings.length 
        : undefined
    }));

    // Process weekly patterns
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weeklyPatterns = Object.entries(weekdayStats).map(([day, stats]) => ({
      day: weekdays[parseInt(day)].substring(0, 3),
      avgPours: stats.pours.length > 0 ? stats.pours.reduce((sum, d) => sum + (dailyPours[d]?.pours || 0), 0) / stats.pours.length : 0,
      avgRating: stats.ratings.length > 0 ? stats.ratings.reduce((sum, r) => sum + r, 0) / stats.ratings.length : 0
    }));

    // Process monthly trends
    const monthlyTrends = Object.entries(monthlyPours)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12) // Last 12 months
      .map(([month, pours]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        pours
      }));

    // Calculate insights
    const weekdayPourCounts = weeklyPatterns.map(w => ({ day: w.day, avg: w.avgPours }));
    const heaviestDay = weekdayPourCounts.reduce((max, day) => day.avg > max.avg ? day : max);
    
    const weekdayRatings = weeklyPatterns.filter(w => w.avgRating > 0);
    const bestRatingDay = weekdayRatings.length > 0 
      ? weekdayRatings.reduce((max, day) => day.avgRating > max.avgRating ? day : max)
      : { day: 'None', avgRating: 0 };

    // Calculate streaks
    let longestStreak = 0;
    let currentStreak = 0;
    let streakStart = '';
    let streakEnd = '';
    let tempStreakStart = '';
    
    const sortedDates = Object.keys(dailyPours).sort();
    sortedDates.forEach((dateStr, index) => {
      if (index === 0) {
        currentStreak = 1;
        tempStreakStart = dateStr;
      } else {
        const prevDate = new Date(sortedDates[index - 1]);
        const currDate = new Date(dateStr);
        const dayDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (dayDiff === 1) {
          currentStreak++;
        } else {
          if (currentStreak > longestStreak) {
            longestStreak = currentStreak;
            streakStart = tempStreakStart;
            streakEnd = sortedDates[index - 1];
          }
          currentStreak = 1;
          tempStreakStart = dateStr;
        }
      }
    });
    
    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
      streakStart = tempStreakStart;
      streakEnd = sortedDates[sortedDates.length - 1];
    }

    // Seasonal pattern
    const seasonalCounts = { winter: 0, spring: 0, summer: 0, fall: 0 };
    calendarPours.forEach(pour => {
      const month = new Date(pour.createdAt).getMonth();
      if (month < 3) seasonalCounts.winter++;
      else if (month < 6) seasonalCounts.spring++;
      else if (month < 9) seasonalCounts.summer++;
      else seasonalCounts.fall++;
    });
    
    const totalSeasonalPours = Object.values(seasonalCounts).reduce((sum, count) => sum + count, 0);
    const seasonalPercentages = Object.entries(seasonalCounts)
      .map(([season, count]) => ({ season, percentage: (count / totalSeasonalPours) * 100 }))
      .sort((a, b) => b.percentage - a.percentage);
    
    let seasonalPattern = undefined;
    if (seasonalPercentages[0].percentage > 35) {
      const diff = seasonalPercentages[0].percentage - 25; // Expected 25% for even distribution
      seasonalPattern = `You drink ${Math.round(diff)}% more in ${seasonalPercentages[0].season}`;
    }

    const streakDatesFormatted = streakStart && streakEnd 
      ? `${new Date(streakStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(streakEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      : 'No streaks yet';

    // Kill Rate Analytics - Optimize queries
    console.time('Kill Rate Query');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Only get open bottles with recent activity
    const openBottles = await UserBottle.find({
      userId: session.user.id,
      status: 'opened',
      fillLevel: { $gt: 0, $lt: 100 } // Exclude full bottles
    })
    .populate('masterBottleId')
    .limit(20) // Limit to top 20 open bottles
    .lean();

    // Get pour history for open bottles in one query
    const openBottleIds = openBottles.map(b => b._id);
    const recentPours = await Pour.find({
      userId: session.user.id,
      userBottleId: { $in: openBottleIds },
      createdAt: { $gte: thirtyDaysAgo }
    })
    .select('userBottleId amount createdAt')
    .sort({ createdAt: 1 })
    .lean();
    
    // Group pours by bottle
    const bottlePourData: Record<string, { pours: any[]; bottle: any }> = {};
    openBottles.forEach(bottle => {
      const bottlePours = recentPours.filter(p => 
        p.userBottleId.toString() === bottle._id.toString()
      );
      if (bottlePours.length > 0) {
        bottlePourData[bottle._id.toString()] = {
          pours: bottlePours,
          bottle
        };
      }
    });
    console.timeEnd('Kill Rate Query');

    // Calculate depletion predictions
    const depletionPredictions: Array<{
      bottleId: string;
      bottleName: string;
      fillLevel: number;
      daysUntilEmpty: number;
      depletionRate: number;
      remainingOz: number;
    }> = [];
    const burnRateData: Array<{
      bottleName: string;
      history: Array<{ date: string; fillLevel: number }>;
      projection: Array<{ date: string; fillLevel: number }>;
    }> = [];
    
    for (const [, data] of Object.entries(bottlePourData)) {
      const { pours, bottle } = data;
      const totalPoured = pours.reduce((sum, p) => sum + p.amount, 0);
      const daysSinceFirstPour = Math.max(1, (Date.now() - pours[0].createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const ozPerDay = totalPoured / daysSinceFirstPour;
      const ozPerWeek = ozPerDay * 7;
      
      const bottleSize = 25.36; // 750ml in oz
      const remainingOz = (bottle.fillLevel / 100) * bottleSize;
      const daysUntilEmpty = ozPerDay > 0 ? Math.round(remainingOz / ozPerDay) : 999;
      
      depletionPredictions.push({
        bottleId: bottle._id.toString(),
        bottleName: (bottle.masterBottleId as any)?.name || 'Unknown',
        fillLevel: bottle.fillLevel,
        daysUntilEmpty,
        depletionRate: ozPerWeek,
        remainingOz
      });
      
      // Generate burn rate history and projection
      if (burnRateData.length < 5) {
        const history = [];
        const projection = [];
        
        // Calculate historical fill levels
        let currentFill = bottle.fillLevel;
        const poursReversed = [...pours].reverse();
        
        history.push({
          date: new Date().toISOString(),
          fillLevel: currentFill
        });
        
        poursReversed.forEach(pour => {
          currentFill += (pour.amount / bottleSize) * 100;
          history.unshift({
            date: pour.createdAt.toISOString(),
            fillLevel: Math.min(100, currentFill)
          });
        });
        
        // Project future depletion
        if (daysUntilEmpty < 180) {
          const projectionDays = Math.min(daysUntilEmpty + 7, 90);
          for (let day = 1; day <= projectionDays; day += 7) {
            const projectedFill = Math.max(0, bottle.fillLevel - (ozPerDay * day / bottleSize) * 100);
            const projectionDate = new Date();
            projectionDate.setDate(projectionDate.getDate() + day);
            projection.push({
              date: projectionDate.toISOString(),
              fillLevel: projectedFill
            });
          }
        }
        
        burnRateData.push({
          bottleName: (bottle.masterBottleId as any)?.name || 'Unknown',
          history: history.slice(-10), // Last 10 data points
          projection
        });
      }
    }

    // Sort depletion predictions by days until empty
    depletionPredictions.sort((a, b) => a.daysUntilEmpty - b.daysUntilEmpty);

    // Calculate consumption changes
    const consumptionChanges: Array<{
      bottle: string;
      change: string;
      isUp: boolean;
    }> = [];
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    for (const [, data] of Object.entries(bottlePourData).slice(0, 3)) {
      const recentPours = data.pours.filter(p => p.createdAt >= twoWeeksAgo);
      const olderPours = data.pours.filter(p => p.createdAt < twoWeeksAgo);
      
      if (recentPours.length > 0 && olderPours.length > 0) {
        const recentRate = recentPours.reduce((sum, p) => sum + p.amount, 0) / 14;
        const olderRate = olderPours.reduce((sum, p) => sum + p.amount, 0) / 16;
        const changePercent = ((recentRate - olderRate) / olderRate) * 100;
        
        if (Math.abs(changePercent) > 20) {
          consumptionChanges.push({
            bottle: (data.bottle.masterBottleId as any)?.name || 'Unknown',
            change: `${changePercent > 0 ? 'up' : 'down'} ${Math.abs(Math.round(changePercent))}% this month`,
            isUp: changePercent > 0
          });
        }
      }
    }

    // Generate warnings and projections
    const warnings: string[] = [];
    const projections: string[] = [];
    
    const emptyingSoon = depletionPredictions.filter(b => b.daysUntilEmpty <= 14);
    if (emptyingSoon.length > 0) {
      warnings.push(`${emptyingSoon.length} bottle${emptyingSoon.length > 1 ? 's' : ''} will be empty within 2 weeks`);
    }
    
    const slowSippers = depletionPredictions.filter(b => b.daysUntilEmpty > 180);
    slowSippers.forEach(bottle => {
      if (bottle.daysUntilEmpty < 365) {
        projections.push(`At current rate, your ${bottle.bottleName} will last ${Math.round(bottle.daysUntilEmpty / 30)} months`);
      }
    });

    // Calculate stats - Optimize queries
    console.time('Stats Query');
    const currentYear = new Date(new Date().getFullYear(), 0, 1);
    
    // Count finished bottles this year
    const finishedCount = await UserBottle.countDocuments({
      userId: session.user.id,
      status: 'finished',
      updatedAt: { $gte: currentYear }
    });

    // Get bottle lifespans with limit
    const bottleLifespans = await UserBottle.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(session.user.id),
          status: 'finished',
          openedDate: { $exists: true },
          finishedDate: { $exists: true }
        }
      },
      {
        $project: {
          name: 1,
          lifespan: {
            $divide: [
              { $subtract: ['$finishedDate', '$openedDate'] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      },
      { $limit: 100 } // Limit to prevent memory issues
    ]);
    console.timeEnd('Stats Query');

    const avgBottleLifespan = bottleLifespans.length > 0
      ? Math.round(bottleLifespans.reduce((sum, b) => sum + b.lifespan, 0) / bottleLifespans.length)
      : 0;

    const fastestKilled = bottleLifespans.length > 0
      ? bottleLifespans.reduce((min, b) => b.lifespan < min.lifespan ? b : min)
      : { name: 'None yet', lifespan: 0 };

    const slowestSipped = bottleLifespans.length > 0
      ? bottleLifespans.reduce((max, b) => b.lifespan > max.lifespan ? b : max)
      : { name: 'None yet', lifespan: 0 };

    // If testing specific section, return only that data
    if (section) {
      console.log(`Returning only ${section} section`);
      const sections: Record<string, any> = {
        tonightsPours: tonightsData,
        collectionInsights: {
          categoryBreakdown,
          ageDistribution,
          proofDistribution,
          mostValuable,
          totalValue,
          averageValue: totalValue / userBottles.length
        },
        valueAnalytics: {
          bestValues,
          overpriced,
          categoryBreakdown: categoryValueBreakdown
        },
        pourAnalytics: {
          mostPoured,
          pourSizeDistribution,
          ratingsByCategory,
          weeklyHeatMap: [],
          costPerPour: {
            total: totalCost,
            average: averageCostPerPour
          }
        },
        pourCalendar: {
          dailyData,
          weeklyPatterns,
          monthlyTrends,
          insights: {
            heaviestDay: heaviestDay.day,
            heaviestDayAvg: heaviestDay.avg,
            longestStreak,
            streakDates: streakDatesFormatted,
            seasonalPattern,
            bestRatingDay: bestRatingDay.day,
            bestRatingAvg: bestRatingDay.avgRating
          }
        },
        killRate: {
          depletionPredictions: depletionPredictions.slice(0, 10),
          burnRateData,
          insights: {
            consumptionChanges,
            warnings,
            projections: projections.slice(0, 3)
          },
          stats: {
            avgBottleLifespan,
            fastestKilled: {
              name: fastestKilled.name || 'None yet',
              days: Math.round(fastestKilled.lifespan)
            },
            slowestSipped: {
              name: slowestSipped.name || 'None yet',
              days: Math.round(slowestSipped.lifespan)
            },
            finishedThisYear: finishedCount
          }
        },
        smartInsights: {
          patterns,
          recommendations,
          achievements
        }
      };
      
      return NextResponse.json({
        [section]: sections[section] || {},
        _debug: {
          section,
          available: Object.keys(sections)
        }
      });
    }

    return NextResponse.json({
      tonightsPours: tonightsData,
      collectionInsights: {
        categoryBreakdown,
        ageDistribution,
        proofDistribution,
        mostValuable,
        totalValue,
        averageValue: totalValue / userBottles.length
      },
      valueAnalytics: {
        bestValues,
        overpriced,
        categoryBreakdown: categoryValueBreakdown
      },
      pourAnalytics: {
        mostPoured,
        pourSizeDistribution,
        ratingsByCategory,
        weeklyHeatMap: [], // TODO: Implement heat map data
        costPerPour: {
          total: totalCost,
          average: averageCostPerPour
        }
      },
      pourCalendar: {
        dailyData,
        weeklyPatterns,
        monthlyTrends,
        insights: {
          heaviestDay: heaviestDay.day,
          heaviestDayAvg: heaviestDay.avg,
          longestStreak,
          streakDates: streakDatesFormatted,
          seasonalPattern,
          bestRatingDay: bestRatingDay.day,
          bestRatingAvg: bestRatingDay.avgRating
        }
      },
      killRate: {
        depletionPredictions: depletionPredictions.slice(0, 10),
        burnRateData,
        insights: {
          consumptionChanges,
          warnings,
          projections: projections.slice(0, 3)
        },
        stats: {
          avgBottleLifespan,
          fastestKilled: {
            name: fastestKilled.name || 'None yet',
            days: Math.round(fastestKilled.lifespan)
          },
          slowestSipped: {
            name: slowestSipped.name || 'None yet',
            days: Math.round(slowestSipped.lifespan)
          },
          finishedThisYear: finishedCount
        }
      },
      smartInsights: {
        patterns,
        recommendations,
        achievements
      }
    });

  } catch (error) {
    // Catch ALL errors, even those outside the main logic
    console.error('Analytics API Critical Error:', error);
    console.error('Error type:', typeof error);
    console.error('Error name:', error instanceof Error ? error.name : 'Unknown');
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Return more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = {
      error: 'Failed to fetch analytics',
      message: errorMessage,
      timestamp: new Date().toISOString(),
      details: error instanceof Error ? error.stack : String(error)
    };
    
    return NextResponse.json(errorDetails, { status: 500 });
  }
}