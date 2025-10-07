#!/bin/bash
set -euo pipefail

# Check if deployed commit hash is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <deployed_commit_hash>"
    exit 1
fi

DEPLOYED_COMMIT_INPUT="$1"
COMMITS_FILE="/tmp/deployment_commits.txt"
CURRENT_COMMIT=$(git rev-parse HEAD)

# Expand short SHA to full SHA if needed
if [[ ${#DEPLOYED_COMMIT_INPUT} -eq 7 ]]; then
    echo "Expanding short SHA: $DEPLOYED_COMMIT_INPUT"
    DEPLOYED_COMMIT=$(git rev-parse "$DEPLOYED_COMMIT_INPUT")
else
    DEPLOYED_COMMIT="$DEPLOYED_COMMIT_INPUT"
fi

# Validate commit hashes
if [[ ! "$DEPLOYED_COMMIT" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Invalid deployed commit hash: $DEPLOYED_COMMIT"
    exit 1
fi

# Fetch commits between deployed and current commit
git log --pretty=format:"%H %s" "$DEPLOYED_COMMIT".."$CURRENT_COMMIT" > "$COMMITS_FILE"

# Generate email subject with date and first 7 characters of current commit hash
EMAIL_SUBJECT="$(date '+%Y-%m-%d') Sage deploy to $(echo "$CURRENT_COMMIT" | cut -c1-7)"
EMAIL_RECIPIENT="evergreen-deploys@mongodb.com"

# Print number of commits
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

# Print email template (not sending)
echo ""
echo "========================================="
echo "Email Template (Not Sent)"
echo "========================================="
echo "To: $EMAIL_RECIPIENT"
echo "Subject: $EMAIL_SUBJECT"
echo ""
echo -e "$EMAIL_BODY"
echo ""

# Output HTML to file for reference
HTML_FILE="/tmp/deployment_email.html"
echo "$HTML_EMAIL_BODY" > "$HTML_FILE"
echo "HTML email template saved to $HTML_FILE"

# Print commits
echo ""
echo "Commits:"
cat "$COMMITS_FILE"

# Output file path for reference
echo ""
echo "Commits saved to $COMMITS_FILE"