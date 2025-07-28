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

    const { amount, notes, rating } = await req.json();

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
    const pour: any = {
      date: new Date(),
      amount,
      notes: notes || '',
    };
    
    if (rating !== undefined && rating >= 0 && rating <= 10) {
      pour.rating = rating;
    }
    
    bottle.pours.push(pour);

    // Update fill level using the new method that respects manual adjustments
    bottle.updateFillLevel();

    // Update status if bottle is finished
    if (bottle.fillLevel !== undefined && bottle.fillLevel <= 0) {
      bottle.status = 'finished';
    }

    await bottle.save();

    return NextResponse.json(bottle);
  } catch (error) {
    console.error('Error recording pour:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}