import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import MasterBottle from '@/models/MasterBottle';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // Find all master bottles with string proof values or invalid values
    const problematicBottles = await MasterBottle.find({
      $or: [
        { proof: { $type: 'string' } },
        { statedProof: { $type: 'string' } },
        { abv: { $type: 'string' } }
      ]
    }).lean();

    console.log(`Found ${problematicBottles.length} master bottles with proof issues`);
    
    // Log first few for debugging
    if (problematicBottles.length > 0) {
      console.log('First bottle:', {
        name: problematicBottles[0].name,
        proof: problematicBottles[0].proof,
        statedProof: problematicBottles[0].statedProof,
        abv: (problematicBottles[0] as any).abv
      });
    }

    let fixed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const bottle of problematicBottles) {
      try {
        let updated = false;
        const update: any = {};

        // Clean proof
        if (bottle.proof !== undefined) {
          const cleaned = cleanProofValue(bottle.proof);
          if (cleaned !== bottle.proof) {
            update.proof = cleaned;
            updated = true;
          }
        }

        // Clean statedProof
        if (bottle.statedProof !== undefined) {
          const cleaned = cleanProofValue(bottle.statedProof);
          if (cleaned !== bottle.statedProof) {
            update.statedProof = cleaned;
            updated = true;
          }
        }

        // Clean abv if it exists
        if ((bottle as any).abv !== undefined) {
          const cleaned = cleanProofValue((bottle as any).abv);
          if (cleaned !== (bottle as any).abv) {
            update.abv = cleaned;
            updated = true;
          }
        }

        if (updated) {
          await MasterBottle.findByIdAndUpdate(
            bottle._id,
            { $set: update },
            { runValidators: true }
          );
          console.log(`Fixed: ${bottle.name} - Updated values:`, update);
          fixed++;
        }
      } catch (error: any) {
        console.error(`Failed to fix bottle ${bottle.name}:`, error);
        errors.push(`${bottle.name}: ${error.message}`);
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      results: {
        total: problematicBottles.length,
        fixed,
        failed,
        errors: errors.slice(0, 10) // Return first 10 errors
      }
    });

  } catch (error) {
    console.error('Clean proof data error:', error);
    return NextResponse.json(
      { error: 'Failed to clean proof data' },
      { status: 500 }
    );
  }
}

function cleanProofValue(value: any): number | null {
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
}