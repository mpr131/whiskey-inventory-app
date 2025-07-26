import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import MasterBottle from '@/models/MasterBottle';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    // Check specific bottle
    const specificBottle = await MasterBottle.findOne({
      'externalData.fwgsId': '000083922'
    });
    
    // Search for all Old Forester products
    const oldForesterProducts = await MasterBottle.find({
      'externalData.source': 'fwgs',
      $or: [
        { name: /old.*forester/i },
        { brand: /old.*forester/i },
        { name: /forester/i },
        { brand: /forester/i }
      ]
    })
    .limit(50)
    .select('name brand externalData.fwgsId');
    
    // Get all unique brands containing 'forester'
    const brands = await MasterBottle.distinct('brand', {
      'externalData.source': 'fwgs',
      brand: /forester/i
    });
    
    return NextResponse.json({
      specificBottle: specificBottle ? {
        name: specificBottle.name,
        brand: specificBottle.brand,
        category: specificBottle.category,
        fwgsId: specificBottle.externalData?.fwgsId
      } : 'NOT FOUND',
      
      oldForesterProductsCount: oldForesterProducts.length,
      oldForesterProducts: oldForesterProducts.map(p => ({
        name: p.name,
        brand: p.brand,
        fwgsId: p.externalData?.fwgsId
      })),
      
      uniqueBrands: brands,
      
      searchTests: {
        'name contains "old forester"': await MasterBottle.countDocuments({
          'externalData.source': 'fwgs',
          name: /old forester/i
        }),
        'brand contains "old forester"': await MasterBottle.countDocuments({
          'externalData.source': 'fwgs',
          brand: /old forester/i
        }),
        'name contains "forester"': await MasterBottle.countDocuments({
          'externalData.source': 'fwgs',
          name: /forester/i
        }),
        'brand = "Old Forester"': await MasterBottle.countDocuments({
          'externalData.source': 'fwgs',
          brand: 'Old Forester'
        })
      }
    });
  } catch (error) {
    console.error('Debug Old Forester error:', error);
    return NextResponse.json(
      { error: 'Failed to debug' },
      { status: 500 }
    );
  }
}