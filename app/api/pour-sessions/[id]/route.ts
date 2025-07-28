import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import PourSession from '@/models/PourSession';
import Pour from '@/models/Pour';

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
    }).populate({
      path: 'companionTags.friendId',
      select: 'name displayName username avatar',
    });

    if (!pourSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Update statistics
    await pourSession.updateStats();

    // Debug: Count actual pours for this session
    const actualPourCount = await Pour.countDocuments({
      sessionId: params.id,
      userId: session.user.id
    });
    
    console.log(`Session ${params.id} - Expected pours: ${pourSession.totalPours}, Actual pours in DB: ${actualPourCount}`);

    // Also get the date range for this session
    const sessionDate = new Date(pourSession.date);
    const startOfDay = new Date(sessionDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(sessionDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Count all pours for this day (regardless of session assignment)
    const allPoursForDay = await Pour.countDocuments({
      userId: session.user.id,
      date: { $gte: startOfDay, $lte: endOfDay }
    });
    
    console.log(`Total pours on ${sessionDate.toDateString()}: ${allPoursForDay}`);

    return NextResponse.json({ 
      session: pourSession,
      debug: {
        actualPourCount,
        allPoursForDay,
        sessionDate: sessionDate.toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching pour session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}