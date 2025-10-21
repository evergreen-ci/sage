#!/bin/bash

# Script to extract undeployed commits by comparing current HEAD with deployed version
#
# Prerequisites:
#   - Run 'kcp' to switch to production context, or 'kcs' to switch to staging context
#   - Ensure you have kubectl access to the target environment
#
# Usage: ./scripts/check-pending-commits.sh [--json]
#   --json: Output in JSON format

set -e

# Default values
OUTPUT_JSON=false

# Check for --json flag
if [[ "$1" == "--json" ]]; then
  OUTPUT_JSON=true
fi

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
  echo "Error: kubectl is not installed or not in PATH" >&2
  exit 1
fi

# Get current kubectl context to determine environment
CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "")
if [[ -z "$CURRENT_CONTEXT" ]]; then
  echo "Error: No kubectl context is set. Run 'kcp' (production) or 'kcs' (staging) first." >&2
  exit 1
fi

# Determine environment from context
if [[ "$CURRENT_CONTEXT" == *"prod"* ]]; then
  ENVIRONMENT="production"
elif [[ "$CURRENT_CONTEXT" == *"staging"* ]]; then
  ENVIRONMENT="staging"
else
  echo "Warning: Could not determine environment from context '$CURRENT_CONTEXT'. Assuming production." >&2
  ENVIRONMENT="production"
fi

# Get the deployed commit hash
DEPLOYED_COMMIT=$(kubectl get pods \
  --selector=release=sage \
  -n devprod-evergreen \
  -o jsonpath='{.items[*].metadata.labels.app\.kubernetes\.io/version}' \
  2>/dev/null | grep -oE 'git-[0-9a-fA-F]+' | cut -d- -f2 | head -n1)

if [[ -z "$DEPLOYED_COMMIT" ]]; then
  if [[ "$OUTPUT_JSON" == true ]]; then
    echo '{"error": "No deployed commit found", "undeployed_commits": []}'
  else
    echo "Error: No deployed commit found in $ENVIRONMENT environment" >&2
  fi
  exit 1
fi

# Get current HEAD
CURRENT_COMMIT=$(git rev-parse HEAD)

# Check if deployed commit is reachable
if ! git cat-file -e "$DEPLOYED_COMMIT" 2>/dev/null; then
  if [[ "$OUTPUT_JSON" == true ]]; then
    echo "{\"error\": \"Deployed commit $DEPLOYED_COMMIT not found in local repository\", \"deployed_commit\": \"$DEPLOYED_COMMIT\", \"current_commit\": \"$CURRENT_COMMIT\"}"
  else
    echo "Error: Deployed commit $DEPLOYED_COMMIT not found in local repository" >&2
    echo "You may need to fetch it: git fetch origin $DEPLOYED_COMMIT" >&2
  fi
  exit 1
fi

# Check if we're up to date
if [[ "$DEPLOYED_COMMIT" == "$CURRENT_COMMIT" ]]; then
  if [[ "$OUTPUT_JSON" == true ]]; then
    echo '{"status": "up-to-date", "deployed_commit": "'$DEPLOYED_COMMIT'", "undeployed_commits": []}'
  else
    echo "No undeployed commits. Current HEAD ($CURRENT_COMMIT) is deployed in $ENVIRONMENT."
  fi
  exit 0
fi

# Get undeployed commits (using ^.. to match generate_deploy_email.sh behavior)
COMMIT_COUNT=$(git rev-list --count ${DEPLOYED_COMMIT}^..${CURRENT_COMMIT})

if [[ "$COMMIT_COUNT" -eq 0 ]]; then
  if [[ "$OUTPUT_JSON" == true ]]; then
    echo '{"status": "up-to-date", "deployed_commit": "'$DEPLOYED_COMMIT'", "current_commit": "'$CURRENT_COMMIT'", "undeployed_commits": []}'
  else
    echo "No undeployed commits. Deployed commit $DEPLOYED_COMMIT is ahead or equal to current HEAD."
  fi
  exit 0
fi

# Calculate repository URL
REPO_URL=$(git config --get remote.origin.url | sed -e 's/\.git$//' -e 's/^git@\([^:]*\):/https:\/\/\1\//')

if [[ "$OUTPUT_JSON" == true ]]; then
  # JSON output
  echo "{"
  echo "  \"environment\": \"$ENVIRONMENT\","
  echo "  \"deployed_commit\": \"$DEPLOYED_COMMIT\","
  echo "  \"current_commit\": \"$CURRENT_COMMIT\","
  echo "  \"undeployed_count\": $COMMIT_COUNT,"
  echo "  \"repository_url\": \"$REPO_URL\","
  echo "  \"undeployed_commits\": ["

  FIRST=true
  while IFS= read -r line; do
    hash=$(echo "$line" | cut -d' ' -f1)
    author=$(echo "$line" | cut -d' ' -f2-)
    message=$(git log --format=%s -n 1 "$hash")

    if [[ "$FIRST" == false ]]; then
      echo ","
    fi
    FIRST=false

    echo -n "    {\"hash\": \"$hash\", \"short_hash\": \"${hash:0:7}\", \"author\": \"$author\", \"message\": \"$message\", \"url\": \"$REPO_URL/commit/$hash\"}"
  done < <(git log --pretty=format:"%H %an" ${DEPLOYED_COMMIT}^..${CURRENT_COMMIT})

  echo ""
  echo "  ]"
  echo "}"
else
  # Human-readable output
  echo "Environment: $ENVIRONMENT"
  echo "Deployed commit: ${DEPLOYED_COMMIT:0:7}"
  echo "Current commit: ${CURRENT_COMMIT:0:7}"
  echo ""
  echo "Undeployed commits ($COMMIT_COUNT):"
  echo "----------------------------------------"

  while IFS= read -r line; do
    hash=$(echo "$line" | awk '{print $1}')
    message=$(echo "$line" | cut -d' ' -f2-)
    short_hash=${hash:0:7}
    echo "  $short_hash - $message"
    echo "    $REPO_URL/commit/$hash"
  done < <(git log --pretty=format:"%H %s" ${DEPLOYED_COMMIT}^..${CURRENT_COMMIT})

  echo ""
  echo "To deploy these commits to $ENVIRONMENT, promote the latest commit."
fi
