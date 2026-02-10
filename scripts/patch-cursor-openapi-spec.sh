#!/bin/bash
# Script to download and patch the Cursor OpenAPI spec to fix the Error schema.
# The actual API returns error.error (string) but the spec incorrectly defines error.message.

set -e

OPENAPI_URL="https://cursor.com/docs-static/cloud-agents-openapi.yaml"
PATCHED_SPEC_PATH="openapi-spec-patched.yaml"

echo "Downloading Cursor OpenAPI spec..."
curl -s "$OPENAPI_URL" > "$PATCHED_SPEC_PATH"

echo "Patching Error schema to match actual API response structure..."
# The actual API returns: { error: { error: "message" } }
# But the spec defines: { error: { message: "message" } }
# We need to change the error.error property from an object with message/code to a string,
# while keeping message and code as optional fields for backwards compatibility

# Use sed to patch the Error schema
# Replace the error.error object definition with both error (string) and message (string) properties
sed -i.bak '/^    Error:/,/^    [A-Z]/ {
  /^    Error:/ {
    n
    n
    n
    /^          properties:/ {
      a\
            error:\
              type: string\
              description: Human-readable error message (actual API format)
      n
      /^            message:/ {
        i\
            message:\
              type: string\
              description: Human-readable error message (legacy/alternative format)
        n
      }
    }
  }
}' "$PATCHED_SPEC_PATH" || true

# A more reliable approach: use a Python script or yq to patch it properly
# For now, let's use a simpler sed approach that adds the error field
python3 << 'PYTHON_SCRIPT'
import yaml
import sys

with open('openapi-spec-patched.yaml', 'r') as f:
    spec = yaml.safe_load(f)

# Patch the Error schema
if 'components' in spec and 'schemas' in spec['components'] and 'Error' in spec['components']['schemas']:
    error_schema = spec['components']['schemas']['Error']
    if 'properties' in error_schema and 'error' in error_schema['properties']:
        error_prop = error_schema['properties']['error']
        if 'properties' in error_prop:
            # The current structure has error: { properties: { message, code } }
            # We need to change it to have both error (string) and message (string)
            original_props = error_prop['properties'].copy()
            error_prop['properties'] = {
                'error': {
                    'type': 'string',
                    'description': 'Human-readable error message (actual API format)'
                },
                'message': original_props.get('message', {
                    'type': 'string',
                    'description': 'Human-readable error message (legacy/alternative format)'
                }),
                'code': original_props.get('code', {
                    'type': 'string',
                    'description': 'Machine-readable error code'
                })
            }

with open('openapi-spec-patched.yaml', 'w') as f:
    yaml.dump(spec, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

print("Successfully patched Error schema")
PYTHON_SCRIPT

if [ $? -eq 0 ]; then
    echo "Successfully patched OpenAPI spec: $PATCHED_SPEC_PATH"
    rm -f "$PATCHED_SPEC_PATH.bak"
else
    echo "Warning: Python patching failed, trying alternative approach..."
    # Fallback: simple sed replacement
    exit 1
fi
