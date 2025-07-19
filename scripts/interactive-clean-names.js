import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import readline from 'readline';
import fs from 'fs/promises';

dotenv.config();

// Configurable array of prefixes to check
// EXCLUDING Buffalo Trace, Brown-Forman Distillers Co., and Heaven Hill (already processed)
const PREFIXES_TO_CHECK = [
  "Rare Character",
  "Jack Daniel's",
  "Wild Turkey",
  "Found North",
  "Maker's Mark",
  "Woodford Reserve",
  "Four Roses Distillery",
  "Garrison Brothers Distillery",
  "Michter's",
  "Garrison Brothers",
  "Barton 1792 Distillery",
  "High West",
  "Penelope",
  "Hardin's Creek",
  "Knob Creek",
  "Angel's Envy",
  "Bardstown Bourbon Company",
];

// File to save decisions
const DECISIONS_FILE = 'name-cleaning-decisions.json';

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify readline question
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function loadPreviousDecisions() {
  try {
    const data = await fs.readFile(DECISIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { approved: [], skipped: [], timestamp: new Date().toISOString() };
  }
}

async function saveDecisions(decisions) {
  await fs.writeFile(DECISIONS_FILE, JSON.stringify(decisions, null, 2));
}

async function interactiveCleanNames() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB\n');

    const database = client.db();
    const masterBottles = database.collection('masterbottles');

    // Get all master bottles
    const bottles = await masterBottles.find({}).toArray();
    console.log(`Found ${bottles.length} master bottles\n`);

    const potentialUpdates = [];

    // Find all bottles that could be updated
    bottles.forEach((bottle) => {
      for (const prefix of PREFIXES_TO_CHECK) {
        if (bottle.name.startsWith(prefix + ' ')) {
          const newName = bottle.name.substring(prefix.length + 1).trim();
          
          if (newName && newName !== bottle.name) {
            potentialUpdates.push({ bottle, newName, prefix });
            break; // Only check the first matching prefix
          }
        }
      }
    });

    console.log(`Found ${potentialUpdates.length} bottles that could be updated\n`);

    if (potentialUpdates.length === 0) {
      console.log('No bottles need updating.');
      rl.close();
      return;
    }

    // Load previous decisions if any
    const decisions = await loadPreviousDecisions();
    console.log('=== INTERACTIVE NAME CLEANING ===\n');
    console.log('For each bottle, press:');
    console.log('  Y - Yes, approve this change');
    console.log('  N - No, skip this change');
    console.log('  Q - Quit and save progress\n');
    console.log('Press Enter to begin...');
    await question('');

    // Clear approved and skipped arrays for new session
    decisions.approved = [];
    decisions.skipped = [];
    decisions.timestamp = new Date().toISOString();

    // Process each potential update
    for (let i = 0; i < potentialUpdates.length; i++) {
      const update = potentialUpdates[i];
      
      console.clear();
      console.log(`\n=== Bottle ${i + 1} of ${potentialUpdates.length} ===\n`);
      console.log(`Distillery: ${update.bottle.distillery || 'N/A'}`);
      console.log(`Brand: ${update.bottle.brand || 'N/A'}`);
      console.log(`\nCurrent name:`);
      console.log(`  "${update.bottle.name}"\n`);
      console.log(`Would become:`);
      console.log(`  "${update.newName}"\n`);
      console.log(`Remove prefix: "${update.prefix}"\n`);

      let validResponse = false;
      while (!validResponse) {
        const response = await question('Approve this change? (Y/N/Q): ');
        const answer = response.toUpperCase();

        if (answer === 'Y') {
          decisions.approved.push({
            _id: update.bottle._id,
            currentName: update.bottle.name,
            newName: update.newName,
            prefix: update.prefix
          });
          console.log('✓ Change approved\n');
          validResponse = true;
        } else if (answer === 'N') {
          decisions.skipped.push({
            _id: update.bottle._id,
            currentName: update.bottle.name,
            wouldBecome: update.newName,
            prefix: update.prefix
          });
          console.log('✗ Change skipped\n');
          validResponse = true;
        } else if (answer === 'Q') {
          console.log('\nQuitting...');
          await saveDecisions(decisions);
          console.log(`Progress saved. Reviewed ${i} of ${potentialUpdates.length} bottles.`);
          rl.close();
          await client.close();
          return;
        } else {
          console.log('Invalid response. Please enter Y, N, or Q.');
        }
      }

      // Save progress every 10 decisions
      if ((decisions.approved.length + decisions.skipped.length) % 10 === 0) {
        await saveDecisions(decisions);
        console.log('Progress saved...');
      }

      // Brief pause before next bottle
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Save final decisions
    await saveDecisions(decisions);

    // Show summary
    console.clear();
    console.log('\n=== REVIEW COMPLETE ===\n');
    console.log(`Total bottles reviewed: ${potentialUpdates.length}`);
    console.log(`Approved changes: ${decisions.approved.length}`);
    console.log(`Skipped changes: ${decisions.skipped.length}\n`);

    if (decisions.approved.length > 0) {
      console.log('Sample of approved changes:');
      decisions.approved.slice(0, 5).forEach(decision => {
        console.log(`\n"${decision.currentName}"`);
        console.log(`→ "${decision.newName}"`);
      });
      if (decisions.approved.length > 5) {
        console.log(`\n... and ${decisions.approved.length - 5} more approved changes`);
      }

      console.log('\n' + '='.repeat(50) + '\n');
      
      const proceed = await question(`Apply ${decisions.approved.length} approved changes to the database? (yes/no): `);
      
      if (proceed.toLowerCase() === 'yes') {
        console.log('\n=== APPLYING CHANGES ===\n');
        
        let successCount = 0;
        let errorCount = 0;

        for (const decision of decisions.approved) {
          try {
            const result = await masterBottles.updateOne(
              { _id: decision._id },
              { $set: { name: decision.newName } }
            );
            
            if (result.modifiedCount === 1) {
              successCount++;
              if (successCount % 10 === 0) {
                console.log(`Updated ${successCount} bottles...`);
              }
            } else {
              console.error(`Failed to update: ${decision.currentName}`);
              errorCount++;
            }
          } catch (error) {
            console.error(`Error updating bottle:`, error);
            errorCount++;
          }
        }

        console.log(`\n=== UPDATE COMPLETE ===`);
        console.log(`Successfully updated: ${successCount} bottles`);
        console.log(`Errors: ${errorCount}`);
        
        // Archive the decisions file
        const archiveFile = `name-cleaning-decisions-${new Date().toISOString().split('T')[0]}.json`;
        await fs.rename(DECISIONS_FILE, archiveFile);
        console.log(`\nDecisions archived to: ${archiveFile}`);
      } else {
        console.log('\nNo changes applied. Decisions saved in', DECISIONS_FILE);
      }
    } else {
      console.log('No changes were approved.');
    }

    rl.close();

  } catch (error) {
    console.error('Error:', error);
    rl.close();
  } finally {
    await client.close();
  }
}

// Run the script
interactiveCleanNames().catch(console.error);