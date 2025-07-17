import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import UserStore from '@/models/UserStore';
import MasterStore from '@/models/MasterStore';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    // Get all user stores with master store details
    const userStores = await UserStore.find({
      userId: session.user.id,
    })
      .populate('masterStoreId')
      .sort('createdAt');
    
    // Also get all master stores for adding new ones
    const allMasterStores = await MasterStore.find().sort('name');
    
    return NextResponse.json({
      userStores,
      masterStores: allMasterStores,
    });
    
  } catch (error: any) {
    console.error('Error fetching stores:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stores' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    const { masterStoreId, nickname, notes } = await request.json();
    
    // Check if user already has this store
    const existing = await UserStore.findOne({
      userId: session.user.id,
      masterStoreId: masterStoreId,
    });
    
    if (existing) {
      return NextResponse.json({ error: 'Store already added' }, { status: 400 });
    }
    
    // Create new user store relationship
    const userStore = await UserStore.create({
      userId: new mongoose.Types.ObjectId(session.user.id),
      masterStoreId: new mongoose.Types.ObjectId(masterStoreId),
      nickname,
      notes,
    });
    
    const populatedStore = await UserStore.findById(userStore._id).populate('masterStoreId');
    
    return NextResponse.json(populatedStore, { status: 201 });
    
  } catch (error: any) {
    console.error('Error creating store:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create store' },
      { status: 500 }
    );
  }
}