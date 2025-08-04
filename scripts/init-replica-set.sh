#!/bin/bash

# Initialize MongoDB replica set for production
# This script should be run on the Big NUC where MongoDB is running

echo "=== MongoDB Replica Set Initialization ==="
echo "This script will initialize a replica set for the production MongoDB"
echo ""

# Since MongoDB is external to this app, we need to connect to it directly
# Adjust the container name if needed based on your infrastructure setup
MONGO_CONTAINER="mongodb-web"

echo "Waiting for MongoDB to be ready..."
sleep 10

echo "Checking if replica set is already initialized..."
docker exec -T $MONGO_CONTAINER mongosh --quiet --eval 'rs.status()' 2>/dev/null | grep -q "ok.*1"

if [ $? -eq 0 ]; then
    echo "Replica set is already initialized!"
    exit 0
fi

echo "Initializing replica set..."
docker exec -T $MONGO_CONTAINER mongosh --eval '
rs.initiate({
  _id: "rs0",
  members: [
    {
      _id: 0,
      host: "mongodb-web:27017"
    }
  ]
})'

# Wait for replica set to be ready
echo "Waiting for replica set to become ready..."
sleep 5

# Check status
echo "Checking replica set status..."
docker exec -T $MONGO_CONTAINER mongosh --eval 'rs.status()'

echo ""
echo "=== Replica set initialization complete! ==="
echo ""
echo "IMPORTANT: If MongoDB was already running, you may need to:"
echo "1. Update the MongoDB container to start with: mongod --replSet rs0 --bind_ip_all"
echo "2. Restart your application to use the new connection string"
echo ""
echo "Your app's MongoDB URI should include: ?replicaSet=rs0"