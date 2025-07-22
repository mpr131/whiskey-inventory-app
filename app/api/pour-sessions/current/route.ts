import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import PourSession from '@/models/PourSession';
import { getCurrentPourSession } from '@/lib/pour-session-manager';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // Use the improved session manager that handles time windows
    const currentSession = await getCurrentPourSession(session.user.id);

    return NextResponse.json({ session: currentSession });
  } catch (error) {
    console.error('Error fetching current session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}