import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import MasterBottle from '@/models/MasterBottle';
import UserBottle from '@/models/UserBottle';
import MasterStore from '@/models/MasterStore';
import UserStore from '@/models/UserStore';
import mongoose from 'mongoose';
import { extractAbvFromName } from '@/utils/extractAbv';

interface ImportedBottle {
  [key: string]: string | undefined;
}

interface MasterBottleMap {
  [key: string]: mongoose.Types.ObjectId;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    // Debug: Check if UserBottle schema has the fields
    console.log('UserBottle schema paths:', Object.keys(UserBottle.schema.paths));
    console.log('Has barcode field?', 'barcode' in UserBottle.schema.paths);
    console.log('Has storeName field?', 'storeName' in UserBottle.schema.paths);
    console.log('Has marketValue field?', 'marketValue' in UserBottle.schema.paths);

    const data = await request.json();
    const { bottles, columnMapping, isCellarTracker = false } = data;

    if (!bottles || !Array.isArray(bottles)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }
    
    // Debug column mapping
    console.log('Column mapping received:', columnMapping);
    console.log('Sample bottle data:', bottles[0] ? Object.keys(bottles[0]) : 'No bottles');

    const results = {
      imported: 0,
      updated: 0,
      failed: 0,
      masterBottlesCreated: 0,
      masterBottlesFound: 0,
      errors: [] as any[],
    };

    // Group bottles differently based on import type
    const masterBottleMap: MasterBottleMap = {};
    const groupedBottles = new Map<string, ImportedBottle[]>();

    if (isCellarTracker && columnMapping.iWine) {
      // CellarTracker mode: group by iWine
      for (const bottle of bottles) {
        const iWine = bottle[columnMapping.iWine] || '';
        if (!iWine) continue; // Skip rows without iWine
        
        if (!groupedBottles.has(iWine)) {
          groupedBottles.set(iWine, []);
        }
        groupedBottles.get(iWine)!.push(bottle);
      }
    } else {
      // Standard mode: group by Wine + Producer + Vintage
      for (const bottle of bottles) {
        const wine = bottle[columnMapping.wine] || '';
        const producer = bottle[columnMapping.producer] || '';
        const vintage = bottle[columnMapping.vintage] || '';
        
        const key = `${wine}|${producer}|${vintage}`.toLowerCase();
        
        if (!groupedBottles.has(key)) {
          groupedBottles.set(key, []);
        }
        groupedBottles.get(key)!.push(bottle);
      }
    }

