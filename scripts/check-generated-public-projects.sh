#!/bin/bash
# Script to verify the generated public projects list is up-to-date with Jira.
# This runs in CI to ensure the list stays in sync with the live public projects.

set -e

echo "Regenerating public projects list from Jira API..."
pnpm generate:public-projects

echo "Checking for changes in generated files..."
if ! git diff --exit-code src/generated/public-projects/; then
  echo ""
  echo "ERROR: The public projects list is out of sync with Jira."
  echo ""
  echo "To fix this, run locally:"
  echo "  pnpm generate:public-projects"
  echo ""
  echo "Then commit the updated file."
  exit 1
fi

echo "Public projects list is up-to-date."
