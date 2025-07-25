#!/usr/bin/env tsx

import dbConnect from '../lib/mongodb';
import MasterBottle from '../models/MasterBottle';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function debugUPCCount() {
  await dbConnect();

  console.log('Debugging UPC counts...\n');

  // Count bottles without UPC codes
  const query = {
    $or: [
      { upcCodes: { $exists: false } },
      { upcCodes: { $size: 0 } },
      { 'upcCodes.0': { $exists: false } }
    ]
  };

  const count = await MasterBottle.countDocuments(query);
  console.log(`Total bottles without UPCs: ${count}`);

  // Get a few samples
  const samples = await MasterBottle.find(query)
    .limit(10)
    .select('name brand distillery upcCodes')
    .lean();

  console.log('\nFirst 10 bottles without UPCs:');
  samples.forEach((bottle, idx) => {
    console.log(`${idx + 1}. ${bottle.name} (${bottle.brand})`);
    console.log(`   UPC Codes: ${JSON.stringify(bottle.upcCodes)}`);
  });

  // Check if it's the query that's wrong
  const allBottles = await MasterBottle.countDocuments({});
  const withUPCs = await MasterBottle.countDocuments({
    'upcCodes.0': { $exists: true }
  });

  console.log(`\nTotal master bottles: ${allBottles}`);
  console.log(`Bottles with UPCs: ${withUPCs}`);
  console.log(`Bottles without UPCs (calculated): ${allBottles - withUPCs}`);

  process.exit(0);
}

debugUPCCount().catch(console.error);