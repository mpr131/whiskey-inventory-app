# Whiskey Vault - Development & Deployment Guide

## Start of Session Checklist

### 1. Pull Latest Changes
```bash
# Pull from both remotes
git pull origin dev
git pull origin main
git pull gitlab dev
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
# Push to GitHub
git push origin dev
git push origin main

# Push to GitLab (auto-connected)
git push gitlab dev
git push gitlab main
```

### 3. Deploy to Production (Beelink Server)
```bash
# SSH into the Beelink server
ssh ams237@beelink

# Navigate to project directory
cd whiskey-vault

# Pull latest changes
git pull

# Rebuild and restart Docker containers
docker-compose down
docker-compose up -d --build

# Check logs to ensure successful deployment
docker-compose logs -f
```

## Common Issues & Fixes

### TypeScript Errors
- Use type casting when TypeScript doesn't recognize populated MongoDB fields:
  ```typescript
  (object as any).property
  ```

### Camera Issues
- Html5QrScanner must use unique IDs to prevent duplicate cameras
- Always clean up scanner instances in useEffect cleanup

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