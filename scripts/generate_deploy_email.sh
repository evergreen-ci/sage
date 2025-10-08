#!/bin/bash

if [ -z "$1" ]; then
  echo "Error: Please provide a commit hash"
  echo "Usage: $0 <previous_commit_hash>"
  exit 1
fi

PREV_COMMIT=$1
CURRENT_COMMIT=$(git rev-parse HEAD)
OUTPUT_FILE="temp/deploy_email.html"

mkdir -p temp

# Calculate the repository URL
REPO_URL=$(git config --get remote.origin.url | sed -e 's/\.git$//' -e 's/^git@\([^:]*\):/https:\/\/\1\//')

LIST_ITEMS=""

while read -r hash message; do
  short_hash=${hash:0:7}
  LIST_ITEMS+=$(cat <<EOF
<li><a href="${REPO_URL}/commit/${hash}">${short_hash}</a> ${message}</li>
EOF
)
done < <(git log --pretty=format:"%H %s" ${PREV_COMMIT}^..${CURRENT_COMMIT})

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

echo "$HTML_CONTENT"

echo "$HTML_CONTENT" > "$OUTPUT_FILE"
echo ""
echo "Saved to $OUTPUT_FILE"
