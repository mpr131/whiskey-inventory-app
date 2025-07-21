import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Notification from '@/models/Notification';
import { logger } from '@/lib/logger';
import mongoose from 'mongoose';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid notification ID' }, { status: 400 });
    }

    await dbConnect();
    
    // Delete the notification (only if it belongs to the user)
    const result = await Notification.findOneAndDelete({
      _id: params.id,
      userId: session.user.id
    });

    if (!result) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      data: { id: params.id, deleted: true } 
    });
  } catch (error) {
    logger.error('Error in delete notification API', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}