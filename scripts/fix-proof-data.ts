#!/usr/bin/env tsx

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import dbConnect from '../lib/mongodb';
import MasterBottle from '../models/MasterBottle';

async function fixProofData() {
  console.log('🔧 Fixing Proof Data in Master Bottles');
  console.log('=====================================\n');
  
  await dbConnect();
  
  try {
    // Find all bottles - we'll check each one
    const allBottles = await MasterBottle.find({});
    console.log(`Total bottles in database: ${allBottles.length}\n`);
    
    // Check for string values or values containing %
    const bottlesNeedingFix = allBottles.filter(bottle => {
      const hasStringProof = typeof bottle.statedProof === 'string' || 
                            typeof bottle.proof === 'string' || 
                            typeof bottle.abv === 'string';
      const hasPercentage = (bottle.statedProof && bottle.statedProof.toString().includes('%')) ||
                           (bottle.proof && bottle.proof.toString().includes('%')) ||
                           (bottle.abv && bottle.abv.toString().includes('%'));
      return hasStringProof || hasPercentage;
    });
    
    console.log(`Found ${bottlesNeedingFix.length} bottles needing proof fixes\n`);
    
    // Show examples
    console.log('Examples of values found:');
    bottlesNeedingFix.slice(0, 5).forEach(bottle => {
      console.log(`  ${bottle.name}:`);
      if (bottle.statedProof) console.log(`    statedProof: ${JSON.stringify(bottle.statedProof)} (type: ${typeof bottle.statedProof})`);
      if (bottle.proof) console.log(`    proof: ${JSON.stringify(bottle.proof)} (type: ${typeof bottle.proof})`);
      if (bottle.abv) console.log(`    abv: ${JSON.stringify(bottle.abv)} (type: ${typeof bottle.abv})`);
    });
    console.log();
    
    let fixed = 0;
    let errors = 0;
    
    for (const bottle of bottlesNeedingFix) {
      try {
        let updated = false;
        const updates: any = {};
        
        // Fix statedProof
        if (bottle.statedProof !== undefined && bottle.statedProof !== null) {
          const oldValue = bottle.statedProof;
          const stringValue = bottle.statedProof.toString();
          
          if (stringValue.includes('%') || typeof bottle.statedProof === 'string') {
            const cleanValue = stringValue.replace('%', '').trim();
            const numValue = parseFloat(cleanValue);
            
            if (!isNaN(numValue)) {
              updates.statedProof = numValue;
              console.log(`  Fixing statedProof for "${bottle.name}": "${oldValue}" → ${numValue}`);
              updated = true;
            }
          }
        }
        
        // Fix proof
        if (bottle.proof !== undefined && bottle.proof !== null) {
          const oldValue = bottle.proof;
          const stringValue = bottle.proof.toString();
          
          if (stringValue.includes('%') || typeof bottle.proof === 'string') {
            const cleanValue = stringValue.replace('%', '').trim();
            const numValue = parseFloat(cleanValue);
            
            if (!isNaN(numValue)) {
              updates.proof = numValue;
              console.log(`  Fixing proof for "${bottle.name}": "${oldValue}" → ${numValue}`);
              updated = true;
            }
          }
        }
        
        // Fix abv
        if (bottle.abv !== undefined && bottle.abv !== null) {
          const oldValue = bottle.abv;
          const stringValue = bottle.abv.toString();
          
          if (stringValue.includes('%') || typeof bottle.abv === 'string') {
            const cleanValue = stringValue.replace('%', '').trim();
            const numValue = parseFloat(cleanValue);
            
            if (!isNaN(numValue)) {
              updates.abv = numValue;
              console.log(`  Fixing abv for "${bottle.name}": "${oldValue}" → ${numValue}`);
              updated = true;
            }
          }
        }
        
        if (updated) {
          // Use updateOne to avoid validation issues
          await MasterBottle.updateOne(
            { _id: bottle._id },
            { $set: updates }
          );
          fixed++;
        }
      } catch (error) {
        console.error(`  ❌ Error fixing bottle "${bottle.name}":`, error);
        errors++;
      }
    }
    
    console.log('\n=====================================');
    console.log(`✅ Fixed ${fixed} bottles`);
    console.log(`❌ Errors: ${errors}`);
    console.log('=====================================\n');
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the fix
fixProofData().catch(console.error);