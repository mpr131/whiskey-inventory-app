import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import MasterBottle from '@/models/MasterBottle';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const field = searchParams.get('field') || 'distillery'; // 'distillery' or 'brand'

    if (query.length < 1) {
      return NextResponse.json({ producers: [] });
    }

    // Aggregate to get unique values
    const pipeline = [
      {
        $match: {
          [field]: { $regex: query, $options: 'i' }
        }
      },
      {
        $group: {
          _id: `$${field}`
        }
      },
      {
        $sort: { _id: 1 as 1 }
      },
      {
        $limit: 20
      }
    ];

    const results = await MasterBottle.aggregate(pipeline);
    const producers = results.map(r => r._id).filter(p => p);

    // Sort with smart matching
    producers.sort((a, b) => {
      const aExact = a.toLowerCase() === query.toLowerCase();
      const bExact = b.toLowerCase() === query.toLowerCase();
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      const aStarts = a.toLowerCase().startsWith(query.toLowerCase());
      const bStarts = b.toLowerCase().startsWith(query.toLowerCase());
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      
      return a.localeCompare(b);
    });

    return NextResponse.json({ producers });
  } catch (error) {
    console.error('Error fetching producers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}