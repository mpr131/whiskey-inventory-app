# Pour Session Management

## Overview

The pour session management system ensures that every pour is associated with a session, preventing orphaned pours and maintaining data integrity.

## Key Features

### 1. **Automatic Session Assignment**
- Every pour MUST be associated with a session
- Sessions automatically group pours within a 4-hour window
- If no session exists, one is created automatically

### 2. **Transaction Safety**
- Pour creation uses database transactions
- If session creation fails, the entire operation is rolled back
- Ensures data consistency

### 3. **Validation**
- Pour model validates that sessionId is present
- API routes enforce session creation before pour creation
- Frontend prevents pour submission without valid session

### 4. **Session Grouping Logic**
- Pours within 4 hours of each other are grouped in the same session
- "Current session" window is 2 hours for quick pour interface
- Sessions are date-based (midnight boundaries respected)

## API Changes

### Pour Creation
```typescript
// OLD - Could create orphaned pours
await Pour.create({
  userId,
  userBottleId,
  amount,
  // sessionId might be missing
});

// NEW - Guaranteed session assignment
import { createPourWithSession } from '@/lib/pour-session-manager';

const { pour, session } = await createPourWithSession(
  {
    userId,
    userBottleId,
    amount,
    rating,
    notes,
    // ... other pour data
  },
  sessionId // optional - will create if not provided
);
```

### Current Session
```typescript
// Get or create current session (2-hour window)
import { getCurrentPourSession } from '@/lib/pour-session-manager';

const session = await getCurrentPourSession(userId, {
  location: 'Home',
  tags: ['whiskey-wednesday']
});
```

## Monitoring & Maintenance

### Scripts

1. **Monitor Orphaned Pours**
   ```bash
   npm run monitor-orphaned-pours
   ```
   Shows any pours without sessions (should be zero)

2. **Debug Pour Sessions**
   ```bash
   npm run debug-pour-sessions -- user@email.com
   ```
   Shows detailed session and pour information for a user

3. **Fix Orphaned Pours**
   ```bash
   npm run fix-orphaned-pours -- user@email.com --execute
   ```
   Assigns orphaned pours to appropriate sessions

4. **Test Pour Creation**
   ```bash
   npm run test-pour-creation
   ```
   Runs tests to ensure pour creation safeguards work

### Cron Job

An API endpoint is available for scheduled orphaned pour checks:

```bash
GET /api/cron/check-orphaned-pours
Authorization: Bearer ${CRON_SECRET}
```

This can be called by services like Vercel Cron or GitHub Actions.

## Error Handling

### Frontend
- Shows clear error message if session creation fails
- Prevents pour submission without valid session
- Retries session creation on transient failures

### Backend
- Validates all pours have sessions
- Logs warnings for any orphaned pours created
- Automatic recovery via cron job

## Configuration

Session timing can be adjusted in `/lib/pour-session-manager.ts`:

```typescript
const SESSION_CONFIG = {
  SESSION_TIMEOUT_HOURS: 4,  // Group pours within 4 hours
  // Add other config as needed
};
```

## Migration

For existing data with orphaned pours:

1. Run `npm run monitor-orphaned-pours` to assess the situation
2. Run `npm run fix-orphaned-pours -- user@email.com` for each affected user
3. Verify with `npm run debug-pour-sessions -- user@email.com`

## Best Practices

1. **Always use the helper functions** - Never create pours directly with `Pour.create()`
2. **Handle errors gracefully** - Show user-friendly messages when session creation fails
3. **Monitor regularly** - Set up the cron job to catch any edge cases
4. **Test thoroughly** - Run the test script after any pour-related changes