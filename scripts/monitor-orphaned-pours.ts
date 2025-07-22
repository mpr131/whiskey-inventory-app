import mongoose from 'mongoose';
import { config } from 'dotenv';
import dbConnect from '../lib/mongodb';
import Pour from '../models/Pour';
import User from '../models/User';

config();

async function monitorOrphanedPours() {
  try {
    await dbConnect();
    console.log('Monitoring orphaned pours...');
    console.log('=====================================\n');

    // Check for orphaned pours
    const orphanedPours = await Pour.find({ 
      sessionId: { $exists: false } 
    })
    .populate('userId', 'email')
    .populate({
      path: 'userBottleId',
      populate: {
        path: 'masterBottleId',
        select: 'name'
      }
    })
    .sort({ createdAt: -1 });

    if (orphanedPours.length === 0) {
      console.log('✅ No orphaned pours found! All pours have sessions.');
      return;
    }

    console.log(`⚠️  Found ${orphanedPours.length} orphaned pours!\n`);

    // Group by user for easier analysis
    const poursByUser = new Map<string, typeof orphanedPours>();
    
    for (const pour of orphanedPours) {
      const userEmail = pour.userId?.email || 'unknown';
      if (!poursByUser.has(userEmail)) {
        poursByUser.set(userEmail, []);
      }
      poursByUser.get(userEmail)!.push(pour);
    }

    // Display orphaned pours by user
    for (const [userEmail, pours] of Array.from(poursByUser)) {
      console.log(`\nUser: ${userEmail}`);
      console.log(`Orphaned pours: ${pours.length}`);
      console.log('-------------------');
      
      for (const pour of pours.slice(0, 5)) { // Show max 5 per user
        const bottleName = pour.userBottleId?.masterBottleId?.name || 'Unknown bottle';
        console.log(`  - ${new Date(pour.date).toLocaleString()}`);
        console.log(`    Bottle: ${bottleName}`);
        console.log(`    Amount: ${pour.amount}oz`);
        console.log(`    Pour ID: ${pour._id}`);
      }
      
      if (pours.length > 5) {
        console.log(`  ... and ${pours.length - 5} more`);
      }
    }

    // Summary statistics
    console.log('\n=====================================');
    console.log('Summary:');
    console.log(`Total orphaned pours: ${orphanedPours.length}`);
    console.log(`Affected users: ${poursByUser.size}`);
    
    // Date range of orphaned pours
    if (orphanedPours.length > 0) {
      const dates = orphanedPours.map(p => new Date(p.date).getTime());
      const oldestDate = new Date(Math.min(...dates));
      const newestDate = new Date(Math.max(...dates));
      console.log(`Date range: ${oldestDate.toLocaleDateString()} to ${newestDate.toLocaleDateString()}`);
    }

    console.log('\n💡 To fix these orphaned pours, run:');
    console.log('   npm run fix-orphaned-pours -- user@email.com --execute');

  } catch (error) {
    console.error('Error monitoring orphaned pours:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nMonitoring complete.');
  }
}

// Run the monitor
monitorOrphanedPours();