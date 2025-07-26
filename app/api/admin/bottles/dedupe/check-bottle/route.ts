import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import UserBottle from '@/models/UserBottle';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bottleId } = await request.json();
    if (!bottleId) {
      return NextResponse.json({ error: 'Bottle ID required' }, { status: 400 });
    }

    await dbConnect();
    
    const bottle = await UserBottle.findById(bottleId)
      .populate({
        path: 'masterBottleId',
        select: 'name producer category subcategory proof statedProof size externalData'
      });
    
    if (!bottle) {
      return NextResponse.json({ error: 'Bottle not found' }, { status: 404 });
    }
    
    const result = {
      userBottle: {
        _id: bottle._id,
        status: bottle.status,
        purchaseDate: bottle.purchaseDate,
        purchasePrice: bottle.purchasePrice,
        purchaseLocation: (bottle as any).purchaseLocation || bottle.storeName,
        notes: bottle.notes
      },
      masterBottle: null as any,
      needsDedupe: false,
      reason: ''
    };
    
    if (!bottle.masterBottleId) {
      result.needsDedupe = true;
      result.reason = 'No master bottle linked';
    } else {
      const master = bottle.masterBottleId as any;
      result.masterBottle = {
        _id: master._id,
        name: master.name,
        brand: master.brand,
        category: master.category,
        proof: master.proof,
        externalData: master.externalData
      };
      
      if (!master.externalData?.source) {
        result.needsDedupe = true;
        result.reason = 'Master bottle has no external source';
      } else if (master.externalData.source !== 'fwgs') {
        result.needsDedupe = true;
        result.reason = `Master bottle is from ${master.externalData.source}, not FWGS`;
      } else {
        result.needsDedupe = false;
        result.reason = `Already linked to FWGS product ${master.externalData.fwgsId}`;
      }
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Check bottle error:', error);
    return NextResponse.json(
      { error: 'Failed to check bottle' },
      { status: 500 }
    );
  }
}