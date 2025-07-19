#!/bin/bash

# Start Whiskey Vault Docker containers

echo "🥃 Starting Whiskey Vault Application..."

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "⚠️  Warning: .env.local not found. Copying from .env.example..."
    cp .env.example .env.local
    echo "📝 Please update .env.local with your configuration before continuing."
    echo "Press Enter to continue or Ctrl+C to exit..."
    read
fi

# Parse command line arguments
ENV="development"
DETACHED=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --prod|--production)
            ENV="production"
            shift
            ;;
        -d|--detach)
            DETACHED="-d"
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: ./docker-start.sh [--prod|--production] [-d|--detach]"
            exit 1
            ;;
    esac
done

# Start containers based on environment
if [ "$ENV" = "production" ]; then
    echo "🚀 Starting in production mode..."
    if [ ! -f .env.production ]; then
        echo "⚠️  Error: .env.production not found. Please create it from .env.example"
        exit 1
    fi
    docker-compose -f docker-compose.prod.yml up $DETACHED --build
else
    echo "🔧 Starting in development mode with hot reload..."
    docker-compose up $DETACHED
fi

if [ -z "$DETACHED" ]; then
    echo "✅ Whiskey Vault is running!"
else
    echo "✅ Whiskey Vault is running in the background!"
    echo "   View logs with: ./docker-logs.sh"
    echo "   Stop with: ./docker-stop.sh"
fi