import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';

dotenv.config();

interface MasterBottle {
  _id: ObjectId;
  name: string;
  brand?: string;
  distillery?: string;
  producer?: string;
}

// Configurable array of prefixes to remove
// Comment out any prefixes you want to keep
const PREFIXES_TO_REMOVE = [
  "Buffalo Trace",
  "Brown-Forman Distillers Co.",
  "Heaven Hill",
 // "Rare Character",
 // "Jack Daniel's",
 // "Wild Turkey",
 // "Found North",
 // "Maker's Mark",
 // "Woodford Reserve",
 // "Four Roses Distillery",
 // "Garrison Brothers Distillery",
 // "Michter's",
 // "Garrison Brothers",
//  "Barton 1792 Distillery",
 // "High West",
 // "Penelope",
//"Hardin's Creek",
 // "Knob Creek",
  // "Angel's Envy", // Example: commented out to keep this prefix
//  "Bardstown Bourbon Company",
];

// Set to false to actually update the database
const DRY_RUN = true;

async function cleanDuplicateNames() {
  const client = new MongoClient(process.env.MONGODB_URI as string);

  try {
    await client.connect();
    console.log('Connected to MongoDB');
    console.log(`MODE: ${DRY_RUN ? 'DRY RUN' : 'LIVE UPDATE'}\n`);

    const database = client.db();
    const masterBottles = database.collection<MasterBottle>('masterbottles');

    // Get all master bottles
    const bottles = await masterBottles.find({}).toArray();
    console.log(`Found ${bottles.length} master bottles\n`);

    const updates: { bottle: MasterBottle; newName: string; prefix: string }[] = [];

    // Check each bottle
    bottles.forEach((bottle) => {
      for (const prefix of PREFIXES_TO_REMOVE) {
        if (bottle.name.startsWith(prefix + ' ')) {
          // Calculate the new name by removing the prefix
          const newName = bottle.name.substring(prefix.length + 1).trim();
          
          // Only update if the new name is different and not empty
          if (newName && newName !== bottle.name) {
            updates.push({ bottle, newName, prefix });
            break; // Only remove the first matching prefix
          }
        }
      }
    });

    console.log(`Found ${updates.length} bottles to update\n`);

    if (updates.length === 0) {
      console.log('No bottles need updating.');
      return;
    }

    // Group updates by prefix for better readability
    const updatesByPrefix = new Map<string, typeof updates>();
    updates.forEach((update) => {
      if (!updatesByPrefix.has(update.prefix)) {
        updatesByPrefix.set(update.prefix, []);
      }
      updatesByPrefix.get(update.prefix)?.push(update);
    });

    // Display updates grouped by prefix
    console.log('=== PLANNED UPDATES ===\n');
    let totalShown = 0;
    for (const [prefix, prefixUpdates] of Array.from(updatesByPrefix.entries())) {
      console.log(`--- ${prefix} (${prefixUpdates.length} updates) ---`);
      
      // Show first 3 examples for each prefix
      const examples = prefixUpdates.slice(0, 3);
      examples.forEach((update) => {
        console.log(`\nBottle ID: ${update.bottle._id}`);
        console.log(`Current:   "${update.bottle.name}"`);
        console.log(`Updated:   "${update.newName}"`);
      });
      
      if (prefixUpdates.length > 3) {
        console.log(`\n... and ${prefixUpdates.length - 3} more ${prefix} bottles`);
      }
      console.log();
      totalShown += examples.length;
    }

    if (!DRY_RUN) {
      console.log('\n=== PERFORMING UPDATES ===\n');
      
      let successCount = 0;
      let errorCount = 0;

      for (const update of updates) {
        try {
          const result = await masterBottles.updateOne(
            { _id: update.bottle._id },
            { $set: { name: update.newName } }
          );
          
          if (result.modifiedCount === 1) {
            successCount++;
            if (successCount % 10 === 0) {
              console.log(`Updated ${successCount} bottles...`);
            }
          } else {
            console.error(`Failed to update bottle ${update.bottle._id}: ${update.bottle.name}`);
            errorCount++;
          }
        } catch (error) {
          console.error(`Error updating bottle ${update.bottle._id}:`, error);
          errorCount++;
        }
      }

      console.log(`\n=== UPDATE COMPLETE ===`);
      console.log(`Successfully updated: ${successCount} bottles`);
      console.log(`Errors: ${errorCount}`);
    } else {
      console.log('\n=== DRY RUN COMPLETE ===');
      console.log(`Would update ${updates.length} bottles`);
      console.log('\nTo apply these changes, set DRY_RUN = false in the script');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Run the script
cleanDuplicateNames().catch(console.error);