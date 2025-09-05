#!/bin/bash

# Braintrust CLI does not correctly fail if there are compile errors while running evals, so this is handled by the script below.

# Pipe stderr output to stdout, then check for string that indicates failure. 
if yarn eval:send_to_braintrust $EVAL_DIR 2>&1 | grep -q "Failed to compile"; then
    echo "ERROR: The eval tests could not run due to a compile failure."
    exit 1
fi
