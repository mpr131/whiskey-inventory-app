const mongoose = require('mongoose');
const readline = require('readline');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/whiskey-inventory';

// Define schemas directly since models might not work in CommonJS context
const UserBottleSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  masterBottleId: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterBottle', required: true },
  purchaseDate: Date,
  purchasePrice: Number,
  marketValue: Number,
  myValue: Number,
  quantity: { type: Number, default: 1 },
  location: {
    area: String,
    bin: String,
  },
  notes: String,
  personalNotes: String,
  purchaseNote: String,
  deliveryDate: Date,
  barcode: String,
  wineBarcode: String,
  storeName: String,
  cellarTrackerId: String,
  photos: [String],
  status: {
    type: String,
    enum: ['unopened', 'opened', 'finished'],
    default: 'unopened',
  },
  openDate: Date,
  fillLevel: { type: Number, default: 100 },
  pours: [{
    date: { type: Date, default: Date.now },
    amount: Number,
    notes: String,
  }],
}, {
  timestamps: true,
});

const MasterBottleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  brand: { type: String, required: true, trim: true },
  distillery: { type: String, required: true, trim: true },
  region: { type: String, trim: true },
  category: {
    type: String,
    required: true,
    enum: ['Bourbon', 'Rye', 'Scotch', 'Irish', 'Japanese', 'Other'],
    default: 'Bourbon',
  },
  type: String,
  age: Number,
  proof: Number,
  msrp: Number,
  description: String,
  isStorePick: { type: Boolean, default: false },
  storePickDetails: {
    store: String,
    pickDate: Date,
    barrel: String,
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, {
  timestamps: true,
});

const UserBottle = mongoose.model('UserBottle', UserBottleSchema);
const MasterBottle = mongoose.model('MasterBottle', MasterBottleSchema);

// Define store schemas
const MasterStoreSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: String,
  state: String,
  country: String,
}, { timestamps: true });

const UserStoreSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  masterStoreId: mongoose.Schema.Types.ObjectId,
}, { timestamps: true });

const MasterStore = mongoose.model('MasterStore', MasterStoreSchema);
const UserStore = mongoose.model('UserStore', UserStoreSchema);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function clearDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get counts before deletion
    const userBottleCount = await UserBottle.countDocuments();
    const masterBottleCount = await MasterBottle.countDocuments();
    const userStoreCount = await UserStore.countDocuments();
    const masterStoreCount = await MasterStore.countDocuments();

    console.log(`\nCurrent database state:`);
    console.log(`- UserBottles: ${userBottleCount}`);
    console.log(`- MasterBottles: ${masterBottleCount}`);
    console.log(`- UserStores: ${userStoreCount}`);
    console.log(`- MasterStores: ${masterStoreCount}`);

    if (userBottleCount === 0 && masterBottleCount === 0 && userStoreCount === 0 && masterStoreCount === 0) {
      console.log('\nDatabase is already empty. Nothing to clear.');
      process.exit(0);
    }

    // Prompt for confirmation
    const answer = await new Promise((resolve) => {
      rl.question(
        '\nThis will delete ALL bottles, master bottles, and stores. Are you sure? (yes/no): ',
        resolve
      );
    });

    if (answer.toLowerCase() !== 'yes') {
      console.log('Operation cancelled.');
      process.exit(0);
    }

    // Double confirmation for safety
    const doubleConfirm = await new Promise((resolve) => {
      rl.question(
        'Are you absolutely sure? This action cannot be undone. Type "DELETE ALL" to confirm: ',
        resolve
      );
    });

    if (doubleConfirm !== 'DELETE ALL') {
      console.log('Operation cancelled. You must type "DELETE ALL" exactly.');
      process.exit(0);
    }

    console.log('\nStarting database cleanup...');

    // Delete all UserBottles
    const userBottleResult = await UserBottle.deleteMany({});
    console.log(`✓ Deleted ${userBottleResult.deletedCount} UserBottles`);

    // Delete all MasterBottles
    const masterBottleResult = await MasterBottle.deleteMany({});
    console.log(`✓ Deleted ${masterBottleResult.deletedCount} MasterBottles`);
    
    // Delete all UserStores
    const userStoreResult = await UserStore.deleteMany({});
    console.log(`✓ Deleted ${userStoreResult.deletedCount} UserStores`);
    
    // Delete all MasterStores
    const masterStoreResult = await MasterStore.deleteMany({});
    console.log(`✓ Deleted ${masterStoreResult.deletedCount} MasterStores`);

    console.log('\n✅ Database cleanup completed successfully!');
    console.log('You can now re-import your data with the updated import logic.');

  } catch (error) {
    console.error('❌ Error clearing database:', error);
    process.exit(1);
  } finally {
    rl.close();
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n\nOperation interrupted by user');
  rl.close();
  await mongoose.disconnect();
  process.exit(0);
});

// Run the cleanup
clearDatabase();