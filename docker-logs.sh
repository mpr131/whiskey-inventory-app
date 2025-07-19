#!/bin/bash

# View Whiskey Vault Docker logs

echo "📋 Viewing Whiskey Vault logs..."

# Parse command line arguments
FOLLOW=""
TAIL="100"

while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--follow)
            FOLLOW="-f"
            shift
            ;;
        -n|--lines)
            TAIL="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: ./docker-logs.sh [-f|--follow] [-n|--lines <number>]"
            exit 1
            ;;
    esac
done

# Determine which container to show logs for
if docker ps | grep -q whiskey-vault-prod; then
    CONTAINER="whiskey-vault-prod"
else
    CONTAINER="whiskey-vault-dev"
fi

# Show logs
docker logs $FOLLOW --tail $TAIL $CONTAINER