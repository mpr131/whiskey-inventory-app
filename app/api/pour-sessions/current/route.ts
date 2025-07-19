import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import PourSession from '@/models/PourSession';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // Find session from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const currentSession = await PourSession.findOne({
      userId: session.user.id,
      date: {
        $gte: today,
        $lt: tomorrow,
      },
    }).sort('-createdAt');

    if (!currentSession) {
      return NextResponse.json({ session: null });
    }

    return NextResponse.json({ session: currentSession });
  } catch (error) {
    console.error('Error fetching current session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}