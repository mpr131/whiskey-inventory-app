import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import MasterBottle from '@/models/MasterBottle';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchTerm = 'blanton' } = await request.json();

    await dbConnect();
    
    // Search with different approaches
    const results: any = {
      searchTerm,
      searches: []
    };
    
    // 1. Case-insensitive search in name
    const nameSearch = await MasterBottle.find({
      'externalData.source': 'fwgs',
      name: { $regex: searchTerm, $options: 'i' }
    }).limit(10).select('name brand producer');
    
    results.searches.push({
      method: 'Name contains (case-insensitive)',
      count: nameSearch.length,
      samples: nameSearch.map(p => ({ name: p.name, brand: p.brand }))
    });
    
    // 2. Search in brand field
    const brandSearch = await MasterBottle.find({
      'externalData.source': 'fwgs',
      brand: { $regex: searchTerm, $options: 'i' }
    }).limit(10).select('name brand producer');
    
    results.searches.push({
      method: 'Brand contains',
      count: brandSearch.length,
      samples: brandSearch.map(p => ({ name: p.name, brand: p.brand }))
    });
    
    // 3. Text search (if text index exists)
    try {
      const textSearch = await MasterBottle.find({
        'externalData.source': 'fwgs',
        $text: { $search: searchTerm }
      }).limit(10).select('name brand producer');
      
      results.searches.push({
        method: 'Text search',
        count: textSearch.length,
        samples: textSearch.map(p => ({ name: p.name, brand: p.brand }))
      });
    } catch (e) {
      results.searches.push({
        method: 'Text search',
        error: 'No text index available'
      });
    }
    
    // 4. Check total FWGS products
    const totalFWGS = await MasterBottle.countDocuments({
      'externalData.source': 'fwgs'
    });
    
    results.totalFWGSProducts = totalFWGS;
    
    // 5. Sample of products with 'B' starting names
    const bProducts = await MasterBottle.find({
      'externalData.source': 'fwgs',
      name: { $regex: '^B', $options: 'i' }
    }).limit(20).select('name brand');
    
    results.sampleBProducts = bProducts.map(p => ({ name: p.name, brand: p.brand }));
    
    // 6. Check specific variations
    const variations = ["Blanton's", "Blantons", "Blanton"];
    for (const variant of variations) {
      const count = await MasterBottle.countDocuments({
        'externalData.source': 'fwgs',
        name: { $regex: variant, $options: 'i' }
      });
      results[`count_${variant}`] = count;
    }
    
    return NextResponse.json(results);
  } catch (error) {
    console.error('Debug search error:', error);
    return NextResponse.json(
      { error: 'Failed to debug search' },
      { status: 500 }
    );
  }
}