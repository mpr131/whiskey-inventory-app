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

    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q') || '';

    // Get all unique location areas for the user
    const bottles = await UserBottle.find({
      userId: session.user.id,
      'location.area': { $exists: true, $ne: '' }
    }).select('location.area');

    // Extract unique areas
    const areasSet = new Set<string>();
    bottles.forEach(bottle => {
      if (bottle.location?.area) {
        areasSet.add(bottle.location.area);
      }
    });

    // Filter by query if provided
    let areas = Array.from(areasSet);
    if (query) {
      areas = areas.filter(area => 
        area.toLowerCase().includes(query.toLowerCase())
      );
    }

    // Sort areas
    areas.sort((a, b) => {
      // Prioritize exact matches
      if (query) {
        const aExact = a.toLowerCase() === query.toLowerCase();
        const bExact = b.toLowerCase() === query.toLowerCase();
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
      }
      return a.localeCompare(b);
    });

    return NextResponse.json({ areas });
  } catch (error) {
    console.error('Error fetching location areas:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}