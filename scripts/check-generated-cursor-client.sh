#!/bin/bash
# Script to verify the generated Cursor API client is up-to-date with the OpenAPI spec.
# This runs in CI to ensure developers regenerate the client when the spec changes.

set -e

echo "Regenerating Cursor API client from OpenAPI spec..."
yarn generate-cursor-client

echo "Checking for changes in generated files..."
if ! git diff --exit-code src/services/cursor/generated/; then
  echo ""
  echo "ERROR: The generated Cursor API client is out of sync with the OpenAPI spec."
  echo ""
  echo "To fix this, run locally:"
  echo "  yarn generate-cursor-client"
  echo ""
  echo "Then commit the updated generated files."
  exit 1
fi

echo "Generated Cursor API client is up-to-date."
