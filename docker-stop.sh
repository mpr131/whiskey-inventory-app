#!/bin/bash

# Stop Whiskey Vault Docker containers

echo "🛑 Stopping Whiskey Vault Application..."

# Check which compose file to use
if [ -f .env.production ] && docker ps | grep -q whiskey-vault-prod; then
    echo "Stopping production containers..."
    docker-compose -f docker-compose.prod.yml down
else
    echo "Stopping development containers..."
    docker-compose down
fi

echo "✅ Whiskey Vault has been stopped."