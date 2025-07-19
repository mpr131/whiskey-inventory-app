import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import PourSession from '@/models/PourSession';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');

    const query = { userId: session.user.id };
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      PourSession.find(query)
        .sort('-date')
        .skip(skip)
        .limit(limit),
      PourSession.countDocuments(query),
    ]);

    return NextResponse.json({
      sessions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching pour sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    
    await dbConnect();

    const pourSession = await PourSession.create({
      ...body,
      userId: new mongoose.Types.ObjectId(session.user.id),
    });

    return NextResponse.json({ session: pourSession }, { status: 201 });
  } catch (error) {
    console.error('Error creating pour session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}