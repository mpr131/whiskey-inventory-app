# Whiskey Vault - Development & Deployment Guide

## Start of Session Checklist

### 1. Pull Latest Changes
```bash
# Always pull from main branch for consistency
git checkout main
git pull origin main
git pull gitlab main
```

## Development Setup

### Local Development
```bash
# Standard development (localhost only)
npm run dev
```

### Mobile Testing with Camera
For testing camera features on mobile devices, you need HTTPS:

```bash
# 1. Start dev server with HTTP support (allows network access)
npm run dev:http

# 2. Create ngrok tunnel for HTTPS access
ngrok http 3000

# 3. Check ngrok URL
curl -s http://localhost:4040/api/tunnels | python3 -m json.tool | grep public_url

# 4. Access the ngrok URL on your mobile device
# Example: https://2c9655ff5ee7.ngrok-free.app
```

**Note:** Camera access requires HTTPS. The ngrok tunnel provides a secure connection for testing on mobile devices.

### Managing Ngrok Sessions
```bash
# Check if ngrok is already running
ps aux | grep ngrok

# Kill existing ngrok session if needed
# Find the PID from ps aux output, then:
kill [PID]

# View ngrok dashboard (when running)
open http://localhost:4040
```

## Pre-Deployment Checklist

### 1. Run ESLint
```bash
npm run lint
```
Fix any linting errors before proceeding.

### 2. Check TypeScript Errors
```bash
npm run build
```
The build command will catch TypeScript errors. Fix all type errors before deployment.

### 3. Test Locally
```bash
npm run dev
# or for HTTP (required for camera testing on mobile)
npm run dev:http
```

## Deployment Process

### 1. Commit Changes
```bash
git add .
git commit -m "Your commit message"
```

### 2. Push to Both Remotes
```bash
# Always push to both remotes for both branches
# First ensure main is updated
git push origin main
git push gitlab main

# Then merge main into dev and push dev
git checkout dev
git merge main
git push origin dev
git push gitlab dev

# Return to main branch
git checkout main
```

### 3. Deploy to Production (Beelink Server)
```bash
# SSH into the Beelink server
ssh ams237beelink

# Navigate to project directory
cd /home/ams237/webapps/whiskey-inventory-app

# IMPORTANT: Switch to main branch and pull latest changes
git checkout main
git pull

# Rebuild and restart Docker containers (use production compose file)
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build

# Check logs to ensure successful deployment
docker-compose -f docker-compose.prod.yml logs -f

# The production app runs on port 3005
# Access at: http://192.168.1.71:3005
```

## PWA Updates

### Refreshing PWA After Deployment
When deploying updates to production, PWA users need to refresh their app to get the latest changes:

1. **Option 1: Force Close and Reopen**
   - Close the PWA app completely
   - Reopen it

2. **Option 2: Clear Safari Website Data**
   - Go to Settings > Safari > Advanced > Website Data
   - Find your site and delete it
   - Reopen the PWA

3. **Option 3: Pull to Refresh**
   - On the home screen, pull down to refresh

### Service Worker Cache
The service worker caches static assets. After deployment, users may need to:
- Hard refresh the browser (Cmd+Shift+R on Mac)
- Clear browser cache
- Wait for service worker to update (usually within 24 hours)

## Git Branch Strategy

### Important Notes
- **Production ALWAYS runs from `main` branch**
- **Always push to BOTH remotes (GitHub and GitLab)**
- **Always push to BOTH branches (`main` and `dev`)**
- The server pulls from GitLab (local network)
- GitHub is the backup/public repository

### Why This Matters
The production server was previously stuck on an old `dev` branch, causing deployments to fail silently. Always ensure:
1. Production server is on `main` branch
2. Changes are pushed to both `main` and `dev`
3. Both GitHub and GitLab have the latest code

## Production Environment

### Docker Containers
The production environment runs two potential containers:
- **whiskey-inventory** (Production) - Port 3005 - Uses `docker-compose.prod.yml`
- **whiskey-vault-dev** (Development) - Port 3001 - Uses `docker-compose.yml`

### Checking Container Status
```bash
# View running containers
ssh ams237beelink 'docker ps | grep whiskey'

# Check production logs
ssh ams237beelink 'docker logs whiskey-inventory --tail 20'

# Stop old/orphaned containers
ssh ams237beelink 'docker-compose -f docker-compose.prod.yml down --remove-orphans'
```

### Port Conflicts
- Port 3000: Used by Grafana (system monitoring)
- Port 3001: Development container (if running)
- Port 3005: Production container

## Common Issues & Fixes

### Port Already Allocated Error
If you get "port is already allocated" error:
```bash
# Check what's using the port
ssh ams237beelink 'lsof -i :3005'

# Or check Docker
ssh ams237beelink 'docker ps | grep 3005'

# Stop conflicting container
ssh ams237beelink 'docker stop [container_id]'
```

### TypeScript Errors
- Use type casting when TypeScript doesn't recognize populated MongoDB fields:
  ```typescript
  (object as any).property
  ```

### Camera Scanner Implementation
We use two scanner components:
1. **Html5QrScanner** - Original scanner with manual camera selection
2. **AutoStartScanner** - Enhanced scanner with automatic setup

#### AutoStartScanner Features
- Automatically requests camera permissions
- Auto-selects best camera (prioritizes: back ultra-wide > ultra-wide > back > rear)
- Starts scanning immediately without manual steps
- Shows user-friendly status messages during initialization

#### Scanner Usage Locations
The scanner is used in multiple pages:
- `/scan` - Main barcode scanning page
- `/pour/quick` - Quick pour session scanning
- `/dashboard` - Dashboard quick scan
- `/bottles` - Bottle collection scanning
- `/admin/upc` - Admin UPC management

#### Camera Issues & Solutions
- **Duplicate cameras bug**: Fixed by using unique timestamp-based IDs
- **Cleanup issues**: Always clean up scanner instances synchronously in useEffect cleanup
- **Permission errors**: AutoStartScanner handles permission requests automatically
- **Camera selection**: AutoStartScanner intelligently selects the best available camera

### MongoDB Population
- Remember to use `.populate('fieldName')` when referencing other collections
- Especially important for UserBottle -> MasterBottle relationships

## Environment Variables
Ensure all required environment variables are set in production:
- MongoDB connection string
- NextAuth secret
- Cloudinary credentials
- Any other API keys

## Monitoring
After deployment:
1. Check application logs: `docker-compose logs -f`
2. Test critical features (camera, pour, search)
3. Monitor for any console errors in browser