import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import MasterBottle from '@/models/MasterBottle';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    const results: any = {};
    
    // 1. Check for specific FWGS ID
    const blantonById = await MasterBottle.findOne({
      'externalData.fwgsId': '000006946'
    });
    
    results.blantonByFwgsId = blantonById ? {
      found: true,
      name: blantonById.name,
      brand: blantonById.brand,
      fwgsId: blantonById.externalData?.fwgsId
    } : { found: false };
    
    // 2. Search for any Blanton products in FWGS
    const blantonProducts = await MasterBottle.find({
      'externalData.source': 'fwgs',
      $or: [
        { name: { $regex: 'blanton', $options: 'i' } },
        { brand: { $regex: 'blanton', $options: 'i' } }
      ]
    }).limit(20).select('name brand externalData.fwgsId externalData.source');
    
    results.blantonProducts = {
      count: blantonProducts.length,
      products: blantonProducts.map(p => ({
        name: p.name,
        brand: p.brand,
        fwgsId: p.externalData?.fwgsId,
        source: p.externalData?.source
      }))
    };
    
    // 3. Check total FWGS products count
    const totalFWGS = await MasterBottle.countDocuments({
      'externalData.source': 'fwgs'
    });
    
    results.totalFWGSProducts = totalFWGS;
    
    // 4. Check if there are any products with fwgsId field
    const withFwgsId = await MasterBottle.countDocuments({
      'externalData.fwgsId': { $exists: true }
    });
    
    results.productsWithFwgsId = withFwgsId;
    
    // 5. Sample some FWGS products to see structure
    const sampleFWGS = await MasterBottle.find({
      'externalData.source': 'fwgs'
    }).limit(5);
    
    results.sampleFWGSProducts = sampleFWGS.map(p => ({
      name: p.name,
      brand: p.brand,
      externalData: p.externalData
    }));
    
    // 6. Search more broadly for bourbon products starting with B
    const bourbonB = await MasterBottle.find({
      'externalData.source': 'fwgs',
      name: { $regex: '^B', $options: 'i' },
      category: { $regex: 'bourbon', $options: 'i' }
    }).limit(10).select('name brand category');
    
    results.bourbonStartingWithB = bourbonB.map(p => ({
      name: p.name,
      brand: p.brand,
      category: p.category
    }));
    
    return NextResponse.json(results);
  } catch (error) {
    console.error('Error checking FWGS product:', error);
    return NextResponse.json(
      { error: 'Failed to check FWGS product' },
      { status: 500 }
    );
  }
}