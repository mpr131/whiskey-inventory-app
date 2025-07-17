import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import UserBottle from '@/models/UserBottle';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount, notes } = await req.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid pour amount' }, { status: 400 });
    }

    await dbConnect();

    const bottle = await UserBottle.findOne({
      _id: params.id,
      userId: session.user.id,
    }).populate('masterBottleId');

    if (!bottle) {
      return NextResponse.json({ error: 'Bottle not found' }, { status: 404 });
    }

    if (bottle.status !== 'opened') {
      return NextResponse.json({ error: 'Bottle must be opened to record pours' }, { status: 400 });
    }

    // Add the pour
    bottle.pours.push({
      date: new Date(),
      amount,
      notes: notes || '',
    });

    // Update fill level (assuming 750ml bottle = ~25.4 oz)
    const totalOz = 25.4;
    const fillLevelDecrease = (amount / totalOz) * 100;
    bottle.fillLevel = Math.max(0, bottle.fillLevel - fillLevelDecrease);

    // Update status if bottle is finished
    if (bottle.fillLevel <= 0) {
      bottle.status = 'finished';
    }

    await bottle.save();

    return NextResponse.json(bottle);
  } catch (error) {
    console.error('Error recording pour:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}