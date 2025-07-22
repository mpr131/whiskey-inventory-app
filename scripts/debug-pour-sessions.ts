import mongoose from 'mongoose';
import { config } from 'dotenv';
import dbConnect from '../lib/mongodb';
import Pour from '../models/Pour';
import PourSession from '../models/PourSession';
import User from '../models/User';

config();

async function debugPourSessions() {
  try {
    await dbConnect();
    console.log('Connected to database');

    // Get a user to test with (you can specify a specific email if needed)
    const userEmail = process.argv[2]; // Pass email as command line argument
    let user;
    
    if (userEmail) {
      user = await User.findOne({ email: userEmail });
      if (!user) {
        console.error(`User with email ${userEmail} not found`);
        process.exit(1);
      }
    } else {
      // Get the first user with pours
      const pourWithUser = await Pour.findOne().populate('userId');
      if (!pourWithUser) {
        console.error('No pours found in database');
        process.exit(1);
      }
      user = await User.findById(pourWithUser.userId);
    }

    console.log(`\nDebugging pours for user: ${user.email}`);
    console.log('=====================================\n');

    // Get all sessions for the user
    const sessions = await PourSession.find({ userId: user._id }).sort({ date: -1 });
    console.log(`Total sessions found: ${sessions.length}`);

    // For each session, check the pours
    for (const session of sessions) {
      console.log(`\nSession: ${session.sessionName}`);
      console.log(`Date: ${session.date}`);
      console.log(`Session ID: ${session._id}`);
      console.log(`Reported total pours: ${session.totalPours}`);

      // Count actual pours in this session
      const actualPours = await Pour.find({ 
        sessionId: session._id,
        userId: user._id 
      });
      console.log(`Actual pours in DB: ${actualPours.length}`);

      // Get date range for this session
      const sessionDate = new Date(session.date);
      const startOfDay = new Date(sessionDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(sessionDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Count all pours for this day
      const allPoursForDay = await Pour.find({
        userId: user._id,
        date: { $gte: startOfDay, $lte: endOfDay }
      });
      console.log(`Total pours on ${sessionDate.toDateString()}: ${allPoursForDay.length}`);

      // Check for orphaned pours on this day
      const orphanedPoursForDay = await Pour.find({
        userId: user._id,
        date: { $gte: startOfDay, $lte: endOfDay },
        sessionId: { $exists: false }
      });
      console.log(`Orphaned pours on this day: ${orphanedPoursForDay.length}`);

      if (orphanedPoursForDay.length > 0) {
        console.log('Orphaned pour details:');
        for (const pour of orphanedPoursForDay) {
          console.log(`  - Pour ID: ${pour._id}, Amount: ${pour.amount}oz, Time: ${pour.date}`);
        }
      }
    }

    // Check for all orphaned pours
    console.log('\n=====================================');
    console.log('All Orphaned Pours (no session assigned):');
    const allOrphanedPours = await Pour.find({
      userId: user._id,
      sessionId: { $exists: false }
    }).sort({ date: -1 });

    console.log(`Total orphaned pours: ${allOrphanedPours.length}`);
    
    if (allOrphanedPours.length > 0) {
      console.log('\nOrphaned pour details:');
      for (const pour of allOrphanedPours) {
        const pourDate = new Date(pour.date);
        console.log(`  - Date: ${pourDate.toDateString()} ${pourDate.toLocaleTimeString()}`);
        console.log(`    Pour ID: ${pour._id}, Amount: ${pour.amount}oz`);
        
        // Check if there's a session on this day
        const startOfPourDay = new Date(pourDate);
        startOfPourDay.setHours(0, 0, 0, 0);
        const endOfPourDay = new Date(pourDate);
        endOfPourDay.setHours(23, 59, 59, 999);
        
        const sessionOnDay = await PourSession.findOne({
          userId: user._id,
          date: { $gte: startOfPourDay, $lte: endOfPourDay }
        });
        
        if (sessionOnDay) {
          console.log(`    ⚠️  Found session on same day: ${sessionOnDay.sessionName} (${sessionOnDay._id})`);
        }
      }
    }

    // Summary statistics
    console.log('\n=====================================');
    console.log('Summary Statistics:');
    const totalPours = await Pour.countDocuments({ userId: user._id });
    const poursWithSession = await Pour.countDocuments({ 
      userId: user._id, 
      sessionId: { $exists: true, $ne: null } 
    });
    const poursWithoutSession = await Pour.countDocuments({ 
      userId: user._id, 
      sessionId: { $exists: false } 
    });

    console.log(`Total pours: ${totalPours}`);
    console.log(`Pours with session: ${poursWithSession}`);
    console.log(`Pours without session: ${poursWithoutSession}`);
    console.log(`Percentage orphaned: ${((poursWithoutSession / totalPours) * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from database');
  }
}

// Run the debug script
debugPourSessions();