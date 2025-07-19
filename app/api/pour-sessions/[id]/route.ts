import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import PourSession from '@/models/PourSession';

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

    const pourSession = await PourSession.findOne({
      _id: params.id,
      userId: session.user.id,
    });

    if (!pourSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Update statistics
    await pourSession.updateStats();

    return NextResponse.json({ session: pourSession });
  } catch (error) {
    console.error('Error fetching pour session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}