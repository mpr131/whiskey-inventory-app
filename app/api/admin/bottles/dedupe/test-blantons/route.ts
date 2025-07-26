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
    
    const results: any = {
      searchQueries: [],
      totalFWGS: 0,
      summary: {}
    };
    
    // 1. Count total FWGS products
    results.totalFWGS = await MasterBottle.countDocuments({
      'externalData.source': 'fwgs'
    });
    
    // 2. Test various search patterns for Blanton's
    const searchPatterns = [
      { query: { 'externalData.fwgsId': '000006946' }, desc: 'By FWGS ID 000006946' },
      { query: { 'externalData.source': 'fwgs', name: /blanton/i }, desc: 'Name contains "blanton" (case-insensitive)' },
      { query: { 'externalData.source': 'fwgs', name: /^blanton/i }, desc: 'Name starts with "blanton"' },
      { query: { 'externalData.source': 'fwgs', brand: /blanton/i }, desc: 'Brand contains "blanton"' },
      { query: { 'externalData.source': 'fwgs', name: /blanton['']?s/i }, desc: 'Name contains "blanton\'s" or "blantons"' },
      { query: { 'externalData.source': 'fwgs', $text: { $search: 'blanton' } }, desc: 'Text search for "blanton"' }
    ];
    
    for (const pattern of searchPatterns) {
      try {
        const count = await MasterBottle.countDocuments(pattern.query);
        const samples = await MasterBottle.find(pattern.query)
          .limit(5)
          .select('name brand externalData.fwgsId');
        
        results.searchQueries.push({
          description: pattern.desc,
          count,
          samples: samples.map(s => ({
            name: s.name,
            brand: s.brand,
            fwgsId: s.externalData?.fwgsId
          }))
        });
      } catch (error) {
        results.searchQueries.push({
          description: pattern.desc,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // 3. Get a sample of all B-starting bourbon products
    const bourbonB = await MasterBottle.find({
      'externalData.source': 'fwgs',
      name: /^b/i,
      category: /bourbon/i
    })
    .limit(20)
    .select('name brand category')
    .sort({ name: 1 });
    
    results.bourbonStartingWithB = bourbonB.map(b => ({
      name: b.name,
      brand: b.brand,
      category: b.category
    }));
    
    // 4. Check if ANY products have fwgsId field
    const withFwgsId = await MasterBottle.findOne({
      'externalData.fwgsId': { $exists: true }
    });
    
    results.hasFwgsIdField = !!withFwgsId;
    
    // 5. Get sample of FWGS products to see data structure
    const sampleFWGS = await MasterBottle.find({
      'externalData.source': 'fwgs'
    })
    .limit(3)
    .select('name brand externalData');
    
    results.sampleFWGSStructure = sampleFWGS.map(s => ({
      name: s.name,
      brand: s.brand,
      externalData: s.externalData
    }));
    
    // Summary
    results.summary = {
      totalFWGSProducts: results.totalFWGS,
      blantonProductsFound: results.searchQueries.find((q: any) => q.description.includes('case-insensitive'))?.count || 0,
      hasFwgsIdField: results.hasFwgsIdField,
      message: results.totalFWGS === 0 ? 'NO FWGS PRODUCTS FOUND - Import may not have run' : 
               results.searchQueries[1].count === 0 ? 'Blanton\'s products missing - may need reimport' : 
               'Blanton\'s products found'
    };
    
    return NextResponse.json(results);
  } catch (error) {
    console.error('Test Blanton\'s error:', error);
    return NextResponse.json(
      { error: 'Failed to test Blanton\'s search' },
      { status: 500 }
    );
  }
}