import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import InviteCode from '@/models/InviteCode';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.user.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    await dbConnect();

    const codes = await InviteCode.find().sort({ createdAt: -1 });

    return NextResponse.json({ codes });
  } catch (error) {
    console.error('Error fetching invite codes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.user.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { expiresIn = 7 } = await req.json();

    await dbConnect();

    let code: string;
    let isUnique = false;

    // Generate unique code
    while (!isUnique) {
      code = (InviteCode.schema.statics.generateCode as any)() as string;
      const existing = await InviteCode.findOne({ code });
      if (!existing) {
        isUnique = true;
      }
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresIn);

    const inviteCode = await InviteCode.create({
      code: code!,
      createdBy: session.user.email,
      expiresAt,
      isActive: true,
    });

    return NextResponse.json({ inviteCode }, { status: 201 });
  } catch (error) {
    console.error('Error creating invite code:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}