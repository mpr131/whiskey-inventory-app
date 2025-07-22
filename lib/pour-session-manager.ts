import mongoose from 'mongoose';
import PourSession from '@/models/PourSession';
import Pour from '@/models/Pour';

/**
 * Configuration for pour session management
 */
const SESSION_CONFIG = {
  // Hours after which a new session is created
  SESSION_TIMEOUT_HOURS: 4,
  // Default session name format
  DEFAULT_SESSION_NAME: (date: Date) => 
    `Session ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
};

/**
 * Find or create a pour session for a given user and date
 * Sessions group pours within SESSION_TIMEOUT_HOURS of each other
 */
export async function findOrCreatePourSession(
  userId: string,
  pourDate: Date = new Date(),
  sessionData?: {
    sessionName?: string;
    location?: string;
    tags?: string[];
    companions?: string[];
  }
): Promise<any> {
  // Calculate session window
  const sessionStart = new Date(pourDate.getTime() - SESSION_CONFIG.SESSION_TIMEOUT_HOURS * 60 * 60 * 1000);
  
  // Try to find an existing session within the time window
  const existingSession = await PourSession.findOne({
    userId,
    createdAt: { 
      $gte: sessionStart,
      $lte: pourDate 
    }
  }).sort('-createdAt'); // Get the most recent session in the window

  if (existingSession) {
    return existingSession;
  }

  // Create new session
  const newSession = await PourSession.create({
    userId: new mongoose.Types.ObjectId(userId),
    sessionName: sessionData?.sessionName || SESSION_CONFIG.DEFAULT_SESSION_NAME(pourDate),
    date: pourDate,
    location: sessionData?.location,
    tags: sessionData?.tags || [],
    companions: sessionData?.companions || [],
    totalPours: 0,
    totalAmount: 0,
    totalCost: 0,
  });

  return newSession;
}

/**
 * Create a pour with guaranteed session assignment
 * Uses transactions to ensure atomicity
 */
export async function createPourWithSession(
  pourData: {
    userId: string;
    userBottleId: string;
    amount: number;
    rating?: number;
    notes?: string;
    companions?: string[];
    tags?: string[];
    location?: string;
    date?: Date;
  },
  sessionId?: string
): Promise<{ pour: any; session: any }> {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

    // Find or create session if not provided
    let pourSession;
    if (sessionId) {
      pourSession = await PourSession.findById(sessionId).session(session);
      if (!pourSession) {
        throw new Error(`Session ${sessionId} not found`);
      }
      if (pourSession.userId.toString() !== pourData.userId) {
        throw new Error('Session does not belong to user');
      }
    } else {
      // Create or find a session based on pour date
      pourSession = await findOrCreatePourSession(
        pourData.userId,
        pourData.date || new Date(),
        {
          location: pourData.location,
          tags: pourData.tags,
          companions: pourData.companions,
        }
      );
    }

    // Create the pour with session reference
    const pour = await Pour.create([{
      ...pourData,
      userId: new mongoose.Types.ObjectId(pourData.userId),
      userBottleId: new mongoose.Types.ObjectId(pourData.userBottleId),
      sessionId: pourSession._id,
      date: pourData.date || new Date(),
    }], { session });

    // Update session statistics
    await pourSession.updateStats();

    await session.commitTransaction();
    
    return { pour: pour[0], session: pourSession };
  } catch (error) {
    await session.abortTransaction();
    console.error('Failed to create pour with session:', error);
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Ensure all pours have sessions assigned
 * This is a safety check that can be run periodically
 */
export async function ensureAllPoursHaveSessions(userId?: string): Promise<number> {
  const query: any = { sessionId: { $exists: false } };
  if (userId) {
    query.userId = userId;
  }

  const orphanedPours = await Pour.find(query);
  let fixed = 0;

  for (const pour of orphanedPours) {
    try {
      const session = await findOrCreatePourSession(
        pour.userId.toString(),
        new Date(pour.date),
        {
          location: pour.location,
          tags: pour.tags,
          companions: pour.companions,
        }
      );

      pour.sessionId = session._id;
      await pour.save();
      
      // Update session stats
      await session.updateStats();
      
      fixed++;
    } catch (error) {
      console.error(`Failed to assign session to pour ${pour._id}:`, error);
    }
  }

  if (fixed > 0) {
    console.warn(`Fixed ${fixed} orphaned pours`);
  }

  return fixed;
}

/**
 * Get or create current session for quick pour
 * Uses a more recent time window (2 hours) for "current" session
 */
export async function getCurrentPourSession(
  userId: string,
  sessionData?: {
    location?: string;
    tags?: string[];
  }
): Promise<any> {
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  // Find recent session
  const recentSession = await PourSession.findOne({
    userId,
    createdAt: { $gte: twoHoursAgo }
  }).sort('-createdAt');

  if (recentSession) {
    // Update session data if provided
    if (sessionData?.location && !recentSession.location) {
      recentSession.location = sessionData.location;
    }
    if (sessionData?.tags && sessionData.tags.length > 0) {
      recentSession.tags = Array.from(new Set([...recentSession.tags, ...sessionData.tags]));
    }
    await recentSession.save();
    return recentSession;
  }

  // Create new session
  return findOrCreatePourSession(userId, now, sessionData);
}