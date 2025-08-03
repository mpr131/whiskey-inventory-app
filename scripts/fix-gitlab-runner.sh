#!/bin/bash

# Script to fix GitLab Runner configuration by adding missing docker tag
# This script should be run on the Big NUC (192.168.1.71)

set -e

echo "=== GitLab Runner Configuration Fix ==="
echo "This script will add the missing 'docker' tag to your GitLab runner configuration"
echo ""

# Check if gitlab-runner container is running
if ! docker ps --format '{{.Names}}' | grep -q '^gitlab-runner$'; then
    echo "Error: gitlab-runner container is not running"
    echo "Please ensure the gitlab-runner container is running and try again"
    exit 1
fi

echo "1. Backing up current configuration..."
# Create backup of current config
docker exec gitlab-runner cp /etc/gitlab-runner/config.toml /etc/gitlab-runner/config.toml.backup

echo "2. Checking current configuration..."
# Check if tags already exist
if docker exec gitlab-runner grep -q 'tags = \["docker"\]' /etc/gitlab-runner/config.toml; then
    echo "Tags already configured correctly. No changes needed."
    exit 0
fi

echo "3. Adding docker tag to runner configuration..."
# Add tags = ["docker"] after executor = "docker" line
docker exec gitlab-runner sh -c 'sed -i "/executor = \"docker\"/a\  tags = [\"docker\"]" /etc/gitlab-runner/config.toml'

echo "4. Verifying the change..."
# Show the updated configuration section
echo "Updated configuration:"
docker exec gitlab-runner grep -A 5 -B 5 'tags = \["docker"\]' /etc/gitlab-runner/config.toml || {
    echo "Warning: Could not verify the change. Checking full [[runners]] section..."
    docker exec gitlab-runner grep -A 10 '\[\[runners\]\]' /etc/gitlab-runner/config.toml
}

echo ""
echo "5. Restarting GitLab runner..."
docker restart gitlab-runner

# Wait for container to be healthy
echo "6. Waiting for GitLab runner to be ready..."
sleep 5

# Check if container is running
if docker ps --format '{{.Names}}' | grep -q '^gitlab-runner$'; then
    echo "✓ GitLab runner restarted successfully"
    
    # Check runner status
    echo ""
    echo "7. Checking runner status..."
    docker exec gitlab-runner gitlab-runner verify
else
    echo "✗ GitLab runner failed to restart"
    echo "Rolling back configuration..."
    docker start gitlab-runner
    docker exec gitlab-runner cp /etc/gitlab-runner/config.toml.backup /etc/gitlab-runner/config.toml
    docker restart gitlab-runner
    exit 1
fi

echo ""
echo "=== Configuration fix complete! ==="
echo "Your GitLab runner should now pick up jobs with the 'docker' tag."
echo ""
echo "To verify the configuration manually, run:"
echo "  docker exec gitlab-runner cat /etc/gitlab-runner/config.toml"
echo ""
echo "Your pipelines should no longer stay in pending state."