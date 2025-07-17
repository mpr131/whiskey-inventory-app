// Import all models to ensure they're registered with Mongoose
// This prevents "Schema hasn't been registered for model" errors
import '@/models/User';
import '@/models/MasterBottle';
import '@/models/UserBottle';
import '@/models/MasterStore';
import '@/models/UserStore';

export function initializeModels() {
  // This function doesn't need to do anything
  // Just importing the models above registers them with Mongoose
  console.log('Models initialized');
}