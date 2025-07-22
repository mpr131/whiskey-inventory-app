import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb';
import Pour from '../models/Pour';
import UserBottle from '../models/UserBottle';
import Notification from '../models/Notification';
import UserPreferences from '../models/UserPreferences';
import { checkPourReminders, checkLowStock } from '../lib/notifications/generator';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function debugNotifications() {
  try {
    await dbConnect();
    console.log('Connected to database');

    // 1. Check for unrated pours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const unratedPours = await Pour.find({
      rating: null,
      notes: null,
      createdAt: { $lt: oneDayAgo }
    }).populate('userBottleId');
    
    console.log(`\n=== UNRATED POURS ===`);
    console.log(`Found ${unratedPours.length} unrated pours older than 24 hours`);
    
    if (unratedPours.length > 0) {
      console.log('Sample pour:', {
        _id: unratedPours[0]._id,
        createdAt: unratedPours[0].createdAt,
        userId: unratedPours[0].userId,
        userBottleId: unratedPours[0].userBottleId?._id
      });
    }

    // 2. Check for recent pours (to understand why no old pours)
    const recentPours = await Pour.find({}).sort('-createdAt').limit(5);
    console.log(`\n=== RECENT POURS ===`);
    console.log(`Found ${recentPours.length} recent pours`);
    recentPours.forEach(pour => {
      console.log(`- Pour ${pour._id}: created ${pour.createdAt}, rating: ${pour.rating}, notes: ${pour.notes ? 'yes' : 'no'}`);
    });

    // 3. Check for low stock bottles
    const users = await UserBottle.distinct('userId');
    console.log(`\n=== LOW STOCK CHECK ===`);
    console.log(`Checking ${users.length} users for low stock bottles`);
    
    let lowStockCount = 0;
    for (const userId of users) {
      const lowStockBottles = await UserBottle.find({
        userId: userId,
        fillLevel: { $lt: 25, $gt: 0 },
        status: 'opened'
      });
      if (lowStockBottles.length > 0) {
        lowStockCount += lowStockBottles.length;
        console.log(`User ${userId} has ${lowStockBottles.length} low stock bottles`);
      }
    }
    console.log(`Total low stock bottles: ${lowStockCount}`);

    // 4. Check existing notifications
    const recentNotifications = await Notification.find({}).sort('-createdAt').limit(5);
    console.log(`\n=== RECENT NOTIFICATIONS ===`);
    console.log(`Found ${recentNotifications.length} recent notifications`);
    recentNotifications.forEach(notif => {
      console.log(`- ${notif.type}: ${notif.title} (created ${notif.createdAt})`);
    });

    // 5. Test notification generation
    console.log(`\n=== TESTING NOTIFICATION GENERATION ===`);
    console.log('Running checkPourReminders...');
    await checkPourReminders();
    
    console.log('Running checkLowStock...');
    await checkLowStock();
    
    // Check if new notifications were created
    const newNotifications = await Notification.find({
      createdAt: { $gt: new Date(Date.now() - 60000) } // Created in last minute
    });
    console.log(`\nCreated ${newNotifications.length} new notifications`);
    newNotifications.forEach(notif => {
      console.log(`- ${notif.type}: ${notif.title}`);
    });

    // 6. Create a test pour that's old enough for notifications
    if (unratedPours.length === 0 && users.length > 0) {
      console.log(`\n=== CREATING TEST DATA ===`);
      // Find a bottle to create a test pour
      const testBottle = await UserBottle.findOne({ status: 'opened' });
      if (testBottle) {
        console.log('Creating test pour for bottle:', testBottle._id);
        // Need to use the session manager to create pours
        const { createPourWithSession } = await import('../lib/pour-session-manager');
        const { pour: testPour } = await createPourWithSession({
          userId: testBottle.userId.toString(),
          userBottleId: (testBottle._id as mongoose.Types.ObjectId).toString(),
          amount: 2,
          location: 'Home',
          date: new Date(Date.now() - 30 * 60 * 60 * 1000)
        });
        
        // Manually update createdAt to be older
        await Pour.updateOne(
          { _id: testPour._id },
          { createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000) }
        );
        console.log('Created test pour:', testPour._id);
        
        // Also set a bottle to low stock
        testBottle.fillLevel = 15;
        await testBottle.save();
        console.log('Set bottle to low stock (15% fill level)');
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from database');
  }
}

debugNotifications();