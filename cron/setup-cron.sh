#!/bin/bash

# Default to prod if no argument
ENV=${1:-prod}

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up Whiskey Vault cron jobs for $ENV environment...${NC}"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if environment directory exists
if [ ! -d "$SCRIPT_DIR/$ENV" ]; then
    echo -e "${RED}Error: Environment '$ENV' not found!${NC}"
    echo "Available environments: dev, prod"
    exit 1
fi

# Unload existing jobs (ignore errors if they don't exist)
echo "Unloading existing cron jobs..."
launchctl unload ~/Library/LaunchAgents/com.whiskeyvault.*.plist 2>/dev/null

# Copy appropriate files
echo "Copying $ENV plist files..."
cp "$SCRIPT_DIR/$ENV"/*.plist ~/Library/LaunchAgents/

# Load new ones
echo "Loading new cron jobs..."
launchctl load ~/Library/LaunchAgents/com.whiskeyvault.notifications.plist
launchctl load ~/Library/LaunchAgents/com.whiskeyvault.ratings.plist

# Verify they're loaded
echo -e "\n${GREEN}Cron jobs loaded for $ENV environment!${NC}"
echo -e "\nVerifying installation:"
launchctl list | grep whiskeyvault

echo -e "\n${GREEN}Setup complete!${NC}"
echo "Notifications will run hourly"
echo "Ratings calculation will run daily at 2 AM"