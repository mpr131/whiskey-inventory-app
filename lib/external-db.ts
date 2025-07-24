import { MongoClient, Db } from 'mongodb';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToExternalDB(): Promise<Db> {
  if (cachedDb) return cachedDb;
  
  if (!process.env.EXTERNAL_MONGODB_URI) {
    throw new Error('EXTERNAL_MONGODB_URI not defined');
  }
  
  try {
    const client = new MongoClient(process.env.EXTERNAL_MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    
    await client.connect();
    
    cachedClient = client;
    cachedDb = client.db('stock_data');
    
    console.log('Connected to external stock_data database');
    return cachedDb;
  } catch (error) {
    console.error('Failed to connect to external database:', error);
    throw error;
  }
}

export async function disconnectFromExternalDB() {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
  }
}