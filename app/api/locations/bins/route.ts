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
    const area = searchParams.get('area') || '';
    const query = searchParams.get('q') || '';

    if (!area) {
      return NextResponse.json({ bins: [] });
    }

    // Get all unique bins for the specified area
    const bottles = await UserBottle.find({
      userId: session.user.id,
      'location.area': area,
      'location.bin': { $exists: true, $ne: '' }
    }).select('location.bin');

    // Extract unique bins
    const binsSet = new Set<string>();
    bottles.forEach(bottle => {
      if (bottle.location?.bin) {
        binsSet.add(bottle.location.bin);
      }
    });

    // Filter by query if provided
    let bins = Array.from(binsSet);
    if (query) {
      bins = bins.filter(bin => 
        bin.toLowerCase().includes(query.toLowerCase())
      );
    }

    // Sort bins (try to sort numerically if possible)
    bins.sort((a, b) => {
      const aNum = parseInt(a);
      const bNum = parseInt(b);
      
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }
      
      return a.localeCompare(b);
    });

    return NextResponse.json({ bins });
  } catch (error) {
    console.error('Error fetching location bins:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}