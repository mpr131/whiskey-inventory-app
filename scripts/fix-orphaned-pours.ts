import mongoose from 'mongoose';
import { config } from 'dotenv';
import dbConnect from '../lib/mongodb';
import Pour from '../models/Pour';
import PourSession from '../models/PourSession';
import User from '../models/User';

config();

async function fixOrphanedPours() {
  try {
    await dbConnect();
    console.log('Connected to database');

    // Get user email from command line or use default
    const userEmail = process.argv[2];
    const dryRun = process.argv[3] !== '--execute';
    
    if (dryRun) {
      console.log('\n⚠️  DRY RUN MODE - No changes will be made');
      console.log('To execute changes, run: npm run fix-orphaned-pours -- <email> --execute\n');
    }

    let user;
    if (userEmail) {
      user = await User.findOne({ email: userEmail });
      if (!user) {
        console.error(`User with email ${userEmail} not found`);
        process.exit(1);
      }
    } else {
      console.error('Please provide a user email as an argument');
      console.error('Usage: npm run fix-orphaned-pours -- user@example.com [--execute]');
      process.exit(1);
    }

    console.log(`Processing orphaned pours for user: ${user.email}`);
    console.log('=====================================\n');

    // Find all orphaned pours
    const orphanedPours = await Pour.find({
      userId: user._id,
      sessionId: { $exists: false }
    }).sort({ date: 1 });

    console.log(`Found ${orphanedPours.length} orphaned pours\n`);

    if (orphanedPours.length === 0) {
      console.log('No orphaned pours to fix!');
      process.exit(0);
    }

    // Group orphaned pours by day
    const poursByDay = new Map<string, typeof orphanedPours>();
    
    for (const pour of orphanedPours) {
      const dateKey = new Date(pour.date).toDateString();
      if (!poursByDay.has(dateKey)) {
        poursByDay.set(dateKey, []);
      }
      poursByDay.get(dateKey)!.push(pour);
    }

    console.log(`Orphaned pours span ${poursByDay.size} different days\n`);

    // Process each day
    let totalFixed = 0;
    let sessionsCreated = 0;
    let sessionsReused = 0;

    for (const [dateKey, pours] of poursByDay) {
      console.log(`\nProcessing ${dateKey}:`);
      console.log(`  Found ${pours.length} orphaned pours`);

      // Get the date range for this day
      const pourDate = new Date(pours[0].date);
      const startOfDay = new Date(pourDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(pourDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Check if there's already a session for this day
      let session = await PourSession.findOne({
        userId: user._id,
        date: { $gte: startOfDay, $lte: endOfDay }
      });

      if (session) {
        console.log(`  Found existing session: ${session.sessionName}`);
        sessionsReused++;
      } else {
        // Create a new session for this day
        const sessionData = {
          userId: user._id,
          sessionName: `Session ${pourDate.toLocaleDateString()} (Recovered)`,
          date: pourDate,
          totalPours: 0,
          totalAmount: 0,
          totalCost: 0
        };

        if (!dryRun) {
          session = await PourSession.create(sessionData);
        } else {
          console.log(`  Would create new session: ${sessionData.sessionName}`);
          session = { _id: 'dry-run-session-id' } as any;
        }
        sessionsCreated++;
      }

      // Assign pours to the session
      for (const pour of pours) {
        console.log(`    Assigning pour ${pour._id} (${pour.amount}oz) to session`);
        if (!dryRun) {
          pour.sessionId = session._id;
          await pour.save();
        }
        totalFixed++;
      }

      // Update session statistics
      if (!dryRun && session) {
        await session.updateStats();
        console.log(`  Updated session statistics`);
      }
    }

    // Summary
    console.log('\n=====================================');
    console.log('Summary:');
    console.log(`Total orphaned pours processed: ${totalFixed}`);
    console.log(`Sessions created: ${sessionsCreated}`);
    console.log(`Sessions reused: ${sessionsReused}`);
    
    if (dryRun) {
      console.log('\n⚠️  This was a DRY RUN - no changes were made');
      console.log('To execute these changes, run the command with --execute flag');
    } else {
      console.log('\n✅ All orphaned pours have been assigned to sessions');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from database');
  }
}

// Run the fix script
fixOrphanedPours();