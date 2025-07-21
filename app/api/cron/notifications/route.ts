import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { checkAndGenerateAllNotifications } from '@/lib/notifications/generator';

export async function GET(request: NextRequest) {
  try {
    // Verify this is called by an authorized source (e.g., Vercel Cron)
    const authHeader = headers().get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Run all notification checks
    await checkAndGenerateAllNotifications();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in notifications cron:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}