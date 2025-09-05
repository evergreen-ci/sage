#!/bin/bash

# Braintrust CLI does not correctly fail if there are compile errors while running evals, so this is handled by the script below.

if [ -d "bin" ]; then
    echo "Directory /bin already exists."
else
    mkdir bin
fi

# Pipe stderr output to stdout, then check for string that indicates failure. 
if yarn eval:send_to_braintrust src/evals/$EVAL_DIR 2>&1 | tee bin/$EVAL_DIR.log  | grep -q "Failed to compile"; then
    echo "ERROR: The eval tests could not run due to a compile failure."
    exit 1
fi

# Print out the log content in the task.
cat bin/$EVAL_DIR.log
