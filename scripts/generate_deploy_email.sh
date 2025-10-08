#!/bin/bash

# Script to generate deployment email HTML from git commits
# Usage: ./generate_deploy_email.sh <previous_commit_hash>

if [ -z "$1" ]; then
  echo "Error: Please provide a commit hash"
  echo "Usage: $0 <previous_commit_hash>"
  exit 1
fi

PREV_COMMIT=$1
CURRENT_COMMIT=$(git rev-parse HEAD)
OUTPUT_FILE="temp/deploy_email.html"

# Create temp directory if it doesn't exist
mkdir -p temp

# Get the repository URL from git config
REPO_URL=$(git config --get remote.origin.url | sed 's/\.git$//' | sed 's/git@github.com:/https:\/\/github.com\//')

# Generate HTML
HTML_CONTENT="<list>
"

# Get commits between previous and current, formatted
while read -r hash message; do
  # Get 7-digit hash
  short_hash=$(echo "$hash" | cut -c1-7)
  HTML_CONTENT+="<a href=\"${REPO_URL}/commit/${hash}\">${short_hash} ${message}</a>
"
done < <(git log --pretty=format:"%H %s" ${PREV_COMMIT}..${CURRENT_COMMIT} --reverse)

HTML_CONTENT+="</list>

To revert, rerun drone release for ${PREV_COMMIT}"

# Print to stdout
echo "$HTML_CONTENT"

# Save to file
echo "$HTML_CONTENT" > "$OUTPUT_FILE"
echo ""
echo "Saved to $OUTPUT_FILE"