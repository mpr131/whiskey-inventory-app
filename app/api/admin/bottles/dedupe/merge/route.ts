import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import UserBottle from '@/models/UserBottle';
import MasterBottle from '@/models/MasterBottle';
import mongoose from 'mongoose';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sourceMasterBottleId, targetMasterBottleId, isStorePick } = await request.json();
  
  if (!sourceMasterBottleId || !targetMasterBottleId) {
    return NextResponse.json(
      { error: 'Source and target master bottle IDs are required' },
      { status: 400 }
    );
  }

  await dbConnect();
  
  // Start a MongoDB session for transaction
  const mongooseSession = await mongoose.startSession();
  
  try {
    // Execute everything in a transaction
    const transactionResult = await mongooseSession.withTransaction(async () => {

    // Find the source master bottle (user/manual)
    // Don't use .lean() here as we need the full document
    const sourceMasterBottle = await MasterBottle.findById(sourceMasterBottleId);
    if (!sourceMasterBottle) {
      return NextResponse.json({ error: 'Source master bottle not found' }, { status: 404 });
    }
    
    console.log('Source bottle before merge:', {
      id: sourceMasterBottle._id,
      name: sourceMasterBottle.name,
      externalData: sourceMasterBottle.externalData
    });

    // Find the target FWGS master bottle
    const targetMasterBottle = await MasterBottle.findById(targetMasterBottleId);
    if (!targetMasterBottle) {
      return NextResponse.json({ error: 'Target FWGS master bottle not found' }, { status: 404 });
    }

    // First, get all UserBottles that need updating
    const userBottlesToUpdate = await UserBottle.find({ masterBottleId: sourceMasterBottleId });
    console.log(`Found ${userBottlesToUpdate.length} user bottles to update`);
    
    // Update each UserBottle individually to handle notes properly
    let updatedCount = 0;
    for (const userBottle of userBottlesToUpdate) {
      try {
        const dedupeNote = isStorePick 
          ? `[Store Pick - Linked to FWGS base product: ${targetMasterBottle.name}]`
          : `[Deduplicated with FWGS product: ${targetMasterBottle.name}]`;
        
        // Update masterBottleId and append to notes
        userBottle.masterBottleId = targetMasterBottle._id;
        userBottle.notes = userBottle.notes 
          ? `${userBottle.notes}\n\n${dedupeNote}`
          : dedupeNote;
        
        await userBottle.save();
        updatedCount++;
      } catch (err) {
        console.error(`Failed to update user bottle ${userBottle._id}:`, err);
      }
    }
    
    console.log(`Successfully updated ${updatedCount} of ${userBottlesToUpdate.length} user bottles`);

    // Log the merge for tracking
    console.log(`Merging user master bottle ${sourceMasterBottleId} INTO FWGS master bottle ${targetMasterBottleId}`);

    // Clean proof values before saving
    const cleanProofValue = (value: any): number | null => {
      if (!value) return null;
      if (value === 'N/A' || value === 'n/a') return null;
      
      // Convert to string and clean
      const strValue = value.toString();
      const cleaned = strValue.replace('%', '').trim();
      const parsed = parseFloat(cleaned);
      
      // Validate the parsed value
      if (isNaN(parsed) || parsed < 0 || parsed > 200) {
        return null;
      }
      
      return parsed;
    };

    // IMPORTANT: We're keeping the FWGS bottle as primary and merging user data INTO it
    
    // First, update the TARGET (FWGS) bottle with user-specific data
    targetMasterBottle.externalData = targetMasterBottle.externalData || {};
    targetMasterBottle.externalData.mergedFrom = sourceMasterBottle._id;
    targetMasterBottle.externalData.mergedAt = new Date();
    
    // Log what we're trying to set
    console.log('Setting originalUserData:', {
      name: sourceMasterBottle.name,
      createdBy: sourceMasterBottle.createdBy,
      createdByType: typeof sourceMasterBottle.createdBy,
      source: sourceMasterBottle.externalData?.source || 'user'
    });
    
    targetMasterBottle.externalData.originalUserData = {
      name: sourceMasterBottle.name,
      createdBy: sourceMasterBottle.createdBy || 'unknown',
      source: sourceMasterBottle.externalData?.source || 'user'
    };

    // Copy user-specific data FROM source (user) TO target (FWGS) bottle
    // Only copy fields that FWGS doesn't have or that are user-specific
    
    // Copy age if FWGS doesn't have it
    if (!targetMasterBottle.age && sourceMasterBottle.age) {
      targetMasterBottle.age = sourceMasterBottle.age;
    }
    
    // Copy store pick details if this is marked as a store pick
    if (isStorePick && sourceMasterBottle.storePickDetails) {
      targetMasterBottle.isStorePick = true;
      targetMasterBottle.storePickDetails = sourceMasterBottle.storePickDetails;
    }
    
    // Copy any UPC codes from user bottle that FWGS might not have
    if (sourceMasterBottle.upcCodes && sourceMasterBottle.upcCodes.length > 0) {
      targetMasterBottle.upcCodes = targetMasterBottle.upcCodes || [];
      const existingCodes = new Set(targetMasterBottle.upcCodes.map((upc: any) => upc.code));
      
      for (const sourceUpc of sourceMasterBottle.upcCodes) {
        if (!existingCodes.has(sourceUpc.code)) {
          targetMasterBottle.upcCodes.push({
            code: sourceUpc.code,
            submittedBy: sourceUpc.submittedBy,
            verifiedCount: sourceUpc.verifiedCount,
            dateAdded: sourceUpc.dateAdded || new Date(),
            isAdminAdded: sourceUpc.isAdminAdded || false
          });
        }
      }
    }
    
    // If user had personal notes, preserve them
    if ((sourceMasterBottle as any).personalNotes) {
      (targetMasterBottle as any).personalNotes = (sourceMasterBottle as any).personalNotes;
    }
    
    // Clean proof values on the target bottle if needed
    if (targetMasterBottle.proof !== undefined && typeof targetMasterBottle.proof === 'string') {
      targetMasterBottle.proof = cleanProofValue(targetMasterBottle.proof);
    }
    if (targetMasterBottle.statedProof !== undefined && typeof targetMasterBottle.statedProof === 'string') {
      targetMasterBottle.statedProof = cleanProofValue(targetMasterBottle.statedProof);
    }
    
      // CRITICAL: Try a different approach - create a new externalData object
      // Some FWGS bottles might have frozen/immutable externalData
      
      // First, let's see what's in the original externalData
      console.log('Original target externalData:', targetMasterBottle.externalData);
      
      // Create new object WITHOUT spread first to avoid overwriting
      const newExternalData: any = {
        source: targetMasterBottle.externalData?.source || 'fwgs',
        fwgsId: targetMasterBottle.externalData?.fwgsId,
        sku: targetMasterBottle.externalData?.sku,
        externalId: targetMasterBottle.externalData?.externalId,
        lastSync: targetMasterBottle.externalData?.lastSync,
        importDate: targetMasterBottle.externalData?.importDate,
        // NOW ADD OUR NEW FIELDS
        mergedFrom: sourceMasterBottle._id,
        mergedAt: new Date(),
        originalUserData: {
          name: sourceMasterBottle.name,
          createdBy: sourceMasterBottle.createdBy || 'unknown',
          source: sourceMasterBottle.externalData?.source || 'user'
        }
      };
      
      // Debug: Check what we created
      console.log('Created newExternalData with mergedFrom:', newExternalData.mergedFrom);
      console.log('Created newExternalData with originalUserData:', newExternalData.originalUserData);
      console.log('Full newExternalData object:', JSON.stringify(newExternalData, null, 2));
      
      // IMPORTANT: Direct assignment doesn't work, set() doesn't work
      // Let's try a different approach - use toObject() and fromObject pattern
      const targetDoc = targetMasterBottle.toObject();
      targetDoc.externalData = newExternalData;
      
      // Now update the mongoose document with the modified object
      Object.assign(targetMasterBottle, targetDoc);
      
      // Also try marking the specific paths as modified
      targetMasterBottle.externalData = newExternalData;
      
      console.log('After assignment, externalData:', JSON.stringify(targetMasterBottle.externalData, null, 2));
      console.log('Document has mergedFrom?', !!targetMasterBottle.externalData?.mergedFrom);
      console.log('Document has originalUserData?', !!targetMasterBottle.externalData?.originalUserData);
      
      // Save target bottle FIRST
      console.log('Saving target (FWGS) master bottle with merged user data');
      
      // CRITICAL: Mark ALL the specific nested paths as modified
      targetMasterBottle.markModified('externalData');
      targetMasterBottle.markModified('externalData.mergedFrom');
      targetMasterBottle.markModified('externalData.originalUserData');
      targetMasterBottle.markModified('externalData.mergedAt');
      targetMasterBottle.markModified('upcCodes');
      
      // Try saving with strict: false to bypass schema validation
      // await targetMasterBottle.save({ session: mongooseSession, strict: false });
      
      // NUCLEAR OPTION: Use raw MongoDB update to bypass Mongoose entirely
      console.log('Using raw MongoDB update to set externalData fields...');
      
      // First save the regular mongoose changes (age, UPC codes, etc)
      await targetMasterBottle.save({ session: mongooseSession });
      
      // Last attempt: Use findByIdAndUpdate with new: true
      const updatedTarget = await MasterBottle.findByIdAndUpdate(
        targetMasterBottleId,
        {
          $set: {
            'externalData.mergedFrom': sourceMasterBottle._id,
            'externalData.mergedAt': new Date(),
            'externalData.originalUserData': {
              name: sourceMasterBottle.name,
              createdBy: sourceMasterBottle.createdBy || 'unknown',
              source: sourceMasterBottle.externalData?.source || 'user'
            }
          }
        },
        { 
          session: mongooseSession,
          new: true,
          runValidators: false,
          strict: false
        }
      );
      
      console.log('findByIdAndUpdate result externalData:', updatedTarget?.externalData);
      
      console.log('Target bottle saved successfully using raw update');
      
      // Verify the save worked BEFORE updating source
      const verifyTarget = await MasterBottle.findById(targetMasterBottleId).session(mongooseSession);
      console.log('Immediate verification - target externalData:', verifyTarget?.externalData);
      
      if (!verifyTarget?.externalData?.mergedFrom) {
        throw new Error('Target bottle failed to save mergedFrom field - aborting transaction');
      }
      
      // NOW mark the source bottle as inactive
      console.log('Marking source (user) master bottle as inactive');
      sourceMasterBottle.active = false;
      sourceMasterBottle.externalData = sourceMasterBottle.externalData || {};
      sourceMasterBottle.externalData.mergedTo = new mongoose.Types.ObjectId(targetMasterBottle._id);
      sourceMasterBottle.externalData.mergedAt = new Date();
      
      sourceMasterBottle.markModified('externalData');
      await sourceMasterBottle.save({ session: mongooseSession });
      console.log('Source bottle marked as inactive successfully');
      
      console.log('Merge summary:', {
        targetBottle: targetMasterBottle.name,
        sourceBottle: sourceMasterBottle.name,
        userDataPreserved: {
          age: targetMasterBottle.age,
          isStorePick: targetMasterBottle.isStorePick,
          upcCodesTotal: targetMasterBottle.upcCodes?.length || 0,
          mergedFromSaved: !!verifyTarget?.externalData?.mergedFrom
        }
      });

      return {
        sourceMasterBottleId: sourceMasterBottle._id,
        targetMasterBottleId: targetMasterBottle._id,
        targetMasterBottleName: targetMasterBottle.name,
        userBottlesUpdated: updatedCount,
        dataMerged: {
          targetBottleName: targetMasterBottle.name,
          sourceBottleName: sourceMasterBottle.name,
          upcCodesTotal: targetMasterBottle.upcCodes?.length || 0,
          fwgsId: targetMasterBottle.externalData?.fwgsId,
          sku: targetMasterBottle.externalData?.sku,
          hasImage: !!targetMasterBottle.defaultImageUrl,
          mergedFromSaved: !!verifyTarget?.externalData?.mergedFrom
        }
      };
    });
    
    // Transaction completed successfully
    return NextResponse.json({
      success: true,
      result: transactionResult
    });
    
  } catch (error) {
    console.error('Error merging bottles:', error);
    return NextResponse.json(
      { error: 'Failed to merge bottles - transaction rolled back' },
      { status: 500 }
    );
  } finally {
    // Always end the session
    await mongooseSession.endSession();
  }
}