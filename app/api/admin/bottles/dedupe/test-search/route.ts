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
    
    const tests = [
      {
        userBottle: "Old Forester Single Barrel (Keystone State)",
        expectedFwgsId: "000083922",
        expectedName: "Old Forester Single Barrel Straight Bourbon"
      },
      {
        userBottle: "Blanton's Original Single Barrel",
        expectedFwgsId: "000006946",
        expectedName: "Blanton's Single Barrel Straight Bourbon"
      }
    ];
    
    const results = [];
    
    for (const test of tests) {
      console.log(`\nTesting: ${test.userBottle}`);
      
      // 1. Check if expected product exists
      const expectedProduct = await MasterBottle.findOne({
        'externalData.fwgsId': test.expectedFwgsId
      });
      
      const result: any = {
        userBottle: test.userBottle,
        expectedProduct: expectedProduct ? {
          found: true,
          name: expectedProduct.name,
          brand: expectedProduct.brand,
          fwgsId: expectedProduct.externalData?.fwgsId
        } : {
          found: false,
          message: `Product ${test.expectedFwgsId} not in database`
        }
      };
      
      // 2. Test different search patterns
      const searchPatterns = [
        // Extract first word
        { 
          pattern: test.userBottle.split(' ')[0].toLowerCase(),
          description: 'First word only'
        },
        // Extract first two words
        { 
          pattern: test.userBottle.split(' ').slice(0, 2).join(' ').toLowerCase(),
          description: 'First two words'
        },
        // Remove parentheses
        { 
          pattern: test.userBottle.replace(/\([^)]*\)/g, '').trim().toLowerCase(),
          description: 'Without parentheses'
        },
        // Just the brand (manual)
        {
          pattern: test.userBottle.toLowerCase().includes('forester') ? 'forester' : 'blanton',
          description: 'Key brand word'
        }
      ];
      
      result.searchTests = [];
      
      for (const search of searchPatterns) {
        const matches = await MasterBottle.find({
          'externalData.source': 'fwgs',
          name: new RegExp(search.pattern, 'i')
        })
        .limit(5)
        .select('name brand externalData.fwgsId');
        
        result.searchTests.push({
          pattern: search.pattern,
          description: search.description,
          matchCount: matches.length,
          topMatches: matches.map(m => ({
            name: m.name,
            brand: m.brand,
            fwgsId: m.externalData?.fwgsId,
            isExpected: m.externalData?.fwgsId === test.expectedFwgsId
          }))
        });
      }
      
      // 3. Direct name search
      const directSearch = await MasterBottle.find({
        'externalData.source': 'fwgs',
        name: new RegExp(test.expectedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      }).select('name brand externalData.fwgsId');
      
      result.directNameSearch = {
        query: test.expectedName,
        found: directSearch.length > 0,
        results: directSearch.map(m => ({
          name: m.name,
          brand: m.brand,
          fwgsId: m.externalData?.fwgsId
        }))
      };
      
      results.push(result);
    }
    
    // Also test the current extractBrandName function
    const brandExtractionTests = [
      "Old Forester Single Barrel (Keystone State)",
      "Blanton's Original Single Barrel",
      "Four Roses Single Barrel",
      "Wild Turkey 101",
      "Jack Daniel's Single Barrel"
    ];
    
    const extractBrandName = (name: string): string => {
      const cleaned = name
        .replace(/['"]/g, '')
        .replace(/\([^)]*\)/g, '')
        .trim();
      
      const words = cleaned.split(/\s+/);
      
      if (words[0]?.endsWith("'s") || words[0]?.endsWith("s'")) {
        return words[0];
      }
      
      if (words.length >= 2) {
        const firstTwo = words.slice(0, 2).join(' ').toLowerCase();
        const commonTwoPart = ['four roses', 'wild turkey', 'eagle rare', 'jim beam', 'jack daniel'];
        if (commonTwoPart.some(brand => firstTwo.includes(brand))) {
          return words.slice(0, 2).join(' ');
        }
      }
      
      return words[0] || '';
    };
    
    const brandTests = brandExtractionTests.map(name => ({
      input: name,
      extracted: extractBrandName(name),
      clean: extractBrandName(name).replace(/[^a-z0-9]/gi, '').toLowerCase()
    }));
    
    return NextResponse.json({
      testResults: results,
      brandExtractionTests: brandTests,
      summary: {
        totalFWGS: await MasterBottle.countDocuments({ 'externalData.source': 'fwgs' }),
        message: 'Check console for detailed debug output'
      }
    });
  } catch (error) {
    console.error('Test search error:', error);
    return NextResponse.json(
      { error: 'Failed to test search' },
      { status: 500 }
    );
  }
}