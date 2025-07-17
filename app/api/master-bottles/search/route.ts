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
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!query || query.length < 2) {
      return NextResponse.json({ bottles: [] });
    }

    const bottles = await MasterBottle.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { brand: { $regex: query, $options: 'i' } },
        { distillery: { $regex: query, $options: 'i' } },
      ],
    })
    .limit(limit)
    .sort({ name: 1 });

    return NextResponse.json({ bottles });
  } catch (error) {
    console.error('Error searching master bottles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}