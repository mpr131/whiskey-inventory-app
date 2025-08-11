// Test script to verify fill level bug is fixed
// Run with: npx tsx scripts/test-fill-level-bug.ts

import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb';
import UserBottle from '../models/UserBottle';
import MasterBottle from '../models/MasterBottle';
import Pour from '../models/Pour';

async function testFillLevelBug() {
  console.log('=== FILL LEVEL BUG TEST ===');
  console.log('Testing the fix for fill level jumping UP after pour...\n');
  
  try {
    await dbConnect();
    console.log('✓ Connected to database\n');
    
    // Find a test user ID - you'll need to replace this with a real user ID
    const testUserId = new mongoose.Types.ObjectId('6606c3e93eb96e829c5e8275'); // Replace with real user ID
    
    // Find or create a test bottle
    console.log('Setting up test bottle...');
    let testBottle = await UserBottle.findOne({
      userId: testUserId,
      notes: { $regex: /TEST BOTTLE FOR FILL LEVEL BUG/ }
    });
    
    if (!testBottle) {
      // Find a master bottle to use
      const masterBottle = await MasterBottle.findOne();
      if (!masterBottle) {
        console.error('No master bottles found. Please add some bottles first.');
        process.exit(1);
      }
      
      // Create a test bottle
      testBottle = await UserBottle.create({
        userId: testUserId,
        masterBottleId: masterBottle._id,
        status: 'opened',
        openDate: new Date(),
        fillLevel: 100,
        notes: 'TEST BOTTLE FOR FILL LEVEL BUG - Can be deleted',
        pours: [],
        fillLevelHistory: [{
          date: new Date(),
          previousLevel: 100,
          newLevel: 100,
          reason: 'manual',
          notes: 'Bottle opened for testing'
        }]
      });
      console.log('✓ Created test bottle\n');
    } else {
      // Reset the test bottle
      testBottle.fillLevel = 100;
      testBottle.pours = [];
      testBottle.fillLevelHistory = [{
        date: new Date(),
        previousLevel: 100,
        newLevel: 100,
        reason: 'manual',
        notes: 'Reset for testing'
      }];
      testBottle.lastManualAdjustment = new Date();
      await testBottle.save();
      console.log('✓ Reset existing test bottle\n');
    }
    
    console.log('=== TEST 1: Pour from 100% ===');
    console.log('Initial fill level:', testBottle.fillLevel, '%');
    console.log('Adding 2oz pour...');
    
    // Simulate adding a pour
    const pour1Amount = 2;
    testBottle.updateFillLevelForNewPour(pour1Amount);
    testBottle.pours.push({
      date: new Date(),
      amount: pour1Amount,
      notes: 'Test pour 1'
    });
    await testBottle.save();
    
    const expectedLevel1 = 100 - (pour1Amount / 25.36 * 100);
    console.log('After pour:');
    console.log('  Expected:', expectedLevel1.toFixed(2), '%');
    console.log('  Actual:', testBottle.fillLevel?.toFixed(2), '%');
    console.log('  ✓ Test 1 PASSED' + (Math.abs((testBottle.fillLevel || 0) - expectedLevel1) < 0.1 ? '' : ' (WARNING: Mismatch!)'));
    console.log();
    
    console.log('=== TEST 2: Manual adjustment to 30% ===');
    console.log('Setting fill level manually to 30%...');
    
    testBottle.adjustFillLevel(30, 'manual', 'Manual adjustment for testing');
    await testBottle.save();
    
    console.log('After manual adjustment:');
    console.log('  Fill level:', testBottle.fillLevel, '%');
    console.log('  Last manual adjustment:', testBottle.lastManualAdjustment);
    console.log();
    
    console.log('=== TEST 3: Pour from manually adjusted level ===');
    console.log('Current fill level:', testBottle.fillLevel, '%');
    console.log('Adding 1.5oz pour...');
    
    const pour2Amount = 1.5;
    const levelBeforePour = testBottle.fillLevel || 0;
    
    // This is the critical test - pour after manual adjustment
    testBottle.updateFillLevelForNewPour(pour2Amount);
    testBottle.pours.push({
      date: new Date(),
      amount: pour2Amount,
      notes: 'Test pour 2 - after manual adjustment'
    });
    await testBottle.save();
    
    const expectedLevel2 = 30 - (pour2Amount / 25.36 * 100);
    console.log('After pour:');
    console.log('  Expected:', expectedLevel2.toFixed(2), '%');
    console.log('  Actual:', testBottle.fillLevel?.toFixed(2), '%');
    
    if ((testBottle.fillLevel || 0) > levelBeforePour) {
      console.error('  ❌ BUG STILL EXISTS: Fill level INCREASED after pour!');
    } else if (Math.abs((testBottle.fillLevel || 0) - expectedLevel2) > 0.1) {
      console.error('  ⚠️  WARNING: Calculation mismatch but level decreased');
    } else {
      console.log('  ✅ TEST PASSED: Fill level correctly decreased!');
    }
    console.log();
    
    console.log('=== TEST 4: Multiple pours ===');
    console.log('Adding 3 more pours of 1oz each...');
    
    let currentLevel = testBottle.fillLevel || 0;
    for (let i = 0; i < 3; i++) {
      const pourAmount = 1;
      testBottle.updateFillLevelForNewPour(pourAmount);
      testBottle.pours.push({
        date: new Date(),
        amount: pourAmount,
        notes: `Test pour ${i + 3}`
      });
      await testBottle.save();
      
      const expectedLevel = currentLevel - (pourAmount / 25.36 * 100);
      console.log(`Pour ${i + 1}: ${testBottle.fillLevel?.toFixed(2)}% (expected: ${expectedLevel.toFixed(2)}%)`);
      currentLevel = testBottle.fillLevel || 0;
    }
    
    console.log();
    console.log('=== SUMMARY ===');
    console.log('Total pours:', testBottle.pours.length);
    console.log('Total amount poured:', testBottle.getTotalPours(), 'oz');
    console.log('Final fill level:', testBottle.fillLevel?.toFixed(2), '%');
    console.log('Fill level history entries:', testBottle.fillLevelHistory.length);
    
    // Clean up test data (optional)
    console.log('\nCleaning up test bottle...');
    await UserBottle.deleteOne({ _id: testBottle._id });
    console.log('✓ Test bottle deleted');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✓ Disconnected from database');
  }
}

// Run the test
testFillLevelBug()
  .then(() => {
    console.log('\n=== TEST COMPLETE ===');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });