# Docker Setup for Whiskey Vault

This guide explains how to run the Whiskey Vault application using Docker while connecting to your existing MongoDB instance.

## Prerequisites

- Docker and Docker Compose installed
- MongoDB running on your host machine (bare metal)
- Node.js 18+ (for local development without Docker)

## Quick Start

1. **Clone and setup environment:**
   ```bash
   # Copy environment template
   cp .env.example .env.local
   
   # Edit .env.local with your configuration
   # For Mac/Windows Docker connecting to host MongoDB:
   # MONGODB_URI=mongodb://host.docker.internal:27017/whiskey-vault?replicaSet=rs0
   ```

2. **Start the application:**
   ```bash
   # Development mode with hot reload
   ./docker-start.sh
   
   # Production mode
   ./docker-start.sh --prod -d
   ```

3. **Access the application:**
   - Development: http://localhost:3000
   - Production: Configure NEXTAUTH_URL and NEXT_PUBLIC_APP_URL in .env.production

## MongoDB Connection Configuration

### For Docker on Mac/Windows:
```
MONGODB_URI=mongodb://host.docker.internal:27017/whiskey-vault?replicaSet=rs0
```

### For Docker on Linux:
You have two options:
1. Use host network mode (modify docker-compose.yml):
   ```yaml
   network_mode: "host"
   ```
2. Use your machine's IP address:
   ```
   MONGODB_URI=mongodb://192.168.1.119:27017/whiskey-vault?replicaSet=rs0
   ```

### For MongoDB Atlas:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/whiskey-vault
```

## Available Scripts

### `./docker-start.sh`
Starts the application containers.
- Default: Development mode with hot reload
- `--prod`: Production mode
- `-d`: Run in background (detached)

### `./docker-stop.sh`
Stops all running containers.

### `./docker-build.sh`
Builds Docker images.
- `--prod`: Build production image
- `--no-cache`: Force rebuild without cache

### `./docker-logs.sh`
View container logs.
- `-f`: Follow logs in real-time
- `-n 50`: Show last 50 lines

### `./docker-seed.sh`
Seeds the database with admin user (admin@whiskeyvault.com / admin123).

## Development Workflow

1. **Start development environment:**
   ```bash
   ./docker-start.sh
   ```

2. **Make code changes:**
   - Files are mounted, so changes are reflected immediately
   - Next.js hot reload works automatically

3. **View logs:**
   ```bash
   ./docker-logs.sh -f
   ```

4. **Seed database:**
   ```bash
   ./docker-seed.sh
   ```

## Production Deployment

1. **Create production environment file:**
   ```bash
   cp .env.example .env.production
   # Update with production values
   ```

2. **Build production image:**
   ```bash
   ./docker-build.sh --prod
   ```

3. **Start production containers:**
   ```bash
   ./docker-start.sh --prod -d
   ```

## Container Management

### Access container shell:
```bash
# Development
docker exec -it whiskey-vault-dev sh

# Production
docker exec -it whiskey-vault-prod sh
```

### View running containers:
```bash
docker ps
```

### Remove containers and volumes:
```bash
# Development
docker-compose down -v

# Production
docker-compose -f docker-compose.prod.yml down -v
```

## Environment Variables

Key variables to configure:

- `MONGODB_URI`: MongoDB connection string
- `NEXTAUTH_URL`: Application URL for authentication
- `NEXTAUTH_SECRET`: Secret for JWT encryption (generate with `openssl rand -base64 32`)
- `NEXT_PUBLIC_APP_URL`: Public-facing application URL

## Troubleshooting

### MongoDB Connection Issues

1. **"Connection refused" error:**
   - Ensure MongoDB is running on host
   - Check MongoDB bind IP (should allow Docker network)
   - Verify replica set configuration

2. **"host.docker.internal" not working:**
   - On Linux, use actual IP or host network mode
   - Ensure extra_hosts is configured in docker-compose.yml

### Build Issues

1. **"Module not found" errors:**
   ```bash
   ./docker-build.sh --no-cache
   ```

2. **Permission errors:**
   - Ensure scripts are executable: `chmod +x docker-*.sh`

### Performance Issues

1. **Slow hot reload:**
   - Exclude node_modules from volume mounts
   - Use .dockerignore to exclude large files

2. **High memory usage:**
   - Adjust resource limits in docker-compose.prod.yml

## Security Notes

- Never commit `.env.local` or `.env.production` files
- Always use strong NEXTAUTH_SECRET in production
- Keep MongoDB credentials secure
- Use HTTPS in production (configure reverse proxy)

## Future Enhancements

- Nginx reverse proxy configuration
- SSL/TLS certificate automation
- Health check endpoints
- Automated backups
- Container orchestration (Kubernetes)