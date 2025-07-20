import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import UserBottle from '@/models/UserBottle';
import { authOptions } from '@/lib/auth';

// Mark bottle as label printed
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const bottle = await UserBottle.findOne({
      _id: params.id,
      userId: session.user.id,
    });

    if (!bottle) {
      return NextResponse.json({ error: 'Bottle not found' }, { status: 404 });
    }

    // Update lastLabelPrintedAt timestamp
    bottle.lastLabelPrintedAt = new Date();
    await bottle.save();

    return NextResponse.json({
      success: true,
      lastLabelPrintedAt: bottle.lastLabelPrintedAt,
    });
  } catch (error) {
    console.error('Error updating label print status:', error);
    return NextResponse.json(
      { error: 'Failed to update label print status' },
      { status: 500 }
    );
  }
}