#!/bin/bash

# Build Whiskey Vault Docker image

echo "🔨 Building Whiskey Vault Docker image..."

# Parse command line arguments
ENV="development"
NO_CACHE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --prod|--production)
            ENV="production"
            shift
            ;;
        --no-cache)
            NO_CACHE="--no-cache"
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: ./docker-build.sh [--prod|--production] [--no-cache]"
            exit 1
            ;;
    esac
done

# Build based on environment
if [ "$ENV" = "production" ]; then
    echo "🚀 Building production image..."
    if [ ! -f .env.production ]; then
        echo "⚠️  Error: .env.production not found. Please create it from .env.example"
        exit 1
    fi
    
    # Load environment variables for build args
    export $(cat .env.production | grep -v '^#' | xargs)
    
    docker-compose -f docker-compose.prod.yml build $NO_CACHE
else
    echo "🔧 Building development image..."
    docker-compose build $NO_CACHE
fi

echo "✅ Build complete!"