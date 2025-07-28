import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb';
import UserBottle from '../models/UserBottle';

async function testFillLevelFix() {
  await dbConnect();

  try {
    console.log('🧪 Testing fill level calculation fix...\n');

    // Create a test bottle
    const testBottle = new UserBottle({
      userId: new mongoose.Types.ObjectId(),
      masterBottleId: new mongoose.Types.ObjectId(),
      status: 'unopened',
      fillLevel: 100,
      pours: [],
      fillLevelHistory: [],
    });

    console.log('1️⃣ Initial state:');
    console.log(`   Status: ${testBottle.status}`);
    console.log(`   Fill Level: ${testBottle.fillLevel}%`);
    console.log(`   History entries: ${testBottle.fillLevelHistory.length}\n`);

    // Open the bottle
    testBottle.openDate = new Date();
    testBottle.status = 'opened';
    await testBottle.save();

    console.log('2️⃣ After opening:');
    console.log(`   Status: ${testBottle.status}`);
    console.log(`   Fill Level: ${testBottle.fillLevel}%`);
    console.log(`   History entries: ${testBottle.fillLevelHistory.length}`);
    if (testBottle.fillLevelHistory.length > 0) {
      console.log(`   Last entry: ${testBottle.fillLevelHistory[0].notes}\n`);
    }

    // Simulate Buffalo Trace scenario
    console.log('3️⃣ Simulating Buffalo Trace scenario...\n');

    // Manual adjustment 1: 88.17% → 25%
    console.log('   Manual adjustment 1: 88.17% → 25%');
    testBottle.adjustFillLevel(25, 'manual', 'Fill level adjusted from 88.17% to 25%');
    await testBottle.save();
    console.log(`   Current fill level: ${testBottle.fillLevel}%`);
    console.log(`   Last manual adjustment: ${testBottle.lastManualAdjustment}`);
    console.log(`   History entries: ${testBottle.fillLevelHistory.length}\n`);

    // Manual adjustment 2: 72.39% → 6%
    console.log('   Manual adjustment 2: 72.39% → 6%');
    testBottle.adjustFillLevel(6, 'manual', 'Fill level adjusted from 72.39% to 6%');
    await testBottle.save();
    console.log(`   Current fill level: ${testBottle.fillLevel}%`);
    console.log(`   Last manual adjustment: ${testBottle.lastManualAdjustment}`);
    console.log(`   History entries: ${testBottle.fillLevelHistory.length}\n`);

    // Add a 1.5oz pour (44ml)
    console.log('   Adding 1.5oz (44ml) pour...');
    testBottle.pours.push({
      date: new Date(),
      amount: 44, // 1.5oz = 44ml
      notes: 'Test pour',
    });
    
    // Call updateFillLevel to simulate what happens in the pour API
    testBottle.updateFillLevel();
    await testBottle.save();

    console.log(`   Current fill level: ${testBottle.fillLevel}%`);
    console.log(`   Expected: ${(6 - (44/750 * 100)).toFixed(2)}% (6% - 5.87% = 0.13%)`);
    console.log(`   Total pours: ${testBottle.getTotalPours()}ml`);
    console.log(`   Pours since last adjustment: ${testBottle.getTotalPoursSince(testBottle.lastManualAdjustment!)}ml`);
    console.log(`   History entries: ${testBottle.fillLevelHistory.length}\n`);

    // Print fill level history
    console.log('4️⃣ Fill Level History:');
    testBottle.fillLevelHistory.forEach((entry, index) => {
      console.log(`   ${index + 1}. ${entry.date.toISOString()}`);
      console.log(`      ${entry.previousLevel}% → ${entry.newLevel}%`);
      console.log(`      Reason: ${entry.reason}`);
      console.log(`      Notes: ${entry.notes}`);
      if (entry.poursSinceLastAdjustment !== undefined) {
        console.log(`      Pours since last adjustment: ${entry.poursSinceLastAdjustment}ml`);
      }
      console.log('');
    });

    // Verify the fix works correctly
    const finalFillLevel = testBottle.fillLevel || 0;
    const expectedFillLevel = 6 - (44/750 * 100);
    const difference = Math.abs(finalFillLevel - expectedFillLevel);

    console.log('5️⃣ Test Results:');
    console.log(`   Final fill level: ${finalFillLevel.toFixed(2)}%`);
    console.log(`   Expected fill level: ${expectedFillLevel.toFixed(2)}%`);
    console.log(`   Difference: ${difference.toFixed(2)}%`);
    
    if (difference < 0.01) {
      console.log('   ✅ TEST PASSED: Fill level calculation respects manual adjustments!');
    } else {
      console.log('   ❌ TEST FAILED: Fill level calculation is incorrect!');
    }

    // Clean up
    await UserBottle.deleteOne({ _id: testBottle._id });

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

// Run the test
testFillLevelFix().catch(console.error);