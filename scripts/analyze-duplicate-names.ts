import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config();

interface MasterBottle {
  _id: string;
  name: string;
  brand?: string;
  distillery?: string;
  producer?: string;
}

async function analyzeDuplicateNames() {
  const client = new MongoClient(process.env.MONGODB_URI as string);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const database = client.db();
    const masterBottles = database.collection<MasterBottle>('masterbottles');

    // Get all master bottles
    const bottles = await masterBottles.find({}).toArray();
    console.log(`Found ${bottles.length} master bottles\n`);

    // Analyze patterns
    const prefixCandidates = new Map<string, number>();
    const examples = new Map<string, MasterBottle[]>();
    
    bottles.forEach(bottle => {
      // Check if name starts with distillery
      if (bottle.distillery && bottle.name.startsWith(bottle.distillery)) {
        const count = prefixCandidates.get(bottle.distillery) || 0;
        prefixCandidates.set(bottle.distillery, count + 1);
        
        if (!examples.has(bottle.distillery)) {
          examples.set(bottle.distillery, []);
        }
        examples.get(bottle.distillery)?.push(bottle);
      }
      
      // Check if name starts with producer
      if (bottle.producer && bottle.producer !== bottle.distillery && bottle.name.startsWith(bottle.producer)) {
        const count = prefixCandidates.get(bottle.producer) || 0;
        prefixCandidates.set(bottle.producer, count + 1);
        
        if (!examples.has(bottle.producer)) {
          examples.set(bottle.producer, []);
        }
        examples.get(bottle.producer)?.push(bottle);
      }
      
      // Check if name starts with brand
      if (bottle.brand && bottle.brand !== bottle.distillery && bottle.brand !== bottle.producer && bottle.name.startsWith(bottle.brand)) {
        const count = prefixCandidates.get(bottle.brand) || 0;
        prefixCandidates.set(bottle.brand, count + 1);
        
        if (!examples.has(bottle.brand)) {
          examples.set(bottle.brand, []);
        }
        examples.get(bottle.brand)?.push(bottle);
      }
    });

    // Sort by frequency
    const sortedPrefixes = Array.from(prefixCandidates.entries())
      .sort((a, b) => b[1] - a[1])
      .filter(([_, count]) => count >= 2); // Only show prefixes that appear 2+ times

    console.log('=== DUPLICATE PREFIX ANALYSIS ===\n');
    console.log(`Found ${sortedPrefixes.length} potential prefixes to remove\n`);

    // Show examples
    sortedPrefixes.slice(0, 20).forEach(([prefix, count]) => {
      console.log(`\n--- ${prefix} (${count} occurrences) ---`);
      const bottleExamples = examples.get(prefix)?.slice(0, 3) || [];
      bottleExamples.forEach(bottle => {
        console.log(`Original: "${bottle.name}"`);
        const cleaned = bottle.name.substring(prefix.length).trim();
        console.log(`Cleaned:  "${cleaned}"`);
        console.log(`Distillery: ${bottle.distillery || 'N/A'}, Producer: ${bottle.producer || 'N/A'}, Brand: ${bottle.brand || 'N/A'}`);
        console.log();
      });
    });

    // Generate suggested prefix list
    console.log('\n=== SUGGESTED PREFIX LIST ===\n');
    console.log('const prefixesToRemove = [');
    sortedPrefixes.slice(0, 20).forEach(([prefix, count]) => {
      console.log(`  "${prefix}", // ${count} occurrences`);
    });
    console.log('];');

  } catch (error) {
    console.error('Error analyzing bottles:', error);
  } finally {
    await client.close();
  }
}

analyzeDuplicateNames().catch(console.error);