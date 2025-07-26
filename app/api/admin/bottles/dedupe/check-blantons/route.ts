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
    
    // Search for any Blanton's products
    const blantonProducts = await MasterBottle.find({
      'externalData.source': 'fwgs',
      name: { $regex: 'blanton', $options: 'i' }
    }).select('name brand producer category subcategory');
    
    // Also check for variations
    const variations = ['blanton', 'blantons', 'blanten', 'blanten\'s'];
    const variationCounts: Record<string, number> = {};
    
    for (const variant of variations) {
      const count = await MasterBottle.countDocuments({
        'externalData.source': 'fwgs',
        name: { $regex: variant, $options: 'i' }
      });
      variationCounts[variant] = count;
    }
    
    // Check total FWGS products
    const totalFWGS = await MasterBottle.countDocuments({
      'externalData.source': 'fwgs'
    });
    
    // Get sample of FWGS products
    const sample = await MasterBottle.find({
      'externalData.source': 'fwgs'
    }).limit(20).select('name brand');
    
    return NextResponse.json({
      blantonProducts: blantonProducts.map(p => ({
        name: p.name,
        brand: p.brand || p.producer
      })),
      variationCounts,
      totalFWGS,
      sampleProducts: sample.map(p => ({
        name: p.name,
        brand: p.brand || 'No brand'
      }))
    });
  } catch (error) {
    console.error('Error checking Blanton\'s products:', error);
    return NextResponse.json(
      { error: 'Failed to check products' },
      { status: 500 }
    );
  }
}