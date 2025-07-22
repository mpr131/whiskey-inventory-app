import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Activity from '@/models/Activity';
import LivePour from '@/models/LivePour';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const pourId = params.id;
    const { type } = await request.json(); // 'activity' or 'live'

    if (type === 'live') {
      // Cheers a live pour
      const livePour = await LivePour.findById(pourId);
      if (!livePour) {
        return NextResponse.json({ error: 'Live pour not found' }, { status: 404 });
      }

      if (livePour.cheersUsers.includes(user._id)) {
        return NextResponse.json({ error: 'Already cheered this pour' }, { status: 400 });
      }

      await (livePour as any).addCheers(user._id.toString());

      return NextResponse.json({
        message: 'Cheers added to live pour',
        cheersCount: livePour.cheersCount + 1,
      });
    } else {
      // Cheers an activity
      const activity = await Activity.findOne({
        type: 'pour',
        targetId: pourId,
      });

      if (!activity) {
        return NextResponse.json({ error: 'Pour activity not found' }, { status: 404 });
      }

      if (activity.metadata.cheersUsers?.includes(user._id)) {
        return NextResponse.json({ error: 'Already cheered this pour' }, { status: 400 });
      }

      const updatedActivity = await (Activity as any).addCheers(activity._id.toString(), user._id.toString());

      return NextResponse.json({
        message: 'Cheers added to pour',
        cheersCount: updatedActivity.metadata.cheersCount,
      });
    }
  } catch (error) {
    console.error('Cheers error:', error);
    return NextResponse.json(
      { error: 'Failed to add cheers' },
      { status: 500 }
    );
  }
}