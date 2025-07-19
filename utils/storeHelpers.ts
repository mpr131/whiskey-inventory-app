import MasterStore from '@/models/MasterStore';
import UserStore from '@/models/UserStore';
import mongoose from 'mongoose';

interface StoreResult {
  userStoreId?: mongoose.Types.ObjectId;
  masterStoreId?: mongoose.Types.ObjectId;
}

/**
 * Find or create a store for a user, with case-insensitive matching
 */
export async function findOrCreateStore(
  storeName: string,
  userId: string
): Promise<StoreResult> {
  if (!storeName || !storeName.trim()) {
    return {};
  }

  const cleanedName = storeName.trim();

  // First, try to find an existing MasterStore (case-insensitive)
  let masterStore = await MasterStore.findOne({
    name: { $regex: new RegExp(`^${cleanedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
  });

  if (!masterStore) {
    // Create new MasterStore with consistent casing
    masterStore = await MasterStore.create({
      name: cleanedName,
      type: 'Retail', // Default type
      country: 'US', // Default country
      createdBy: new mongoose.Types.ObjectId(userId),
    });
  }

  // Check if user already has this store linked
  let userStore = await UserStore.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    masterStoreId: masterStore._id,
  });

  if (!userStore) {
    // Create UserStore relationship
    userStore = await UserStore.create({
      userId: new mongoose.Types.ObjectId(userId),
      masterStoreId: masterStore._id,
    });
  }

  return {
    userStoreId: userStore._id as mongoose.Types.ObjectId,
    masterStoreId: masterStore._id as mongoose.Types.ObjectId,
  };
}