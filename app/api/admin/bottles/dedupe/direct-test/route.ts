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

    const { searchTerm } = await request.json();
    if (!searchTerm) {
      return NextResponse.json({ error: 'Search term required' }, { status: 400 });
    }

    await dbConnect();
    
    console.log('\n=== DIRECT SEARCH TEST ===');
    console.log('Search term:', searchTerm);
    
    const results: any = {
      searchTerm,
      tests: []
    };
    
    // Test 1: Direct string search
    try {
      const direct = await MasterBottle.find({
        'externalData.source': 'fwgs',
        name: searchTerm
      }).limit(5).select('name brand externalData.fwgsId');
      
      results.tests.push({
        method: 'Direct string match',
        query: { name: searchTerm },
        count: direct.length,
        matches: direct.map(m => ({ name: m.name, brand: m.brand, fwgsId: m.externalData?.fwgsId }))
      });
    } catch (e: any) {
      results.tests.push({ method: 'Direct string match', error: e.message });
    }
    
    // Test 2: Case-insensitive regex
    try {
      const regex = await MasterBottle.find({
        'externalData.source': 'fwgs',
        name: { $regex: searchTerm, $options: 'i' }
      }).limit(5).select('name brand externalData.fwgsId');
      
      results.tests.push({
        method: 'Case-insensitive regex',
        query: { name: { $regex: searchTerm, $options: 'i' } },
        count: regex.length,
        matches: regex.map(m => ({ name: m.name, brand: m.brand, fwgsId: m.externalData?.fwgsId }))
      });
    } catch (e: any) {
      results.tests.push({ method: 'Case-insensitive regex', error: e.message });
    }
    
    // Test 3: Using new RegExp
    try {
      const newRegex = await MasterBottle.find({
        'externalData.source': 'fwgs',
        name: new RegExp(searchTerm, 'i')
      }).limit(5).select('name brand externalData.fwgsId');
      
      results.tests.push({
        method: 'new RegExp()',
        query: `new RegExp('${searchTerm}', 'i')`,
        count: newRegex.length,
        matches: newRegex.map(m => ({ name: m.name, brand: m.brand, fwgsId: m.externalData?.fwgsId }))
      });
    } catch (e: any) {
      results.tests.push({ method: 'new RegExp()', error: e.message });
    }
    
    // Test 4: Text search (if available)
    try {
      const textSearch = await MasterBottle.find({
        'externalData.source': 'fwgs',
        $text: { $search: searchTerm }
      }).limit(5).select('name brand externalData.fwgsId');
      
      results.tests.push({
        method: 'Text search',
        query: { $text: { $search: searchTerm } },
        count: textSearch.length,
        matches: textSearch.map(m => ({ name: m.name, brand: m.brand, fwgsId: m.externalData?.fwgsId }))
      });
    } catch (e: any) {
      results.tests.push({ method: 'Text search', error: e.message });
    }
    
    // Test 5: Check specific products
    const checkProducts = [
      { id: '000083922', name: 'Old Forester Single Barrel' },
      { id: '000006946', name: "Blanton's Single Barrel" }
    ];
    
    results.specificProducts = [];
    
    for (const check of checkProducts) {
      const product = await MasterBottle.findOne({
        'externalData.fwgsId': check.id
      }).select('name brand externalData.fwgsId');
      
      results.specificProducts.push({
        fwgsId: check.id,
        expectedName: check.name,
        found: !!product,
        actualName: product?.name,
        brand: product?.brand
      });
    }
    
    // Count total FWGS products
    results.totalFWGS = await MasterBottle.countDocuments({ 'externalData.source': 'fwgs' });
    
    // Sample some products to verify structure
    const sample = await MasterBottle.find({ 'externalData.source': 'fwgs' })
      .limit(5)
      .select('name brand externalData');
    
    results.sampleProducts = sample.map(s => ({
      name: s.name,
      brand: s.brand,
      externalData: s.externalData
    }));
    
    console.log('Results:', JSON.stringify(results, null, 2));
    
    return NextResponse.json(results);
  } catch (error) {
    console.error('Direct test error:', error);
    return NextResponse.json(
      { error: 'Failed to run direct test' },
      { status: 500 }
    );
  }
}