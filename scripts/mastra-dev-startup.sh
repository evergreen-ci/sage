#!/bin/bash
set -e

check_for_errors() {
    local log_file="$1"
    if grep -E "Error|triggerUncaughtException" "$log_file"; then
        echo "Errors detected during Mastra dev server startup"
        echo "Check for a broken import or a missing file"
        return 1
    fi
}

check_playground() {
    local url="http://localhost:4111"
    for i in {1..10}; do
        if curl -s --head "$url" | grep "200 OK" > /dev/null; then
            echo "Playground is up at $url"
            return 0
        fi
        sleep 2
    done
    echo "Playground not detected at $url after waiting."
    return 1
}

# Capture server output to a log file and terminal
log_file=$(mktemp)
echo "Starting Mastra dev server..."
timeout 30 pnpm mastra:dev 2>&1 | tee "$log_file" &
server_pid=$!

# Wait for server to start or timeout
sleep 10

# Check if process is still running
if ! kill -0 $server_pid 2>/dev/null; then
    echo "Mastra dev server failed to start"
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
fi

# Check for Playground
if ! check_playground; then
    echo "Playground check failed."
    kill $server_pid
    rm "$log_file"
    exit 1
fi

# No errors, clean up
kill $server_pid
rm "$log_file"
exit 0
