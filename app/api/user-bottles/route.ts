import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import UserBottle from '@/models/UserBottle';
import MasterBottle from '@/models/MasterBottle';
import UserStore from '@/models/UserStore';
import MasterStore from '@/models/MasterStore';
import User from '@/models/User';
import Activity from '@/models/Activity';
import mongoose from 'mongoose';
import { extractAbvFromName } from '@/utils/extractAbv';
import { findOrCreateStore } from '@/utils/storeHelpers';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get('search');
    const brand = searchParams.get('brand');
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const proof = searchParams.get('proof');
    const sort = searchParams.get('sort') || '-createdAt';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const view = searchParams.get('view') || 'my'; // my, community, all

    let query: any = {};
    
    if (view === 'my') {
      query = { userId: session.user.id };
    }

    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    if (view === 'community') {
      // Show MasterBottles
      const masterQuery: any = {};
      
      if (search) {
        masterQuery.$or = [
          { name: { $regex: search, $options: 'i' } },
          { brand: { $regex: search, $options: 'i' } },
          { distillery: { $regex: search, $options: 'i' } },
        ];
      }
      
      if (category) {
        masterQuery.category = category;
      }

      // Apply proof filter
      if (proof) {
        switch (proof) {
          case '80-90':
            masterQuery.proof = { $gte: 80, $lte: 90 };
            break;
          case '90-100':
            masterQuery.proof = { $gte: 90, $lte: 100 };
            break;
          case '100-110':
            masterQuery.proof = { $gte: 100, $lte: 110 };
            break;
          case '110-120':
            masterQuery.proof = { $gte: 110, $lte: 120 };
            break;
          case '120+':
            masterQuery.proof = { $gte: 120 };
            break;
          case 'cask':
            masterQuery.proof = { $gte: 110 };
            break;
        }
      }

      const [bottles, total] = await Promise.all([
        MasterBottle.find(masterQuery)
          .sort(sort)
          .skip(skip)
          .limit(limit),
        MasterBottle.countDocuments(masterQuery),
      ]);

      return NextResponse.json({
        bottles,
        isMasterBottles: true,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } else {
      // Show UserBottles grouped by MasterBottle
      let masterIds: mongoose.Types.ObjectId[] = [];
      
      if (search || brand) {
        // Search both barcode fields and text fields simultaneously
        if (search) {
          // First, search UserBottles by barcode fields
          const barcodeQuery = {
            $and: [
              { userId: session.user.id },
              {
                $or: [
                  { barcode: search },
                  { cellarTrackerId: search },
                  { wineBarcode: search },
                  { vaultBarcode: search },
                ]
              }
            ]
          };
          
          const bottlesWithBarcode = await UserBottle.find(barcodeQuery).select('masterBottleId');
          const barcodeMatchIds = Array.from(new Set(bottlesWithBarcode.map(b => b.masterBottleId)));
          
          // Then, search MasterBottles by name/brand/distillery
          const searchWords = search.toLowerCase().split(' ').filter(word => word.length > 0);
          const searchRegex = searchWords.map(word => `(?=.*${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`).join('');
          
          const masterBottleQuery = {
            $or: [
              { name: { $regex: search, $options: 'i' } },
              { brand: { $regex: search, $options: 'i' } },
              { distillery: { $regex: search, $options: 'i' } },
              // Add fuzzy matching for partial words
              { name: { $regex: searchRegex, $options: 'i' } },
              { brand: { $regex: searchRegex, $options: 'i' } },
              { distillery: { $regex: searchRegex, $options: 'i' } },
            ]
          };
          
          const masterBottles = await MasterBottle.find(masterBottleQuery).select('_id');
          const textMatchIds = masterBottles.map(b => b._id);
          
          // Combine both barcode and text search results
          const combinedIds = [...barcodeMatchIds, ...textMatchIds];
          masterIds = Array.from(new Set(combinedIds));
          
          if (masterIds.length > 0) {
            query.masterBottleId = { $in: masterIds };
          }
        }
        
        if (brand) {
          // Add brand filter (can be combined with search)
          const brandCondition = {
            $or: [
              { brand: { $regex: brand, $options: 'i' } },
              { distillery: { $regex: brand, $options: 'i' } },
            ]
          };
          
          const brandBottles = await MasterBottle.find(brandCondition).select('_id');
          const brandIds = brandBottles.map(b => b._id);
          
          // If we already have search results, intersect with brand filter
          if (masterIds.length > 0) {
            masterIds = masterIds.filter(id => brandIds.some(brandId => brandId.equals(id)));
          } else {
            masterIds = brandIds;
          }
          
          if (masterIds.length > 0) {
            query.masterBottleId = { $in: masterIds };
          }
        }
      }

      // Get all user bottles first
      const allUserBottles = await UserBottle.find(query)
        .populate('masterBottleId')
        .populate({
          path: 'storeId',
          populate: {
            path: 'masterStoreId',
            model: 'MasterStore'
          }
        })
        .sort('createdAt');

      // Group bottles by MasterBottle
      const groupedBottles = new Map<string, any>();
      
      for (const bottle of allUserBottles) {
        const masterBottleId = bottle.masterBottleId._id.toString();
        
        if (!groupedBottles.has(masterBottleId)) {
          groupedBottles.set(masterBottleId, {
            _id: masterBottleId,
            masterBottleId: bottle.masterBottleId,
            totalCount: 0,
            openedCount: 0,
            unopenedCount: 0,
            finishedCount: 0,
            locations: new Set(),
            stores: new Set(),
            totalValue: 0,
            averagePrice: 0,
            priceRange: { min: null, max: null },
            userBottles: [], // Individual bottles for detail view
            createdAt: bottle.createdAt,
            updatedAt: bottle.updatedAt,
          });
        }
        
        const group = groupedBottles.get(masterBottleId);
        group.totalCount++;
        group.userBottles.push(bottle);
        
        // Count by status
        if (bottle.status === 'opened') group.openedCount++;
        else if (bottle.status === 'unopened') group.unopenedCount++;
        else if (bottle.status === 'finished') group.finishedCount++;
        
        // Track locations
        if (bottle.location?.area) {
          group.locations.add(bottle.location.area + (bottle.location.bin ? ` (${bottle.location.bin})` : ''));
        }
        
        // Track stores from populated store data
        const storeData = bottle.storeId as any;
        if (storeData?.masterStoreId?.name) {
          group.stores.add(storeData.masterStoreId.name);
        }
        
        // Calculate values
        const bottleValue = bottle.purchasePrice || bottle.marketValue || bottle.myValue || 0;
        group.totalValue += bottleValue;
        
        if (bottleValue > 0) {
          if (group.priceRange.min === null || bottleValue < group.priceRange.min) {
            group.priceRange.min = bottleValue;
          }
          if (group.priceRange.max === null || bottleValue > group.priceRange.max) {
            group.priceRange.max = bottleValue;
          }
        }
        
        // Update timestamps
        if (bottle.createdAt > group.createdAt) group.createdAt = bottle.createdAt;
        if (bottle.updatedAt > group.updatedAt) group.updatedAt = bottle.updatedAt;
      }
      
      // Convert to array and finalize calculations
      const bottleGroups = Array.from(groupedBottles.values()).map(group => {
        group.locations = Array.from(group.locations);
        group.stores = Array.from(group.stores);
        group.averagePrice = group.totalCount > 0 ? group.totalValue / group.totalCount : 0;
        return group;
      });
      
      // Apply category filter
      let filteredGroups = bottleGroups;
      if (category) {
        filteredGroups = bottleGroups.filter(group => 
          group.masterBottleId.category === category
        );
      }
      
      // Apply status filter
      if (status) {
        filteredGroups = filteredGroups.filter(group => {
          if (status === 'opened') return group.openedCount > 0;
          if (status === 'unopened') return group.unopenedCount > 0;
          if (status === 'finished') return group.finishedCount > 0;
          return true;
        });
      }
      
      // Apply proof filter
      if (proof) {
        filteredGroups = filteredGroups.filter(group => {
          const bottleProof = group.masterBottleId.proof;
          if (!bottleProof) return false;
          
          switch (proof) {
            case '80-90':
              return bottleProof >= 80 && bottleProof <= 90;
            case '90-100':
              return bottleProof >= 90 && bottleProof <= 100;
            case '100-110':
              return bottleProof >= 100 && bottleProof <= 110;
            case '110-120':
              return bottleProof >= 110 && bottleProof <= 120;
            case '120+':
              return bottleProof >= 120;
            case 'cask':
              return bottleProof >= 110;
            default:
              return true;
          }
        });
      }
      
      // Sort the groups
      filteredGroups.sort((a, b) => {
        switch (sort) {
          case 'name':
            return a.masterBottleId.name.localeCompare(b.masterBottleId.name);
          case '-name':
            return b.masterBottleId.name.localeCompare(a.masterBottleId.name);
          case 'createdAt':
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          case '-createdAt':
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          case 'purchasePrice':
            return a.averagePrice - b.averagePrice;
          case '-purchasePrice':
            return b.averagePrice - a.averagePrice;
          case '-value':
            return b.totalValue - a.totalValue;
          case 'proof':
            return (a.masterBottleId.proof || 0) - (b.masterBottleId.proof || 0);
          case '-proof':
            return (b.masterBottleId.proof || 0) - (a.masterBottleId.proof || 0);
          default:
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
      });
      
      // Apply pagination
      const totalGroups = filteredGroups.length;
      const paginatedGroups = filteredGroups.slice(skip, skip + limit);

      return NextResponse.json({
        bottles: paginatedGroups,
        isMasterBottles: false,
        isGrouped: true,
        pagination: {
          page,
          limit,
          total: totalGroups,
          pages: Math.ceil(totalGroups / limit),
        },
      });
    }
  } catch (error) {
    console.error('Error fetching bottles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    
    await dbConnect();

    // Check if masterBottleId is provided, if not, create or find one
    let masterBottleId = body.masterBottleId;
    
    if (!masterBottleId && body.masterBottle) {
      // Try to find existing master bottle
      let masterBottle = await MasterBottle.findOne({
        name: body.masterBottle.name,
        distillery: body.masterBottle.distillery,
        isStorePick: body.masterBottle.isStorePick || false,
      });

      if (!masterBottle) {
        // Extract ABV/proof from name
        const abvData = extractAbvFromName(body.masterBottle.name);
        
        // Create new master bottle
        masterBottle = await MasterBottle.create({
          ...body.masterBottle,
          abv: body.masterBottle.abv || abvData.abv,
          proof: body.masterBottle.proof || abvData.proof,
          statedProof: abvData.statedProof,
          createdBy: new mongoose.Types.ObjectId(session.user.id),
        });
      }

      masterBottleId = masterBottle._id;
    }

    if (!masterBottleId) {
      return NextResponse.json({ error: 'Master bottle information required' }, { status: 400 });
    }

    // Handle purchase location (store) with case-insensitive matching
    let storeId;
    if (body.purchaseLocation) {
      const storeResult = await findOrCreateStore(body.purchaseLocation, session.user.id);
      storeId = storeResult.userStoreId;
    }

    // Generate vault barcode
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Assign barcode prefix if user doesn't have one
    if (!user.barcodePrefix) {
      // Find the next available prefix
      let prefixNumber = 1;
      let prefixAssigned = false;
      
      while (!prefixAssigned) {
        const proposedPrefix = `WV${prefixNumber.toString().padStart(3, '0')}`;
        const existingUser = await User.findOne({ barcodePrefix: proposedPrefix });
        
        if (!existingUser) {
          user.barcodePrefix = proposedPrefix;
          await user.save();
          prefixAssigned = true;
        } else {
          prefixNumber++;
        }
      }
    }

    // Generate next vault barcode
    const nextSequence = (user.lastBarcodeSequence || 0) + 1;
    const vaultBarcode = `${user.barcodePrefix}-${nextSequence.toString().padStart(6, '0')}`;

    // Update user's last sequence
    user.lastBarcodeSequence = nextSequence;
    await user.save();

    const userBottle = await UserBottle.create({
      ...body,
      userId: new mongoose.Types.ObjectId(session.user.id),
      masterBottleId: new mongoose.Types.ObjectId(masterBottleId),
      storeId: storeId,
      vaultBarcode: vaultBarcode,
      photos: body.photos || [],
      pours: [],
    });

    const populatedBottle = await UserBottle.findById(userBottle._id)
      .populate('masterBottleId')
      .populate({
        path: 'storeId',
        populate: {
          path: 'masterStoreId',
          model: 'MasterStore'
        }
      });

    // Create activity for new bottle
    try {
      const masterBottle = await MasterBottle.findById(masterBottleId);
      
      if (masterBottle) {
        await Activity.create({
          userId: session.user.id,
          type: 'new_bottle',
          targetId: userBottle._id,
          metadata: {
            bottleName: masterBottle.name,
            bottleImage: masterBottle.imageUrl,
          },
        });

        // Update user stats
        await User.findByIdAndUpdate(session.user.id, {
          $inc: { 'stats.bottleCount': 1 },
        });
      }
    } catch (activityError) {
      console.error('Error creating activity:', activityError);
      // Don't fail the bottle creation if activity fails
    }

    return NextResponse.json({ bottle: populatedBottle }, { status: 201 });
  } catch (error) {
    console.error('Error creating bottle:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}