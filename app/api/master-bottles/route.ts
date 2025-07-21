import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import MasterBottle from '@/models/MasterBottle';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const upc = searchParams.get('upc');
    const limit = parseInt(searchParams.get('limit') || '20');

    let query: any = {};

    // Search by UPC
    if (upc) {
      query = { 'upcCodes.code': upc };
    }
    // Search by name/brand/distillery
    else if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { brand: { $regex: search, $options: 'i' } },
          { distillery: { $regex: search, $options: 'i' } },
        ],
      };
    }

    const bottles = await MasterBottle.find(query)
      .limit(limit)
      .sort({ name: 1 });

    return NextResponse.json(bottles);

  } catch (error) {
    console.error('Error fetching master bottles:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}