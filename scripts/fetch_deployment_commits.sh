#!/bin/bash
set -euo pipefail

# Check if deployment URL is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <deployment_url>"
    exit 1
fi

DEPLOYMENT_URL="$1"
COMMITS_FILE="/tmp/deployment_commits.txt"
# Generate email subject with date and first 7 characters of current commit hash
EMAIL_SUBJECT="$(date '+%Y-%m-%d') Sage deploy to $(git rev-parse HEAD | cut -c1-7)"
EMAIL_RECIPIENT="evergreen-deploys@mongodb.com"

# Fetch the deployed commit hash
DEPLOYED_COMMIT=$(curl -s "$DEPLOYMENT_URL")
CURRENT_COMMIT=$(git rev-parse HEAD)

# Validate commit hashes
if [[ ! "$DEPLOYED_COMMIT" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Invalid deployed commit hash"
    exit 1
fi

# Fetch commits between deployed and current commit
git log --pretty=format:"%H %s" "$DEPLOYED_COMMIT".."$CURRENT_COMMIT" > "$COMMITS_FILE"

# Optional: Print number of commits
COMMIT_COUNT=$(wc -l < "$COMMITS_FILE")
echo "Found $COMMIT_COUNT commits between deployed and current version"

# Prepare email body
EMAIL_BODY="Deployment Details:\n"
EMAIL_BODY+="Previous Commit: https://github.com/evergreen-ci/sage/commit/$DEPLOYED_COMMIT\n"
EMAIL_BODY+="Current Commit: https://github.com/evergreen-ci/sage/commit/$CURRENT_COMMIT\n"
EMAIL_BODY+="Number of Commits: $COMMIT_COUNT\n\n"
EMAIL_BODY+="Commits:\n"

# Generate commit list with GitHub links
while read -r commit; do
    COMMIT_HASH=$(echo "$commit" | awk '{print $1}')
    COMMIT_MESSAGE=$(echo "$commit" | cut -d' ' -f2-)
    EMAIL_BODY+="- [${COMMIT_HASH}](https://github.com/evergreen-ci/sage/commit/${COMMIT_HASH}) ${COMMIT_MESSAGE}\n"
done < "$COMMITS_FILE"

# Prepare HTML email body
HTML_EMAIL_BODY="<!DOCTYPE html>
<html>
<body>
<h2>Deployment Details</h2>
<p>
Previous Commit: <a href='https://github.com/evergreen-ci/sage/commit/$DEPLOYED_COMMIT'>$DEPLOYED_COMMIT</a><br>
Current Commit: <a href='https://github.com/evergreen-ci/sage/commit/$CURRENT_COMMIT'>$CURRENT_COMMIT</a><br>
Number of Commits: $COMMIT_COUNT
</p>

<h3>Commits:</h3>
<ul>"

# Generate HTML commit list
while read -r commit; do
    COMMIT_HASH=$(echo "$commit" | awk '{print $1}')
    COMMIT_MESSAGE=$(echo "$commit" | cut -d' ' -f2-)
    HTML_EMAIL_BODY+="<li><a href='https://github.com/evergreen-ci/sage/commit/${COMMIT_HASH}'>${COMMIT_HASH}</a> ${COMMIT_MESSAGE}</li>"
done < "$COMMITS_FILE"

HTML_EMAIL_BODY+="</ul>

<h3>Revert Instructions</h3>
<p>To Revert, rerun the drone release for <a href='https://github.com/evergreen-ci/sage/commit/${DEPLOYED_COMMIT}'>${DEPLOYED_COMMIT}</a></p>
</body>
</html>"

# Send HTML email
echo -e "$HTML_EMAIL_BODY" | mail -a "Content-Type: text/html" -s "$EMAIL_SUBJECT" "$EMAIL_RECIPIENT"

# Print commits (optional)
echo "Commits:"
cat "$COMMITS_FILE"

# Output file path for reference
echo "Commits saved to $COMMITS_FILE"
echo "Deployment commit email sent to $EMAIL_RECIPIENT"