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

check_for_success() {
    local log_file="$1"
    if grep -q "Sage server is running on port" "$log_file"; then
        return 0
    else
        echo "Sage prod server did not output expected startup message"
        return 1
    fi
}

# Capture server output to a log file
log_file=$(mktemp)
echo "Starting Sage prod server..."

pnpm build
# Use process substitution and capture the actual process PID
timeout 30 bash -c 'pnpm start' 2>&1 | tee "$log_file" &
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
    kill $server_pid 2>/dev/null || true
    rm "$log_file"
    exit 1
fi

# Check for expected success message
if ! check_for_success "$log_file"; then
    kill $server_pid 2>/dev/null || true
    cat "$log_file"
    rm "$log_file"
    exit 1
fi

# No errors, clean up
kill $server_pid 2>/dev/null || true
rm "$log_file"
exit 0
