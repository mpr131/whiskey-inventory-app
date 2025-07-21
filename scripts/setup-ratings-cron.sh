#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Whiskey Vault Rating Calculation Setup${NC}"
echo "This script will set up a nightly job to calculate community ratings."
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo "Please create a .env file with CRON_SECRET defined."
    exit 1
fi

# Get CRON_SECRET from .env
CRON_SECRET=$(grep CRON_SECRET .env | cut -d '=' -f2-)
if [ -z "$CRON_SECRET" ]; then
    echo -e "${RED}Error: CRON_SECRET not found in .env file!${NC}"
    echo "Please add CRON_SECRET to your .env file."
    exit 1
fi

# Get app URL
echo -e "${YELLOW}Enter your app URL (default: http://localhost:3005):${NC}"
read -r APP_URL
APP_URL=${APP_URL:-http://localhost:3005}

# Create plist content
PLIST_PATH="$HOME/Library/LaunchAgents/com.whiskeyvault.ratings.plist"
PLIST_CONTENT="<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">
<plist version=\"1.0\">
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
        <string>${APP_URL}/api/cron/calculate-ratings</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>2</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/tmp/whiskeyvault-ratings.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/whiskeyvault-ratings-error.log</string>
</dict>
</plist>"

# Create LaunchAgents directory if it doesn't exist
mkdir -p "$HOME/Library/LaunchAgents"

# Write plist file
echo "$PLIST_CONTENT" > "$PLIST_PATH"

# Load the launch agent
launchctl unload "$PLIST_PATH" 2>/dev/null
launchctl load "$PLIST_PATH"

echo -e "${GREEN}✓ Rating calculation cron job installed successfully!${NC}"
echo ""
echo "The job will run daily at 2:00 AM."
echo "Logs will be written to: /tmp/whiskeyvault-ratings.log"
echo ""

# Test the endpoint
echo -e "${YELLOW}Would you like to test the rating calculation endpoint now? (y/n):${NC}"
read -r TEST_NOW
if [[ "$TEST_NOW" =~ ^[Yy]$ ]]; then
    echo "Testing rating calculation endpoint..."
    RESPONSE=$(curl -s -X POST -H "Authorization: Bearer ${CRON_SECRET}" "${APP_URL}/api/cron/calculate-ratings")
    echo "Response: $RESPONSE"
    echo ""
fi

# Check status
echo "To check the status of the job, run:"
echo "  launchctl list | grep whiskeyvault"
echo ""
echo "To manually trigger the rating calculation, run:"
echo "  curl -X POST -H \"Authorization: Bearer \$CRON_SECRET\" ${APP_URL}/api/cron/calculate-ratings"
echo ""
echo "To view logs, run:"
echo "  tail -f /tmp/whiskeyvault-ratings.log"