    // Create or find MasterBottles for unique wines
    for (const [key, bottleGroup] of groupedBottles) {
      const firstBottle = bottleGroup[0];
      const wine = firstBottle[columnMapping.wine] || '';
      const producer = firstBottle[columnMapping.producer] || '';
      const vintage = firstBottle[columnMapping.vintage] || '';
      const region = firstBottle[columnMapping.region] || '';
      
      // Map CellarTracker's Varietal to our category
      let category = 'Bourbon';
      if (columnMapping.varietal && firstBottle[columnMapping.varietal]) {
        const varietal = firstBottle[columnMapping.varietal].toLowerCase();
        if (varietal.includes('bourbon')) category = 'Bourbon';
        else if (varietal.includes('rye')) category = 'Rye';
        else if (varietal.includes('scotch') || varietal.includes('single malt')) category = 'Scotch';
        else if (varietal.includes('irish')) category = 'Irish';
        else if (varietal.includes('japanese')) category = 'Japanese';
        else category = 'Other';
      }

      try {
        // For CellarTracker imports, use iWine as additional identifier
        let masterBottle;
        
        if (isCellarTracker && firstBottle[columnMapping.iWine]) {
          // First try to find by cellarTrackerId
          const existingUserBottle = await UserBottle.findOne({
            cellarTrackerId: firstBottle[columnMapping.iWine],
          }).populate('masterBottleId');
          
          if (existingUserBottle?.masterBottleId) {
            masterBottle = existingUserBottle.masterBottleId;
            results.masterBottlesFound++;
          }
        }
        
        // If not found by iWine, try standard lookup
        if (!masterBottle) {
          masterBottle = await MasterBottle.findOne({
            name: { $regex: new RegExp(`^${wine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            distillery: { $regex: new RegExp(`^${producer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            isStorePick: false,
          });
          
          if (masterBottle) {
            results.masterBottlesFound++;
          }
        }

        if (!masterBottle) {
          // Extract age from vintage or wine name
          let age = null;
          if (vintage && !isNaN(parseInt(vintage))) {
            const vintageYear = parseInt(vintage);
            if (vintageYear > 1900 && vintageYear < 2100) {
              // It's a year, calculate age
              age = new Date().getFullYear() - vintageYear;
            } else {
              // It might be the age itself
              age = vintageYear;
            }
          } else {
            // Try to extract age from name (e.g., "Russell's Reserve 13 Year")
            const ageMatch = wine.match(/(\d+)\s*[Yy]ear/);
            if (ageMatch) {
              age = parseInt(ageMatch[1]);
            }
          }

          // Extract ABV/proof from wine name
          const abvData = extractAbvFromName(wine);

          // Create new MasterBottle
          try {
            masterBottle = await MasterBottle.create({
              name: wine,
              brand: producer,
              distillery: producer,
              region: region || undefined,
              category: category,
              type: category,
              age: age && age > 0 && age < 100 ? age : undefined,
              abv: abvData.abv || undefined,
              proof: abvData.proof || undefined,
              statedProof: abvData.statedProof || undefined,
              createdBy: new mongoose.Types.ObjectId(session.user.id),
            });
            results.masterBottlesCreated++;
          } catch (createError: any) {
            if (createError.code === 11000) {
              // Duplicate key error - the bottle was created by another import running concurrently
              masterBottle = await MasterBottle.findOne({
                name: { $regex: new RegExp(`^${wine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
                distillery: { $regex: new RegExp(`^${producer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
                isStorePick: false,
              });
              if (masterBottle) {
                results.masterBottlesFound++;
              }
            } else {
              throw createError;
            }
          }
        }

        if (masterBottle) {
          masterBottleMap[key] = masterBottle._id;
        }
      } catch (error: any) {
        console.error(`Error processing MasterBottle for ${wine}:`, error);
        results.errors.push({
          bottle: wine,
          error: `Failed to process master bottle: ${error.message}`,
        });
      }
    }

    // Create ONE UserBottle per CSV row (no grouping)
    for (const [key, bottleGroup] of groupedBottles) {
      const masterBottleId = masterBottleMap[key];
      
      if (!masterBottleId) {
        console.error(`No master bottle found for key: ${key}`);
        for (const bottle of bottleGroup) {
          results.failed++;
          results.errors.push({
            bottle: `${bottle[columnMapping.wine]} - ${bottle[columnMapping.location] || 'No location'}`,
            error: 'Master bottle could not be created or found',
          });
        }
        continue;
      }

      // Create individual UserBottle for each CSV row
      for (const bottle of bottleGroup) {
        try {
          const purchaseDate = bottle[columnMapping.purchaseDate];
          const deliveryDate = bottle[columnMapping.deliveryDate];
          const location = bottle[columnMapping.location] || '';
          const bin = bottle[columnMapping.bin] || '';
          const cellarTrackerId = bottle[columnMapping.iWine] || '';
          
          // Generate unique barcode for each bottle if not provided
          let barcodeValue = bottle[columnMapping.barcode] || bottle[columnMapping.wineBarcode] || '';
          if (!barcodeValue) {
            // Generate unique barcode: timestamp + random number
            barcodeValue = `WV${Date.now()}${Math.floor(Math.random() * 1000)}`;
          }
          
          // Check if this exact PHYSICAL bottle already exists (by barcode ONLY)
          // NOTE: cellarTrackerId identifies the MASTER bottle (wine type), not individual bottles
          let existingBottle = null;
          
          if (barcodeValue) {
            // Check by barcode - this identifies the specific physical bottle
            existingBottle = await UserBottle.findOne({
              userId: new mongoose.Types.ObjectId(session.user.id),
              barcode: barcodeValue,
            });
            
            if (existingBottle) {
              console.log(`Found existing bottle with barcode: ${barcodeValue}`);
            }
          }

          // Build the user bottle data object carefully
          const userBottleData: any = {
            userId: new mongoose.Types.ObjectId(session.user.id),
            masterBottleId: masterBottleId,
            quantity: 1, // Always 1 per individual bottle
            notes: bottle[columnMapping.notes] || '',
            personalNotes: bottle[columnMapping.personalNotes] || '',
            purchaseNote: bottle[columnMapping.purchaseNote] || '',
            status: 'unopened',
            photos: [],
            pours: [],
            fillLevel: 100, // New bottles start at 100%
          };
          
          // Add optional fields only if they have values
          if (purchaseDate) {
            userBottleData.purchaseDate = new Date(purchaseDate);
          }
          if (bottle[columnMapping.price]) {
            userBottleData.purchasePrice = Math.round(parseFloat(bottle[columnMapping.price]) * 100) / 100;
          }
          if (bottle[columnMapping.value]) {
            userBottleData.marketValue = Math.round(parseFloat(bottle[columnMapping.value]) * 100) / 100;
          }
          if (location || bin) {
            userBottleData.location = {
              area: location || '',
              bin: bin || '',
            };
          }
          if (deliveryDate) {
            userBottleData.deliveryDate = new Date(deliveryDate);
          }
          if (bottle[columnMapping.barcode]) {
            userBottleData.barcode = bottle[columnMapping.barcode];
          } else if (barcodeValue) {
            userBottleData.barcode = barcodeValue;
          }
          if (bottle[columnMapping.wineBarcode]) {
            userBottleData.wineBarcode = bottle[columnMapping.wineBarcode];
          }
          // Store name will be handled after building the base object
          if (cellarTrackerId) {
            userBottleData.cellarTrackerId = cellarTrackerId;
          }

          // Handle bottle size if provided and not standard
          const size = bottle[columnMapping.size];
          if (size && size !== '750ml' && size !== '750ML') {
            userBottleData.notes = `${size} bottle. ${userBottleData.notes}`.trim();
          }

          // Handle store creation/lookup
          if (columnMapping.storeName && bottle[columnMapping.storeName]) {
            
            try {
              const storeName = bottle[columnMapping.storeName].trim();
              
              // Find or create MasterStore
              let masterStore = await MasterStore.findOne({
                name: { $regex: new RegExp(`^${storeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
              });
              
              if (!masterStore) {
                masterStore = await MasterStore.create({
                  name: storeName,
                  type: 'Private Store', // Default, can be refined later
                  country: 'US',
                });
                console.log(`Created new MasterStore: ${storeName}`);
              }
              
              // Find or create UserStore relationship
              let userStore = await UserStore.findOne({
                userId: new mongoose.Types.ObjectId(session.user.id),
                masterStoreId: masterStore._id,
              });
              
              if (!userStore) {
                userStore = await UserStore.create({
                  userId: new mongoose.Types.ObjectId(session.user.id),
                  masterStoreId: masterStore._id,
                });
                console.log(`Created UserStore relationship for: ${storeName}`);
              }
              
              userBottleData.storeId = userStore._id;
              console.log(`Setting storeId for bottle: ${userStore._id} (UserStore) -> ${masterStore._id} (MasterStore: ${storeName})`);
            } catch (storeError) {
              console.error(`Error handling store ${bottle[columnMapping.storeName]}:`, storeError);
              // Continue without store if there's an error
            }
          }

          // Debug logging
          console.log('Raw bottle data for fields:', {
            barcode: bottle[columnMapping.barcode],
            wineBarcode: bottle[columnMapping.wineBarcode],
            storeName: bottle[columnMapping.storeName],
            value: bottle[columnMapping.value],
            iWine: bottle[columnMapping.iWine],
            purchaseNote: bottle[columnMapping.purchaseNote],
            deliveryDate: bottle[columnMapping.deliveryDate],
          });
          console.log('Creating/Updating UserBottle with data:', {
            barcode: userBottleData.barcode,
            wineBarcode: userBottleData.wineBarcode,
            storeId: userBottleData.storeId,
            marketValue: userBottleData.marketValue,
            cellarTrackerId: userBottleData.cellarTrackerId,
            purchaseNote: userBottleData.purchaseNote,
            deliveryDate: userBottleData.deliveryDate,
          });

          if (existingBottle) {
            // Update existing bottle with new data
            if (userBottleData.marketValue) existingBottle.marketValue = userBottleData.marketValue;
            if (userBottleData.purchasePrice) existingBottle.purchasePrice = userBottleData.purchasePrice;
            if (userBottleData.purchaseDate) existingBottle.purchaseDate = userBottleData.purchaseDate;
            if (userBottleData.deliveryDate) existingBottle.deliveryDate = userBottleData.deliveryDate;
            if (userBottleData.location) existingBottle.location = userBottleData.location;
            if (userBottleData.notes) existingBottle.notes = userBottleData.notes;
            if (userBottleData.personalNotes) existingBottle.personalNotes = userBottleData.personalNotes;
            if (userBottleData.purchaseNote) existingBottle.purchaseNote = userBottleData.purchaseNote;
            if (userBottleData.barcode) existingBottle.barcode = userBottleData.barcode;
            if (userBottleData.wineBarcode) existingBottle.wineBarcode = userBottleData.wineBarcode;
            if (userBottleData.storeId) existingBottle.storeId = userBottleData.storeId;
            if (userBottleData.cellarTrackerId) existingBottle.cellarTrackerId = userBottleData.cellarTrackerId;
            
            await existingBottle.save();
            
            // Verify what was actually saved
            console.log('Updated bottle verification:', {
              _id: existingBottle._id,
              barcode: existingBottle.barcode,
              wineBarcode: existingBottle.wineBarcode,
              storeId: existingBottle.storeId,
              marketValue: existingBottle.marketValue,
              cellarTrackerId: existingBottle.cellarTrackerId,
            });
            
            results.updated++;
          } else {
            // Create new UserBottle
            console.log('Creating new UserBottle');
            console.log('About to create with:', JSON.stringify(userBottleData, null, 2));
            
            // Try using new UserBottle() instead of create()
            const newBottle = new UserBottle(userBottleData);
            console.log('New bottle instance before save:', JSON.stringify(newBottle.toObject(), null, 2));
            
            const createdBottle = await newBottle.save();
            console.log('Created result:', JSON.stringify(createdBottle.toObject(), null, 2));
            
            // Verify what was actually saved
            console.log('Created bottle verification:', {
              _id: createdBottle._id,
              barcode: createdBottle.barcode,
              wineBarcode: createdBottle.wineBarcode,
              storeId: createdBottle.storeId,
              marketValue: createdBottle.marketValue,
              cellarTrackerId: createdBottle.cellarTrackerId,
            });
            
            results.imported++;
          }

        } catch (error: any) {
          results.failed++;
          results.errors.push({
            bottle: `${bottle[columnMapping.wine]} - ${bottle[columnMapping.location] || 'No location'}`,
            error: error.message,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        uniqueWines: groupedBottles.size,
        totalBottles: bottles.length,
        masterBottlesCreated: results.masterBottlesCreated,
        masterBottlesFound: results.masterBottlesFound,
        bottlesImported: results.imported,
        bottlesUpdated: results.updated,
      },
    });

  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    );
  }
}

// Preview endpoint with better CSV parsing
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const { csvData, isCellarTracker = false } = data;

    if (!csvData) {
      return NextResponse.json({ error: 'No CSV data provided' }, { status: 400 });
    }

    // Parse CSV more intelligently
    const lines = csvData.split('\n').filter((line: string) => line.trim());
    
    // Parse headers
    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine);
    
    // Parse data rows
    const preview = [];
    for (let i = 1; i < Math.min(11, lines.length); i++) {
      const values = parseCSVLine(lines[i]);
      const row: any = {};
      headers.forEach((header: string, index: number) => {
        row[header] = values[index] || '';
      });
      preview.push(row);
    }

    // Analyze data to provide suggestions
    const analysis = analyzeCSVData(headers, preview, isCellarTracker);

    return NextResponse.json({
      success: true,
      headers,
      preview,
      totalRows: lines.length - 1,
      analysis,
    });

  } catch (error: any) {
    console.error('Preview error:', error);
    return NextResponse.json(
      { error: error.message || 'Preview failed' },
      { status: 500 }
    );
  }
}

// Helper function to parse CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Analyze CSV to suggest mappings
function analyzeCSVData(headers: string[], preview: any[], isCellarTracker: boolean) {
  const analysis: any = {
    suggestedMappings: {},
    uniqueWines: new Set(),
    hasMultipleLocations: false,
    isCellarTracker: isCellarTracker,
  };

  // Suggest column mappings based on header names
  const headerLower = headers.map(h => h.toLowerCase());
  
  // Common CellarTracker field mappings
  const mappingSuggestions = {
    wine: ['wine', 'name', 'bottle'],
    producer: ['producer', 'winery', 'distillery', 'brand'],
    vintage: ['vintage', 'year', 'age'],
    size: ['size', 'bottle size', 'format'],
    price: ['price', 'purchase price', 'cost'],
    quantity: ['quantity', 'qty', 'count', 'bottles'],
    location: ['location', 'storage', 'cellar', 'storage location'],
    bin: ['bin', 'position', 'shelf', 'bin/position'],
    notes: ['notes', 'tasting notes', 'comments', 'tnotes'],
    personalNotes: ['note', 'my notes', 'personal notes', 'pnotes'],
    purchaseNote: ['purchase note', 'purchase notes', 'pnotes'],
    purchaseDate: ['purchase date', 'purchasedate', 'bought', 'acquired'],
    storeName: ['store', 'store name', 'storename', 'vendor', 'from'],
    deliveryDate: ['delivery date', 'deliverydate', 'received', 'delivered'],
    barcode: ['barcode', 'upc'],
    wineBarcode: ['wine barcode', 'winebarcode'],
    iWine: ['iwine', 'cellartracker id', 'ct id'],
    value: ['value', 'market value', 'current value'],
    varietal: ['varietal', 'variety', 'type'],
    region: ['region', 'appellation', 'country', 'location'],
  };

  for (const [field, patterns] of Object.entries(mappingSuggestions)) {
    for (const pattern of patterns) {
      const index = headerLower.indexOf(pattern);
      if (index !== -1) {
        analysis.suggestedMappings[field] = headers[index];
        break;
      }
    }
  }

  // Analyze for unique wines and multiple locations
  if (isCellarTracker && analysis.suggestedMappings.iWine) {
    // CellarTracker mode: use iWine for uniqueness
    const wineLocationMap = new Map<string, Set<string>>();
    
    for (const row of preview) {
      const iWine = row[analysis.suggestedMappings.iWine] || '';
      const location = row[analysis.suggestedMappings.location] || '';
      const bin = row[analysis.suggestedMappings.bin] || '';
      
      if (iWine) {
        const locationKey = `${location}|${bin}`;
        
        if (!wineLocationMap.has(iWine)) {
          wineLocationMap.set(iWine, new Set());
        }
        wineLocationMap.get(iWine)!.add(locationKey);
        
        analysis.uniqueWines.add(iWine);
      }
    }

    // Check if any wine has multiple locations
    for (const locations of wineLocationMap.values()) {
      if (locations.size > 1) {
        analysis.hasMultipleLocations = true;
        break;
      }
    }
  } else {
    // Standard mode: use Wine + Producer + Vintage
    const wineLocationMap = new Map<string, Set<string>>();
    
    for (const row of preview) {
      const wine = row[analysis.suggestedMappings.wine] || '';
      const producer = row[analysis.suggestedMappings.producer] || '';
      const vintage = row[analysis.suggestedMappings.vintage] || '';
      const location = row[analysis.suggestedMappings.location] || '';
      const bin = row[analysis.suggestedMappings.bin] || '';
      
      const wineKey = `${wine}|${producer}|${vintage}`;
      const locationKey = `${location}|${bin}`;
      
      if (!wineLocationMap.has(wineKey)) {
        wineLocationMap.set(wineKey, new Set());
      }
      wineLocationMap.get(wineKey)!.add(locationKey);
      
      analysis.uniqueWines.add(wineKey);
    }

    // Check if any wine has multiple locations
    for (const locations of wineLocationMap.values()) {
      if (locations.size > 1) {
        analysis.hasMultipleLocations = true;
        break;
      }
    }
  }

  analysis.uniqueWineCount = analysis.uniqueWines.size;
  
  return analysis;
}