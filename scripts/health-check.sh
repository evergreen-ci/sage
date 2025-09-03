#!/bin/bash
set -e

# Start server
yarn start &
SERVER_PID=$!
echo "Started server with PID: $SERVER_PID"

# Function to cleanup
cleanup() {
    echo "Cleaning up server..."
    if kill -0 $SERVER_PID 2>/dev/null; then
        kill -TERM $SERVER_PID 2>/dev/null || true
        sleep 2
        if kill -0 $SERVER_PID 2>/dev/null; then
            kill -KILL $SERVER_PID 2>/dev/null || true
        fi
    fi
    # Clean up any orphaned processes
    pkill -f "node dist/main.js" 2>/dev/null || true
}

# Set trap to ensure cleanup on script exit
trap cleanup EXIT

# Wait for server to start and run for a bit
sleep 5

# Optional: Add a health check here
curl -f http://localhost:8080/health || exit 1

echo "Server test completed successfully"
