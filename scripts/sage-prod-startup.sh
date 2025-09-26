#!/bin/bash
set -e

check_for_errors() {
    local log_file="$1"
    if grep -E "Error|triggerUncaughtException|Failed to start" "$log_file"; then
        echo "Errors detected during Sage prod server startup"
        echo "Check for configuration or startup issues"
        return 1
    fi
}

# Capture server output to a log file and terminal
log_file=$(mktemp)
echo "Starting Sage prod server..."
timeout 30 yarn start 2>&1 | tee "$log_file" &
server_pid=$!

# Wait for server to start or timeout
sleep 10

# Check if process is still running
if ! kill -0 $server_pid 2>/dev/null; then
    echo "Sage prod server failed to start"
    cat "$log_file"
    rm "$log_file"
    exit 1
fi

# Check for errors
if ! check_for_errors "$log_file"; then
    # Errors found
    kill $server_pid
    rm "$log_file"
    exit 1
else
    # No errors, clean up
    kill $server_pid
    rm "$log_file"
    exit 0
fi