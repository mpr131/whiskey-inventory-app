import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb';
import Pour from '../models/Pour';
import PourSession from '../models/PourSession';
import User from '../models/User';
import Friendship from '../models/Friendship';

async function migrateCompanionsToTags() {
  await dbConnect();

  try {
    console.log('🔄 Starting companion migration...\n');

    // Get all users for friend matching
    const users = await User.find({}).select('name displayName username');
    const userMap = new Map();
    users.forEach(user => {
      const names = [user.name, user.displayName, user.username].filter(Boolean);
      names.forEach(name => {
        if (name) {
          userMap.set(name.toLowerCase(), user._id.toString());
        }
      });
    });

    // Migrate PourSessions
    console.log('📋 Migrating PourSessions...');
    const sessions = await PourSession.find({ 
      companions: { $exists: true, $ne: [] },
      companionTags: { $exists: false }
    });

    let sessionCount = 0;
    for (const session of sessions) {
      const companionTags = [];
      
      for (const companion of session.companions || []) {
        const companionLower = companion.toLowerCase();
        const friendId = userMap.get(companionLower);
        
        if (friendId) {
          // Check if they're actually friends
          const friendship = await Friendship.findOne({
            $and: [
              { status: 'accepted' },
              {
                $or: [
                  { requester: session.userId, recipient: friendId },
                  { requester: friendId, recipient: session.userId },
                ],
              },
            ],
          });

          if (friendship) {
            companionTags.push({
              type: 'friend',
              friendId: new mongoose.Types.ObjectId(friendId),
              name: companion,
            });
          } else {
            companionTags.push({
              type: 'text',
              name: companion,
            });
          }
        } else {
          companionTags.push({
            type: 'text',
            name: companion,
          });
        }
      }

      session.companionTags = companionTags;
      await session.save();
      sessionCount++;
    }

    console.log(`✅ Migrated ${sessionCount} PourSessions`);

    // Migrate Pours
    console.log('\n🥃 Migrating Pours...');
    const pours = await Pour.find({ 
      companions: { $exists: true, $ne: [] },
      companionTags: { $exists: false }
    });

    let pourCount = 0;
    for (const pour of pours) {
      const companionTags = [];
      
      for (const companion of pour.companions || []) {
        const companionLower = companion.toLowerCase();
        const friendId = userMap.get(companionLower);
        
        if (friendId) {
          // Check if they're actually friends
          const friendship = await Friendship.findOne({
            $and: [
              { status: 'accepted' },
              {
                $or: [
                  { requester: pour.userId, recipient: friendId },
                  { requester: friendId, recipient: pour.userId },
                ],
              },
            ],
          });

          if (friendship) {
            companionTags.push({
              type: 'friend',
              friendId: new mongoose.Types.ObjectId(friendId),
              name: companion,
            });
          } else {
            companionTags.push({
              type: 'text',
              name: companion,
            });
          }
        } else {
          companionTags.push({
            type: 'text',
            name: companion,
          });
        }
      }

      pour.companionTags = companionTags;
      await pour.save();
      pourCount++;
    }

    console.log(`✅ Migrated ${pourCount} Pours`);

    // Summary
    console.log('\n📊 Migration Summary:');
    console.log(`   - ${sessionCount} PourSessions updated`);
    console.log(`   - ${pourCount} Pours updated`);
    console.log('\n✨ Migration completed successfully!');
    
    // Note about backward compatibility
    console.log('\n💡 Note: The original companions field has been preserved for backward compatibility.');
    console.log('   New companionTags field contains structured friend/text data.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.connection.close();
  }
}

// Run the migration
migrateCompanionsToTags().catch(console.error);