import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import UserBottle from '@/models/UserBottle';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // Get all user bottles with location data
    const bottles = await UserBottle.find({ 
      userId: session.user.id,
      location: { $exists: true, $ne: null }
    }).populate('masterBottleId');

    // Group bottles by location.area
    const locationMap = new Map<string, {
      area: string;
      bottles: any[];
      uniqueBins: Set<string>;
      totalBottles: number;
      totalValue: number;
    }>();

    for (const bottle of bottles) {
      if (!bottle.location?.area) continue;

      const area = bottle.location.area;
      
      if (!locationMap.has(area)) {
        locationMap.set(area, {
          area,
          bottles: [],
          uniqueBins: new Set(),
          totalBottles: 0,
          totalValue: 0,
        });
      }

      const locationData = locationMap.get(area)!;
      locationData.bottles.push(bottle);
      locationData.totalBottles += bottle.quantity || 1;
      
      // Calculate value (use myValue > marketValue > purchasePrice)
      const bottleValue = bottle.myValue || bottle.marketValue || bottle.purchasePrice || 0;
      locationData.totalValue += bottleValue * (bottle.quantity || 1);

      // Track unique bins
      if (bottle.location.bin) {
        locationData.uniqueBins.add(bottle.location.bin);
      }
    }

    // Convert to array and format for response
    const locations = Array.from(locationMap.values()).map(location => ({
      name: location.area,
      totalBottles: location.totalBottles,
      totalValue: location.totalValue,
      uniqueBins: location.uniqueBins.size,
      bottles: location.bottles.map(bottle => ({
        _id: bottle._id,
        name: bottle.masterBottleId?.name || 'Unknown',
        distillery: bottle.masterBottleId?.distillery || 'Unknown',
        quantity: bottle.quantity,
        bin: bottle.location?.bin || '',
        value: bottle.myValue || bottle.marketValue || bottle.purchasePrice || 0,
      })),
    }));

    // Sort by total bottles descending
    locations.sort((a, b) => b.totalBottles - a.totalBottles);

    return NextResponse.json({ locations });
  } catch (error) {
    console.error('Error fetching locations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}