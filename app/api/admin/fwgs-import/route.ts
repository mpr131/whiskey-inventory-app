import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import MasterBottle from '@/models/MasterBottle';
import { connectToExternalDB } from '@/lib/external-db';
import { 
  createMasterFromFWGS, 
  mergeFWGSData, 
  findPotentialMatches,
  PotentialMatch
} from '@/lib/fwgs-import-helpers';

// GET: Get import status and statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const externalDb = await connectToExternalDB();

    // Get statistics
    const totalFWGS = await externalDb.collection('all_products').countDocuments({});
    const totalMaster = await MasterBottle.countDocuments({});
    const fwgsImported = await MasterBottle.countDocuments({ 'externalData.source': 'fwgs' });
    const customBottles = await MasterBottle.countDocuments({ 
      'externalData.source': { $in: ['manual', 'user'] } 
    });
    const duplicates = await MasterBottle.countDocuments({ 
      duplicateOf: { $exists: true } 
    });

    // Get recent imports
    const recentImports = await MasterBottle.find({ 
      'externalData.source': 'fwgs' 
    })
      .sort({ 'externalData.importDate': -1 })
      .limit(10)
      .select('name brand externalData.importDate')
      .lean();

    return NextResponse.json({
      stats: {
        totalFWGS,
        totalMaster,
        fwgsImported,
        customBottles,
        duplicates,
        percentImported: totalFWGS > 0 ? Math.round((fwgsImported / totalFWGS) * 100) : 0
      },
      recentImports
    });

  } catch (error) {
    console.error('Error getting import status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Import a single product or batch
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, fwgsId, batchSize = 100 } = await request.json();

    await dbConnect();
    const externalDb = await connectToExternalDB();

    if (action === 'single' && fwgsId) {
      // Import single product
      const product = await externalDb
        .collection('all_products')
        .findOne({ repositoryId: fwgsId });

      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }

      // Check if already imported
      const existing = await MasterBottle.findOne({
        'externalData.fwgsId': product.repositoryId
      });

      if (existing) {
        return NextResponse.json({
          message: 'Product already imported',
          bottle: existing
        });
      }

      // Check for matches
      const matches = await findPotentialMatches(product, externalDb);
      
      if (matches.length > 0 && matches[0].confidence >= 85) {
        // Merge with existing
        const bottleId = (matches[0].bottle as any)._id;
        const merged = await mergeFWGSData(bottleId.toString(), product);
        return NextResponse.json({
          message: 'Product merged with existing bottle',
          bottle: merged,
          matchConfidence: matches[0].confidence
        });
      } else {
        // Create new
        const created = await createMasterFromFWGS(product);
        return NextResponse.json({
          message: 'New bottle created from FWGS data',
          bottle: created
        });
      }

    } else if (action === 'batch') {
      // Import batch of unimported products
      const imported = await MasterBottle.distinct('externalData.fwgsId', {
        'externalData.source': 'fwgs'
      });

      const products = await externalDb
        .collection('all_products')
        .find({ repositoryId: { $nin: imported } })
        .limit(batchSize)
        .toArray();

      let created = 0;
      let merged = 0;
      let errors = 0;

      for (const product of products) {
        try {
          const matches = await findPotentialMatches(product, externalDb);
          
          if (matches.length > 0 && matches[0].confidence >= 85) {
            const bottleId = (matches[0].bottle as any)._id;
            await mergeFWGSData(bottleId.toString(), product);
            merged++;
          } else {
            await createMasterFromFWGS(product);
            created++;
          }
        } catch (error) {
          console.error(`Error importing ${product.displayName}:`, error);
          errors++;
        }
      }

      return NextResponse.json({
        message: `Batch import completed`,
        results: {
          processed: products.length,
          created,
          merged,
          errors
        }
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error in import:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT: Update sync status or resolve duplicates
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, bottleId, preferredId } = await request.json();

    await dbConnect();

    if (action === 'resolveDuplicate' && bottleId && preferredId) {
      // Mark one as duplicate of the other
      const duplicate = await MasterBottle.findById(bottleId);
      const preferred = await MasterBottle.findById(preferredId);

      if (!duplicate || !preferred) {
        return NextResponse.json({ error: 'Bottle not found' }, { status: 404 });
      }

      duplicate.duplicateOf = preferred._id;
      duplicate.active = false;
      await duplicate.save();

      // Update user bottles
      const UserBottle = (await import('@/models/UserBottle')).default;
      const updateResult = await UserBottle.updateMany(
        { masterBottleId: duplicate._id },
        { masterBottleId: preferred._id }
      );

      return NextResponse.json({
        message: 'Duplicate resolved',
        userBottlesUpdated: updateResult.modifiedCount
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error in update:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}