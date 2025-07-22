# Whiskey Vault Notifications Cron Job Setup

This guide explains how to set up automated cron jobs on macOS to run notification checks and ratings calculations for your Whiskey Vault environment.

## Prerequisites

1. Your Whiskey Vault app should be running on the appropriate port:
   - Development: port 3003
   - Production/SIT: port 3005
2. You need to have a `CRON_SECRET` environment variable set in your `.env.local` file
3. macOS (this uses launchd, which is macOS-specific)

## Quick Setup (Recommended)

Use the automated setup script located in the `cron/` directory:

### Development Environment
```bash
cd /path/to/whiskey-inventory-app
./cron/setup-cron.sh dev
```

### Production/SIT Environment
```bash
cd /path/to/whiskey-inventory-app
./cron/setup-cron.sh prod
```

The setup script will:
- Unload any existing Whiskey Vault cron jobs
- Copy the appropriate plist files for your environment
- Load the new cron jobs
- Verify they're running

## Manual Setup (Reference)

If you prefer to set up the cron jobs manually or need to customize them:

### 1. Set up the CRON_SECRET

Add this to your `.env.local` file:
```
CRON_SECRET=your-secret-key-here
```

### 2. Copy the appropriate plist files

For development:
```bash
cp cron/dev/*.plist ~/Library/LaunchAgents/
```

For production:
```bash
cp cron/prod/*.plist ~/Library/LaunchAgents/
```

### 3. Update the CRON_SECRET in the plist files

Edit both plist files and replace the Authorization header with your actual secret:
```xml
<string>Authorization: Bearer YOUR_ACTUAL_CRON_SECRET</string>
```

### 4. Load the cron jobs

```bash
launchctl load ~/Library/LaunchAgents/com.whiskeyvault.notifications.plist
launchctl load ~/Library/LaunchAgents/com.whiskeyvault.ratings.plist
```

## Cron Job Details

### 1. Notifications (Hourly)
- **File**: `com.whiskeyvault.notifications.plist`
- **Endpoint**: `/api/cron/notifications`
- **Frequency**: Every hour
- **Functions**:
  - Pour reminders for unrated pours older than 24 hours
  - Low stock alerts for bottles with < 25% remaining
  - Achievement notifications
  - Weekly insights (Sundays only)

### 2. Ratings Calculation (Daily)
- **File**: `com.whiskeyvault.ratings.plist`
- **Endpoint**: `/api/cron/calculate-ratings`
- **Frequency**: Daily at 2:00 AM
- **Functions**:
  - Calculates community average ratings
  - Updates master bottle statistics

## launchctl Commands

### Load (Start) the cron jobs:
```bash
launchctl load ~/Library/LaunchAgents/com.whiskeyvault.notifications.plist
launchctl load ~/Library/LaunchAgents/com.whiskeyvault.ratings.plist
```

### Unload (Stop) the cron jobs:
```bash
launchctl unload ~/Library/LaunchAgents/com.whiskeyvault.notifications.plist
launchctl unload ~/Library/LaunchAgents/com.whiskeyvault.ratings.plist
```

### Check if they're running:
```bash
launchctl list | grep com.whiskeyvault
```

### View the logs:
```bash
# Notifications logs
tail -f /tmp/whiskeyvault-notifications.log
tail -f /tmp/whiskeyvault-notifications-error.log

# Ratings logs
tail -f /tmp/whiskeyvault-ratings.log
tail -f /tmp/whiskeyvault-ratings-error.log
```

### Manually trigger the cron jobs:

Development:
```bash
# Notifications
curl -X GET -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3003/api/cron/notifications

# Ratings
curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3003/api/cron/calculate-ratings
```

Production:
```bash
# Notifications
curl -X GET -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3005/api/cron/notifications

# Ratings
curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3005/api/cron/calculate-ratings
```

## How It Works

### Notifications (Hourly)
1. The launchd service runs every 3600 seconds (1 hour)
2. It makes a GET request to `/api/cron/notifications`
3. The request includes an Authorization header with your CRON_SECRET
4. The API endpoint then:
   - Checks for unrated pours older than 24 hours and sends reminders
   - Checks for bottles with low stock (< 25%) and sends alerts
   - On Sundays, generates weekly insight notifications

### Ratings (Daily)
1. The launchd service runs daily at 2:00 AM
2. It makes a POST request to `/api/cron/calculate-ratings`
3. The request includes an Authorization header with your CRON_SECRET
4. The API endpoint calculates community ratings for all master bottles

## Troubleshooting

### Cron job not running?

1. Check if it's loaded:
   ```bash
   launchctl list | grep com.whiskeyvault
   ```

2. Check the error logs:
   ```bash
   tail -f /tmp/whiskeyvault-notifications-error.log
   tail -f /tmp/whiskeyvault-ratings-error.log
   ```

3. Make sure your app is running on the correct port:
   - Development: 3003
   - Production: 3005

### Getting 401 Unauthorized?

1. Check that your CRON_SECRET in the plist matches your `.env.local`
2. Reload the plist after making changes:
   ```bash
   launchctl unload ~/Library/LaunchAgents/com.whiskeyvault.*.plist
   launchctl load ~/Library/LaunchAgents/com.whiskeyvault.*.plist
   ```

### Want to change the frequency?

Edit the `StartInterval` value in the notifications plist:
- 3600 = 1 hour
- 1800 = 30 minutes
- 7200 = 2 hours
- 86400 = 24 hours

For the ratings job, edit the `StartCalendarInterval` section to change the time.

## Testing

To test that notifications are working:

1. Create a pour and don't rate it
2. Manually set its created date to 25+ hours ago in the database
3. Run the cron job manually:
   ```bash
   curl -X GET -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3003/api/cron/notifications
   ```
4. Check for a new notification in the app

## Uninstalling

To completely remove the cron jobs:

```bash
# Use the setup script
./cron/setup-cron.sh  # Then press Ctrl+C when it asks for environment

# Or manually:
launchctl unload ~/Library/LaunchAgents/com.whiskeyvault.*.plist
rm ~/Library/LaunchAgents/com.whiskeyvault.*.plist
```

## Environment Variables

The cron jobs require the following environment variable in your `.env.local`:

```
CRON_SECRET=your-secret-key-here
```

**Important**: The CRON_SECRET must match exactly between your `.env.local` and the plist files, including any trailing characters.

## For Production Deployment

When deploying to SIT/UAT/Production:

1. Ensure the CRON_SECRET is set in the production environment
2. Use `./cron/setup-cron.sh prod` to install production cron jobs
3. Verify the app is running on port 3005
4. Monitor the logs to ensure jobs are running successfully

## Additional Resources

- See `cron/README.md` for quick reference
- Check individual plist files in `cron/dev/` and `cron/prod/` for configuration details