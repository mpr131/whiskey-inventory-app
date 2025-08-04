# MongoDB Replica Set Setup for Production

## Background
The production MongoDB needs to be configured as a replica set to support transactions in the whiskey inventory app.

## Current Setup
- MongoDB runs externally on the `infrastructure_infrastructure` network
- Container name: `mongodb-web`
- The whiskey inventory app connects to it at `mongodb://mongodb-web:27017/whiskey-inventory`

## Required Changes

### 1. Update MongoDB Container Configuration
The MongoDB container needs to be started with replica set support. Update the docker-compose file where MongoDB is defined (in your infrastructure setup) to include:

```yaml
mongodb-web:
  image: mongo:7.0
  command: mongod --replSet rs0 --bind_ip_all
  # ... rest of configuration
```

### 2. Initialize the Replica Set
After updating the MongoDB container to start with `--replSet rs0`, run the initialization script:

```bash
cd /path/to/whiskey-inventory-app
./scripts/init-replica-set.sh
```

This script will:
- Check if the replica set is already initialized
- Initialize it if needed
- Show the replica set status

### 3. Application Configuration
The production MongoDB URI has been updated to include the replica set parameter:
```
mongodb://mongodb-web:27017/whiskey-inventory?replicaSet=rs0
```

This is already configured in `.env.production`.

## Verification
After setup, you can verify the replica set is working:

```bash
# Check replica set status
docker exec mongodb-web mongosh --eval 'rs.status()'

# Test a transaction in the app
# The app should no longer show "Transaction numbers are only allowed on a replica set member or mongos" errors
```

## Important Notes
- This change needs to be made in the infrastructure docker-compose file, not in the whiskey inventory app
- The MongoDB data will be preserved during this change
- After the change, MongoDB will support transactions required by the app