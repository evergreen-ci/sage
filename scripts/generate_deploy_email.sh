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

# Get the repository URL, converting SSH (git@host:user/repo) to HTTPS 
# and stripping the .git extension for a clean web link.
# This is more general than the original.
REPO_URL=$(git config --get remote.origin.url | sed -e 's/\.git$//' -e 's/^git@\([^:]*\):/https:\/\/\1\//')

# Store the list items in a temporary variable first
LIST_ITEMS=""

# Get commits between previous and current (exclusive of PREV_COMMIT)
while read -r hash message; do
  short_hash=${hash:0:7}
  # Use a Here-Document to build the safe, unstyled list item
  LIST_ITEMS+=$(cat <<EOF
<li><a href="${REPO_URL}/commit/${hash}">${short_hash}</a> ${message}</li>
EOF
)
done < <(git log --pretty=format:"%H %s" ${PREV_COMMIT}^..${CURRENT_COMMIT})

# Generate final HTML content using a Here-Document for clean output
HTML_CONTENT=$(cat <<EOF
<p>The following changes were deployed:</p>
<ul>
${LIST_ITEMS}
</ul>

<p>
    <strong>Deploying commit:</strong> ${CURRENT_COMMIT:0:7}<br>
    To revert, rerun release for commit: ${PREV_COMMIT:0:7}
</p>
EOF
)

# Print to stdout
echo "$HTML_CONTENT"

# Save to file
echo "$HTML_CONTENT" > "$OUTPUT_FILE"
echo ""
echo "Saved to $OUTPUT_FILE"
