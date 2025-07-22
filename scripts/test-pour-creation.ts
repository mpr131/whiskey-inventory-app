import mongoose from 'mongoose';
import { config } from 'dotenv';
import dbConnect from '../lib/mongodb';
import Pour from '../models/Pour';
import PourSession from '../models/PourSession';
import UserBottle from '../models/UserBottle';
import User from '../models/User';
import { createPourWithSession } from '../lib/pour-session-manager';

config();

async function testPourCreation() {
  try {
    await dbConnect();
    console.log('Testing pour creation safeguards...');
    console.log('=====================================\n');

    // Get a test user
    const user = await User.findOne().limit(1);
    if (!user) {
      console.error('No users found in database');
      return;
    }

    // Get a bottle for this user
    const bottle = await UserBottle.findOne({ userId: user._id }).limit(1);
    if (!bottle) {
      console.error('No bottles found for user');
      return;
    }

    console.log(`Testing with user: ${user.email}`);
    console.log(`Testing with bottle: ${bottle._id}\n`);

    // Test 1: Try to create a pour without a session (should fail)
    console.log('Test 1: Creating pour without session (should fail)...');
    try {
      await Pour.create({
        userId: user._id,
        userBottleId: bottle._id,
        amount: 1.5,
        date: new Date(),
      });
      console.error('❌ Test 1 FAILED: Pour was created without a session!');
    } catch (error) {
      console.log('✅ Test 1 PASSED: Pour creation without session was rejected');
      console.log(`   Error: ${error.message}\n`);
    }

    // Test 2: Create pour with session using the helper (should succeed)
    console.log('Test 2: Creating pour with automatic session assignment...');
    try {
      const { pour, session } = await createPourWithSession({
        userId: user._id.toString(),
        userBottleId: bottle._id.toString(),
        amount: 1.5,
        rating: 8.5,
        notes: 'Test pour with auto-session',
        location: 'Home',
      });
      console.log('✅ Test 2 PASSED: Pour created with session');
      console.log(`   Pour ID: ${pour._id}`);
      console.log(`   Session ID: ${session._id}`);
      console.log(`   Session Name: ${session.sessionName}\n`);

      // Clean up test pour
      await Pour.findByIdAndDelete(pour._id);
    } catch (error) {
      console.error('❌ Test 2 FAILED:', error.message);
    }

    // Test 3: Test session grouping (4-hour window)
    console.log('Test 3: Testing session grouping within 4-hour window...');
    try {
      const now = new Date();
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      
      // Create first pour
      const { pour: pour1, session: session1 } = await createPourWithSession({
        userId: user._id.toString(),
        userBottleId: bottle._id.toString(),
        amount: 1,
        date: threeHoursAgo,
      });

      // Create second pour (should use same session)
      const { pour: pour2, session: session2 } = await createPourWithSession({
        userId: user._id.toString(),
        userBottleId: bottle._id.toString(),
        amount: 1.5,
        date: now,
      });

      if (session1._id.toString() === session2._id.toString()) {
        console.log('✅ Test 3 PASSED: Pours within 4 hours grouped in same session');
        console.log(`   Session ID: ${session1._id}`);
        console.log(`   Total pours in session: ${session1.totalPours}`);
      } else {
        console.error('❌ Test 3 FAILED: Pours were not grouped in same session');
      }

      // Clean up
      await Pour.findByIdAndDelete(pour1._id);
      await Pour.findByIdAndDelete(pour2._id);
      await session1.updateStats();
    } catch (error) {
      console.error('❌ Test 3 FAILED:', error.message);
    }

    // Test 4: Test session separation (>4 hours apart)
    console.log('\nTest 4: Testing session separation for pours >4 hours apart...');
    try {
      const now = new Date();
      const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);
      
      // Create first pour
      const { pour: pour1, session: session1 } = await createPourWithSession({
        userId: user._id.toString(),
        userBottleId: bottle._id.toString(),
        amount: 1,
        date: fiveHoursAgo,
      });

      // Create second pour (should create new session)
      const { pour: pour2, session: session2 } = await createPourWithSession({
        userId: user._id.toString(),
        userBottleId: bottle._id.toString(),
        amount: 1.5,
        date: now,
      });

      if (session1._id.toString() !== session2._id.toString()) {
        console.log('✅ Test 4 PASSED: Pours >4 hours apart created separate sessions');
        console.log(`   Session 1 ID: ${session1._id}`);
        console.log(`   Session 2 ID: ${session2._id}`);
      } else {
        console.error('❌ Test 4 FAILED: Pours were grouped in same session');
      }

      // Clean up
      await Pour.findByIdAndDelete(pour1._id);
      await Pour.findByIdAndDelete(pour2._id);
      await PourSession.findByIdAndDelete(session1._id);
      await PourSession.findByIdAndDelete(session2._id);
    } catch (error) {
      console.error('❌ Test 4 FAILED:', error.message);
    }

    console.log('\n=====================================');
    console.log('Pour creation tests completed!');

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nTests finished.');
  }
}

// Run the tests
testPourCreation();