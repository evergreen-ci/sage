#!/usr/bin/env bash
set -Eeuo pipefail

# Accept EVAL_DIR as arg or env var
EVAL_DIR="${1:-${EVAL_DIR:-}}"
if [[ -z "$EVAL_DIR" ]]; then
  echo "usage: $0 <eval_dir>    # or set EVAL_DIR in env"
  exit 2
fi

LOG_DIR="bin"
LOG_FILE="$LOG_DIR/${EVAL_DIR}_$(date +%Y%m%dT%H%M%S).log"

# Common error strings that show up even if yarn exits 0
FAIL_PATTERNS=$(
  cat <<'REGEX'
Failed to compile
Compilation failed
Build failed
TypeScript error
error TS[0-9]{3,5}
TS[0-9]{3,5}:
SyntaxError:
ReferenceError:
Module build failed
Cannot find module
Error: Cannot find module
REGEX
)

mkdir -p "$LOG_DIR"

echo "Running: yarn eval:send_to_braintrust src/evals/$EVAL_DIR"
echo "(logging to $LOG_FILE)"

# Run eval, tee so user sees output AND it goes into log
set +e
yarn eval:send_to_braintrust "src/evals/$EVAL_DIR" 2>&1 | tee "$LOG_FILE"
YARN_EC=${PIPESTATUS[0]}
set -e

# Hard fail if yarn itself non-zero
if [[ $YARN_EC -ne 0 ]]; then
  echo "ERROR: eval command exited with $YARN_EC"
  exit "$YARN_EC"
fi

# Collapse patterns into single regex
JOINED_PATTERN="$(echo "$FAIL_PATTERNS" | sed '/^\s*$/d' | paste -sd'|' -)"

if grep -Eiq "$JOINED_PATTERN" "$LOG_FILE"; then
  echo "ERROR: Compile/build failure detected in logs."
  exit 1
fi

echo "Success ✅"
