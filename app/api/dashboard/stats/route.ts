import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import UserBottle from '@/models/UserBottle';
import MasterBottle from '@/models/MasterBottle';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // Get all user bottles with populated master data
    const userBottles = await UserBottle.find({ 
      userId: session.user.id 
    }).populate('masterBottleId');

    // Calculate statistics
    let totalBottles = 0;
    let totalValue = 0;
    let openBottles = 0;
    const uniqueLocations = new Set<string>();
    const uniqueMasterBottles = new Set<string>();

    for (const bottle of userBottles) {
      // Count total bottles (considering quantity)
      totalBottles += bottle.quantity || 1;

      // Calculate value (use myValue if set, otherwise marketValue, otherwise purchasePrice)
      const bottleValue = bottle.myValue || bottle.marketValue || bottle.purchasePrice || 0;
      totalValue += bottleValue * (bottle.quantity || 1);

      // Count open bottles
      if (bottle.status === 'opened') {
        openBottles += bottle.quantity || 1;
      }

      // Track unique locations
      if (bottle.location) {
        const locationKey = `${bottle.location.area || 'Unknown'}${bottle.location.bin ? ` - ${bottle.location.bin}` : ''}`;
        uniqueLocations.add(locationKey);
      }

      // Track unique master bottles
      if (bottle.masterBottleId) {
        uniqueMasterBottles.add(bottle.masterBottleId._id.toString());
      }
    }

    // Get recent bottles for activity feed
    const recentBottles = await UserBottle.find({ 
      userId: session.user.id 
    })
    .populate('masterBottleId')
    .sort('-createdAt')
    .limit(5);

    // Get top valued bottles
    const topValuedBottles = userBottles
      .map(bottle => ({
        ...bottle.toObject(),
        totalValue: (bottle.myValue || bottle.marketValue || bottle.purchasePrice || 0) * (bottle.quantity || 1)
      }))
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 5);

    // Get low stock bottles (opened bottles with fill level < 20%)
    const lowStockBottles = userBottles
      .filter(bottle => bottle.status === 'opened' && bottle.fillLevel < 20)
      .map(bottle => ({
        _id: bottle._id,
        name: bottle.masterBottleId?.name || 'Unknown',
        distillery: bottle.masterBottleId?.distillery || 'Unknown',
        fillLevel: bottle.fillLevel,
        quantity: bottle.quantity,
        location: bottle.location,
        openDate: bottle.openDate,
      }))
      .sort((a, b) => a.fillLevel - b.fillLevel)
      .slice(0, 10);

    return NextResponse.json({
      stats: {
        totalBottles,
        totalValue,
        openBottles,
        uniqueBottles: uniqueMasterBottles.size,
        locations: uniqueLocations.size,
        lowStockBottles: lowStockBottles.length,
      },
      recentBottles: recentBottles.map(bottle => ({
        _id: bottle._id,
        name: bottle.masterBottleId?.name || 'Unknown',
        distillery: bottle.masterBottleId?.distillery || 'Unknown',
        quantity: bottle.quantity,
        status: bottle.status,
        fillLevel: bottle.fillLevel,
        createdAt: bottle.createdAt,
      })),
      topValuedBottles: topValuedBottles.map(bottle => ({
        _id: bottle._id,
        name: bottle.masterBottleId?.name || 'Unknown',
        distillery: bottle.masterBottleId?.distillery || 'Unknown',
        quantity: bottle.quantity,
        totalValue: bottle.totalValue,
      })),
      lowStockBottles: lowStockBottles,
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}