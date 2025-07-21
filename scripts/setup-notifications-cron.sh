#!/bin/bash

# Whiskey Vault Notifications Cron Setup for macOS
# This script sets up a launchd job to run the notification checks every hour

echo "🥃 Whiskey Vault Notifications Cron Setup"
echo "========================================"
echo ""

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script is for macOS only"
    exit 1
fi

# Get the CRON_SECRET from user or .env file
if [ -f ".env.local" ]; then
    CRON_SECRET=$(grep CRON_SECRET .env.local | cut -d '=' -f2)
fi

if [ -z "$CRON_SECRET" ]; then
    echo "Please enter your CRON_SECRET (this should match the one in your .env.local file):"
    read -s CRON_SECRET
    echo ""
fi

# Path to the plist file
PLIST_PATH="$HOME/Library/LaunchAgents/com.whiskeyvault.notifications.plist"

# Create the LaunchAgents directory if it doesn't exist
mkdir -p "$HOME/Library/LaunchAgents"

# Create the plist file with the actual CRON_SECRET
cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.whiskeyvault.notifications</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/curl</string>
        <string>-X</string>
        <string>GET</string>
        <string>-H</string>
        <string>Authorization: Bearer ${CRON_SECRET}</string>
        <string>http://localhost:3005/api/cron/notifications</string>
    </array>
    
    <!-- Run every hour -->
    <key>StartInterval</key>
    <integer>3600</integer>
    
    <!-- Keep alive only during successful runs -->
    <key>KeepAlive</key>
    <false/>
    
    <!-- Run at load -->
    <key>RunAtLoad</key>
    <true/>
    
    <!-- Standard output log -->
    <key>StandardOutPath</key>
    <string>/tmp/whiskeyvault-notifications.log</string>
    
    <!-- Standard error log -->
    <key>StandardErrorPath</key>
    <string>/tmp/whiskeyvault-notifications-error.log</string>
</dict>
</plist>
EOF

echo "✅ Created plist file at: $PLIST_PATH"
echo ""
echo "📋 Instructions:"
echo "==============="
echo ""
echo "1. To LOAD (start) the notification cron job:"
echo "   launchctl load $PLIST_PATH"
echo ""
echo "2. To UNLOAD (stop) the notification cron job:"
echo "   launchctl unload $PLIST_PATH"
echo ""
echo "3. To CHECK if it's running:"
echo "   launchctl list | grep com.whiskeyvault.notifications"
echo ""
echo "4. To view logs:"
echo "   tail -f /tmp/whiskeyvault-notifications.log"
echo "   tail -f /tmp/whiskeyvault-notifications-error.log"
echo ""
echo "5. To manually trigger the cron job:"
echo "   curl -X GET -H \"Authorization: Bearer $CRON_SECRET\" http://localhost:3005/api/cron/notifications"
echo ""
echo "6. To reload after making changes to the plist:"
echo "   launchctl unload $PLIST_PATH"
echo "   launchctl load $PLIST_PATH"
echo ""
echo "⚠️  IMPORTANT: Make sure your app is running on port 3005 before the cron job executes!"
echo ""
echo ""

# Ask about rating calculations
echo "🌟 Additional Setup Option"
echo "========================"
echo ""
echo "Would you also like to set up nightly rating calculations? (y/n)"
echo "This will calculate community ratings for all bottles at 2 AM daily."
read -r SETUP_RATINGS

if [[ "$SETUP_RATINGS" =~ ^[Yy]$ ]]; then
    echo ""
    echo "Setting up rating calculations..."
    
    # Create the ratings plist
    RATINGS_PLIST_PATH="$HOME/Library/LaunchAgents/com.whiskeyvault.ratings.plist"
    
    cat > "$RATINGS_PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.whiskeyvault.ratings</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/curl</string>
        <string>-X</string>
        <string>POST</string>
        <string>-H</string>
        <string>Authorization: Bearer ${CRON_SECRET}</string>
        <string>http://localhost:3005/api/cron/calculate-ratings</string>
    </array>
    
    <!-- Run daily at 2 AM -->
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>2</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    
    <!-- Standard output log -->
    <key>StandardOutPath</key>
    <string>/tmp/whiskeyvault-ratings.log</string>
    
    <!-- Standard error log -->
    <key>StandardErrorPath</key>
    <string>/tmp/whiskeyvault-ratings-error.log</string>
</dict>
</plist>
EOF
    
    echo "✅ Created ratings plist file at: $RATINGS_PLIST_PATH"
    echo ""
    echo "📋 Rating Calculation Instructions:"
    echo "==================================="
    echo ""
    echo "1. To LOAD (start) the rating calculation job:"
    echo "   launchctl load $RATINGS_PLIST_PATH"
    echo ""
    echo "2. To UNLOAD (stop) the rating calculation job:"
    echo "   launchctl unload $RATINGS_PLIST_PATH"
    echo ""
    echo "3. To CHECK if it's running:"
    echo "   launchctl list | grep com.whiskeyvault.ratings"
    echo ""
    echo "4. To view logs:"
    echo "   tail -f /tmp/whiskeyvault-ratings.log"
    echo ""
    echo "5. To manually trigger rating calculations:"
    echo "   curl -X POST -H \"Authorization: Bearer $CRON_SECRET\" http://localhost:3005/api/cron/calculate-ratings"
fi
echo ""
echo "Would you like to load the cron job now? (y/n)"
read -r response

if [[ "$response" =~ ^[Yy]$ ]]; then
    launchctl load "$PLIST_PATH"
    echo "✅ Notification cron job loaded!"
    echo ""
    echo "Checking status..."
    launchctl list | grep com.whiskeyvault.notifications
else
    echo "ℹ️  You can load it later with: launchctl load $PLIST_PATH"
fi