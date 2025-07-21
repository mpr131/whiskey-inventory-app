# Whiskey Vault Notifications Cron Job Setup

This guide explains how to set up an automated cron job on macOS to run notification checks every hour for your Whiskey Vault SIT/UAT environment.

## Prerequisites

1. Your Whiskey Vault app should be running on port 3005
2. You need to have a `CRON_SECRET` environment variable set in your `.env.local` file
3. macOS (this uses launchd, which is macOS-specific)

## Quick Setup

Run the setup script:

```bash
./scripts/setup-notifications-cron.sh
```

## Manual Setup

### 1. Set up the CRON_SECRET

Add this to your `.env.local` file:
```
CRON_SECRET=your-secret-key-here
```

### 2. Create the plist file

The plist file has been created at:
```
~/Library/LaunchAgents/com.whiskeyvault.notifications.plist
```

### 3. Update the CRON_SECRET in the plist

Edit the plist file and replace `your-cron-secret-here` with your actual secret.

## launchctl Commands

### Load (Start) the cron job:
```bash
launchctl load ~/Library/LaunchAgents/com.whiskeyvault.notifications.plist
```

### Unload (Stop) the cron job:
```bash
launchctl unload ~/Library/LaunchAgents/com.whiskeyvault.notifications.plist
```

### Check if it's running:
```bash
launchctl list | grep com.whiskeyvault.notifications
```

### View the logs:
```bash
# Standard output
tail -f /tmp/whiskeyvault-notifications.log

# Error output
tail -f /tmp/whiskeyvault-notifications-error.log
```

### Manually trigger the cron job:
```bash
curl -X GET -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3005/api/cron/notifications
```

## How It Works

1. The launchd service runs every 3600 seconds (1 hour)
2. It makes a GET request to `http://localhost:3005/api/cron/notifications`
3. The request includes an Authorization header with your CRON_SECRET
4. The API endpoint then:
   - Checks for unrated pours older than 24 hours and sends reminders
   - Checks for bottles with low stock (< 25%) and sends alerts
   - On Sundays, generates weekly insight notifications

## Troubleshooting

### Cron job not running?

1. Check if it's loaded:
   ```bash
   launchctl list | grep com.whiskeyvault.notifications
   ```

2. Check the error log:
   ```bash
   tail -f /tmp/whiskeyvault-notifications-error.log
   ```

3. Make sure your app is running on port 3005

### Getting 401 Unauthorized?

1. Check that your CRON_SECRET in the plist matches your `.env.local`
2. Reload the plist after making changes:
   ```bash
   launchctl unload ~/Library/LaunchAgents/com.whiskeyvault.notifications.plist
   launchctl load ~/Library/LaunchAgents/com.whiskeyvault.notifications.plist
   ```

### Want to change the frequency?

Edit the `StartInterval` value in the plist:
- 3600 = 1 hour
- 1800 = 30 minutes
- 7200 = 2 hours
- 86400 = 24 hours

## Testing

To test that notifications are working:

1. Create a pour and don't rate it
2. Manually set its created date to 25+ hours ago in the database
3. Run the cron job manually:
   ```bash
   curl -X GET -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3005/api/cron/notifications
   ```
4. Check for a new notification in the app

## Uninstalling

To completely remove the cron job:

```bash
# Unload it first
launchctl unload ~/Library/LaunchAgents/com.whiskeyvault.notifications.plist

# Then delete the plist file
rm ~/Library/LaunchAgents/com.whiskeyvault.notifications.plist
```