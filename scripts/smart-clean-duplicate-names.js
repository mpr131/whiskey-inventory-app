import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config();

// Mapping of distilleries to their known sub-brands
// Only remove the distillery prefix when followed by these sub-brands
const DISTILLERY_SUB_BRANDS = {
  "Buffalo Trace": [
    "Blanton's",
    "Weller",
    "E.H. Taylor",
    "Eagle Rare",
    "Sazerac",
    "George T. Stagg",
    "Thomas H. Handy",
    "William Larue Weller",
    "Antique Collection",
    "Benchmark",
    "Ancient Age"
  ],
  "Heaven Hill": [
    "Elijah Craig",
    "Evan Williams",
    "Larceny",
    "Henry McKenna",
    "Rittenhouse",
    "Parker's Heritage",
    "Bernheim",
    "Mellow Corn"
  ],
  "Brown-Forman Distillers Co.": [
    "Old Forester",
    "Woodford Reserve",
    "Early Times",
    "Coopers' Craft"
  ],
  "Wild Turkey": [
    "Russell's Reserve",
    "Master's Keep",
    "Rare Breed",
    "Kentucky Spirit",
    "Jimmy Russell"
  ],
  "Four Roses Distillery": [
    "Small Batch",
    "Single Barrel",
    "Limited Edition"
  ],
  "Beam Suntory": [
    "Jim Beam",
    "Knob Creek",
    "Booker's",
    "Baker's",
    "Basil Hayden's",
    "Little Book"
  ],
  "Jack Daniel's": [
    "Single Barrel",
    "Gentleman Jack",
    "Tennessee Honey",
    "Tennessee Fire",
    "Sinatra Select",
    "No. 27 Gold",
    "Bottled-in-Bond",
    "Rye"
  ],
  "Maker's Mark": [
    "46",
    "Cask Strength",
    "Private Select",
    "Wood Finishing Series",
    "Cellar Aged"
  ],
  "Garrison Brothers Distillery": [
    "Cowboy",
    "Balmorhea",
    "Guadalupe",
    "HoneyDew",
    "Single Barrel"
  ],
  "Garrison Brothers": [
    "Cowboy",
    "Balmorhea",
    "Guadalupe",
    "HoneyDew",
    "Single Barrel"
  ],
  "Rare Character": [
    // For Rare Character, we'll use a special pattern since they don't have sub-brands
    // but rather age statements and barrel info
  ]
};

// Set to false to actually update the database
const DRY_RUN = true;

function shouldRemovePrefix(bottleName, distillery) {
  // Check if this distillery has known sub-brands
  const subBrands = DISTILLERY_SUB_BRANDS[distillery];
  if (!subBrands) {
    return false; // Don't remove if we don't know the sub-brands
  }

  // Check if the name starts with the distillery
  if (!bottleName.startsWith(distillery + ' ')) {
    return false;
  }

  // Get the part after the distillery name
  const remainingName = bottleName.substring(distillery.length + 1);

  // Check if any sub-brand appears at the beginning of the remaining name
  for (const subBrand of subBrands) {
    if (remainingName.startsWith(subBrand)) {
      return true;
    }
  }

  // Special case for Rare Character - they don't have sub-brands but use age statements
  if (distillery === "Rare Character") {
    // Remove prefix if it starts with age statement or "Single Barrel"
    if (/^\d+(\.\d+)?\s+Year|^Single Barrel|^SiB/i.test(remainingName)) {
      return true;
    }
  }

  // Special cases for patterns
  // For numbered releases (e.g., "10 Year Old")
  if (/^\d+\s+Year/i.test(remainingName)) {
    // Only remove if it's a special edition or has other identifiers
    if (/Limited|Special|Select|Edition|Batch|Proof|Single Barrel/i.test(remainingName)) {
      return true;
    }
    return false; // Keep distillery name for simple age statements
  }

  return false;
}

async function smartCleanDuplicateNames() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');
    console.log(`MODE: ${DRY_RUN ? 'DRY RUN' : 'LIVE UPDATE'}\n`);

    const database = client.db();
    const masterBottles = database.collection('masterbottles');

    // Get all master bottles
    const bottles = await masterBottles.find({}).toArray();
    console.log(`Found ${bottles.length} master bottles\n`);

    const updates = [];

    // Check each bottle
    bottles.forEach((bottle) => {
      // Check against each known distillery
      for (const distillery of Object.keys(DISTILLERY_SUB_BRANDS)) {
        if (shouldRemovePrefix(bottle.name, distillery)) {
          const newName = bottle.name.substring(distillery.length + 1).trim();
          
          if (newName && newName !== bottle.name) {
            updates.push({ bottle, newName, distillery });
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

    // Group updates by distillery for better readability
    const updatesByDistillery = new Map();
    updates.forEach((update) => {
      if (!updatesByDistillery.has(update.distillery)) {
        updatesByDistillery.set(update.distillery, []);
      }
      updatesByDistillery.get(update.distillery).push(update);
    });

    // Display updates grouped by distillery
    console.log('=== PLANNED UPDATES ===\n');
    let totalShown = 0;
    for (const [distillery, distilleryUpdates] of updatesByDistillery) {
      console.log(`--- ${distillery} (${distilleryUpdates.length} updates) ---`);
      
      // Show first 5 examples for each distillery
      const examples = distilleryUpdates.slice(0, 5);
      examples.forEach((update) => {
        console.log(`\nBottle ID: ${update.bottle._id}`);
        console.log(`Current:   "${update.bottle.name}"`);
        console.log(`Updated:   "${update.newName}"`);
      });
      
      if (distilleryUpdates.length > 5) {
        console.log(`\n... and ${distilleryUpdates.length - 5} more ${distillery} bottles`);
      }
      console.log();
      totalShown += examples.length;
    }

    // Show examples of bottles that were NOT updated
    console.log('\n=== BOTTLES KEPT AS-IS (Examples) ===\n');
    const keptBottles = bottles.filter(bottle => {
      return !updates.some(update => update.bottle._id.equals(bottle._id)) &&
             Object.keys(DISTILLERY_SUB_BRANDS).some(distillery => 
               bottle.name.startsWith(distillery + ' ')
             );
    }).slice(0, 10);

    keptBottles.forEach(bottle => {
      console.log(`Kept: "${bottle.name}"`);
    });

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
smartCleanDuplicateNames().catch(console.error);