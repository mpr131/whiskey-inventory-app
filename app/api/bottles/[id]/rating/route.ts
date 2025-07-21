import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { getUserBottleRating } from '@/utils/ratingCalculations';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const rating = await getUserBottleRating(session.user.id, params.id);

    return NextResponse.json({ rating });
  } catch (error) {
    console.error('Error fetching personal rating:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}