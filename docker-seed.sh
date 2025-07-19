#!/bin/bash

# Run database seed script inside Docker container

echo "🌱 Running database seed script..."

# Check if container is running
if ! docker ps | grep -q whiskey-vault; then
    echo "⚠️  Error: Whiskey Vault container is not running."
    echo "   Start the container first with: ./docker-start.sh"
    exit 1
fi

# Determine which container to use
if docker ps | grep -q whiskey-vault-prod; then
    CONTAINER="whiskey-vault-prod"
else
    CONTAINER="whiskey-vault-dev"
fi

echo "📦 Using container: $CONTAINER"

# Check if seed script exists
if [ ! -f scripts/seed.js ] && [ ! -f scripts/seed.ts ]; then
    echo "⚠️  Error: No seed script found in scripts/ directory"
    exit 1
fi

# Run the seed script inside the container
echo "🔄 Seeding database with admin user..."
docker exec -it $CONTAINER npm run seed

if [ $? -eq 0 ]; then
    echo "✅ Database seeded successfully!"
    echo "   Admin user: admin@whiskeyvault.com"
    echo "   Password: admin123"
else
    echo "❌ Error: Failed to seed database"
    exit 1
fi