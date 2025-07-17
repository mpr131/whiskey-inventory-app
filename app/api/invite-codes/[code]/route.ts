import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import InviteCode from '@/models/InviteCode';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.user.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    await dbConnect();

    const inviteCode = await InviteCode.findOne({ code: params.code });

    if (!inviteCode) {
      return NextResponse.json({ error: 'Invite code not found' }, { status: 404 });
    }

    inviteCode.isActive = false;
    await inviteCode.save();

    return NextResponse.json({ message: 'Invite code deactivated' });
  } catch (error) {
    console.error('Error deactivating invite code:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.user.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { expiresAt } = await req.json();

    await dbConnect();

    const inviteCode = await InviteCode.findOne({ code: params.code });

    if (!inviteCode) {
      return NextResponse.json({ error: 'Invite code not found' }, { status: 404 });
    }

    if (expiresAt) {
      inviteCode.expiresAt = new Date(expiresAt);
    }

    await inviteCode.save();

    return NextResponse.json({ inviteCode });
  } catch (error) {
    console.error('Error updating invite code:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}