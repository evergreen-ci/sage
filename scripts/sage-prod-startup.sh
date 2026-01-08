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

extract_port_from_log() {
    local log_file="$1"
    grep -Eo "Sage server is running on port [0-9]+" "$log_file" | tail -n 1 | grep -Eo "[0-9]+"
}

check_for_route_served() {
    local log_file="$1"
    local port="$2"

    if [ -z "$port" ]; then
        echo "Could not determine server port from logs"
        return 1
    fi

    echo "Checking that the server serves a route (GET /) on port $port..."

    local attempt
    for attempt in 1 2 3 4 5; do
        if curl -sS -o /dev/null --max-time 2 "http://localhost:${port}/"; then
            sleep 1
            if grep -qE "HTTP[[:space:]]+GET[[:space:]]+/[[:space:]]" "$log_file"; then
                return 0
            fi
        fi
        sleep 1
    done

    echo "Sage prod server did not appear to serve a route (expected to find an 'HTTP GET /' log line)"
    return 1
}

# Capture server output to a log file
log_file=$(mktemp)
echo "Starting Sage prod server..."

yarn build
# Use process substitution and capture the actual process PID
timeout 30 bash -c 'yarn start' 2>&1 | tee "$log_file" &
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

server_port=$(extract_port_from_log "$log_file")
if ! check_for_route_served "$log_file" "$server_port"; then
    kill $server_pid 2>/dev/null || true
    cat "$log_file"
    rm "$log_file"
    exit 1
fi

# No errors, clean up
kill $server_pid 2>/dev/null || true
rm "$log_file"
exit 0
