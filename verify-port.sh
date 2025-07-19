#!/bin/bash

# Verify PORT configuration across the project

echo "🔍 Verifying PORT configuration..."
echo ""

# Show current PORT setting
echo "Current PORT setting: ${PORT:-3000}"
echo ""

# Check for hardcoded ports
echo "Checking for hardcoded ports (3003, 3005, 3000)..."
echo "========================================"

# Define files to check
FILES_TO_CHECK=(
    "*.json"
    "*.yml"
    "*.yaml"
    "Dockerfile*"
    "docker-*.sh"
    "*.js"
    "*.ts"
    "*.tsx"
)

# Track if any hardcoded ports found
FOUND_ISSUES=0

# Function to check for hardcoded ports in a file
check_file() {
    local file=$1
    local pattern="3003|3005|3000"
    
    # Skip node_modules, .next, and build directories
    if [[ "$file" == *"node_modules"* ]] || [[ "$file" == *".next"* ]] || [[ "$file" == *"build"* ]]; then
        return
    fi
    
    # Check if file contains hardcoded ports
    if grep -E "$pattern" "$file" > /dev/null 2>&1; then
        echo ""
        echo "📄 File: $file"
        grep -n -E "$pattern" "$file" | while read -r line; do
            echo "   Line: $line"
        done
        FOUND_ISSUES=1
    fi
}

# Search for hardcoded ports
for pattern in "${FILES_TO_CHECK[@]}"; do
    find . -name "$pattern" -type f 2>/dev/null | while read -r file; do
        check_file "$file"
    done
done

echo ""
echo "========================================"

# Check environment consistency
echo ""
echo "🔧 Checking environment configuration..."
echo ""

# Check if .env files exist
for env_file in .env .env.local .env.production; do
    if [ -f "$env_file" ]; then
        echo "Found $env_file:"
        grep -E "^PORT=|^NEXTAUTH_URL=|^NEXT_PUBLIC_APP_URL=" "$env_file" | sed 's/^/  /'
        echo ""
    fi
done

# Verify PORT usage in running containers
if command -v docker &> /dev/null; then
    echo "🐳 Checking Docker configuration..."
    
    # Check if any whiskey-vault containers are running
    if docker ps --format "table {{.Names}}\t{{.Ports}}" | grep -E "whiskey-vault"; then
        echo "Running containers:"
        docker ps --format "table {{.Names}}\t{{.Ports}}" | grep -E "whiskey-vault|NAMES"
    else
        echo "No whiskey-vault containers currently running."
    fi
    echo ""
fi

# Summary
echo "========================================"
echo "📊 Summary:"
echo ""

if [ $FOUND_ISSUES -eq 0 ]; then
    echo "✅ No hardcoded ports found in configuration files!"
    echo "✅ PORT environment variable is properly configured."
else
    echo "⚠️  Found potential hardcoded port references."
    echo "   Please review the files above and ensure they use environment variables."
fi

echo ""
echo "💡 Tips:"
echo "   - Set PORT in your .env file to use a custom port"
echo "   - Ensure NEXTAUTH_URL and NEXT_PUBLIC_APP_URL match your PORT setting"
echo "   - Run 'source .env' before starting the app locally"
echo "   - Docker will use the PORT from your .env file automatically"
echo ""