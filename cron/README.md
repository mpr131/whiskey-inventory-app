# Whiskey Vault Cron Jobs

This directory contains the scheduled job configurations for Whiskey Vault.

## Jobs

1. **Notifications** (Hourly)
   - Pour reminders for unrated pours older than 24 hours
   - Low stock alerts (< 25% fill level)
   - Achievement notifications
   - Weekly insights (Sundays only)

2. **Ratings** (Daily at 2 AM)
   - Calculates community average ratings
   - Updates master bottle statistics

## Setup

### Development (Port 3003)
```bash
./setup-cron.sh dev
```

### Production (Port 3005)
```bash
./setup-cron.sh prod
```

## Testing

To manually test the cron endpoints:

```bash
# Test notifications (dev)
curl -X GET -H "Authorization: Bearer p+zbMRbJbLWMwmDmnBrCDHhzx88z1wZDK7AtZwyH7aA=" http://localhost:3003/api/cron/notifications

# Test ratings (dev)
curl -X POST -H "Authorization: Bearer p+zbMRbJbLWMwmDmnBrCDHhzx88z1wZDK7AtZwyH7aA=" http://localhost:3003/api/cron/calculate-ratings

# Test notifications (prod)
curl -X GET -H "Authorization: Bearer p+zbMRbJbLWMwmDmnBrCDHhzx88z1wZDK7AtZwyH7aA=" http://localhost:3005/api/cron/notifications

# Test ratings (prod)
curl -X POST -H "Authorization: Bearer p+zbMRbJbLWMwmDmnBrCDHhzx88z1wZDK7AtZwyH7aA=" http://localhost:3005/api/cron/calculate-ratings
```

## Troubleshooting

### View logs
```bash
# Check if jobs are loaded
launchctl list | grep whiskeyvault

# View notification logs
tail -f /tmp/whiskeyvault-notifications.log
tail -f /tmp/whiskeyvault-notifications-error.log

# View ratings logs
tail -f /tmp/whiskeyvault-ratings.log
tail -f /tmp/whiskeyvault-ratings-error.log
```

### Common Issues

1. **401 Unauthorized**: Check that CRON_SECRET in .env.local matches the Authorization header in the plist files
2. **Connection refused**: Ensure the app is running on the correct port (3003 for dev, 3005 for prod)
3. **Jobs not running**: Use `launchctl list | grep whiskeyvault` to verify they're loaded

### Uninstall

To completely remove the cron jobs:

```bash
# Unload jobs
launchctl unload ~/Library/LaunchAgents/com.whiskeyvault.*.plist

# Remove plist files
rm ~/Library/LaunchAgents/com.whiskeyvault.*.plist
```

## Environment Variables

The cron jobs require the following environment variable in your `.env.local`:

```
CRON_SECRET=p+zbMRbJbLWMwmDmnBrCDHhzx88z1wZDK7AtZwyH7aA=
```

## Security Note

The CRON_SECRET is hardcoded in the plist files for simplicity. In a production environment, consider:
- Using a different secret for production
- Storing secrets in a secure vault
- Using environment-specific secrets