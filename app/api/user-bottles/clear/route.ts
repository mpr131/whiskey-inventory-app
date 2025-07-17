import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import UserBottle from '@/models/UserBottle';

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // Delete all user bottles for this user (keep MasterBottles intact)
    const result = await UserBottle.deleteMany({ 
      userId: session.user.id 
    });

    return NextResponse.json({ 
      success: true,
      deletedCount: result.deletedCount,
      message: `Successfully deleted ${result.deletedCount} bottles from your collection`
    });
  } catch (error) {
    console.error('Error clearing collection:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}