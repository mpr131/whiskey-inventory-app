// MongoDB initialization script for Whiskey Inventory application
// This script runs when MongoDB container starts with an empty database

// Switch to the whiskey database
db = db.getSiblingDB('whiskey');

// Create collections with validation rules
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'username'],
      properties: {
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
        },
        username: {
          bsonType: 'string',
          minLength: 3,
          maxLength: 50
        }
      }
    }
  }
});

db.createCollection('bottles');
db.createCollection('masterbottles');
db.createCollection('userbottles');
db.createCollection('pours');
db.createCollection('poursessions');
db.createCollection('activities');
db.createCollection('friendships');
db.createCollection('invitecodes');
db.createCollection('locations');
db.createCollection('masterstores');
db.createCollection('userstores');
db.createCollection('notifications');
db.createCollection('livepours');
db.createCollection('userpreferences');

// Create indexes for better performance
print('Creating indexes...');

// User indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ inviteCode: 1 });
db.users.createIndex({ createdAt: -1 });

// Bottle indexes (old schema - kept for compatibility)
db.bottles.createIndex({ user: 1, createdAt: -1 });
db.bottles.createIndex({ name: 'text', distillery: 'text' });
db.bottles.createIndex({ barcode: 1 });
db.bottles.createIndex({ status: 1 });

// MasterBottle indexes
db.masterbottles.createIndex({ name: 'text', distillery: 'text', searchName: 'text' });
db.masterbottles.createIndex({ normalizedName: 1 });
db.masterbottles.createIndex({ distillery: 1 });
db.masterbottles.createIndex({ upc: 1 });
db.masterbottles.createIndex({ externalIds: 1 });
db.masterbottles.createIndex({ 'externalIds.fwgsId': 1 });
db.masterbottles.createIndex({ 'externalIds.fwgsProductId': 1 });
db.masterbottles.createIndex({ createdAt: -1 });

// UserBottle indexes
db.userbottles.createIndex({ user: 1, createdAt: -1 });
db.userbottles.createIndex({ user: 1, masterBottle: 1 });
db.userbottles.createIndex({ masterBottle: 1 });
db.userbottles.createIndex({ barcode: 1 });
db.userbottles.createIndex({ status: 1 });
db.userbottles.createIndex({ location: 1 });

// Pour indexes
db.pours.createIndex({ bottle: 1, createdAt: -1 });
db.pours.createIndex({ userBottle: 1, createdAt: -1 });
db.pours.createIndex({ user: 1, createdAt: -1 });
db.pours.createIndex({ session: 1, createdAt: -1 });
db.pours.createIndex({ createdAt: -1 });
db.pours.createIndex({ rating: 1 });

// PourSession indexes
db.poursessions.createIndex({ user: 1, createdAt: -1 });
db.poursessions.createIndex({ user: 1, isActive: 1 });
db.poursessions.createIndex({ endedAt: 1 });

// Activity indexes
db.activities.createIndex({ user: 1, createdAt: -1 });
db.activities.createIndex({ type: 1, createdAt: -1 });
db.activities.createIndex({ 'relatedUsers': 1 });
db.activities.createIndex({ createdAt: -1 });

// Friendship indexes
db.friendships.createIndex({ requester: 1, recipient: 1 }, { unique: true });
db.friendships.createIndex({ recipient: 1, status: 1 });
db.friendships.createIndex({ requester: 1, status: 1 });

// InviteCode indexes
db.invitecodes.createIndex({ code: 1 }, { unique: true });
db.invitecodes.createIndex({ createdBy: 1 });
db.invitecodes.createIndex({ usedBy: 1 });

// Location indexes
db.locations.createIndex({ user: 1, type: 1 });
db.locations.createIndex({ user: 1, area: 1, bin: 1 });

// Store indexes
db.masterstores.createIndex({ name: 'text' });
db.masterstores.createIndex({ normalizedName: 1 });
db.userstores.createIndex({ user: 1, masterStore: 1 }, { unique: true });
db.userstores.createIndex({ user: 1 });

// Notification indexes
db.notifications.createIndex({ user: 1, createdAt: -1 });
db.notifications.createIndex({ user: 1, read: 1 });
db.notifications.createIndex({ user: 1, type: 1 });

// LivePour indexes
db.livepours.createIndex({ user: 1 });
db.livepours.createIndex({ pour: 1 });
db.livepours.createIndex({ createdAt: 1 }, { expireAfterSeconds: 600 }); // Auto-delete after 10 minutes

// UserPreferences indexes
db.userpreferences.createIndex({ user: 1 }, { unique: true });

print('Database initialization complete!');