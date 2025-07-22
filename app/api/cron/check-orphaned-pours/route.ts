import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Pour from '@/models/Pour';
import { ensureAllPoursHaveSessions } from '@/lib/pour-session-manager';

// This endpoint can be called by a cron job to check for orphaned pours
export async function GET(req: NextRequest) {
  try {
    // Optional: Add auth check for cron secret
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // Count orphaned pours before fix
    const orphanedCountBefore = await Pour.countDocuments({ 
      sessionId: { $exists: false } 
    });

    if (orphanedCountBefore === 0) {
      return NextResponse.json({ 
        message: 'No orphaned pours found',
        orphanedPours: 0,
        fixed: 0 
      });
    }

    // Log warning about orphaned pours
    console.warn(`Found ${orphanedCountBefore} orphaned pours!`);

    // Get details of orphaned pours for logging
    const orphanedPours = await Pour.find({ 
      sessionId: { $exists: false } 
    })
    .populate('userId', 'email')
    .limit(10); // Just log first 10

    console.error('Orphaned pour details:', orphanedPours.map(p => ({
      id: p._id,
      user: p.userId?.email || 'unknown',
      date: p.date,
      amount: p.amount,
    })));

    // Fix orphaned pours
    const fixed = await ensureAllPoursHaveSessions();

    // Count orphaned pours after fix
    const orphanedCountAfter = await Pour.countDocuments({ 
      sessionId: { $exists: false } 
    });

    // Alert if we couldn't fix all orphaned pours
    if (orphanedCountAfter > 0) {
      console.error(`WARNING: Still have ${orphanedCountAfter} orphaned pours after fix attempt!`);
    }

    return NextResponse.json({
      message: 'Orphaned pour check completed',
      orphanedPoursFound: orphanedCountBefore,
      fixed,
      remaining: orphanedCountAfter,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error checking orphaned pours:', error);
    return NextResponse.json({ 
      error: 'Failed to check orphaned pours',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Also support POST for manual trigger
export async function POST(req: NextRequest) {
  return GET(req);
}